import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import Video from 'react-native-video';
import BarraProgreso from './BarraProgreso'; // Asegurá que la ruta sea correcta

const { width } = Dimensions.get('window');

export default function ReproductorHLS({ usuario, estaActivo, irSiguienteUsuario, irAnteriorUsuario, alCerrar }) {
  
  const [idxHistoria, setIdxHistoria] = useState(0);
  const [pausadoManual, setPausadoManual] = useState(false);
  const [estaListo, setEstaListo] = useState(false); 
  const [duracionVideo, setDuracionVideo] = useState(5000); 
  const [videoCargado, setVideoCargado] = useState(false); 
  const [mostrarMiniatura, setMostrarMiniatura] = useState(true);

  const historiasActuales = usuario?.historias || [];
  const historiaActual = historiasActuales[idxHistoria];
  const urlActual = historiasActuales[idxHistoria]?.url;
  const thumbnailActual = historiasActuales[idxHistoria]?.thumbnail;
  const esFoto = historiaActual?.tipo === 'foto';

  const tieneSiguienteInterno = idxHistoria < historiasActuales.length - 1;
  const urlSiguienteInterna = tieneSiguienteInterno ? historiasActuales[idxHistoria + 1]?.url : null;
  const siguienteEsFoto = tieneSiguienteInterno ? historiasActuales[idxHistoria + 1]?.tipo === 'foto' : false;
  // ⚡ NUEVO: Guardamos la url si la que viene es foto para mandarla a la precarga
  const urlSiguienteFoto = (tieneSiguienteInterno && siguienteEsFoto) ? urlSiguienteInterna : null;
  const estaMontadoRef = useRef(true);

  useEffect(() => {
    estaMontadoRef.current = true;
    return () => { estaMontadoRef.current = false; };
  }, []);

  // Sincronización absoluta al activar/desactivar la celda en el FlatList horizontal
  useEffect(() => {
    if (estaActivo) {
      setMostrarMiniatura(true);
      setPausadoManual(false);
      
      // La barra y el estado "listo" esperan un instante para no saturar
      const tListo = setTimeout(() => {
          if (estaMontadoRef.current) {
            setEstaListo(true);
            
            if (esFoto) {
              // 📸 Si es foto, activa la barra al toque con 5 segundos fijos
              setDuracionVideo(5000); 
              setVideoCargado(true);
              setMostrarMiniatura(false);
            } else if (duracionVideo > 0) {
              setVideoCargado(true);
            }
          }
        }, 250);

      return () => clearTimeout(tListo);
    } else {
      // Al salir, solo reseteamos el índice interno y los buffers secundarios
      setIdxHistoria(0);
      setVideoCargado(false);
      setPausadoManual(false);
      setEstaListo(false);
    }
  }, [estaActivo]);

  // Reset al cambiar de historia interna (mismo usuario)
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
        
        {/* 📸 SI ES FOTO: Mostramos la imagen nativa sin usar el motor de video */}
{/* 📸 SI ES FOTO: Con onLoad para evitar pantallas negras intermedias */}
{urlActual && esFoto && (
  <Image
    source={{ uri: urlActual }}
    style={StyleSheet.absoluteFill}
    resizeMode="cover"
    onLoad={() => {
      if (estaMontadoRef.current && estaActivo) {
        setVideoCargado(true); // Arranca la barrita de progreso
        setMostrarMiniatura(false); // Apaga el escudo visual sin baches
      }
    }}
  />
)}

{/* 🎥 SI ES VIDEO: Dejamos tu motor exactamente igual, pero sumamos !esFoto */}
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
              const msReales = data.duration * 1000;
              if (estaMontadoRef.current) {
                setDuracionVideo(msReales);
                if (estaActivo) setVideoCargado(true); 
              }
            }
          }}
          onReadyForDisplay={() => {
            if (estaMontadoRef.current && estaActivo) {
              setMostrarMiniatura(false);
            }
          }}
          bufferConfig={{
            minBufferMs: 1000,
            maxBufferMs: 2500,
            bufferForPlaybackMs: 300,   
            bufferForPlaybackAfterRebufferMs: 800
          }}
          onError={(e) => console.log("❌ Error Video Activo:", e)}
        />
      )}

        {/* MOTOR 2: ESPEJO PRECARGA INTERNA (Este sí queda condicionado a estar quieto) */}
         {/* MOTOR 2: ESPEJO PRECARGA INTERNA */}
        {estaActivo && estaListo && urlSiguienteInterna && !siguienteEsFoto && (
          <View style={styles.motorOculto}>
            <Video
              source={{ uri: urlSiguienteInterna }}
              paused={true} 
              useTextureView={true}
              bufferConfig={{
                minBufferMs: 1500,
                maxBufferMs: 3000,
                bufferForPlaybackMs: 500,
                bufferForPlaybackAfterRebufferMs: 1000
              }}
              onError={(e) => console.log("ℹ️ Buffer interno preparándose")}
            />
          </View>
        )}

        {/* 📸 MOTOR 3: ESPEJO PRECARGA PARA FOTOS (Invisible de 1x1 píxel) */}
          {estaActivo && estaListo && urlSiguienteFoto && (
            <Image
              source={{ uri: urlSiguienteFoto }}
              style={{ width: 1, height: 1, position: 'absolute', opacity: 0 }}
              onLoad={() => console.log("⚡ [PRECARGA] Siguiente foto lista en caché")}
            />
          )}
        {/* CAPA DE MINIATURA CONTROLADA */}
        {(!videoCargado || mostrarMiniatura) && thumbnailActual && (
          <Image 
            source={{ uri: thumbnailActual }} 
            style={StyleSheet.absoluteFill} 
            resizeMode="cover"
          />
        )}

        {/* CAPA DE TOQUES TÁCTILES */}
        <Pressable 
          style={styles.capaToques}
          delayLongPress={250}
          pressRetentionOffset={{ top: 150, bottom: 150, left: 150, right: 150 }}
          onPress={(evt) => {
            if (!estaActivo) return;
            const toqueX = evt.nativeEvent.locationX;
            if (toqueX < width / 3) {
              irAnterior();
            } else {
              irSiguiente();
            }
          }}
          onLongPress={() => setPausadoManual(true)}
          onPressOut={() => {
            if (pausadoManual) setPausadoManual(false);
          }}
        />
      </View>

      {/* BARRA DE PROGRESO AISLADA */}
      <BarraProgreso
        historias={historiasActuales}
        idxHistoria={idxHistoria}
        estaActivo={estaActivo}
        pausadoManual={pausadoManual}
        videoCargado={videoCargado}
        duracionVideo={duracionVideo}
        onTiempoCompleto={irSiguiente}
      />

      {/* BOTÓN CERRAR */}
      <TouchableOpacity style={styles.botonX} onPress={alCerrar}>
        <Ionicons name="close" size={34} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  capaToques: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'transparent', zIndex: 10 },
  motorOculto: { width: 1, height: 1, opacity: 0, position: 'absolute' },
  botonX: { position: 'absolute', top: 55, right: 20, zIndex: 30 }
});