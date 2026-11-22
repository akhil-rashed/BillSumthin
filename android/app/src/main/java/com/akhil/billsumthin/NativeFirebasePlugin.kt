package com.akhil.billsumthin

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.ActivityResult
import com.getcapacitor.annotation.ActivityCallback
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import org.json.JSONObject

@CapacitorPlugin(name = "NativeFirebase")
class NativeFirebasePlugin : Plugin() {

    private val auth by lazy { FirebaseAuth.getInstance() }
    private val db by lazy { FirebaseFirestore.getInstance() }

    @PluginMethod
    fun getAuthState(call: PluginCall) {
        val user = auth.currentUser
        if (user == null) {
            call.resolve(JSObject().put("signedIn", false))
            return
        }
        user.getIdToken(false)
            .addOnSuccessListener { tokenRes ->
                call.resolve(
                    JSObject()
                        .put("signedIn", true)
                        .put("uid", user.uid)
                        .put("email", user.email ?: "")
                        .put("displayName", user.displayName ?: "")
                        .put("idToken", tokenRes.token ?: "")
                )
            }
            .addOnFailureListener {
                call.resolve(JSObject().put("signedIn", true).put("uid", user.uid)
                    .put("email", user.email ?: "").put("displayName", user.displayName ?: ""))
            }
    }

    @PluginMethod
    fun signInWithGoogle(call: PluginCall) {
        try {
            val webClientId = context.getString(R.string.default_web_client_id)
            if (webClientId.isBlank()) {
                call.reject("Google sign-in is missing the Web OAuth client ID. Check google-services.json.")
                return
            }
            val options = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(webClientId)
                .requestEmail()
                .build()
            val client = GoogleSignIn.getClient(activity, options)
            startActivityForResult(call, client.signInIntent, "googleSignInResult")
        } catch (e: Exception) {
            call.reject(e.localizedMessage ?: "Could not start Google sign-in.")
        }
    }

    @ActivityCallback
    private fun googleSignInResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode != android.app.Activity.RESULT_OK || result.data == null) {
            call.reject("Google sign-in was cancelled.")
            return
        }
        try {
            val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
            val account = task.getResult(ApiException::class.java)
            val idToken = account.idToken
            if (idToken.isNullOrBlank()) {
                call.reject("Google did not return an ID token. Check the Web OAuth client configuration.")
                return
            }
            val credential = GoogleAuthProvider.getCredential(idToken, null)
            auth.signInWithCredential(credential)
                .addOnSuccessListener { res -> resolveUser(call, res.user) }
                .addOnFailureListener { e -> call.reject(e.localizedMessage ?: "Firebase Google sign-in failed.") }
        } catch (e: ApiException) {
            call.reject("Google sign-in failed (code ${e.statusCode}). ${e.localizedMessage ?: ""}")
        } catch (e: Exception) {
            call.reject(e.localizedMessage ?: "Google sign-in failed.")
        }
    }

    @PluginMethod
    fun signInAnonymously(call: PluginCall) {
        val current = auth.currentUser
        if (current != null) {
            call.resolve(JSObject().put("signedIn", true).put("uid", current.uid))
            return
        }
        auth.signInAnonymously()
            .addOnSuccessListener { res ->
                call.resolve(JSObject().put("signedIn", true).put("uid", res.user?.uid ?: ""))
            }
            .addOnFailureListener { e ->
                call.reject("Firebase sign-in failed.", e)
            }
    }


    @PluginMethod
    fun createAccount(call: PluginCall) {
        val email = call.getString("email")?.trim().orEmpty()
        val password = call.getString("password").orEmpty()
        if (email.isBlank() || password.length < 6) {
            call.reject("Enter a valid email and a password with at least 6 characters.")
            return
        }
        auth.createUserWithEmailAndPassword(email, password)
            .addOnSuccessListener { result -> resolveUser(call, result.user) }
            .addOnFailureListener { e -> call.reject(e.localizedMessage ?: "Could not create account.") }
    }

    @PluginMethod
    fun signInWithEmail(call: PluginCall) {
        val email = call.getString("email")?.trim().orEmpty()
        val password = call.getString("password").orEmpty()
        if (email.isBlank() || password.isBlank()) {
            call.reject("Enter your email and password.")
            return
        }
        auth.signInWithEmailAndPassword(email, password)
            .addOnSuccessListener { result -> resolveUser(call, result.user) }
            .addOnFailureListener { e -> call.reject(e.localizedMessage ?: "Sign-in failed.") }
    }

    @PluginMethod
    fun signOut(call: PluginCall) {
        auth.signOut()
        call.resolve(JSObject().put("signedOut", true))
    }

    private fun resolveUser(call: PluginCall, user: com.google.firebase.auth.FirebaseUser?) {
        if (user == null) {
            call.reject("Firebase did not return an account.")
            return
        }
        user.getIdToken(true)
            .addOnSuccessListener { token ->
                call.resolve(JSObject()
                    .put("signedIn", true)
                    .put("uid", user.uid)
                    .put("email", user.email ?: "")
                    .put("displayName", user.displayName ?: "")
                    .put("idToken", token.token ?: ""))
            }
            .addOnFailureListener { call.resolve(JSObject()
                .put("signedIn", true).put("uid", user.uid).put("email", user.email ?: "")) }
    }

    @PluginMethod
    fun saveBill(call: PluginCall) {
        val uid = auth.currentUser?.uid
        val jsonStr = call.getString("billJson")
        if (uid.isNullOrBlank() || jsonStr.isNullOrBlank()) {
            call.resolve(JSObject().put("synced", false))
            return
        }
        try {
            val obj = JSONObject(jsonStr)
            val billId = obj.optString("id")
            if (billId.isBlank()) {
                call.resolve(JSObject().put("synced", false))
                return
            }
            val map = hashMapOf<String, Any?>(
                "id" to billId,
                "documentType" to obj.optString("documentType"),
                "provider" to obj.optString("provider"),
                "total" to obj.optDouble("total", 0.0),
                "currencyCode" to obj.optString("currencyCode"),
                "category" to obj.optString("category"),
                "issueDate" to obj.opt("issueDate"),
                "dueDate" to obj.opt("dueDate"),
                "updatedAt" to obj.optString("updatedAt")
            )
            db.collection("users").document(uid).collection("bills").document(billId)
                .set(map)
                .addOnSuccessListener { call.resolve(JSObject().put("synced", true)) }
                .addOnFailureListener { call.resolve(JSObject().put("synced", false)) }
        } catch (e: Exception) {
            call.resolve(JSObject().put("synced", false))
        }
    }

    @PluginMethod
    fun clearUserBills(call: PluginCall) {
        val uid = auth.currentUser?.uid
        if (uid.isNullOrBlank()) {
            call.resolve(JSObject().put("deleted", false))
            return
        }
        db.collection("users").document(uid).collection("bills").get()
            .addOnSuccessListener { snap ->
                val batch = db.batch()
                for (doc in snap.documents) batch.delete(doc.reference)
                batch.commit()
                    .addOnSuccessListener { call.resolve(JSObject().put("deleted", true)) }
                    .addOnFailureListener { call.resolve(JSObject().put("deleted", false)) }
            }
            .addOnFailureListener { call.resolve(JSObject().put("deleted", false)) }
    }
}
