package com.akhil.billsumthin

import android.content.ContentValues
import android.content.Intent
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.io.FileOutputStream

@CapacitorPlugin(name = "NativeFileExport")
class NativeFileExportPlugin : Plugin() {

    @PluginMethod
    fun saveAndShare(call: PluginCall) {
        val fileName = call.getString("fileName") ?: "BillSumthin.txt"
        val mimeType = call.getString("mimeType") ?: "text/plain"
        val base64Data = call.getString("base64Data")

        if (base64Data.isNullOrBlank()) {
            call.reject("No export data provided.")
            return
        }

        try {
            val bytes = Base64.decode(base64Data, Base64.DEFAULT)

            // Save to MediaStore.Downloads on Android 10+ (no MANAGE_EXTERNAL_STORAGE needed)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                    put(MediaStore.Downloads.MIME_TYPE, mimeType)
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/BillSumthin")
                }
                val uri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                if (uri != null) {
                    context.contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                }
            }

            // Also stage in cache for FileProvider share sheet
            val cacheFile = File(context.cacheDir, fileName)
            FileOutputStream(cacheFile).use { it.write(bytes) }

            val shareUri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                cacheFile
            )
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = mimeType
                putExtra(Intent.EXTRA_STREAM, shareUri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            activity.startActivity(Intent.createChooser(shareIntent, "Export $fileName"))

            call.resolve(JSObject().put("ok", true).put("fileName", fileName))
        } catch (e: Exception) {
            call.reject("Export failed.", e)
        }
    }
}
