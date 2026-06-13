const { onObjectFinalized } = require("firebase-functions/v2/storage");
const admin = require("firebase-admin");
const { spawn } = require("child-process-promise");
const path = require("path");
const os = require("os");
const fs = require("fs");

admin.initializeApp();

exports.convertirKotlinHls = onObjectFinalized({ memory: '1GiB' }, async (event) => {
  const filePath = event.data.name; 
  
  // Detectar origen
  const esKotlin = filePath.startsWith("kotlin_lab/videos/");
  const esHlsLab = filePath.startsWith("hls_lab/");
  const esChat = filePath.startsWith("hls_lab/chat_"); 

  if (!(esKotlin || esHlsLab) || !filePath.endsWith(".mp4") || filePath.includes("output_videos")) {
    return console.log("Ignorado: Archivo fuera de carpetas o ya procesado.");
  }

  const bucket = admin.storage().bucket(event.data.bucket);
  const fileName = path.basename(filePath, '.mp4');
  const tempFilePath = path.join(os.tmpdir(), `${fileName}.mp4`);
  
  // Rutas
  const outputFolderMp4 = esKotlin ? `kotlin_lab/output_videos/` : `hls_lab/output_videos/`;
  const destinationVideoPath = `${outputFolderMp4}${fileName}.mp4`;
  const thumbnailPath = `hls_lab/thumbnails/${fileName}.jpg`; 
  
  // Colección
  let coleccionFirestore = "historias_hls";
  if (esKotlin) coleccionFirestore = "historias_kotlin_lab";
  if (esChat) coleccionFirestore = "chat_laboratorio";

  const tempThumbnail = path.join(os.tmpdir(), `${fileName}.jpg`);
  const tempOutputVideo = path.join(os.tmpdir(), `output_${fileName}.mp4`);
  
  try {
    await bucket.file(filePath).download({ destination: tempFilePath });

    // 1. Miniatura
    await spawn("ffmpeg", ["-i", tempFilePath, "-ss", "00:00:01", "-vframes", "1", "-q:v", "2", tempThumbnail]);
    await bucket.upload(tempThumbnail, { destination: thumbnailPath });

    // 2. Procesamiento (Optimización Range Requests)
    await spawn("ffmpeg", [
      "-i", tempFilePath,
      "-c:v", "libx264", "-profile:v", "baseline", "-level", "3.0",
      "-pix_fmt", "yuv420p", "-b:v", "1M", "-c:a", "aac",
      "-movflags", "+faststart",
      tempOutputVideo
    ]);

    await bucket.upload(tempOutputVideo, { destination: destinationVideoPath });

    // 3. URLs
    const urlVideoOptimizado = `https://firebasestorage.googleapis.com/v0/b/${event.data.bucket}/o/${encodeURIComponent(destinationVideoPath)}?alt=media`;
    const urlThumbnail = `https://firebasestorage.googleapis.com/v0/b/${event.data.bucket}/o/${encodeURIComponent(thumbnailPath)}?alt=media`;

    // 4. ACTUALIZACIÓN ROBUSTA (Corregido para incluir miniaturas y tipo video)
    const dataToUpdate = {
        fileUrl: urlVideoOptimizado,     // Para chat
        thumbnailUrl: urlThumbnail,      // Para chat
        url: urlVideoOptimizado,         // Para historias
        thumbnail: urlThumbnail,         // Para historias
        tipo: "video"                    // Forzamos que deje de ser "hls_pending"
    };

    // Usamos el ID del archivo (fileName) para actualizar directo
    await admin.firestore().collection(coleccionFirestore).doc(fileName).set(dataToUpdate, { merge: true });
    
    console.log(`✅ Firestore ${coleccionFirestore} actualizado correctamente para ID: ${fileName}`);

    // 5. Limpieza
    await bucket.file(filePath).delete();
    if (fs.existsSync(tempThumbnail)) fs.unlinkSync(tempThumbnail);
    if (fs.existsSync(tempOutputVideo)) fs.unlinkSync(tempOutputVideo);
    
  } catch (error) {
    console.error("Error crítico en conversión:", error);
  } finally {
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
  }
});