package com.cristianayala.historiaslab

import android.annotation.SuppressLint
import android.graphics.Outline
import android.net.Uri
import android.os.Bundle
import android.os.CountDownTimer
import android.util.Log
import android.view.MotionEvent
import android.view.View
import android.view.ViewOutlineProvider
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.*
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import android.view.ScaleGestureDetector

import android.media.MediaMetadataRetriever

class HistoriasActivity : AppCompatActivity() {

    private lateinit var viewFinder: PreviewView
    private lateinit var cameraExecutor: ExecutorService
    
    // Elementos del Layout
    private lateinit var btnCapturarContenedor: View
    private lateinit var anilloExterior: View
    private lateinit var btnCapturar: View
    private lateinit var contenedorContador: LinearLayout
    private lateinit var txtTiempoGrabar: TextView
    private lateinit var btnVoltearCamara: ImageButton
    private lateinit var btnFlash: ImageButton
    private lateinit var btnGaleria: ImageButton

    // Casos de uso de CameraX y objeto de control
    private var camera: Camera? = null
    private var imageCapture: ImageCapture? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var activeRecording: Recording? = null
    // ... tus otras variables privadas ...
    private var scaleGestureDetector: ScaleGestureDetector? = null//creo que es para el zoom
    // Estados de la cámara
    private var lensFacing = CameraSelector.LENS_FACING_BACK
    private var flashEncendido = false
    private var tiempoInicialToque: Long = 0
    private var estaGrabandoVideo = false
    private var temporizadorRegresivo: CountDownTimer? = null

 private val selectorGaleriaLauncher = registerForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri: Uri? ->
        if (uri != null) {
            Log.d("HistoriasActivity", "Analizando video...")
            
            // FILTRO ESTRICTO: Si es 4K, bloqueamos el acceso inmediatamente
            if (esVideoMuyPesado(uri)) {
                Log.e("HistoriasActivity", "⚠️ Video 4K detectado, bloqueando para evitar crash.")
android.widget.Toast.makeText(this, "Solo videos en calidad HD (720p) este es 4k o similar.", android.widget.Toast.LENGTH_LONG).show()                // Aquí termina el flujo, NO permitimos que pase a la vista previa
            } else {
                // Solo si es un video "amigable" (<= 1080p), procesamos
                cameraExecutor.execute {
                    val rutaLocal = copiarArchivoACache(uri)
                    runOnUiThread {
                        if (rutaLocal != null) {
                            Log.d("HistoriasActivity", "Video seguro para vista previa: $rutaLocal")
                            HistoriasLabModule.promesaCamara?.resolve(rutaLocal)
                            HistoriasLabModule.promesaCamara = null
                            finish()
                        }
                    }
                }
            }
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_historias)

        // Vincular vistas de la interfaz
        viewFinder = findViewById(R.id.viewFinder)
        btnCapturarContenedor = findViewById(R.id.btnCapturarContenedor)
        anilloExterior = findViewById(R.id.anilloExterior)
        btnCapturar = findViewById(R.id.btnCapturar)
        contenedorContador = findViewById(R.id.contenedorContador)
        txtTiempoGrabar = findViewById(R.id.txtTiempoGrabar)
        btnVoltearCamara = findViewById(R.id.btnVoltearCamara)
        btnFlash = findViewById(R.id.btnFlash)
        btnGaleria = findViewById(R.id.btnGaleria)

        // ⭕ Hacer redondos los botones principales
        val outlineRedondo = object : ViewOutlineProvider() {
            override fun getOutline(view: View, outline: Outline) {
                outline.setRoundRect(0, 0, view.width, view.height, view.width / 2f)
            }
        }
        anilloExterior.outlineProvider = outlineRedondo
        anilloExterior.clipToOutline = true
        btnCapturar.outlineProvider = outlineRedondo
        btnCapturar.clipToOutline = true
        
        // Redondear levemente los botones flotantes de control
        btnVoltearCamara.clipToOutline = true
        btnFlash.clipToOutline = true
        btnGaleria.clipToOutline = true

        cameraExecutor = Executors.newSingleThreadExecutor()

        // 🔘 DETECTOR TÁCTIL (Mantiene la lógica anterior intacta)
        btnCapturar.setOnTouchListener { v, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    tiempoInicialToque = System.currentTimeMillis()
                    v.isPressed = true
                    btnCapturarContenedor.animate().scaleX(1.15f).scaleY(1.15f).setDuration(150).start()
                    btnCapturar.postDelayed({
                        if (v.isPressed && !estaGrabandoVideo) {
                            startRecordingVideo()
                        }
                    }, 400)
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    val duracionToque = System.currentTimeMillis() - tiempoInicialToque
                    v.isPressed = false
                    btnCapturarContenedor.animate().scaleX(1.0f).scaleY(1.0f).setDuration(150).start()
                    btnCapturar.animate().scaleX(1.0f).scaleY(1.0f).setDuration(150).start()
                    
                    if (estaGrabandoVideo) {
                        stopRecordingVideo()
                    } else if (duracionToque < 400 && event.action == MotionEvent.ACTION_UP) {
                        takePhoto()
                    }
                    true
                }
                else -> false
            }
        }

        // 🔄 ACCIÓN: VOLTEAR CÁMARA
        btnVoltearCamara.setOnClickListener {
            if (!estaGrabandoVideo) {
                lensFacing = if (lensFacing == CameraSelector.LENS_FACING_BACK) {
                    CameraSelector.LENS_FACING_FRONT
                } else {
                    CameraSelector.LENS_FACING_BACK
                }
                // Si pasamos a la frontal, apagamos el flash por lógica física
                flashEncendido = false
                btnFlash.setImageResource(android.R.drawable.btn_star_big_off)
                
                startCamera() // Reinicia la cámara con el nuevo lente
            }
        }

        // ⚡ ACCIÓN: SELECCIÓN DE FLASH / LINTERNA
        btnFlash.setOnClickListener {
            // Solo permitimos usar flash en cámara trasera
            if (lensFacing == CameraSelector.LENS_FACING_BACK) {
                flashEncendido = !flashEncendido
                camera?.cameraControl?.enableTorch(flashEncendido)
                
                // Cambiamos el icono nativo para dar feedback visual instantáneo
                if (flashEncendido) {
                    btnFlash.setImageResource(android.R.drawable.btn_star_big_on)
                } else {
                    btnFlash.setImageResource(android.R.drawable.btn_star_big_off)
                }
            }
        }

 btnGaleria.setOnClickListener {
    if (!estaGrabandoVideo) {
        // Feedback visual inmediato
        btnGaleria.animate().scaleX(0.8f).scaleY(0.8f).setDuration(100).withEndAction {
            btnGaleria.animate().scaleX(1.0f).scaleY(1.0f).setDuration(100).start()
        }.start()

        selectorGaleriaLauncher.launch(
            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo)
        )
    }
}

        startCamera()
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider: ProcessCameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(viewFinder.surfaceProvider)
            }

            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .build()

            // 🎬 Subimos el selector de calidad a HD (720p)
            val recorder = Recorder.Builder()
                .setQualitySelector(QualitySelector.from(Quality.HD))
                .build()
            videoCapture = VideoCapture.withOutput(recorder)

            val cameraSelector = CameraSelector.Builder().requireLensFacing(lensFacing).build()

             try {
                cameraProvider.unbindAll()
                camera = cameraProvider.bindToLifecycle(
                    this, cameraSelector, preview, imageCapture, videoCapture
                )
                // 🔥 AGREGÁ ESTO ACÁ ABAJO:
            scaleGestureDetector = CameraUtils.configurarZoomGesto(this, camera)
            viewFinder.setOnTouchListener { _, event ->
                scaleGestureDetector?.onTouchEvent(event)
                true // Retornamos true para que el gesto sea procesado
            }
            } catch (exc: Exception) {
                Log.e("HistoriasActivity", "Error al iniciar CameraX", exc)
            }
            }, ContextCompat.getMainExecutor(this))
            }

    private fun takePhoto() {
        val imageCapture = imageCapture ?: return
        val name = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(System.currentTimeMillis())
        val photoFile = File(cacheDir, "$name.jpg")
        val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

        imageCapture.takePicture(
            outputOptions,
            ContextCompat.getMainExecutor(this),
            object : ImageCapture.OnImageSavedCallback {
                override fun onError(exc: ImageCaptureException) {
                    Log.e("HistoriasActivity", "Error al capturar foto: ${exc.message}")
                    HistoriasLabModule.promesaCamara?.reject("ERROR_CAMARA", exc.message)
                }

                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    val pathCompleto = photoFile.absolutePath
                    HistoriasLabModule.promesaCamara?.resolve(pathCompleto)
                    HistoriasLabModule.promesaCamara = null
                    finish()
                }
            }
        )
    }

    @SuppressLint("MissingPermission")
    private fun startRecordingVideo() {
        val videoCapture = videoCapture ?: return
        estaGrabandoVideo = true
        
        btnCapturar.animate().scaleX(0.75f).scaleY(0.75f).setDuration(200).start()

        val name = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(System.currentTimeMillis())
        val videoFile = File(cacheDir, "$name.mp4")
        val outputOptions = FileOutputOptions.Builder(videoFile).build()

        activeRecording = videoCapture.output
            .prepareRecording(this, outputOptions)
            .withAudioEnabled() 
            .start(ContextCompat.getMainExecutor(this)) { recordEvent ->
                when (recordEvent) {
                    is VideoRecordEvent.Start -> {
                        iniciarCuentaRegresiva()
                    }
                    is VideoRecordEvent.Finalize -> {
                        cancelarCuentaRegresiva()
                        if (!recordEvent.hasError()) {
                            val pathCompleto = videoFile.absolutePath
                            HistoriasLabModule.promesaCamara?.resolve(pathCompleto)
                            HistoriasLabModule.promesaCamara = null
                            finish()
                        } else {
                            cleanupRecording()
                            HistoriasLabModule.promesaCamara?.reject("ERROR_VIDEO", "Error código: ${recordEvent.error}")
                        }
                    }
                }
            }
    }

    private fun iniciarCuentaRegresiva() {
        txtTiempoGrabar.setTextColor(ContextCompat.getColor(this, android.R.color.white))
        txtTiempoGrabar.text = "01:00" // 👈 Cambiamos el texto inicial a 1 minuto
        contenedorContador.visibility = View.VISIBLE

        // ⏱️ Cambiamos el primer número a 60000 (60 segundos de corrido)
        temporizadorRegresivo = object : CountDownTimer(60000, 1000) {
            override fun onTick(millisUntilFinished: Long) {
                val segundosTotales = (millisUntilFinished / 1000).toInt()
                val minutos = segundosTotales / 60
                val segundos = segundosTotales % 60

                // Formateamos para que muestre 01:00, 00:59, 00:58...
                txtTiempoGrabar.text = String.format(Locale.US, "%02d:%02d", minutos, segundos)

                if (segundosTotales <= 5) {
                    txtTiempoGrabar.setTextColor(ContextCompat.getColor(this@HistoriasActivity, android.R.color.holo_red_light))
                }
            }

            override fun onFinish() {
                txtTiempoGrabar.text = "00:00"
                stopRecordingVideo()
            }
        }.start()
    }

    private fun cancelarCuentaRegresiva() {
        temporizadorRegresivo?.cancel()
        temporizadorRegresivo = null
        contenedorContador.visibility = View.GONE
    }

    private fun stopRecordingVideo() {
        if (estaGrabandoVideo) {
            estaGrabandoVideo = false
            cancelarCuentaRegresiva()
            activeRecording?.stop()
            activeRecording = null
        }
    }

    private fun cleanupRecording() {
        cancelarCuentaRegresiva()
        activeRecording?.close()
        activeRecording = null
        estaGrabandoVideo = false
    }

    // 📂 FUNCIÓN AUXILIAR: Extrae el archivo de la galería y lo deja listo en la Caché local
    private fun copiarArchivoACache(uri: Uri): String? {
        try {
            val contenidoResolver = contentResolver
            val tipoMime = contenidoResolver.getType(uri) ?: ""
            val extension = if (tipoMime.contains("video")) "mp4" else "jpg"
            
            val nombreArchivo = "galeria_${System.currentTimeMillis()}.$extension"
            val archivoDestino = File(cacheDir, nombreArchivo)
            
            val inputStream: InputStream? = contenidoResolver.openInputStream(uri)
            val outputStream = FileOutputStream(archivoDestino)
            
            val buffer = ByteArray(4 * 1024)
            var bytesLeidos: Int
            while (inputStream?.read(buffer).also { bytesLeidos = it ?: -1 } != -1) {
                outputStream.write(buffer, 0, bytesLeidos)
            }
            
            outputStream.flush()
            outputStream.close()
            inputStream?.close()
            
            return archivoDestino.absolutePath
        } catch (e: Exception) {
            Log.e("HistoriasActivity", "Error al clonar el archivo seleccionado", e)
            return null
        }
    }

private fun esVideoMuyPesado(uri: Uri): Boolean {
    return try {
        val retriever = MediaMetadataRetriever()
        retriever.setDataSource(this, uri)
        val width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
        retriever.release()
        width > 1280 // Esto bloquea todo lo que sea mayor a 720p
    } catch (e: Exception) {
        false
    }
}

    override fun onDestroy() {
        super.onDestroy()
        cancelarCuentaRegresiva()
        cameraExecutor.shutdown()
    }
}