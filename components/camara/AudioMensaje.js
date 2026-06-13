import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';

export default function AudioMensaje({ uri, id, isPlaying, onPlay }) {
  const [sound, setSound] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const positionRef = useRef(0);
  const isMounted = useRef(true);
  
  const localUri = `${FileSystem.documentDirectory}${id}.m4a`;
  const [bloqueado, setBloqueado] = useState(false);// Estado para bloquear la repruducción bluqeada
  useEffect(() => {
    const downloadAndCache = async () => {
      const info = await FileSystem.getInfoAsync(localUri);
      if (!info.exists) {
        try {
          console.log(`[LOG] Descargando audio ${id}...`);
          await FileSystem.downloadAsync(uri, localUri);
        } catch (e) { console.error("Error al guardar en disco:", e); }
      }
      if (isMounted.current) setIsReady(true);
    };
    downloadAndCache();
    return () => { isMounted.current = false; };
  }, [uri, id]);

useEffect(() => {
    const managePlayback = async () => {
      console.log(`[LOG] managePlayback: isPlaying=${isPlaying}, hasSound=${!!sound}`);
      
      if (isPlaying) {
        if (!sound) {
          try {
            console.log("[LOG] Creando nueva instancia de sonido");
            const { sound: newSound } = await Audio.Sound.createAsync(
              { uri: localUri },
              { shouldPlay: true, positionMillis: 0 }
            );

            newSound.setOnPlaybackStatusUpdate(async (status) => {
              if (status.isLoaded && status.didJustFinish) {
                console.log("[LOG] Audio terminado. Rebobinando y avisando al padre.");
                // Bloqueamos cualquier interacción inmediata
                await newSound.setPositionAsync(0);
                await newSound.pauseAsync();
                onPlay(null); // Esto cambia el isPlaying a false en el padre
              }
            });
            setSound(newSound);
          } catch (createError) {
            console.error("Error al crear sonido:", createError);
          }
        } else {
          // Solo reproducir si no ha terminado ya
          const status = await sound.getStatusAsync();
          if (status.isLoaded && !status.isPlaying) {
            console.log("[LOG] Reanudando sonido existente");
            await sound.playAsync();
          }
        }
      } else {
        if (sound) {
          const status = await sound.getStatusAsync();
          if (status.isLoaded && status.isPlaying) {
            console.log("[LOG] Pausando sonido");
            await sound.pauseAsync();
          }
        }
      }
    };

    if (isReady) managePlayback();
  }, [isPlaying]);

  return (
    <TouchableOpacity 
      onPress={() => isReady && (isPlaying ? onPlay(null) : onPlay(id))} 
      style={{ 
        flexDirection: 'row', alignItems: 'center', padding: 12, 
        backgroundColor: isReady ? '#f0f0f0' : '#e0e0e0',
        borderRadius: 20, minWidth: 200, justifyContent: 'center' 
      }}
    >
      <Ionicons name={isPlaying ? "pause" : "play"} size={24} color="#007AFF" />
      <Text style={{ marginLeft: 10, fontWeight: 'bold' }}>
        {isReady ? (isPlaying ? "Reproduciendo..." : "Reproducir") : "Cargando..."}
      </Text>
    </TouchableOpacity>
  );
}