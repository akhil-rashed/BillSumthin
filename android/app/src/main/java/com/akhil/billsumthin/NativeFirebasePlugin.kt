package com.akhil.billsumthin

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
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
                        .put("idToken", tokenRes.token ?: "")
                )
            }
            .addOnFailureListener {
                call.resolve(JSObject().put("signedIn", true).put("uid", user.uid))
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
