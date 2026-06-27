package kz.itshechka.bahandi

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.FileProvider
import java.io.File

/**
 * Android-обёртка над веб-приложением Bahandi (WebView).
 * Веб собран в app/src/main/assets/www и грузится из file://.
 * Реализован выбор фото: камера + галерея с множественным выбором.
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var cameraImageUri: Uri? = null

    private var allowMultiple = false
    private var captureOnly = false

    private val REQ_FILE_CHOOSER = 1001
    private val REQ_CAMERA_PERMISSION = 2001

    @Suppress("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WebView.setWebContentsDebuggingEnabled(true)
        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true               // localStorage (JWT, тема, язык)
            allowFileAccess = true
            allowContentAccess = true
            @Suppress("DEPRECATION")
            allowFileAccessFromFileURLs = true
            @Suppress("DEPRECATION")
            allowUniversalAccessFromFileURLs = true // обход CORS: file:// → https API
            mediaPlaybackRequiresUserGesture = false
            javaScriptCanOpenWindowsAutomatically = true
            cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
            userAgentString = "$userAgentString BahandiAndroid/1.0"
        }

        webView.webViewClient = WebViewClient()
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?
            ): Boolean {
                // Завершаем предыдущий выбор, если был
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback

                allowMultiple = params?.mode == FileChooserParams.MODE_OPEN_MULTIPLE
                captureOnly = params?.isCaptureEnabled == true

                if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(arrayOf(Manifest.permission.CAMERA), REQ_CAMERA_PERMISSION)
                } else {
                    launchChooser()
                }
                return true
            }
        }

        webView.loadUrl("file:///android_asset/www/index.html")
    }

    private fun launchChooser() {
        val cameraGranted =
            checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

        // Галерея (с множественным выбором, если форма это просит)
        val galleryIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "image/*"
            if (allowMultiple) putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        }

        // Камера (через FileProvider — полноразмерное фото)
        var cameraIntent: Intent? = null
        if (cameraGranted) {
            try {
                val photoFile = createImageFile()
                cameraImageUri = FileProvider.getUriForFile(this, "$packageName.fileprovider", photoFile)
                cameraIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                    putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri)
                    addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                }
            } catch (_: Exception) {
                cameraIntent = null
            }
        }

        val launch: Intent = if (captureOnly && cameraIntent != null) {
            cameraIntent
        } else {
            Intent.createChooser(galleryIntent, getString(R.string.choose_photo)).apply {
                if (cameraIntent != null) {
                    putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cameraIntent))
                }
            }
        }

        try {
            startActivityForResult(launch, REQ_FILE_CHOOSER)
        } catch (_: Exception) {
            filePathCallback?.onReceiveValue(null)
            filePathCallback = null
        }
    }

    private fun createImageFile(): File {
        val dir = File(cacheDir, "images").apply { mkdirs() }
        return File.createTempFile("IMG_${System.currentTimeMillis()}_", ".jpg", dir)
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQ_FILE_CHOOSER) return

        val callback = filePathCallback ?: return
        var results: Array<Uri>? = null

        if (resultCode == Activity.RESULT_OK) {
            val clip = data?.clipData
            val single = data?.data
            when {
                clip != null -> results = Array(clip.itemCount) { clip.getItemAt(it).uri }
                single != null -> results = arrayOf(single)
                cameraImageUri != null -> results = arrayOf(cameraImageUri!!) // фото с камеры
            }
        }

        callback.onReceiveValue(results)
        filePathCallback = null
        cameraImageUri = null
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_CAMERA_PERMISSION) {
            // Независимо от ответа открываем выбор (без камеры — только галерея)
            launchChooser()
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
