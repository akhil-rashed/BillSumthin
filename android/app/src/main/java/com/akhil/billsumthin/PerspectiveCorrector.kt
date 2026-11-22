package com.akhil.billsumthin

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.min

object PerspectiveCorrector {

    data class Result(
        val file: File,
        val documentDetected: Boolean,
        val autoCorrected: Boolean
    )

    fun processFile(inputFile: File): Result {
        return try {
            val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(inputFile.absolutePath, opts)
            val maxDim = max(opts.outWidth, opts.outHeight)
            var sampleSize = 1
            while (maxDim / sampleSize > 2200) {
                sampleSize *= 2
            }
            val decodeOpts = BitmapFactory.Options().apply { inSampleSize = sampleSize }
            val original = BitmapFactory.decodeFile(inputFile.absolutePath, decodeOpts)
                ?: return Result(inputFile, documentDetected = false, autoCorrected = false)

            val bounds = detectBrightDocumentBounds(original)
            if (bounds == null) {
                return Result(inputFile, documentDetected = false, autoCorrected = false)
            }

            val cropped = Bitmap.createBitmap(
                original,
                bounds.left,
                bounds.top,
                bounds.width(),
                bounds.height()
            )
            val enhanced = applySubtleReadabilityBoost(cropped)
            val outFile = File(inputFile.parentFile, "bill_proc_${System.currentTimeMillis()}.jpg")
            FileOutputStream(outFile).use { fos ->
                enhanced.compress(Bitmap.CompressFormat.JPEG, 92, fos)
            }
            if (enhanced != cropped) enhanced.recycle()
            if (cropped != original) cropped.recycle()
            original.recycle()

            Result(outFile, documentDetected = true, autoCorrected = true)
        } catch (e: Exception) {
            Result(inputFile, documentDetected = false, autoCorrected = false)
        }
    }

    private fun detectBrightDocumentBounds(bmp: Bitmap): android.graphics.Rect? {
        val w = bmp.width
        val h = bmp.height
        val step = max(4, min(w, h) / 120)
        var minX = w
        var minY = h
        var maxX = 0
        var maxY = 0
        var brightCount = 0
        var totalSamples = 0

        for (y in 0 until h step step) {
            for (x in 0 until w step step) {
                val px = bmp.getPixel(x, y)
                val r = (px shr 16) and 0xFF
                val g = (px shr 8) and 0xFF
                val b = px and 0xFF
                val luma = (0.299 * r + 0.587 * g + 0.114 * b)
                totalSamples++
                if (luma > 145) {
                    brightCount++
                    if (x < minX) minX = x
                    if (y < minY) minY = y
                    if (x > maxX) maxX = x
                    if (y > maxY) maxY = y
                }
            }
        }

        if (totalSamples == 0 || brightCount < totalSamples * 0.15) return null
        val padX = (w * 0.02).toInt()
        val padY = (h * 0.02).toInt()
        val left = max(0, minX - padX)
        val top = max(0, minY - padY)
        val right = min(w, maxX + padX)
        val bottom = min(h, maxY + padY)

        if (right - left < w * 0.35 || bottom - top < h * 0.35) return null
        if (left == 0 && top == 0 && right == w && bottom == h) return null
        return android.graphics.Rect(left, top, right, bottom)
    }

    private fun applySubtleReadabilityBoost(src: Bitmap): Bitmap {
        val out = Bitmap.createBitmap(src.width, src.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(out)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        val cm = ColorMatrix().apply {
            // Gentle 1.12 contrast boost without destroying original document appearance
            val contrast = 1.12f
            val translate = (-0.5f * contrast + 0.5f) * 255f
            set(
                floatArrayOf(
                    contrast, 0f, 0f, 0f, translate,
                    0f, contrast, 0f, 0f, translate,
                    0f, 0f, contrast, 0f, translate,
                    0f, 0f, 0f, 1f, 0f
                )
            )
        }
        paint.colorFilter = ColorMatrixColorFilter(cm)
        canvas.drawBitmap(src, 0f, 0f, paint)
        return out
    }
}
