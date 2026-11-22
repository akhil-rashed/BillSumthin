package com.akhil.billsumthin

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
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
import java.io.FileOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/** Simple rule-of-thirds grid drawn over the camera preview. */
class GridOverlayView(context: Context) : View(context) {
    private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG)

    init {
        linePaint.color = Color.argb(102, 255, 255, 255)
        linePaint.strokeWidth = 2f
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        val thirdW = w / 3f
        val thirdH = h / 3f
        canvas.drawLine(thirdW, 0f, thirdW, h, linePaint)
        canvas.drawLine(thirdW * 2f, 0f, thirdW * 2f, h, linePaint)
        canvas.drawLine(0f, thirdH, w, thirdH, linePaint)
        canvas.drawLine(0f, thirdH * 2f, w, thirdH * 2f, linePaint)
    }
}

class DocumentCameraActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_IMAGE_URI = "extra_image_uri"
        const val EXTRA_AUTO_CORRECTED = "extra_auto_corrected"
        const val EXTRA_DOC_DETECTED = "extra_doc_detected"
    }

    private lateinit var previewView: PreviewView
    private lateinit var flashBtn: TextView
    private lateinit var statusPill: TextView
    private lateinit var gridOverlay: View
    private lateinit var captureBtn: View
    private lateinit var cameraExecutor: ExecutorService

    private var imageCapture: ImageCapture? = null
    private var camera: Camera? = null
    private var flashMode: Int = ImageCapture.FLASH_MODE_AUTO
    private var gridVisible: Boolean = false
    private var isCapturing: Boolean = false

    private val mutedWhite: Int = Color.rgb(205, 213, 230)

    private val galleryLauncher =
        registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
            if (uri != null) handleGalleryImage(uri)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        cameraExecutor = Executors.newSingleThreadExecutor()
        window.statusBarColor = Color.rgb(17, 21, 34)
        window.navigationBarColor = Color.rgb(17, 21, 34)

        val root = FrameLayout(this)
        root.setBackgroundColor(Color.rgb(17, 21, 34))

        previewView = PreviewView(this)
        previewView.layoutParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
        previewView.scaleType = PreviewView.ScaleType.FILL_CENTER
        previewView.implementationMode = PreviewView.ImplementationMode.PERFORMANCE
        root.addView(previewView)

        // Document frame
        val frame = View(this)
        frame.background = roundedStroke(Color.TRANSPARENT, 25, Color.argb(225, 142, 173, 255), dp(2))
        val frameParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(430), Gravity.CENTER)
        frameParams.leftMargin = dp(30)
        frameParams.rightMargin = dp(30)
        root.addView(frame, frameParams)

        // Optional grid
        gridOverlay = GridOverlayView(this)
        gridOverlay.visibility = View.GONE
        val gridParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(430), Gravity.CENTER)
        gridParams.leftMargin = dp(30)
        gridParams.rightMargin = dp(30)
        root.addView(gridOverlay, gridParams)

        // Top toolbar
        val top = LinearLayout(this)
        top.orientation = LinearLayout.HORIZONTAL
        top.gravity = Gravity.CENTER_VERTICAL
        top.setPadding(dp(18), dp(16), dp(18), dp(12))
        top.background = glassPanel(Color.argb(184, 20, 25, 38), 30)
        top.elevation = dp(12).toFloat()
        val topParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP
        )
        topParams.setMargins(dp(14), dp(38), dp(14), 0)

        val closeBtn = roundAction("×")
        closeBtn.contentDescription = "Close camera"
        closeBtn.setOnClickListener {
            this@DocumentCameraActivity.setResult(Activity.RESULT_CANCELED)
            this@DocumentCameraActivity.finish()
        }
        top.addView(closeBtn, LinearLayout.LayoutParams(dp(48), dp(48)))

        val heading = LinearLayout(this)
        heading.orientation = LinearLayout.VERTICAL
        heading.gravity = Gravity.CENTER
        heading.setPadding(dp(8), 0, dp(8), 0)
        heading.addView(label("Scan a bill", 18f, Color.WHITE, true))
        val subtitle = label("Position the whole receipt", 11f, mutedWhite, false)
        subtitle.setPadding(0, dp(3), 0, 0)
        heading.addView(subtitle)
        top.addView(heading, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))

        flashBtn = roundAction("ϟ  AUTO")
        flashBtn.textSize = 12f
        flashBtn.setOnClickListener { cycleFlashMode() }
        top.addView(flashBtn, LinearLayout.LayoutParams(dp(86), dp(48)))
        root.addView(top, topParams)

        // Status pill
        statusPill = label("READY WHEN YOU ARE  ·  Keep the full bill in frame", 11f, Color.WHITE, true)
        statusPill.gravity = Gravity.CENTER
        statusPill.setPadding(dp(16), dp(12), dp(16), dp(12))
        statusPill.background = glassPanel(Color.argb(217, 27, 38, 52), 24)
        statusPill.elevation = dp(10).toFloat()
        val pillParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER
        )
        pillParams.topMargin = dp(270)
        root.addView(statusPill, pillParams)

        // Bottom dock
        val dock = LinearLayout(this)
        dock.orientation = LinearLayout.VERTICAL
        dock.gravity = Gravity.CENTER
        dock.setPadding(dp(22), dp(20), dp(22), dp(26))
        val dockBg = GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(Color.argb(233, 29, 38, 59), Color.argb(245, 22, 29, 46))
        )
        val r = dp(30).toFloat()
        dockBg.cornerRadii = floatArrayOf(r, r, r, r, 0f, 0f, 0f, 0f)
        dockBg.setStroke(dp(1), Color.argb(54, 255, 255, 255))
        dock.background = dockBg
        dock.elevation = dp(18).toFloat()
        val dockParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM
        )
        dockParams.setMargins(dp(10), 0, dp(10), dp(8))

        val controlRow = LinearLayout(this)
        controlRow.gravity = Gravity.CENTER
        controlRow.orientation = LinearLayout.HORIZONTAL

        val galleryBtn = roundAction("▣")
        galleryBtn.contentDescription = "Choose a bill from gallery"
        galleryBtn.setOnClickListener { openGallery() }
        controlRow.addView(galleryBtn, LinearLayout.LayoutParams(dp(58), dp(58)))
        controlRow.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f))

        val capture = FrameLayout(this)
        val outer = GradientDrawable()
        outer.shape = GradientDrawable.OVAL
        outer.setColor(Color.WHITE)
        outer.setStroke(dp(5), Color.argb(102, 255, 255, 255))
        capture.background = outer
        capture.elevation = dp(14).toFloat()
        capture.contentDescription = "Capture bill"
        capture.isClickable = true
        capture.isFocusable = true
        capture.setOnClickListener { takePhoto() }
        val inner = View(this)
        val innerBg = GradientDrawable()
        innerBg.shape = GradientDrawable.OVAL
        innerBg.setColor(Color.rgb(244, 246, 252))
        innerBg.setStroke(dp(1), Color.rgb(207, 216, 242))
        inner.background = innerBg
        capture.addView(inner, FrameLayout.LayoutParams(dp(48), dp(48), Gravity.CENTER))
        captureBtn = capture
        controlRow.addView(capture, LinearLayout.LayoutParams(dp(82), dp(82)))
        controlRow.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f))

        val gridBtn = roundAction("⊞")
        gridBtn.contentDescription = "Toggle framing grid"
        gridBtn.setOnClickListener {
            gridVisible = !gridVisible
            gridOverlay.visibility = if (gridVisible) View.VISIBLE else View.GONE
            gridBtn.text = if (gridVisible) "⊟" else "⊞"
            statusPill.text = if (gridVisible) "GRID ON  •  Align the bill edges" else "READY TO SCAN  •  Keep bill in frame"
        }
        controlRow.addView(gridBtn, LinearLayout.LayoutParams(dp(58), dp(58)))
        dock.addView(controlRow)

        val hint = label("TAP TO CAPTURE  ·  ORIGINAL QUALITY", 9f, mutedWhite, true)
        hint.letterSpacing = 0.16f
        hint.gravity = Gravity.CENTER
        hint.setPadding(0, dp(12), 0, dp(2))
        dock.addView(hint)
        root.addView(dock, dockParams)

        setContentView(root)
        startCamera()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun label(text: String, size: Float, color: Int, bold: Boolean): TextView {
        val tv = TextView(this)
        tv.text = text
        tv.textSize = size
        tv.setTextColor(color)
        tv.typeface = Typeface.create("sans-serif", if (bold) Typeface.BOLD else Typeface.NORMAL)
        tv.includeFontPadding = false
        return tv
    }

    private fun glassPanel(color: Int, radius: Int): GradientDrawable {
        val d = GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(Color.argb(217, 52, 64, 92), color)
        )
        d.cornerRadius = dp(radius).toFloat()
        d.setStroke(dp(1), Color.argb(66, 255, 255, 255))
        return d
    }

    private fun roundedStroke(fill: Int, radius: Int, strokeColor: Int, strokeWidth: Int): GradientDrawable {
        val d = GradientDrawable()
        d.setColor(fill)
        d.cornerRadius = dp(radius).toFloat()
        d.setStroke(strokeWidth, strokeColor)
        return d
    }

    private fun roundAction(textValue: String): TextView {
        val tv = label(textValue, 17f, Color.WHITE, true)
        tv.gravity = Gravity.CENTER
        tv.background = glassPanel(Color.argb(169, 39, 48, 66), 28)
        tv.elevation = dp(5).toFloat()
        tv.isClickable = true
        tv.isFocusable = true
        tv.setPadding(dp(4), 0, dp(4), 0)
        return tv
    }

    private fun startCamera() {
        val providerFuture = ProcessCameraProvider.getInstance(this)
        providerFuture.addListener(Runnable {
            try {
                val cameraProvider = providerFuture.get()
                val preview = Preview.Builder().build()
                preview.setSurfaceProvider(previewView.surfaceProvider)
                val capture = ImageCapture.Builder()
                    .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                    .setFlashMode(flashMode)
                    .build()
                imageCapture = capture
                cameraProvider.unbindAll()
                val cam = cameraProvider.bindToLifecycle(
                    this@DocumentCameraActivity,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    capture
                )
                camera = cam
                val hasFlash = cam.cameraInfo.hasFlashUnit()
                flashBtn.isEnabled = hasFlash
                if (!hasFlash) {
                    flashBtn.text = "ϟ  N/A"
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
        imageCapture?.setFlashMode(flashMode)
        flashBtn.text = when (flashMode) {
            ImageCapture.FLASH_MODE_AUTO -> "ϟ  AUTO"
            ImageCapture.FLASH_MODE_ON -> "ϟ  ON"
            else -> "ϟ  OFF"
        }
    }

    private fun openGallery() {
        galleryLauncher.launch("image/*")
    }

    private fun handleGalleryImage(uri: Uri) {
        try {
            val cached = File(cacheDir, "bill_gallery_" + System.currentTimeMillis() + ".jpg")
            val input = contentResolver.openInputStream(uri)
                ?: throw IllegalStateException("Unable to read selected image")
            input.use { ins ->
                FileOutputStream(cached).use { out -> ins.copyTo(out) }
            }
            val corrected = PerspectiveCorrector.processFile(cached)
            val result = Intent()
            result.putExtra(EXTRA_IMAGE_URI, Uri.fromFile(corrected.file).toString())
            result.putExtra(EXTRA_AUTO_CORRECTED, corrected.autoCorrected)
            result.putExtra(EXTRA_DOC_DETECTED, corrected.documentDetected)
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
        captureBtn.alpha = 0.55f
        statusPill.text = "PROCESSING YOUR BILL…"
        val photoFile = File(cacheDir, "bill_cap_" + System.currentTimeMillis() + ".jpg")
        val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()
        capture.takePicture(
            outputOptions,
            cameraExecutor,
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                    val processed = PerspectiveCorrector.processFile(photoFile)
                    runOnUiThread {
                        val data = Intent()
                        data.putExtra(EXTRA_IMAGE_URI, Uri.fromFile(processed.file).toString())
                        data.putExtra(EXTRA_AUTO_CORRECTED, processed.autoCorrected)
                        data.putExtra(EXTRA_DOC_DETECTED, processed.documentDetected)
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
            }
        )
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }
}
