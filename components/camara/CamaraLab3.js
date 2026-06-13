import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CamaraLab3({ onCaptura, onCerrar }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  if (!permission || !permission.granted) return null;

  const startVideo = async () => {
    if (cameraRef.current) {
      setIsRecording(true);
      try {
        // Al NO hacer await aquí, permitimos que la app siga respondiendo
        // recordAsync recibe un callback para cuando finaliza
        cameraRef.current.recordAsync().then((video) => {
          onCaptura({ uri: video.uri, tipo: 'video' });
        });
      } catch (error) {
        console.error("Error al iniciar grabación:", error);
        setIsRecording(false);
      }
    }
  };

  const stopVideo = async () => {
    if (cameraRef.current) {
      await cameraRef.current.stopRecording();
      setIsRecording(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* CÁMARA SOLA, SIN HIJOS */}
      <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} mode="video" />

      {/* CONTROLES POSICIONADOS ABSOLUTAMENTE */}
      <TouchableOpacity style={styles.btnCerrar} onPress={onCerrar}>
        <Ionicons name="close" size={30} color="white" />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.button, isRecording && styles.recording]} 
        onPress={isRecording ? stopVideo : startVideo}
      >
        <Text style={styles.text}>{isRecording ? 'DETENER' : 'GRABAR'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({ 
  container: { flex: 1, backgroundColor: 'black' },
  btnCerrar: { position: 'absolute', top: 50, left: 20, zIndex: 10 },
  button: { 
    position: 'absolute', 
    bottom: 50, 
    alignSelf: 'center', 
    padding: 20, 
    backgroundColor: 'white', 
    borderRadius: 20,
    zIndex: 10 
  },
  recording: { backgroundColor: '#FF3B30' },
  text: { fontWeight: 'bold' }
});