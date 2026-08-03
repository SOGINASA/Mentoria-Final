package kz.itshechka.bahandi

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.FileProvider
import org.json.JSONObject
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

    // Голосовой ввод (нативное распознавание речи, мост в JS: window.AndroidVoice)
    private var speechRecognizer: SpeechRecognizer? = null
    private var pendingVoiceLang: String? = null

    private val REQ_FILE_CHOOSER = 1001
    private val REQ_CAMERA_PERMISSION = 2001
    private val REQ_AUDIO_PERMISSION = 2002

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

        // Мост для голосового ввода: window.AndroidVoice.{isAvailable,start,stop}
        webView.addJavascriptInterface(VoiceBridge(), "AndroidVoice")

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
        if (requestCode == REQ_AUDIO_PERMISSION) {
            val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
            val lang = pendingVoiceLang
            pendingVoiceLang = null
            if (granted && lang != null) startVoice(lang) else emitVoiceError("denied")
        }
    }

    // ---------------- Голосовой ввод (native speech-to-text) ----------------

    /** JS-мост: доступен из веб-кода как window.AndroidVoice */
    inner class VoiceBridge {
        @JavascriptInterface
        fun isAvailable(): Boolean = SpeechRecognizer.isRecognitionAvailable(this@MainActivity)

        @JavascriptInterface
        fun start(lang: String) {
            runOnUiThread { startVoice(lang) }
        }

        @JavascriptInterface
        fun stop() {
            runOnUiThread { stopVoice() }
        }
    }

    private fun startVoice(lang: String) {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingVoiceLang = lang
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQ_AUDIO_PERMISSION)
            return
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            emitVoiceError("unsupported")
            return
        }
        // Пересоздаём распознаватель на каждый запуск — так стабильнее
        speechRecognizer?.destroy()
        val recognizer = SpeechRecognizer.createSpeechRecognizer(this)
        speechRecognizer = recognizer
        recognizer.setRecognitionListener(voiceListener)

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true) // текст сразу по мере речи
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }
        try {
            recognizer.startListening(intent)
        } catch (_: Exception) {
            emitVoiceError("unsupported")
        }
    }

    private fun stopVoice() {
        speechRecognizer?.let {
            try { it.stopListening() } catch (_: Exception) {}
            try { it.cancel() } catch (_: Exception) {}
            try { it.destroy() } catch (_: Exception) {}
        }
        speechRecognizer = null
    }

    private val voiceListener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}

        override fun onPartialResults(partialResults: Bundle?) {
            firstResult(partialResults)?.let { emitVoiceResult(it) }
        }

        override fun onResults(results: Bundle?) {
            firstResult(results)?.let { emitVoiceResult(it) }
            emitVoiceEnd()
        }

        override fun onError(error: Int) {
            when (error) {
                // Нет речи/таймаут — это не ошибка для пользователя, просто завершаем
                SpeechRecognizer.ERROR_NO_MATCH,
                SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> emitVoiceEnd()
                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> emitVoiceError("denied")
                else -> emitVoiceError("error")
            }
        }

        override fun onEvent(eventType: Int, params: Bundle?) {}
    }

    private fun firstResult(bundle: Bundle?): String? {
        val list = bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        return list?.firstOrNull()?.takeIf { it.isNotBlank() }
    }

    private fun emitVoiceResult(text: String) {
        val js = "window.__bahandiVoice && window.__bahandiVoice.onResult(${JSONObject.quote(text)});"
        runOnUiThread { webView.evaluateJavascript(js, null) }
    }

    private fun emitVoiceEnd() {
        runOnUiThread {
            webView.evaluateJavascript("window.__bahandiVoice && window.__bahandiVoice.onEnd();", null)
        }
    }

    private fun emitVoiceError(code: String) {
        val js = "window.__bahandiVoice && window.__bahandiVoice.onError(${JSONObject.quote(code)});"
        runOnUiThread { webView.evaluateJavascript(js, null) }
    }

    override fun onDestroy() {
        stopVoice()
        super.onDestroy()
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
