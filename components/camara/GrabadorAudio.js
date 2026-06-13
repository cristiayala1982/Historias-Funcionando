import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function GrabadorAudio({ onEnviar }) {
  const recorderRef = useRef(null);
  const [grabando, setGrabando] = useState(false);

  const empezarGrabacion = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      
      recorderRef.current = recording;
      setGrabando(true);
    } catch (error) {
      console.error("Error al grabar:", error);
    }
  };

  const detenerGrabacion = async () => {
    if (!recorderRef.current) return;
    try {
      setGrabando(false);
      await recorderRef.current.stopAndUnloadAsync();
      const uri = recorderRef.current.getURI();
      if (uri) onEnviar(uri);
      recorderRef.current = null;
    } catch (error) {
      console.error("Error al detener:", error);
    }
  };

  return (
    <View style={styles.contenedor}>
      {/* Ahora el indicador NO está lejos, está "dentro" del área del botón.
         Si el componente GrabadorAudio vive dentro del inputWrapper, 
         esto va a quedar justo al lado o sobre el área de escritura.
      */}
      {grabando && (
        <View style={styles.indicadorFlotante}>
          <View style={styles.puntoRojo} />
          <Text style={styles.textoGrabando}>GRABANDO...</Text>
        </View>
      )}

      <TouchableOpacity 
        onPressIn={empezarGrabacion} 
        onPressOut={detenerGrabacion}
        style={styles.boton}
      >
        <Ionicons name="mic" size={28} color={grabando ? "#ff4444" : "white"} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { 
    justifyContent: 'center', 
    alignItems: 'center',
    width: 60, // Mismo tamaño que tu botón de micrófono
  },
  boton: { padding: 10 },
  indicadorFlotante: {
    position: 'absolute',
    right: 50, // Se despliega hacia la izquierda desde el botón
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 120, // Suficiente para que se lea "GRABANDO"
  },
  puntoRojo: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4444',
    marginRight: 8,
  },
  textoGrabando: { 
    color: 'white', 
    fontSize: 14, 
    fontWeight: 'bold' 
  }
});