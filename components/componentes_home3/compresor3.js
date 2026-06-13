// componentes/componentes_home3/compresor3.js
import * as FileSystem from 'expo-file-system/legacy';
import { Video } from 'react-native-compressor';

export const comprimirVideoPro = async (uriOriginal) => {
  try {
    console.log("💾 [DISCO - INICIO] Recibiendo video original para optimizar:", uriOriginal);

    console.log("⚙️ [MOTOR] Iniciando compresión ,nativa con react-native-compressor...");
    
    // El motor comprime el archivo usando el procesador nativo del celular
    const uriComprimida = await Video.compress(
      uriOriginal,
      { compressionMethod: 'auto' } // Mantiene una excelente calidad equilibrada
    );

    console.log("✅ [DISCO - ÉXITO] ¡Video comprimido creado con éxito! Nueva ruta:", uriComprimida);

    // Formateamos la ruta original por seguridad para que Expo FileSystem la borre bien
    // (A veces FileSystem necesita la ruta sin el prefijo 'file://' en Android)
    const rutaParaBorrar = uriOriginal.startsWith('file://') ? uriOriginal : `file://${uriOriginal}`;

    console.log("🗑️ [SISTEMA] Intentando eliminar el video original pesado de:", rutaParaBorrar);
    
    // ELIMINACIÓN DEL ORIGINAL DE KOTLIN (Para limpiar el disco de inmediato)
    await FileSystem.deleteAsync(rutaParaBorrar, { idempotent: true });
    
    console.log("🗑️ [SISTEMA] ¡Video original eliminado correctamente del disco!");

    return uriComprimida; // Devolvemos el video optimizado y liviano listo para subir
  } catch (error) {
    console.error("❌ [ERROR CRÍTICO COMPRESOR] Falló el proceso de compresión:", error);
    throw error;
  }
};