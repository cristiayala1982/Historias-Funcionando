// === INICIO: IMPORTACIONES ===
import { Ionicons } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { comprimirVideoPro } from '../componentes_home3/compresor3';
import VistaPrevia from './VistaPrevia';
// === FIN: IMPORTACIONES ===

export default function CamaraLab3({ onVideoGrabado, idUsuario, onCerrar }) {
  const [procesando, setProcesando] = useState(false);
  const [archivoCapturado, setArchivoCapturado] = useState(null);
  const [textoEstado, setTextoEstado] = useState('Abriendo cámara...');
  const [segundosRestantes, setSegundosRestantes] = useState(30);
  const [esVideo, setEsVideo] = useState(false);

  const intervalRef = useRef(null);

  // ⏱️ Manejo del contador en reversa cuando se abre el video
  useEffect(() => {
    if (procesando && esVideo) {
      setSegundosRestantes(30);
      intervalRef.current = setInterval(() => {
        setSegundosRestantes((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setEsVideo(false);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [procesando, esVideo]);

  const abrirCamaraSistema = async (modo) => {
    try {
      console.log(`🔐 [CÁMARA] Solicitando permisos para [${modo.toUpperCase()}]...`);
      const permisoCamera = await ImagePicker.requestCameraPermissionsAsync();
      const permisoMicrofono = await Camera.requestMicrophonePermissionsAsync();
      
      if (!permisoCamera.granted || !permisoMicrofono.granted) {
        Alert.alert('Permisos requeridos', 'Necesitamos acceso a la cámara y micrófono.');
        if (onCerrar) onCerrar();
        return;
      }

      // Si es video, activamos la flag para que arranque la cuenta regresiva en pantalla
      if (modo === 'video') {
        setEsVideo(true);
        setTextoEstado('Grabando video...');
      } else {
        setEsVideo(false);
        setTextoEstado('Abriendo cámara...');
      }
      
      setProcesando(true);

      const opciones = {
        mediaTypes: modo === 'foto' ? 'images' : 'videos',
        allowsEditing: false, 
        quality: 0.7,         
      };

      if (modo === 'video') {
        opciones.videoMaxDuration = 30; // Límite de 30 segundos nativo
      }

      console.log(`📸 [CÁMARA] Lanzando cámara del sistema en modo: ${modo.toUpperCase()}`);
      const resultado = await ImagePicker.launchCameraAsync(opciones);

      // Frenamos el contador de reversa apenas regresa de la cámara nativa
      if (intervalRef.current) clearInterval(intervalRef.current);

      if (!resultado.canceled && resultado.assets && resultado.assets.length > 0) {
        const recurso = resultado.assets[0];

        if (modo === 'foto') {
          setArchivoCapturado({
            tipo: 'foto',
            uri: recurso.uri,
            thumbnailUri: recurso.uri
          });
          setProcesando(false);
        } else {
          // Si es video, seguimos en estado procesando pero cambiando los textos
          setEsVideo(false); 
          setTextoEstado('Generando miniatura...');
          let miniaturaUri = null;
          try {
            const { uri } = await VideoThumbnails.getThumbnailAsync(recurso.uri, { time: 0, quality: 0.6 });
            miniaturaUri = uri;
          } catch (e) {
            miniaturaUri = recurso.uri;
          }

          setTextoEstado('Comprimiendo video...');
          const videoOptimizado = await comprimirVideoPro(recurso.uri);

          setArchivoCapturado({
            tipo: 'video',
            uri: videoOptimizado,
            thumbnailUri: miniaturaUri
          });
          setProcesando(false);
        }
      } else {
        console.log("🚪 [CÁMARA] El usuario canceló. Volviendo a las historias...");
        setProcesando(false);
        if (onCerrar) onCerrar();
      }

    } catch (error) {
      console.error("❌ [ERROR CRÍTICO CÁMARA]:", error);
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProcesando(false);
      Alert.alert('Error', 'No se pudo abrir la cámara.');
      if (onCerrar) onCerrar();
    }
  };

  const publicarMultimedia = async () => {
    if (!archivoCapturado || !onVideoGrabado) return;
    try {
      setProcesando(true);
      setEsVideo(false);
      setTextoEstado('Subiendo al laboratorio...');
      
      await onVideoGrabado({
        uri: archivoCapturado.uri,
        thumbnailUri: archivoCapturado.thumbnailUri,
        tipo: archivoCapturado.tipo,
        idUsuarioDestino: idUsuario
      });
      
      setArchivoCapturado(null);
      if (onCerrar) onCerrar();
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la historia.');
    } finally {
      setProcesando(false);
    }
  };

  // Pantalla de carga y cuenta regresiva
  if (procesando) {
    return (
      <View style={styles.containerLoading}>
        <ActivityIndicator size="large" color="#1E90FF" />
        <Text style={styles.textoCarga}>{textoEstado}</Text>
        {esVideo && (
          <View style={styles.contenedorTimer}>
            <Text style={styles.textoTimer}>Tiempo restante:</Text>
            <Text style={styles.numeroTimer}>{segundosRestantes}s</Text>
          </View>
        )}
      </View>
    );
  }

  if (archivoCapturado) {
    return (
      <VistaPrevia 
        archivo={archivoCapturado}
        onDescartar={() => setArchivoCapturado(null)} 
        onPublicar={publicarMultimedia}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Botón "X" que cierra la vista completa */}
      <TouchableOpacity style={styles.botonCerrarX} onPress={onCerrar} activeOpacity={0.7}>
        <Ionicons name="close-outline" size={32} color="white" />
      </TouchableOpacity>

      <Text style={styles.tituloMenu}>Crear Historia</Text>
      <Text style={styles.subtituloMenu}>¿Qué formato preferís para tu laboratorio?</Text>

      <View style={styles.contenedorBotones}>
        {/* BOTÓN FOTO */}
        <TouchableOpacity 
          style={[styles.botonOpcion, styles.btnFoto]} 
          onPress={() => abrirCamaraSistema('foto')}
          activeOpacity={0.8}
        >
          <View style={styles.iconoCirculo}>
            <Ionicons name="camera" size={26} color="white" />
          </View>
          <View style={styles.contenedorTextoBoton}>
            <Text style={styles.textoBoton}>Sacar una Foto</Text>
            <Text style={styles.descBoton}>Captura una imagen fija al instante</Text>
          </View>
        </TouchableOpacity>

        {/* BOTÓN VIDEO */}
        <TouchableOpacity 
          style={[styles.botonOpcion, styles.btnVideo]} 
          onPress={() => abrirCamaraSistema('video')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconoCirculo, { backgroundColor: 'rgba(30, 144, 255, 0.15)' }]}>
            <Ionicons name="videocam" size={26} color="#1E90FF" />
          </View>
          <View style={styles.contenedorTextoBoton}>
            <Text style={[styles.textoBoton, { color: '#1E90FF' }]}>Grabar un Video</Text>
            <Text style={styles.descBoton}>Máximo 30 segundos de duración</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505', justifyContent: 'center', paddingHorizontal: 24 },
  containerLoading: { flex: 1, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center', padding: 20 },
  textoCarga: { color: 'white', marginTop: 15, fontSize: 16, fontWeight: '600', letterSpacing: 0.5 },
  
  // Estilos del contador en reversa flotante en la carga
  contenedorTimer: { marginTop: 25, alignItems: 'center', backgroundColor: '#121212', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 20, borderWidth: 1, borderColor: '#1e1e1e' },
  textoTimer: { color: '#666', fontSize: 13, fontWeight: 'bold', uppercase: true, letterSpacing: 1 },
  numeroTimer: { color: '#FF3B30', fontSize: 38, fontWeight: '900', marginTop: 5 },

  botonCerrarX: { position: 'absolute', top: 50, left: 20, padding: 8, zIndex: 10 },
  tituloMenu: { color: 'white', fontSize: 26, fontWeight: 'bold', marginBottom: 6, letterSpacing: 0.5 },
  subtituloMenu: { color: '#666', fontSize: 15, marginBottom: 45 },
  contenedorBotones: { gap: 16 },
  botonOpcion: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#121212', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#1e1e1e' },
  btnVideo: { borderColor: 'rgba(30, 144, 255, 0.2)' },
  iconoCirculo: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  contenedorTextoBoton: { flex: 1 },
  textoBoton: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  descBoton: { color: '#555', fontSize: 12, marginTop: 2 }
});