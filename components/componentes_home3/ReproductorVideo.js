import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, Image, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import BarraProgreso from './BarraProgreso';

const { width } = Dimensions.get('window');

const obtenerUrlPublica = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const bucket = "historiaslab-7672a.firebasestorage.app";
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
};

export default function ReproductorVideo({ usuario, estaActivo, irSiguienteUsuario, irAnteriorUsuario, alCerrar, onEliminarHistoria }) {
  
  const [idxHistoria, setIdxHistoria] = useState(0);
  const [pausadoManual, setPausadoManual] = useState(false);
  const [videoCargado, setVideoCargado] = useState(false); 
  const [mostrarMiniatura, setMostrarMiniatura] = useState(true);
  const [duracionVideo, setDuracionVideo] = useState(5000);

  const historiasActuales = usuario?.historias || [];
  const historiaActual = historiasActuales[idxHistoria];
  const historiaSiguiente = historiasActuales[idxHistoria + 1];

  const urlActual = obtenerUrlPublica(historiaActual?.url);
  const thumbnailActual = historiaActual?.thumbnail;
  const esFoto = historiaActual?.tipo === 'foto';

  const urlSiguiente = obtenerUrlPublica(historiaSiguiente?.url);
  const siguienteEsFoto = historiaSiguiente?.tipo === 'foto';

  const estaMontadoRef = useRef(true);

  // REPRODUCTOR A: Se encarga de los índices PARES (0, 2, 4...)
  const playerA = useVideoPlayer(idxHistoria % 2 === 0 ? urlActual : (!siguienteEsFoto ? urlSiguiente : null), (p) => {
    p.loop = false;
  });

  // REPRODUCTOR B: Se encarga de los índices IMPARES (1, 3, 5...)
  const playerB = useVideoPlayer(idxHistoria % 2 !== 0 ? urlActual : (!siguienteEsFoto ? urlSiguiente : null), (p) => {
    p.loop = false;
  });

  // Determinar cuál es el reproductor que debe sonar y verse AHORA
  const reproductorActivo = idxHistoria % 2 === 0 ? playerA : playerB;

  useEffect(() => {
    estaMontadoRef.current = true;
    return () => { estaMontadoRef.current = false; };
  }, []);

  // Sincronizar Play / Pause del reproductor activo e iniciar la precarga silenciosa del otro
  useEffect(() => {
    if (!estaActivo) {
      playerA.pause();
      playerB.pause();
      return;
    }

    if (esFoto) {
      playerA.pause();
      playerB.pause();
    } else if (reproductorActivo) {
      if (!pausadoManual) {
        reproductorActivo.muted = false;
        reproductorActivo.play();
      } else {
        reproductorActivo.pause();
      }
    }
  }, [estaActivo, pausadoManual, reproductorActivo, esFoto, idxHistoria]);

  // Manejo del estado de carga, duración y fin del video
  useEffect(() => {
    if (!estaActivo) {
      setIdxHistoria(0);
      setVideoCargado(false);
      setMostrarMiniatura(true);
      return;
    }

    if (esFoto) {
      setDuracionVideo(5000);
      setVideoCargado(true);
      setMostrarMiniatura(false);
    } else if (reproductorActivo) {
      
      const verificarEstadoVideo = () => {
        if (!estaMontadoRef.current) return;
        const status = reproductorActivo.status?.state || reproductorActivo.status;
        
        if (status === 'readyToPlay') {
          setVideoCargado(true);
          setMostrarMiniatura(false);
          if (reproductorActivo.duration) {
            setDuracionVideo(reproductorActivo.duration * 1000);
          }
        }
      };

      const suscripcionStatus = reproductorActivo.addListener('statusChange', verificarEstadoVideo);
      const suscripcionEnd = reproductorActivo.addListener('playToEnd', () => {
        if (estaMontadoRef.current) irSiguiente();
      });

      verificarEstadoVideo();

      return () => {
        suscripcionStatus.remove();
        suscripcionEnd.remove();
      };
    }
  }, [estaActivo, idxHistoria, esFoto, reproductorActivo]);

  useEffect(() => {
    if (idxHistoria > historiasActuales.length - 1) {
      setIdxHistoria(Math.max(0, historiasActuales.length - 1));
    }
  }, [historiasActuales.length, idxHistoria]);

  const irSiguiente = () => {
    if (idxHistoria < historiasActuales.length - 1) {
      setVideoCargado(false);
      setMostrarMiniatura(true);
      setIdxHistoria(idxHistoria + 1);
    } else {
      irSiguienteUsuario();
    }
  };

  const irAnterior = () => {
    setVideoCargado(false);
    setMostrarMiniatura(true);
    if (idxHistoria > 0) {
      setIdxHistoria(idxHistoria - 1);
    } else {
      irAnteriorUsuario();
    }
  };

  const confirmarEliminarHistoriaActual = () => {
    if (!historiaActual?.id || !onEliminarHistoria) return;

    Alert.alert(
      'Borrar historia',
      'Esta historia se eliminara de forma permanente. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            await onEliminarHistoria(historiaActual);
          },
        },
      ]
    );
  };

  if (!usuario) return null;

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill}>
        
        {/* Renderizado de Fotos */}
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

        {/* Renderizado de Videos utilizando el reproductor activo actual */}
        {urlActual && !esFoto && reproductorActivo && (
          <VideoView
            player={reproductorActivo}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
          />
        )}

        {/* Miniatura de Carga */}
        {(!videoCargado || mostrarMiniatura) && thumbnailActual && (
          <Image 
            source={{ uri: thumbnailActual }} 
            style={StyleSheet.absoluteFill} 
            resizeMode="cover"
          />
        )}

        {/* Capa de Toques */}
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

      <View style={styles.accionesSuperiores}>
        <TouchableOpacity style={styles.botonAccion} onPress={confirmarEliminarHistoriaActual}>
          <Ionicons name="trash-outline" size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.botonAccion} onPress={alCerrar}>
          <Ionicons name="close" size={30} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  capaToques: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 10 },
  accionesSuperiores: {
    position: 'absolute',
    top: 55,
    right: 20,
    zIndex: 30,
    flexDirection: 'row',
    gap: 10,
  },
  botonAccion: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});