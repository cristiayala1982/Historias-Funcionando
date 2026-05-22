// componentes/componentes_home3/compresor3.js
import * as FileSystem from 'expo-file-system/legacy';
import { Video } from 'react-native-compressor';

export const comprimirVideoPro = async (uriOriginal) => {
  try {
    console.log("💾 [DISCO] Video original guardado en temporales:", uriOriginal);

    console.log("⚙️ Iniciando compresión...");
    const uriComprimida = await Video.compress(
      uriOriginal,
      { compressionMethod: 'auto' }
    );

    console.log("✅ [DISCO] Video comprimido creado:", uriComprimida);

    // ELIMINACIÓN DEL ORIGINAL (Para no llenar la memoria)
    await FileSystem.deleteAsync(uriOriginal, { idempotent: true });
    console.log("🗑️ [SISTEMA] Video original eliminado para liberar espacio.");

    return uriComprimida;
  } catch (error) {
    console.error("❌ Error en el motor de compresión:", error);
    throw error;
  }
};