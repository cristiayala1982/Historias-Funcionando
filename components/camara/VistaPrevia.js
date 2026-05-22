import { Ionicons } from '@expo/vector-icons';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Video from 'react-native-video';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function VistaPrevia({ archivo, onDescartar, onPublicar }) {
  if (!archivo) return null;

  const { tipo, uri } = archivo;

  return (
    <View style={styles.container}>
      {/* Si es foto muestra imagen, si no, reproduce el video en bucle */}
      {tipo === 'foto' ? (
        <Image source={{ uri: uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <Video
          source={{ uri: uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          repeat={true}
          muted={false}
        />
      )}

      {/* Botonera flotante inferior */}
      <View style={styles.contenedorBotones}>
        <TouchableOpacity style={styles.botonAccion} onPress={onDescartar}>
          <Ionicons name="close-circle" size={55} color="#FF3B30" />
          <Text style={styles.textoBoton}>Descartar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.botonAccion} onPress={onPublicar}>
          <Ionicons name="checkmark-circle" size={55} color="#34C759" />
          <Text style={styles.textoBoton}>Publicar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  contenedorBotones: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    width: SCREEN_WIDTH,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
    zIndex: 10,
  },
  botonAccion: { alignItems: 'center' },
  textoBoton: { color: 'white', fontWeight: 'bold', fontSize: 13, marginTop: 5, textShadowColor: 'black', textShadowRadius: 3 }
});