package com.cristianayala.historiaslab

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import android.util.Log

class ChatLabModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    // Este es el nombre con el que vamos a llamar al módulo desde JavaScript
    override fun getName(): String {
        return "ChatLabNative"
    }

    // Esta es nuestra primera función nativa de prueba
    @ReactMethod
    fun testConexion(mensaje: String) {
        Log.d("CHAT_LAB_KOTLIN", "¡Conexión exitosa! Mensaje recibido desde JS: $mensaje")
    }
}