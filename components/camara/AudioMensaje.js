import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useRef, useState } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';

const BARRAS = 5;
const AUDIO_CACHE_DIR = `${FileSystem.cacheDirectory}chat-audios/`;
const AUDIO_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const AUDIO_CACHE_MAX_FILES = 200;

async function limpiarCacheAudios() {
  try {
    await FileSystem.makeDirectoryAsync(AUDIO_CACHE_DIR, { intermediates: true });
    const archivos = await FileSystem.readDirectoryAsync(AUDIO_CACHE_DIR);
    const ahora = Date.now();

    const infos = await Promise.all(
      archivos.map(async (nombre) => {
        const uri = `${AUDIO_CACHE_DIR}${nombre}`;
        const info = await FileSystem.getInfoAsync(uri);
        return { uri, ...info };
      })
    );

    const existentes = infos.filter((info) => info.exists);

    const vencidos = existentes.filter((info) => {
      if (typeof info.modificationTime !== 'number') return false;
      return ahora - info.modificationTime * 1000 > AUDIO_CACHE_MAX_AGE_MS;
    });

    await Promise.all(vencidos.map((info) => FileSystem.deleteAsync(info.uri, { idempotent: true })));

    const restantes = existentes
      .filter((info) => !vencidos.some((vencido) => vencido.uri === info.uri))
      .sort((a, b) => (b.modificationTime || 0) - (a.modificationTime || 0));

    if (restantes.length > AUDIO_CACHE_MAX_FILES) {
      const sobrantes = restantes.slice(AUDIO_CACHE_MAX_FILES);
      await Promise.all(sobrantes.map((info) => FileSystem.deleteAsync(info.uri, { idempotent: true })));
    }
  } catch (error) {
    console.warn('No se pudo limpiar cache de audios:', error?.message || error);
  }
}

function OnditasEcualizador({ reproduciendo }) {
  const animaciones = useRef(Array.from({ length: BARRAS }, () => new Animated.Value(0.3))).current;
  const loopsRef = useRef([]);

  useEffect(() => {
    loopsRef.current.forEach(l => l?.stop());
    loopsRef.current = [];

    if (reproduciendo) {
      animaciones.forEach((anim, i) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: 200 + i * 80, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0.25, duration: 200 + i * 80, useNativeDriver: true }),
          ])
        );
        loop.start();
        loopsRef.current.push(loop);
      });
    } else {
      animaciones.forEach(anim => Animated.timing(anim, { toValue: 0.3, duration: 150, useNativeDriver: true }).start());
    }

    return () => loopsRef.current.forEach(l => l?.stop());
  }, [reproduciendo]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 24, marginHorizontal: 8 }}>
      {animaciones.map((anim, i) => (
        <Animated.View
          key={i}
          style={{
            width: 3,
            height: 20,
            borderRadius: 2,
            backgroundColor: '#007AFF',
            transform: [{ scaleY: anim }],
          }}
        />
      ))}
    </View>
  );
}

export default function AudioMensaje({ uri, id, isPlaying, onPlay, onEnded }) {
  const [sound, setSound] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [progreso, setProgreso] = useState(0); // 0 a 1
  const isMounted = useRef(true);
  
  const localUri = `${AUDIO_CACHE_DIR}${id}.m4a`;
  useEffect(() => {
    const downloadAndCache = async () => {
      await limpiarCacheAudios();
      const info = await FileSystem.getInfoAsync(localUri);
      if (!info.exists) {
        try {
          await FileSystem.makeDirectoryAsync(AUDIO_CACHE_DIR, { intermediates: true });
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
    return () => {
      if (sound) {
        sound.setOnPlaybackStatusUpdate(null);
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [sound]);

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
              if (status.isLoaded) {
                if (status.durationMillis > 0) {
                  setProgreso(status.positionMillis / status.durationMillis);
                }
                if (status.didJustFinish) {
                  setProgreso(0);
                  newSound.setOnPlaybackStatusUpdate(null);
                  await newSound.stopAsync().catch(() => {});
                  await newSound.unloadAsync().catch(() => {});
                  if (isMounted.current) {
                    setSound(null);
                  }
                  onEnded?.(id);
                }
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
        borderRadius: 20, minWidth: 200,
      }}
    >
      <Ionicons name={isPlaying ? "pause" : "play"} size={24} color="#007AFF" />
      
      {/* Onditas ecualizador */}
      <OnditasEcualizador reproduciendo={isPlaying} />

      {/* Barra de progreso */}
      <View style={{ flex: 1, height: 3, backgroundColor: '#ccc', borderRadius: 2, overflow: 'hidden' }}>
        <View style={{ width: `${progreso * 100}%`, height: '100%', backgroundColor: '#007AFF', borderRadius: 2 }} />
      </View>

      {!isReady && (
        <Text style={{ marginLeft: 8, fontSize: 11, color: '#999' }}>Cargando...</Text>
      )}
    </TouchableOpacity>
  );
}