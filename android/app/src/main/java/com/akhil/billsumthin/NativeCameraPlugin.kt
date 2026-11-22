package com.akhil.billsumthin

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.File
import java.io.FileOutputStream

@CapacitorPlugin(
    name = "NativeCamera",
    permissions = [
        Permission(strings = [Manifest.permission.CAMERA], alias = "camera")
    ]
)
class NativeCameraPlugin : Plugin() {

    @PluginMethod
    fun openCamera(call: PluginCall) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            requestPermissionForAlias("camera", call, "cameraPermissionCallback")
            return
        }
        launchCameraActivity(call)
    }

    @PermissionCallback
    private fun cameraPermissionCallback(call: PluginCall) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            launchCameraActivity(call)
        } else {
            call.reject("Camera permission denied.")
        }
    }

    private fun launchCameraActivity(call: PluginCall) {
        val intent = Intent(context, DocumentCameraActivity::class.java)
        startActivityForResult(call, intent, "handleCameraResult")
    }

    @ActivityCallback
    private fun handleCameraResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK || result.data == null) {
            call.resolve(JSObject().put("cancelled", true))
            return
        }
        val uriStr = result.data?.getStringExtra(DocumentCameraActivity.EXTRA_IMAGE_URI)
        val autoCorrected = result.data?.getBooleanExtra(DocumentCameraActivity.EXTRA_AUTO_CORRECTED, false) ?: false
        val docDetected = result.data?.getBooleanExtra(DocumentCameraActivity.EXTRA_DOC_DETECTED, false) ?: false

        if (uriStr.isNullOrBlank()) {
            call.resolve(JSObject().put("cancelled", true))
            return
        }
        call.resolve(
            JSObject()
                .put("imageUri", uriStr)
                .put("autoCorrected", autoCorrected)
                .put("documentDetected", docDetected)
        )
    }

    @PluginMethod
    fun pickImage(call: PluginCall) {
        val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
            type = "image/*"
            addCategory(Intent.CATEGORY_OPENABLE)
        }
        startActivityForResult(call, Intent.createChooser(intent, "Select bill image"), "handlePickResult")
    }

    @ActivityCallback
    private fun handlePickResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val uri: Uri? = result.data?.data
        if (result.resultCode != Activity.RESULT_OK || uri == null) {
            call.resolve(JSObject().put("cancelled", true))
            return
        }
        try {
            val cachedFile = copyUriToCache(uri)
            val corrected = PerspectiveCorrector.processFile(cachedFile)
            call.resolve(
                JSObject()
                    .put("imageUri", Uri.fromFile(corrected.file).toString())
                    .put("autoCorrected", corrected.autoCorrected)
                    .put("documentDetected", corrected.documentDetected)
            )
        } catch (e: Exception) {
            call.reject("Could not read selected image.", e)
        }
    }

    @PluginMethod
    fun openAppSettings(call: PluginCall) {
        val intent = Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", context.packageName, null)
        )
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        call.resolve()
    }

    private fun copyUriToCache(uri: Uri): File {
        val outFile = File(context.cacheDir, "bill_pick_${System.currentTimeMillis()}.jpg")
        context.contentResolver.openInputStream(uri)?.use { input ->
            FileOutputStream(outFile).use { output ->
                input.copyTo(output)
            }
        } ?: throw IllegalStateException("Unable to open image stream")
        return outFile
    }
}
