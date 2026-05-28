import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import Video from 'react-native-video';
import BarraProgreso from './BarraProgreso';

const { width } = Dimensions.get('window');

// Función para transformar la ruta de Firebase en URL pública optimizada
const obtenerUrlPublica = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const bucket = "historiaslab-7672a.firebasestorage.app";
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
};

export default function ReproductorHLS({ usuario, estaActivo, irSiguienteUsuario, irAnteriorUsuario, alCerrar }) {
  
  const [idxHistoria, setIdxHistoria] = useState(0);
  const [pausadoManual, setPausadoManual] = useState(false);
  const [estaListo, setEstaListo] = useState(false); 
  const [duracionVideo, setDuracionVideo] = useState(5000); 
  const [videoCargado, setVideoCargado] = useState(false); 
  const [mostrarMiniatura, setMostrarMiniatura] = useState(true);

  const historiasActuales = usuario?.historias || [];
  const historiaActual = historiasActuales[idxHistoria];

  // Leemos dinámicamente la URL optimizada que guardará nuestra nueva Cloud Function
  const urlActual = obtenerUrlPublica(historiaActual?.url);
  const thumbnailActual = historiaActual?.thumbnail;

  console.log("⚡ [REPRODUCTOR] Intentando cargar:", urlActual);

  const esFoto = historiaActual?.tipo === 'foto';

  const tieneSiguienteInterno = idxHistoria < historiasActuales.length - 1;
  const urlSiguienteInterna = tieneSiguienteInterno 
    ? obtenerUrlPublica(historiasActuales[idxHistoria + 1]?.url) 
    : null;
    
  const siguienteEsFoto = tieneSiguienteInterno ? historiasActuales[idxHistoria + 1]?.tipo === 'foto' : false;
  const urlSiguienteFoto = (tieneSiguienteInterno && siguienteEsFoto) ? urlSiguienteInterna : null;
  
  const estaMontadoRef = useRef(true);

  useEffect(() => {
    estaMontadoRef.current = true;
    return () => { estaMontadoRef.current = false; };
  }, []);

  useEffect(() => {
    if (estaActivo) {
      setMostrarMiniatura(true);
      setPausadoManual(false);
      const tListo = setTimeout(() => {
          if (estaMontadoRef.current) {
            setEstaListo(true);
            if (esFoto) {
              setDuracionVideo(5000); 
              setVideoCargado(true);
              setMostrarMiniatura(false);
            } else if (duracionVideo > 0) {
              setVideoCargado(true);
            }
          }
        }, 150);
      return () => clearTimeout(tListo);
    } else {
      setIdxHistoria(0);
      setVideoCargado(false);
      setPausadoManual(false);
      setEstaListo(false);
    }
  }, [estaActivo]);

  useEffect(() => {
    if (estaMontadoRef.current && estaActivo) {
      setVideoCargado(false); 
      setMostrarMiniatura(true); 
    }
  }, [idxHistoria]);

  const irSiguiente = () => {
    if (idxHistoria < historiasActuales.length - 1) {
      setIdxHistoria(idxHistoria + 1);
    } else {
      irSiguienteUsuario();
    }
  };

  const irAnterior = () => {
    if (idxHistoria > 0) {
      setIdxHistoria(idxHistoria - 1);
    } else {
      irAnteriorUsuario();
    }
  };

  if (!usuario) return null;

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill}>
        
        {urlActual && esFoto && (
          <Image
            source={{ uri: urlActual }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onLoad={() => {
              if (estaMontadoRef.current && estaActivo) {
                setVideoCargado(true);
                setMostrarMiniatura(false);
              }
            }}
          />
        )}

        {urlActual && !esFoto && (
          <Video
            source={{ uri: urlActual }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            paused={!estaActivo || pausadoManual} 
            onEnd={irSiguiente}
            useTextureView={true} 
            onLoad={(data) => {
              if (data && data.duration) {
                if (estaMontadoRef.current) {
                  setDuracionVideo(data.duration * 1000);
                  if (estaActivo) setVideoCargado(true); 
                }
              }
            }}
            onReadyForDisplay={() => {
              if (estaMontadoRef.current && estaActivo) setMostrarMiniatura(false);
            }}
            bufferConfig={{
              minBufferMs: 600,                  // Cambiar a 600
              maxBufferMs: 1500,                 // Cambiar a 1500
              bufferForPlaybackMs: 100,          // ¡Acá está el secreto! Cambiar a 100
              bufferForPlaybackAfterRebufferMs: 400 // Cambiar a 400
            }}
            onError={(e) => console.log("❌ Error Video Activo:", e)}
          />
        )}

        {estaActivo && estaListo && urlSiguienteInterna && !siguienteEsFoto && (
          <View style={styles.motorOculto}>
            <Video
              source={{ uri: urlSiguienteInterna }}
              paused={true}               // Volvemos a true para que no te trabe el video activo
              preload="auto"              // ¡ESTO ES CLAVE! Le dice a Android que descargue aunque esté pausado
              muted={true}
              volume={0}
              bufferConfig={{
                minBufferMs: 600,
                maxBufferMs: 1200,
                bufferForPlaybackMs: 100,
                bufferForPlaybackAfterRebufferMs: 400
              }}
              onError={(e) => console.log("ℹ️ Buffer interno preparándose")}
            />
          </View>
        )}

        {estaActivo && estaListo && urlSiguienteFoto && (
          <Image
            source={{ uri: urlSiguienteFoto }}
            style={{ width: 1, height: 1, position: 'absolute', opacity: 0 }}
            onLoad={() => console.log("⚡ [PRECARGA] Siguiente foto lista")}
          />
        )}

        {(!videoCargado || mostrarMiniatura) && thumbnailActual && (
          <Image 
            source={{ uri: thumbnailActual }} 
            style={StyleSheet.absoluteFill} 
            resizeMode="cover"
          />
        )}

        <Pressable 
          style={styles.capaToques}
          onPress={(evt) => {
            if (!estaActivo) return;
            evt.nativeEvent.locationX < width / 3 ? irAnterior() : irSiguiente();
          }}
          onLongPress={() => setPausadoManual(true)}
          onPressOut={() => setPausadoManual(false)}
        />
      </View>

      <BarraProgreso
        historias={historiasActuales}
        idxHistoria={idxHistoria}
        estaActivo={estaActivo}
        pausadoManual={pausadoManual}
        videoCargado={videoCargado}
        duracionVideo={duracionVideo}
        onTiempoCompleto={irSiguiente}
      />

      <TouchableOpacity style={styles.botonX} onPress={alCerrar}>
        <Ionicons name="close" size={34} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  capaToques: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 10 },
  motorOculto: { width: 1, height: 1, opacity: 0, position: 'absolute' },
  botonX: { position: 'absolute', top: 55, right: 20, zIndex: 30 }
});