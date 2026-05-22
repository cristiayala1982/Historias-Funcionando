import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function MenuLaboratorio() {
  const router = useRouter();
  const [info, setInfo] = useState({ modelo: '', ram: 0, perfil: '' });

  useEffect(() => {
    const ramTotal = Device.totalMemory ? Device.totalMemory / (1024 ** 3) : 0;
    const modelo = Device.modelName || "Celular";
    let perfilAsignado = ramTotal > 4 ? "GAMA ALTA" : "GAMA BAJA";
    setInfo({ modelo, ram: ramTotal.toFixed(2), perfil: perfilAsignado });
  }, []);

  return (
    <ScrollView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.titulo}>LABORATORIO</Text>
      
      <View style={styles.card}>
        <Text style={styles.valor}>{info.modelo}</Text>
        <Text style={[styles.perfil, { color: info.perfil === "GAMA ALTA" ? '#00FF00' : '#FF4500' }]}>
          {info.perfil} ({info.ram} GB RAM)
        </Text>
      </View>

      <View style={styles.menu}>
        {/* DEJAMOS SOLO EL BOTÓN PARA HOME 3 */}
        <TouchableOpacity style={styles.btn} onPress={() => router.push('/(tabs)/home3')}>
          <Text style={styles.btnTxt}>INGRESAR A HISTORIAS HLS</Text>
          <Text style={styles.subTxt}>Streaming fluido con fragmentación de video</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 20 },
  titulo: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 50, textAlign: 'center' },
  card: { backgroundColor: '#111', padding: 20, borderRadius: 15, marginVertical: 30, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  valor: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  perfil: { fontSpread: 'bold', marginTop: 5, fontWeight: 'bold' },
  menu: { gap: 15 },
  btn: { backgroundColor: '#1E90FF', padding: 20, borderRadius: 15, borderWidth: 1, borderColor: '#3385ff' }, // Un azul llamativo para el botón único
  btnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
  subTxt: { color: '#ddd', fontSize: 12, marginTop: 4, textAlign: 'center' }
});