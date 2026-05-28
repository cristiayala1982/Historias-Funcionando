import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
  NativeModules,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// --- COMPONENTES ---
import VistaPrevia from '../../../components/camara/VistaPrevia';

// --- FIREBASE (AISLADO PARA KOTLIN) ---
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '../../../firebaseConfig';

export default function HomeKotlinLaboratorio() {
  const router = useRouter();
  const navigation = useNavigation();

  const [usuarios, setUsuarios] = useState([]);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [archivoCapturado, setArchivoCapturado] = useState(null);
  const [idDestino, setIdDestino] = useState(null);
  const [publicandoId, setPublicandoId] = useState(null);
  const [progresoSubida, setProgresoSubida] = useState(0);

  // --- BOTÓN ATRÁS DEFENSIVO ---
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (archivoCapturado) {
          setArchivoCapturado(null);
          return true;
        }
        router.replace('/'); 
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove(); 
    }, [archivoCapturado])
  );

  // --- ESCUCHA EN TIEMPO REAL (COLECCIONES AISLADAS) ---
  useEffect(() => {
    const qU = query(collection(db, "usuarios_kotlin_lab"), orderBy("fecha", "desc"));
    const unsubU = onSnapshot(qU, (snapU) => {
      const users = snapU.docs.map(d => ({ id: d.id, ...d.data() }));
      const qH = query(collection(db, "historias_kotlin_lab"), orderBy("fecha", "asc"));
      
      onSnapshot(qH, (snapH) => {
        const stories = snapH.docs.map(d => d.data());
        const usersFinal = users.map(u => ({
          ...u,
          historias: stories.filter(h => h.usuarioId === u.id),
          publicado: stories.some(h => h.usuarioId === u.id)
        }));
        setUsuarios(usersFinal);
      });
    });
    return () => unsubU();
  }, []);

  const agregarUsuario = async () => {
    if (nuevoNombre.trim().length < 2) return;
    const colores = ['#FF4500', '#007AFF', '#34C759', '#AF52DE'];
    await addDoc(collection(db, "usuarios_kotlin_lab"), {
      nombre: nuevoNombre,
      color: colores[Math.floor(Math.random() * colores.length)],
      fecha: serverTimestamp()
    });
    setNuevoNombre('');
  };

  const levantarCamaraKotlin = async (usuarioId) => {
    if (NativeModules.HistoriasLabNative) {
      try {
        setIdDestino(usuarioId);
        const rutaCrudaAndroid = await NativeModules.HistoriasLabNative.abrirCamaraHistorias();
        const esVideo = rutaCrudaAndroid.endsWith('.mp4');
        setArchivoCapturado({
          tipo: esVideo ? 'video' : 'foto',
          uri: `file://${rutaCrudaAndroid}`
        });
      } catch (error) {
        console.log("ℹ️ Captura cancelada.");
      }
    }
  };

  const finalizarYSubirNativo = async () => {
    if (!archivoCapturado) return;
    const { uri, tipo } = archivoCapturado;
    setArchivoCapturado(null);
    setPublicandoId(idDestino);

    try {
      const archivoId = `${idDestino}_${Date.now()}`;
      const respuesta = await fetch(uri);
      const blobArchivo = await respuesta.blob();

      const esFoto = tipo === 'foto';
      // RUTA AISLADA EN STORAGE
      const storagePath = esFoto ? `kotlin_lab/fotos/${archivoId}.jpg` : `kotlin_lab/videos/${archivoId}.mp4`;
      const mimeType = esFoto ? 'image/jpeg' : 'video/mp4';

      const archivoRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(archivoRef, blobArchivo, { contentType: mimeType });

      uploadTask.on('state_changed', 
        (s) => setProgresoSubida((s.bytesTransferred / s.totalBytes) * 100),
        (error) => { console.error(error); setPublicandoId(null); },
        async () => {
          const urlPrincipal = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, "historias_kotlin_lab"), { 
            url: urlPrincipal, 
            thumbnail: urlPrincipal, 
            usuarioId: idDestino, 
            fecha: serverTimestamp(),
            tipo: esFoto ? 'foto' : 'hls_pending' 
          });
          setPublicandoId(null);
        }
      );
    } catch (e) { setPublicandoId(null); }
  };

  const reproducirConExoPlayerNativo = (usuario) => {
    const historias = usuario.historias || [];
    const historiasListas = historias.filter(h => h.hls_path || h.tipo === 'foto' || h.tipo === 'hls_pending');

    if (historiasListas.length === 0) {
      Alert.alert("Aviso", "No hay historias listas.");
      return;
    }

    const urls = historiasListas.map(h => h.hls_path || h.url);
    const tipos = historiasListas.map(h => h.tipo);
    const thumbnails = historiasListas.map(h => h.thumbnail || h.url);
    
    if (NativeModules.HistoriasLabNative) {
      NativeModules.HistoriasLabNative.abrirReproductorNativo(urls, tipos, thumbnails);
    }
  };

  if (archivoCapturado) {
    return <VistaPrevia archivo={archivoCapturado} onDescartar={() => setArchivoCapturado(null)} onPublicar={finalizarYSubirNativo} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.headerContainer}>
        <Text style={styles.header}>LABORATORIO KOTLIN (AISLADO)</Text>
      </View>
      <View style={styles.inputArea}>
        <TextInput style={styles.input} placeholder="Nombre del tester..." value={nuevoNombre} onChangeText={setNuevoNombre} />
        <TouchableOpacity style={styles.btnAgregar} onPress={agregarUsuario}><Ionicons name="add" size={30} color="white" /></TouchableOpacity>
      </View>
      <ScrollView style={styles.listaUsuarios} contentContainerStyle={{ paddingBottom: 100 }}>
        {usuarios.map(u => (
          <View key={u.id} style={styles.tarjetaTester}>
            <TouchableOpacity style={[styles.avatar, { backgroundColor: u.color }]} onPress={() => reproducirConExoPlayerNativo(u)}>
              <Text style={styles.avatarTxt}>{u.nombre?.substring(0, 2).toUpperCase()}</Text>
            </TouchableOpacity>
            <View style={styles.infoTester}>
              <Text style={styles.nombreTester}>{u.nombre}</Text>
              <Text style={styles.historiasCountTxt}>{u.publicado ? `🔥 ${u.historias.length} historias` : "Sin historias"}</Text>
            </View>
            <TouchableOpacity style={styles.btnMas} onPress={() => levantarCamaraKotlin(u.id)}><Ionicons name="add-circle" size={35} color="#EF4444" /></TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  headerContainer: { marginTop: 60, marginBottom: 10, alignItems: 'center' },
  header: { fontWeight: '900', fontSize: 15, letterSpacing: 2, color: '#000' },
  subHeader: { color: '#EF4444', fontSize: 11, fontWeight: 'bold', marginTop: 2 },
  inputArea: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 15, gap: 12, alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#F2F2F7', borderRadius: 15, paddingHorizontal: 18, height: 55, color: '#000', fontSize: 15 },
  btnAgregar: { backgroundColor: '#EF4444', width: 55, height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  listaUsuarios: { flex: 1, marginTop: 10, paddingHorizontal: 20 },
  tarjetaTester: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', padding: 15, borderRadius: 15, marginBottom: 10, borderWidth: 1, borderColor: '#EEE' },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  infoTester: { flex: 1, marginLeft: 15 },
  nombreTester: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  historiasCountTxt: { fontSize: 11, color: '#666', marginTop: 2 },
  btnMas: { padding: 5 }
});