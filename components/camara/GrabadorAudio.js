import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av'; // Esta es la librería correcta
import { useRef } from 'react';
import { TouchableOpacity } from 'react-native';

export default function GrabadorAudio({ onEnviar }) {
  const recorderRef = useRef(null);

  const empezarGrabacion = async () => {
    try {
      // Pedimos permiso de forma clásica y segura
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      // Usamos el preset de alta calidad
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      
      recorderRef.current = recording;
      console.log("Grabando...");
    } catch (error) {
      console.error("Error al grabar:", error);
    }
  };

  const detenerGrabacion = async () => {
    if (!recorderRef.current) return;

    try {
      await recorderRef.current.stopAndUnloadAsync();
      const uri = recorderRef.current.getURI();
      
      if (uri) onEnviar(uri);
      
      recorderRef.current = null;
      console.log("Grabación guardada en:", uri);
    } catch (error) {
      console.error("Error al detener:", error);
    }
  };

  return (
    <TouchableOpacity 
      onPressIn={empezarGrabacion} 
      onPressOut={detenerGrabacion}
      style={{ padding: 10 }}
    >
      <Ionicons name="mic" size={28} color="white" />
    </TouchableOpacity>
  );
}