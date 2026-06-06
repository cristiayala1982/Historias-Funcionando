import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';

export default function AudioMensaje({ uri, id, isPlaying, onPlay }) {
  const [sound, setSound] = useState(null);
  const positionRef = useRef(0);
  const isMounted = useRef(true); // Interruptor de seguridad

  useEffect(() => {
    isMounted.current = true;

    const startAudio = async () => {
      // Si ya no debe sonar, no hacemos nada
      if (!isPlaying) return;

      try {
        const { sound: newSound } = await Audio.Sound.createAsync({ uri });
        
        // Si el componente se desmontó mientras cargaba, lo limpiamos de inmediato
        if (!isMounted.current) {
          await newSound.unloadAsync();
          return;
        }

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            positionRef.current = 0;
            onPlay(null);
          } else if (status.positionMillis) {
            positionRef.current = status.positionMillis;
          }
        });

        await newSound.setPositionAsync(positionRef.current);
        await newSound.playAsync();
        
        if (isMounted.current) {
          setSound(newSound);
        } else {
          await newSound.unloadAsync();
        }
      } catch (e) {
        console.error("Error crítico de reproducción:", e);
      }
    };

    if (isPlaying) {
      startAudio();
    } else if (sound) {
      // Si pausamos, descargamos para liberar RAM
      sound.unloadAsync().then(() => setSound(null));
    }

    return () => {
      isMounted.current = false; // Apagamos el interruptor
      if (sound) sound.unloadAsync();
    };
  }, [isPlaying]);

  return (
    <TouchableOpacity 
      onPress={() => isPlaying ? onPlay(null) : onPlay(id)} 
      style={{ 
        flexDirection: 'row', alignItems: 'center', padding: 12, 
        backgroundColor: '#f0f0f0', borderRadius: 20, 
        minWidth: 200, justifyContent: 'center' 
      }}
    >
      <Ionicons name={isPlaying ? "pause" : "play"} size={24} color="#007AFF" />
      <Text style={{ marginLeft: 10, fontWeight: 'bold' }}>
        {isPlaying ? "Reproduciendo..." : "Reproducir"}
      </Text>
    </TouchableOpacity>
  );
}