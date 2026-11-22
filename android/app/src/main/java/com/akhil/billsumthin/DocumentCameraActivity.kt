package com.akhil.billsumthin

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class DocumentCameraActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_IMAGE_URI = "extra_image_uri"
        const val EXTRA_AUTO_CORRECTED = "extra_auto_corrected"
        const val EXTRA_DOC_DETECTED = "extra_doc_detected"
    }

    private lateinit var previewView: PreviewView
    private lateinit var flashBtn: Button
    private lateinit var statusPill: TextView
    private lateinit var cameraExecutor: ExecutorService

    private var imageCapture: ImageCapture? = null
    private var camera: Camera? = null
    private var flashMode = ImageCapture.FLASH_MODE_AUTO

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        cameraExecutor = Executors.newSingleThreadExecutor()

        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
        }

        previewView = PreviewView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }
        root.addView(previewView)

        // Top bar with Close & Document Status Pill
        val topBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(36, 72, 36, 24)
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.TOP
            )
        }

        val closeBtn = Button(this).apply {
            text = "Close"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#66000000"))
            setOnClickListener {
                setResult(Activity.RESULT_CANCELED)
                finish()
            }
        }

        statusPill = TextView(this).apply {
            text = "Align bill within frame"
            setTextColor(Color.WHITE)
            textSize = 13f
            setPadding(28, 14, 28, 14)
            setBackgroundColor(Color.parseColor("#9912151A"))
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginStart = 24
                marginEnd = 24
            }
        }

        flashBtn = Button(this).apply {
            text = "Flash: Auto"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#66000000"))
            setOnClickListener { cycleFlashMode() }
        }

        topBar.addView(closeBtn)
        topBar.addView(statusPill)
        topBar.addView(flashBtn)
        root.addView(topBar)

        // Bottom Capture Bar
        val bottomBar = FrameLayout(this).apply {
            setPadding(36, 28, 36, 64)
            setBackgroundColor(Color.parseColor("#CC0B0D10"))
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM
            )
        }

        val captureBtn = Button(this).apply {
            text = "Capture Bill"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#2563EB"))
            textSize = 16f
            setPadding(48, 28, 48, 28)
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
            )
            setOnClickListener { takePhoto() }
        }
        bottomBar.addView(captureBtn)
        root.addView(bottomBar)

        setContentView(root)
        startCamera()
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()
            val preview = Preview.Builder().build().also {
                it.surfaceProvider = previewView.surfaceProvider
            }

            val capture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                .setFlashMode(flashMode)
                .build()
            imageCapture = capture

            val selector = CameraSelector.DEFAULT_BACK_CAMERA
            try {
                cameraProvider.unbindAll()
                camera = cameraProvider.bindToLifecycle(this, selector, preview, capture)
                val hasFlash = camera?.cameraInfo?.hasFlashUnit() ?: false
                flashBtn.isEnabled = hasFlash
                if (!hasFlash) {
                    flashBtn.text = "No Flash"
                    flashBtn.alpha = 0.45f
                }
            } catch (e: Exception) {
                setResult(Activity.RESULT_CANCELED)
                finish()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun cycleFlashMode() {
        flashMode = when (flashMode) {
            ImageCapture.FLASH_MODE_AUTO -> ImageCapture.FLASH_MODE_ON
            ImageCapture.FLASH_MODE_ON -> ImageCapture.FLASH_MODE_OFF
            else -> ImageCapture.FLASH_MODE_AUTO
        }
        imageCapture?.flashMode = flashMode
        flashBtn.text = when (flashMode) {
            ImageCapture.FLASH_MODE_AUTO -> "Flash: Auto"
            ImageCapture.FLASH_MODE_ON -> "Flash: On"
            else -> "Flash: Off"
        }
    }

    private fun takePhoto() {
        val capture = imageCapture ?: return
        val photoFile = File(cacheDir, "bill_cap_${System.currentTimeMillis()}.jpg")
        val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

        statusPill.text = "Processing document..."
        capture.takePicture(
            outputOptions,
            cameraExecutor,
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                    val result = PerspectiveCorrector.processFile(photoFile)
                    runOnUiThread {
                        val data = Intent().apply {
                            putExtra(EXTRA_IMAGE_URI, Uri.fromFile(result.file).toString())
                            putExtra(EXTRA_AUTO_CORRECTED, result.autoCorrected)
                            putExtra(EXTRA_DOC_DETECTED, result.documentDetected)
                        }
                        setResult(Activity.RESULT_OK, data)
                        finish()
                    }
                }

                override fun onError(exception: ImageCaptureException) {
                    runOnUiThread {
                        setResult(Activity.RESULT_CANCELED)
                        finish()
                    }
                }
            }
        )
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }
}
