// todo vista previa de foto/video con botones de publicar/descartar + STICKER MOVIL
import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Animated, Dimensions, Image, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// 💥 CLAVE: Importamos los componentes del nuevo expo-video
import { useVideoPlayer, VideoView } from 'expo-video';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function VistaPrevia({ archivo, onDescartar, onPublicar }) {
  if (!archivo) return null;

  const { tipo, uri } = archivo;

  // 🎬 Inicializamos el reproductor moderno de expo-video si es un video
  const player = useVideoPlayer(uri, (playerInstance) => {
    playerInstance.loop = true;      // Activa el bucle infinito
    playerInstance.muted = false;     // Desmutear para escuchar el audio de la historia
    playerInstance.play();           // Arranca automáticamente
  });

  // 🖐️ CONFIGURACIÓN DEL STICKER MOVIBLE
  // Guardamos la posición X e Y del sticker usando una variable animada
  const posicionSticker = useRef(new Animated.ValueXY({ x: 120, y: 200 })).current;

  // Creamos el detector de gestos (PanResponder)
  const panResponder = useRef(
    PanResponder.create({
      // Activamos el toque apenas el usuario apoya el dedo en el sticker
      onStartShouldSetPanResponder: () => true,
      
      // Mientras arrastra el dedo, actualizamos la posición en tiempo real
      onPanResponderMove: Animated.event(
        [null, { dx: posicionSticker.x, dy: posicionSticker.y }],
        { useNativeDriver: false } // False porque manejamos layout físico
      ),
      
      // Cuando levanta el dedo, el sticker se queda fijo en el último lugar
      onPanResponderRelease: () => {
        posicionSticker.extractOffset(); // Fija los valores acumulados para que no vuelva al inicio
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      {/* Si es foto muestra imagen, si no, reproduce el video en bucle */}
      {tipo === 'foto' ? (
        <Image source={{ uri: uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        /* 🎬 Usamos el nuevo VideoView de expo-video */
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"         // Reemplaza a resizeMode
          nativeControls={false}     // Oculta la botonera nativa
        />
      )}

      {/* 👾 STICKER INTERACTIVO (Mover con el dedo) */}
      <Animated.View
        {...panResponder.panHandlers} // Le inyectamos los sensores de movimiento
        style={[
          posicionSticker.getLayout(), // Le pasa la posición dinámica de X e Y
          styles.stickerContenedor
        ]}
      >
        {/* Acá metí un emoji de fuego, pero puede ser cualquier imagen o sticker */}
        <Text style={styles.stickerTexto}>🔥</Text>
      </Animated.View>

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
  
  // Estilos del sticker flotante
  stickerContenedor: {
    position: 'absolute',
    padding: 10,
    zIndex: 99, // Arriba del video obligatoriamente
    cursor: 'pointer',
  },
  stickerTexto: {
    fontSize: 75, // Bien grande estilo historia de Instagram
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 1, height: 3 },
    textShadowRadius: 5,
  },

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