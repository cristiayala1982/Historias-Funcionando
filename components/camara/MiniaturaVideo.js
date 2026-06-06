import { VideoView, useVideoPlayer } from 'expo-video';

export default function MiniaturaVideo({ uri }) {
  // El player se crea aquí. Expo-video empieza a hacer el "buffer" (descarga) 
  // automáticamente al crear el player, aunque no llames a .play()
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = false;
    // No ponemos p.play() aquí para que no se sature el dispositivo
  });

  return (
    <VideoView 
      style={{ width: '100%', height: '100%' }}
      player={player}
      contentFit="cover"
      nativeControls={false}
      // Al no poner autoPlay, el video se queda listo (buffer) esperando 
      // y no te obliga a ver el pantallazo negro de inicio
    />
  );
}