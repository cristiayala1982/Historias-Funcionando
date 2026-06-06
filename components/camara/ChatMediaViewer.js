import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

export default function ChatMediaViewer({ archivo, alCerrar }) {
  const player = useVideoPlayer(archivo.fileUrl, (p) => {
    p.muted = false; // Sonido activado al abrir en grande
    p.play();
  });

  return (
    <View style={styles.container}>
      <VideoView 
        player={player} 
        style={styles.fullScreen} 
        contentFit="contain" 
        nativeControls={true} // BOTONES DE PLAY/PAUSA ACTIVOS
      />
      <TouchableOpacity style={styles.botonCerrar} onPress={alCerrar}>
        <Ionicons name="close" size={40} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  fullScreen: { flex: 1 },
  botonCerrar: { position: 'absolute', top: 50, left: 20, zIndex: 10 }
});