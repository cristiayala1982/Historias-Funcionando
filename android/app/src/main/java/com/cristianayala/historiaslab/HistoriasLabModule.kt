package com.cristianayala.historiaslab

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import android.content.Intent
import java.util.ArrayList

class HistoriasLabModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "HistoriasLabNative"
    }

    companion object {
        var promesaCamara: Promise? = null
    }

    @ReactMethod
    fun abrirCamaraHistorias(promise: Promise) {
        promesaCamara = promise

        val intent = Intent(reactContext, HistoriasActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
    }

    @ReactMethod
    fun abrirReproductorNativo(urls: ReadableArray, tipos: ReadableArray, thumbnails: ReadableArray) {
        val intent = Intent(reactContext, ReproductorActivity::class.java)
        
        val listaUrls = ArrayList<String>()
        val listaTipos = ArrayList<String>()
        val listaThumbnails = ArrayList<String>()
        
        for (i in 0 until urls.size()) {
            // 🛡️ Agregamos ?: "" para asegurar que nunca se inserte un nulo en las listas estricta de Kotlin
            listaUrls.add(urls.getString(i) ?: "")
            listaTipos.add(tipos.getString(i) ?: "")
            listaThumbnails.add(thumbnails.getString(i) ?: "")
        }

        intent.putStringArrayListExtra("LISTA_URLS", listaUrls)
        intent.putStringArrayListExtra("LISTA_TIPOS", listaTipos)
        intent.putStringArrayListExtra("LISTA_THUMBNAILS", listaThumbnails)
        
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
    }
}