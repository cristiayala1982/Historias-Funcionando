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

  // Función para manejar el botón de Historias Kotlin
  const manejarHistoriasKotlin = () => {
    router.push('/(tabs)/homekotlin');
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Text style={styles.titulo}>LABORATORIO</Text>
      
      <View style={styles.card}>
        <Text style={styles.valor}>{info.modelo}</Text>
        <Text style={[styles.perfil, { color: info.perfil === "GAMA ALTA" ? '#D97706' : '#EF4444' }]}>
          {info.perfil} ({info.ram} GB RAM)
        </Text>
      </View>

      <Text style={styles.seccionTitulo}>MÓDULOS JAVASCRIPT (PROYECTO 1)</Text>
      <View style={styles.menu}>
        <TouchableOpacity style={[styles.btn, styles.btnJS]} onPress={() => router.push('/(tabs)/home3')}>
          <Text style={styles.btnTxt}>INGRESAR A HISTORIAS HLS</Text>
          <Text style={styles.subTxt}>Streaming fluido con fragmentación de video</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, styles.btnJS]} onPress={() => router.push('/(tabs)/chats')}>
          <Text style={styles.btnTxt}>INGRESAR A CHAT LAB</Text>
          <Text style={styles.subTxt}>Pruebas de teclado fluido y notas de voz</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.seccionTitulo}>MÓDULOS KOTLIN (PROYECTO 2)</Text>
      <View style={styles.menu}>
        {/* BOTÓN HISTORIAS KOTLIN CONECTADO AL MODULO NATIVO */}
        <TouchableOpacity style={[styles.btn, styles.btnKotlin]} onPress={manejarHistoriasKotlin}>
          <Text style={styles.btnTxt}>HISTORIAS KOTLIN NATIVO</Text>
          <Text style={styles.subTxt}>Máxima fluidez con ExoPlayer y buffer inteligente</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, styles.btnKotlin]} onPress={() => router.push('/(tabs)/chat-kotlin')}>
          <Text style={styles.btnTxt}>CHAT KOTLIN NATIVO</Text>
          <Text style={styles.subTxt}>Control total del teclado por hardware y WindowInsets</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F2', padding: 20 },
  titulo: { color: '#4A3B32', fontSize: 26, fontWeight: 'bold', marginTop: 50, textAlign: 'center' },
  card: { backgroundColor: '#FFFDF9', padding: 20, borderRadius: 15, marginVertical: 20, alignItems: 'center', borderWidth: 1, borderColor: '#EAE3D2', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  valor: { color: '#4A3B32', fontSize: 20, fontWeight: 'bold' },
  perfil: { marginTop: 5, fontWeight: 'bold', fontSize: 14 },
  seccionTitulo: { color: '#7C6A5A', fontSize: 13, fontWeight: 'bold', marginTop: 25, marginBottom: 10, letterSpacing: 1 },
  menu: { gap: 12, marginBottom: 15 },
  btn: { padding: 18, borderRadius: 15, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  btnJS: { backgroundColor: '#FDBA74', borderColor: '#F97316' },
  btnKotlin: { backgroundColor: '#FCA5A5', borderColor: '#EF4444' },
  btnTxt: { color: '#4A1D1D', fontWeight: 'bold', fontSize: 15, textAlign: 'center' },
  subTxt: { color: '#6B4E4E', fontSize: 11, marginTop: 4, textAlign: 'center', fontWeight: '500' }
});