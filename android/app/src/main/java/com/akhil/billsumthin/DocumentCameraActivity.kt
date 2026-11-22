package com.akhil.billsumthin

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
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
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class DocumentCameraActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_IMAGE_URI = "extra_image_uri"
        const val EXTRA_AUTO_CORRECTED = "extra_auto_corrected"
        const val EXTRA_DOC_DETECTED = "extra_doc_detected"
    }

    private lateinit var previewView: PreviewView
    private lateinit var flashBtn: TextView
    private lateinit var statusPill: TextView
    private lateinit var frame: View
    private lateinit var gridOverlay: View
    private lateinit var captureBtn: View
    private lateinit var cameraExecutor: ExecutorService

    private var imageCapture: ImageCapture? = null
    private var camera: Camera? = null
    private var flashMode = ImageCapture.FLASH_MODE_AUTO
    private var gridVisible = false
    private var isCapturing = false

    private val ink = Color.rgb(18, 23, 34)
    private val blue = Color.rgb(132, 151, 255)
    private val mutedWhite = Color.rgb(205, 213, 230)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        cameraExecutor = Executors.newSingleThreadExecutor()
        window.statusBarColor = Color.rgb(17, 21, 34)
        window.navigationBarColor = Color.rgb(17, 21, 34)

        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(17, 21, 34))
            fitsSystemWindows = false
        }

        previewView = PreviewView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            scaleType = PreviewView.ScaleType.FILL_CENTER
            implementationMode = PreviewView.ImplementationMode.PERFORMANCE
        }
        root.addView(previewView)

        // A restrained document frame and optional composition grid.
        frame = View(this).apply {
            background = roundedStroke(Color.TRANSPARENT, 25f, Color.argb(225, 142, 173, 255), dp(2))
        }
        val frameParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 0, Gravity.CENTER
        ).apply {
            leftMargin = dp(30); rightMargin = dp(30)
            height = dp(430)
        }
        root.addView(frame, frameParams)

        gridOverlay = object : View(this) {
            private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = 0x66FFFFFF
                strokeWidth = dp(1).toFloat()
            }
            override fun onDraw(canvas: Canvas) {
                super.onDraw(canvas)
                val thirdW = width / 3f
                val thirdH = height / 3f
                canvas.drawLine(thirdW, 0f, thirdW, height.toFloat(), linePaint)
                canvas.drawLine(thirdW * 2, 0f, thirdW * 2, height.toFloat(), linePaint)
                canvas.drawLine(0f, thirdH, width.toFloat(), thirdH, linePaint)
                canvas.drawLine(0f, thirdH * 2, width.toFloat(), thirdH * 2, linePaint)
            }
        }.apply { visibility = View.GONE }
        root.addView(gridOverlay, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(430), Gravity.CENTER
        ).apply { leftMargin = dp(30); rightMargin = dp(30) })

        // Top glass toolbar.
        val top = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(18), dp(16), dp(18), dp(12))
            background = glassPanel(0xB8141926.toInt(), 30f)
            elevation = dp(12).toFloat()
        }
        val topParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP
        ).apply { setMargins(dp(14), dp(38), dp(14), 0) }

        val close = roundAction("×", 48).apply {
            contentDescription = "Close camera"
            setOnClickListener { setResult(Activity.RESULT_CANCELED); finish() }
        }
        top.addView(close, LinearLayout.LayoutParams(dp(48), dp(48)))

        val heading = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(8), 0, dp(8), 0)
        }
        heading.addView(label("Scan a bill", 18f, Color.WHITE, true))
        heading.addView(label("Position the whole receipt", 11f, mutedWhite, false).apply {
            setPadding(0, dp(3), 0, 0)
        })
        top.addView(heading, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))

        flashBtn = roundAction("ϟ  AUTO", 48).apply {
            textSize = 12f
            setOnClickListener { cycleFlashMode() }
        }
        top.addView(flashBtn, LinearLayout.LayoutParams(dp(86), dp(48)))
        root.addView(top, topParams)

        // Detection hint floats just below the document frame.
        statusPill = label("✦   READY WHEN YOU ARE     ·     Keep the full bill in frame", 11f, Color.WHITE, true).apply {
            gravity = Gravity.CENTER
            setPadding(dp(16), dp(12), dp(16), dp(12))
            background = glassPanel(0xD91B2634.toInt(), 24f)
            elevation = dp(10).toFloat()
        }
        root.addView(statusPill, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER
        ).apply { topMargin = dp(270) })

        // Bottom controls sit in a soft glass dock.
        val dock = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(22), dp(20), dp(22), dp(26))
            background = GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(0xE91D263B.toInt(), 0xF5161D2E.toInt())
            ).apply {
                cornerRadii = floatArrayOf(dp(30).toFloat(), dp(30).toFloat(), dp(30).toFloat(), dp(30).toFloat(), 0f, 0f, 0f, 0f)
                setStroke(dp(1), 0x36FFFFFF)
            }
            elevation = dp(18).toFloat()
        }
        val dockParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM
        ).apply { setMargins(dp(10), 0, dp(10), dp(8)) }

        val controlRow = LinearLayout(this).apply {
            gravity = Gravity.CENTER
            orientation = LinearLayout.HORIZONTAL
        }
        val galleryBtn = roundAction("▣", 58).apply {
            contentDescription = "Choose a bill from gallery"
            setOnClickListener { openGallery() }
        }
        controlRow.addView(galleryBtn, LinearLayout.LayoutParams(dp(58), dp(58)))
        val spacer = View(this)
        controlRow.addView(spacer, LinearLayout.LayoutParams(0, 1, 1f))

        captureBtn = FrameLayout(this).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.WHITE)
                setStroke(dp(5), 0x66FFFFFF)
            }
            elevation = dp(14).toFloat()
            contentDescription = "Capture bill"
            isClickable = true
            isFocusable = true
            setOnClickListener { takePhoto() }
            addView(View(this@DocumentCameraActivity).apply {
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(0xFFF4F6FC.toInt())
                    setStroke(dp(1), 0xFFCFD8F2.toInt())
                }
            }, FrameLayout.LayoutParams(dp(48), dp(48), Gravity.CENTER))
        }
        controlRow.addView(captureBtn, LinearLayout.LayoutParams(dp(82), dp(82)))
        val spacer2 = View(this)
        controlRow.addView(spacer2, LinearLayout.LayoutParams(0, 1, 1f))
        val gridBtn = roundAction("⊞", 58).apply {
            contentDescription = "Toggle framing grid"
            setOnClickListener {
                gridVisible = !gridVisible
                gridOverlay.visibility = if (gridVisible) View.VISIBLE else View.GONE
                text = if (gridVisible) "⊟" else "⊞"
                statusPill.text = if (gridVisible) "GRID ON   •   Align the bill edges" else "READY TO SCAN   •   Keep bill in frame"
            }
        }
        controlRow.addView(gridBtn, LinearLayout.LayoutParams(dp(58), dp(58)))
        dock.addView(controlRow)

        dock.addView(label("TAP TO CAPTURE  ·  ORIGINAL QUALITY", 9f, mutedWhite, true).apply {
            letterSpacing = .16f
            gravity = Gravity.CENTER
            setPadding(0, dp(12), 0, dp(2))
        })
        root.addView(dock, dockParams)

        setContentView(root)
        startCamera()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun label(text: String, size: Float, color: Int, bold: Boolean): TextView =
        TextView(this).apply {
            this.text = text
            textSize = size
            setTextColor(color)
            typeface = if (bold) Typeface.create("sans-serif", Typeface.BOLD) else Typeface.create("sans-serif", Typeface.NORMAL)
            includeFontPadding = false
        }

    private fun glassPanel(color: Int, radius: Float) = GradientDrawable(
        GradientDrawable.Orientation.TOP_BOTTOM,
        intArrayOf(0xD934405C.toInt(), color)
    ).apply {
        cornerRadius = dp(radius.toInt()).toFloat()
        setStroke(dp(1), 0x42FFFFFF)
    }

    private fun roundedStroke(color: Int, radius: Float, stroke: Int, width: Int) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = dp(radius.toInt()).toFloat()
        setStroke(width, stroke)
    }

    private fun roundAction(textValue: String, size: Int): TextView =
        label(textValue, 17f, Color.WHITE, true).apply {
            gravity = Gravity.CENTER
            background = glassPanel(0xA9273042.toInt(), 28f)
            elevation = dp(5).toFloat()
            isClickable = true
            isFocusable = true
            setPadding(dp(4), 0, dp(4), 0)
        }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()
            val preview = Preview.Builder().build().also {
                it.surfaceProvider = previewView.surfaceProvider
            }
            val stillResolution = ResolutionSelector.Builder()
                .setResolutionStrategy(ResolutionStrategy.HIGHEST_AVAILABLE_STRATEGY)
                .build()
            val capture = ImageCapture.Builder()
                .setResolutionSelector(stillResolution)
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                .setFlashMode(flashMode)
                .build()
            imageCapture = capture
            try {
                cameraProvider.unbindAll()
                camera = cameraProvider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, preview, capture)
                val hasFlash = camera?.cameraInfo?.hasFlashUnit() ?: false
                flashBtn.isEnabled = hasFlash
                if (!hasFlash) {
                    flashBtn.text = "ϟ  N/A"
                    flashBtn.alpha = .45f
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
            ImageCapture.FLASH_MODE_AUTO -> "ϟ  AUTO"
            ImageCapture.FLASH_MODE_ON -> "ϟ  ON"
            else -> "ϟ  OFF"
        }
    }

    private fun openGallery() {
        val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
            type = "image/*"
            addCategory(Intent.CATEGORY_OPENABLE)
        }
        startActivityForResult(Intent.createChooser(intent, "Choose a bill image"), 721)
    }

    @Deprecated("Handled for compatibility with the existing Android activity")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != 721 || resultCode != Activity.RESULT_OK) return
        val uri = data?.data ?: return
        try {
            val cached = File(cacheDir, "bill_gallery_${System.currentTimeMillis()}.jpg")
            contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(cached).use { output -> input.copyTo(output) }
            } ?: throw IllegalStateException("Unable to read selected image")
            val corrected = PerspectiveCorrector.processFile(cached)
            val result = Intent().apply {
                putExtra(EXTRA_IMAGE_URI, Uri.fromFile(corrected.file).toString())
                putExtra(EXTRA_AUTO_CORRECTED, corrected.autoCorrected)
                putExtra(EXTRA_DOC_DETECTED, corrected.documentDetected)
            }
            setResult(Activity.RESULT_OK, result)
            finish()
        } catch (e: Exception) {
            statusPill.text = "Could not open image — try again"
        }
    }

    private fun takePhoto() {
        if (isCapturing) return
        val capture = imageCapture ?: return
        isCapturing = true
        captureBtn.alpha = .55f
        statusPill.text = "◌   PROCESSING YOUR BILL…"
        val photoFile = File(cacheDir, "bill_cap_${System.currentTimeMillis()}.jpg")
        val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()
        capture.takePicture(outputOptions, cameraExecutor, object : ImageCapture.OnImageSavedCallback {
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
                    isCapturing = false
                    captureBtn.alpha = 1f
                    statusPill.text = "Capture failed — please try again"
                }
            }
        })
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }
}
