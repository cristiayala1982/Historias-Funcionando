// === INICIO: IMPORTACIONES ===
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
// === FIN: IMPORTACIONES ===

export default function BarraProgreso({ 
  historias, 
  idxHistoria, 
  estaActivo, 
  pausadoManual, 
  videoCargado, 
  duracionVideo, 
  onTiempoCompleto 
}) {
  const [progreso, setProgreso] = useState(0);
  const timerRef = useRef(null);
  const estaMontadoRef = useRef(true);

  // Detectamos inteligentemente el tipo de la historia actual
  const historiaActual = historias[idxHistoria];
  const esFoto = historiaActual?.tipo === 'foto';

  useEffect(() => {
    estaMontadoRef.current = true;
    return () => {
      estaMontadoRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Controlar reseteos al cambiar de historia o si sale de pantalla
  useEffect(() => {
    setProgreso(0);
    if (!estaActivo && timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [idxHistoria, estaActivo]);

  // Manejo del intervalo (Timer de la barra adaptado)
  useEffect(() => {
    // 1. Si no está activo o está pausado con el dedo, frenamos el timer
    if (!estaActivo || pausadoManual || !estaMontadoRef.current) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // 2. Definimos la duración real de este paso de la barra
    let tiempoTotalHistoria = 0;

    if (esFoto) {
      // Si es foto, le clavamos 5000 milisegundos (5 segundos) de duración fija
      tiempoTotalHistoria = 5000;
    } else {
      // Si es video, validamos que ya esté cargado y tenga duración real
      if (!videoCargado || duracionVideo <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }
      tiempoTotalHistoria = duracionVideo;
    }

    // Limpieza preventiva de intervalos viejos
    if (timerRef.current) clearInterval(timerRef.current);

    const interval = 50; 
    const incremento = (interval / tiempoTotalHistoria) * 100;

    timerRef.current = setInterval(() => {
      if (!estaMontadoRef.current) return;

      setProgreso((prev) => {
        if (prev >= 100) {
          clearInterval(timerRef.current);
          setTimeout(() => {
            if (estaMontadoRef.current) onTiempoCompleto();
          }, 0);
          return 100;
        }
        return prev + incremento;
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [idxHistoria, estaActivo, pausadoManual, videoCargado, duracionVideo, esFoto]);

  return (
    <View style={styles.contenedorBarras}>
      {historias.map((_, i) => (
        <View key={i} style={styles.fondoBarra}>
          <View 
            style={[
              styles.rellenoBarra, 
              { width: i < idxHistoria ? '100%' : i === idxHistoria ? `${progreso}%` : '0%' }
            ]} 
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedorBarras: { position: 'absolute', top: 40, left: 10, right: 10, flexDirection: 'row', gap: 5, zIndex: 20 },
  fondoBarra: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 2, overflow: 'hidden' },
  rellenoBarra: { height: '100%', backgroundColor: 'white' }
});