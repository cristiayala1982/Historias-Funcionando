package com.cristianayala.historiaslab

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import java.util.ArrayList

class ChatLabPackage : ReactPackage {

    // Registra nuestro módulo de chat para que JS lo pueda usar
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        val modules = ArrayList<NativeModule>()
        modules.add(ChatLabModule(reactContext))
        return modules
    }

    // Dejamos esto listo por si más adelante creamos vistas nativas (como el reproductor de historias)
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}