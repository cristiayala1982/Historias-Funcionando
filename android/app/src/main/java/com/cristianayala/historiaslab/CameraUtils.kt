package com.cristianayala.historiaslab

import android.annotation.SuppressLint
import android.view.ScaleGestureDetector
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.extensions.ExtensionMode
import androidx.camera.extensions.ExtensionsManager
import android.content.Context
import androidx.appcompat.app.AppCompatActivity

object CameraUtils {

// 🔍 1. Configurar el Zoom con Gestos (Pinch-to-Zoom) - Más rápido
    fun configurarZoomGesto(context: Context, camera: Camera?): ScaleGestureDetector {
        return ScaleGestureDetector(context, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
            override fun onScale(detector: ScaleGestureDetector): Boolean {
                camera?.let {
                    val info = it.cameraInfo.zoomState.value
                    val currentZoomRatio = info?.zoomRatio ?: 1.0f
                    
                    // Ajuste de velocidad: 
                    // (detector.scaleFactor - 1.0f) obtiene qué tanto se movieron los dedos
                    // Multiplicamos por 2.5f para que sea 2.5 veces más rápido.
                    val delta = 1.0f + (detector.scaleFactor - 1.0f) * 2.5f 
                    
                    it.cameraControl.setZoomRatio(currentZoomRatio * delta)
                }
                return true
            }
        })
    }

    // 🌗 2. Obtener Selector de Cámara optimizado para Modo Noche nativo
    fun obtenerSelectorConModoNoche(
        context: Context,
        cameraProvider: ProcessCameraProvider,
        baseSelector: CameraSelector,
        onReady: (CameraSelector) -> Unit
    ) {
        val extensionsManagerFuture = ExtensionsManager.getInstanceAsync(context, cameraProvider)
        extensionsManagerFuture.addListener({
            val extensionsManager = extensionsManagerFuture.get()
            
            // Chequeamos si el fabricante (Motorola) habilitó el modo noche de fábrica para ese lente
            if (extensionsManager.isExtensionAvailable(baseSelector, ExtensionMode.NIGHT)) {
                val selectorModoNoche = extensionsManager.getExtensionEnabledCameraSelector(
                    baseSelector,
                    ExtensionMode.NIGHT
                )
                onReady(selectorModoNoche)
            } else {
                // Si el dispositivo no lo tiene, devolvemos el selector común y corriente
                onReady(baseSelector)
            }
        }, androidx.core.content.ContextCompat.getMainExecutor(context))
    }
}