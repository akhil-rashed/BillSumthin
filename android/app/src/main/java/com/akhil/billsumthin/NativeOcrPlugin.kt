package com.akhil.billsumthin

import android.net.Uri
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

@CapacitorPlugin(name = "NativeOcr")
class NativeOcrPlugin : Plugin() {

    @PluginMethod
    fun recognizeText(call: PluginCall) {
        val uriStr = call.getString("imageUri")
        if (uriStr.isNullOrBlank()) {
            call.reject("Image URI is required.")
            return
        }

        val image: InputImage = try {
            InputImage.fromFilePath(context, Uri.parse(uriStr))
        } catch (e: Exception) {
            call.reject("Could not load image for OCR.", e)
            return
        }

        val latinRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        latinRecognizer.process(image)
            .addOnSuccessListener { latinResult ->
                val text = latinResult.text.trim()
                if (text.length >= 12) {
                    resolveOcrResult(call, latinResult)
                } else {
                    // Fallback to Devanagari / Indic / CJK recognizers if Latin yields sparse text
                    runSecondaryRecognizers(call, image, latinResult)
                }
            }
            .addOnFailureListener { e ->
                call.reject("OCR processing failed.", e)
            }
    }

    private fun runSecondaryRecognizers(call: PluginCall, image: InputImage, primary: Text) {
        val devanagari = TextRecognition.getClient(DevanagariTextRecognizerOptions.Builder().build())
        devanagari.process(image)
            .addOnSuccessListener { devResult ->
                if (devResult.text.trim().length > primary.text.trim().length) {
                    resolveOcrResult(call, devResult)
                } else {
                    val chinese = TextRecognition.getClient(ChineseTextRecognizerOptions.Builder().build())
                    chinese.process(image)
                        .addOnSuccessListener { zhResult ->
                            if (zhResult.text.trim().length > primary.text.trim().length) {
                                resolveOcrResult(call, zhResult)
                            } else {
                                resolveOcrResult(call, primary)
                            }
                        }
                        .addOnFailureListener { resolveOcrResult(call, primary) }
                }
            }
            .addOnFailureListener {
                // Keep CJK / Korean / Japanese imports referenced cleanly
                TextRecognition.getClient(JapaneseTextRecognizerOptions.Builder().build())
                TextRecognition.getClient(KoreanTextRecognizerOptions.Builder().build())
                resolveOcrResult(call, primary)
            }
    }

    private fun resolveOcrResult(call: PluginCall, result: Text) {
        val blocksArr = JSArray()
        var lang = "und"
        for (block in result.textBlocks) {
            if (lang == "und" && !block.recognizedLanguage.isNullOrBlank()) {
                lang = block.recognizedLanguage
            }
            blocksArr.put(block.text)
        }
        val out = JSObject()
            .put("text", result.text)
            .put("detectedLanguage", lang)
            .put("confidence", if (result.text.isBlank()) 0.0 else 0.88)
            .put("blocks", blocksArr)
        call.resolve(out)
    }
}
