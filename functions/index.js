const { onObjectFinalized } = require("firebase-functions/v2/storage");
const admin = require("firebase-admin");
const { spawn } = require("child-process-promise");
const path = require("path");
const os = require("os");
const fs = require("fs");

admin.initializeApp();

exports.convertirKotlinHls = onObjectFinalized({ memory: '1GiB' }, async (event) => {
  const filePath = event.data.name; 
  
  const esKotlin = filePath.startsWith("kotlin_lab/videos/");
  const esHlsLab = filePath.startsWith("hls_lab/");

  // Cambiamos la validación para asegurarnos de procesar solo los videos crudos (.mp4)
  if (!(esKotlin || esHlsLab) || !filePath.endsWith(".mp4") || filePath.includes("output_videos")) {
    return console.log("Ignorado: Archivo fuera de carpetas, ya procesado o no es MP4.");
  }

  const bucket = admin.storage().bucket(event.data.bucket);
  const fileName = path.basename(filePath, '.mp4');
  const tempFilePath = path.join(os.tmpdir(), `${fileName}.mp4`);
  
  // Nuevas rutas limpias para guardar el archivo único MP4 optimizado
  const outputFolderMp4 = esKotlin ? `kotlin_lab/output_videos/` : `hls_lab/output_videos/`;
  const destinationVideoPath = `${outputFolderMp4}${fileName}.mp4`;
  
  const thumbnailPath = esKotlin ? `kotlin_lab/thumbnails/${fileName}.jpg` : `hls_lab/thumbnails/${fileName}.jpg`;
  const coleccionFirestore = esKotlin ? "historias_kotlin_lab" : "historias_hls";
  
  const tempThumbnail = path.join(os.tmpdir(), `${fileName}.jpg`);
  const tempOutputVideo = path.join(os.tmpdir(), `output_${fileName}.mp4`);
  
  try {
    await bucket.file(filePath).download({ destination: tempFilePath });

    // 1. Extraer miniatura (Se mantiene igual, funciona de diez)
    await spawn("ffmpeg", ["-i", tempFilePath, "-ss", "00:00:01", "-vframes", "1", "-q:v", "2", tempThumbnail]);
    await bucket.upload(tempThumbnail, { destination: thumbnailPath });

    // 2. PROCESO DE RANGER + FASTSTART
    // Optimizamos el peso y movemos los metadatos al inicio para streaming instantáneo
    await spawn("ffmpeg", [
      "-i", tempFilePath,
      "-c:v", "libx264",         // Códec universal compatible con cualquier Android/iOS
      "-profile:v", "baseline",  // Perfil liviano para carga inmediata
      "-level", "3.0",
      "-pix_fmt", "yuv420p",     // Forzar formato de color estándar de web/móvil
      "-b:v", "1M",              // Bitrate controlado para que pese muy pocos MB
      "-c:a", "aac",             // Audio universal compatible
      "-movflags", "+faststart", // El secreto mágico: Mueve el mapa al principio para habilitar Range Requests instantáneos
      tempOutputVideo
    ]);

    // 3. Subir el único video MP4 optimizado resultante
    await bucket.upload(tempOutputVideo, { destination: destinationVideoPath });

    // Armamos la URL pública definitiva del video optimizado
    const urlVideoOptimizado = `https://firebasestorage.googleapis.com/v0/b/${event.data.bucket}/o/${encodeURIComponent(destinationVideoPath)}?alt=media`;

    // 4. ACTUALIZACIÓN DE FIRESTORE
    // Buscamos el documento por la URL original que subió la app
    const urlOriginal = `https://firebasestorage.googleapis.com/v0/b/${event.data.bucket}/o/${encodeURIComponent(filePath)}?alt=media`;
    const querySnapshot = await admin.firestore().collection(coleccionFirestore)
      .where("url", "==", urlOriginal)
      .limit(1)
      .get();

    if (!querySnapshot.empty) {
      await querySnapshot.docs[0].ref.update({
        url: urlVideoOptimizado, // Pisamos o actualizamos con la nueva URL ultra rápida
        tipo: "video"            // Tipo estándar para reproductores nativos
      });
      console.log("Firestore actualizado por query con MP4 Range.");
    } else {
      // Fallback: intentar por ID de documento
      await admin.firestore().collection(coleccionFirestore).doc(fileName).update({
        url: urlVideoOptimizado,
        tipo: "video"
      });
      console.log("Firestore actualizado por ID con MP4 Range.");
    }

    // 5. Limpieza del archivo crudo pesado original y archivos temporales
    await bucket.file(filePath).delete();
    if (fs.existsSync(tempThumbnail)) fs.unlinkSync(tempThumbnail);
    if (fs.existsSync(tempOutputVideo)) fs.unlinkSync(tempOutputVideo);
    console.log("🚀 ¡Proceso completado con éxito!");
    
  } catch (error) {
    console.error("Error crítico en conversión Range:", error);
  } finally {
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
  }
});