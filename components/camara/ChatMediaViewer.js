import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useState } from 'react';
import { BackHandler, ImageBackground, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function ChatMediaViewer({ archivo, alCerrar }) {
  const [estaCargado, setEstaCargado] = useState(false);

  // Lógica para interceptar el botón físico de Android
  useEffect(() => {
    const backAction = () => {
      alCerrar();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [alCerrar]);

  const player = useVideoPlayer(archivo.fileUrl, (player) => {
    player.loop = false;
    
    // Escuchamos cuando el video está listo para reproducir
    player.addListener('statusChange', (status) => {
      if (status.status === 'readyToPlay') {
        setEstaCargado(true);
      }
    });
    
    player.play();
  });

  return (
    <View style={styles.container}>
      {/* Si el video aún no está listo, mostramos la miniatura */}
      {!estaCargado && (
        <ImageBackground 
          source={{ uri: archivo.thumbnailUrl || archivo.thumbnail || archivo.fileUrl }} 
          style={StyleSheet.absoluteFill}
        />
      )}

      <VideoView 
        player={player} 
        style={styles.fullScreen} 
        contentFit="contain" 
        nativeControls={true}
        fullscreenOptions={{
          enterFullscreen: true,
          exitFullscreen: true,
          showEnterFullscreenButton: true
        }}
        automaticallyUpdatesPlayer={true}
      />

      <TouchableOpacity style={styles.botonCerrar} onPress={alCerrar}>
        <Ionicons name="close" size={40} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'black' 
  },
  fullScreen: { 
    flex: 1 
  },
  botonCerrar: { 
    position: 'absolute', 
    top: 50, 
    left: 20, 
    zIndex: 999, 
    padding: 10
  }
});