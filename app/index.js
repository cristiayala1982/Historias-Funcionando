import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
// 💥 Agregamos PermissionsAndroid y Platform acá abajo
import { PermissionsAndroid, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function MenuLaboratorio() {
  const router = useRouter();
  const [info, setInfo] = useState({ modelo: '', ram: 0, perfil: '' });

  useEffect(() => {
    // 1. Configuración de información del dispositivo
    const ramTotal = Device.totalMemory ? Device.totalMemory / (1024 ** 3) : 0;
    const modelo = Device.modelName || "Celular";
    let perfilAsignado = ramTotal > 4 ? "GAMA ALTA" : "GAMA BAJA";
    setInfo({ modelo, ram: ramTotal.toFixed(2), perfil: perfilAsignado });

    // 2. 🚀 SOLICITUD DE PERMISOS AUTOMÁTICA AL INSTALAR/ARRANCAR
    const solicitarPermisosIniciales = async () => {
      if (Platform.OS === 'android') {
        try {
          // Esto pide Cámara y Micrófono juntos de una sola vez y no vuelve a molestar
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.CAMERA,
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          ]);
        } catch (err) {
          console.warn("Error al solicitar permisos en el arranque:", err);
        }
      }
    };

    solicitarPermisosIniciales();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.backgroundBlobTop} />
      <View style={styles.backgroundBlobBottom} />

      <View style={styles.heroCard}>
        <Text style={styles.kicker}>HISTORIASLAB</Text>
        <Text style={styles.titulo}>Panel de Laboratorio</Text>
        <Text style={styles.heroDescripcion}>
          Centro de pruebas para historias HLS y chat multimedia.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Ionicons name="phone-portrait-outline" size={20} color="#0B3B60" />
          <Text style={styles.infoTitulo}>Dispositivo activo</Text>
        </View>
        <Text style={styles.valor}>{info.modelo}</Text>
        <View style={styles.badgesRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{info.perfil}</Text>
          </View>
          <View style={styles.badgeSecondary}>
            <Text style={styles.badgeTxtSec}>{info.ram} GB RAM</Text>
          </View>
        </View>
      </View>

      <Text style={styles.seccionTitulo}>MODULOS ACTIVOS</Text>
      <View style={styles.menu}>
        <TouchableOpacity style={[styles.moduloCard, styles.moduloHistorias]} onPress={() => router.push('/(tabs)/home3')} activeOpacity={0.9}>
          <View style={styles.moduloIconWrap}>
            <Ionicons name="sparkles-outline" size={22} color="#7C2D12" />
          </View>
          <View style={styles.moduloTextoWrap}>
            <Text style={styles.moduloTitulo}>Historias HLS</Text>
            <Text style={styles.moduloSubtitulo}>Streaming fluido con fragmentacion de video</Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={30} color="#9A3412" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.moduloCard, styles.moduloChat]} onPress={() => router.push('/(tabs)/chats')} activeOpacity={0.9}>
          <View style={styles.moduloIconWrap}>
            <Ionicons name="chatbubbles-outline" size={22} color="#123B36" />
          </View>
          <View style={styles.moduloTextoWrap}>
            <Text style={styles.moduloTitulo}>Chat Lab</Text>
            <Text style={styles.moduloSubtitulo}>Pruebas de audio, video y teclado rapido</Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={30} color="#14532D" />
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F8FB',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  backgroundBlobTop: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#DDF0FF',
  },
  backgroundBlobBottom: {
    position: 'absolute',
    bottom: 120,
    left: -70,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#FFE8D2',
  },
  heroCard: {
    marginTop: 28,
    backgroundColor: '#0B3B60',
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 18,
    shadowColor: '#0B3B60',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },
  kicker: {
    color: '#A5D8FF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  titulo: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
  },
  heroDescripcion: {
    marginTop: 8,
    color: '#DCEEFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  infoCard: {
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#D8EAF8',
    shadowColor: '#4A6B85',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoTitulo: {
    color: '#0B3B60',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  valor: {
    color: '#102A43',
    fontSize: 19,
    fontWeight: '800',
    marginTop: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  badge: {
    backgroundColor: '#E6F4FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeTxt: {
    color: '#0C4A6E',
    fontWeight: '700',
    fontSize: 12,
  },
  badgeSecondary: {
    backgroundColor: '#FFF3E6',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeTxtSec: {
    color: '#9A3412',
    fontWeight: '700',
    fontSize: 12,
  },
  seccionTitulo: {
    color: '#33546E',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 24,
    marginBottom: 10,
    letterSpacing: 1.2,
  },
  menu: {
    gap: 12,
    marginBottom: 15,
  },
  moduloCard: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  moduloHistorias: {
    backgroundColor: '#FFEFE3',
    borderColor: '#FED7AA',
  },
  moduloChat: {
    backgroundColor: '#E9FBF3',
    borderColor: '#BBF7D0',
  },
  moduloIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduloTextoWrap: {
    flex: 1,
  },
  moduloTitulo: {
    color: '#1F2937',
    fontWeight: '800',
    fontSize: 15,
  },
  moduloSubtitulo: {
    marginTop: 3,
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '500',
  },
});