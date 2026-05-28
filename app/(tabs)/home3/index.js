// === INICIO: IMPORTACIONES ===
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Dimensions, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// --- COMPONENTES ---
import CamaraLab3 from '../../../components/camara/CamaraLab3';
import ReproductorItem from '../../../components/componentes_home3/ReproductorVideo.js'; // Ahora actúa como ítem individual

// --- FIREBASE ---
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '../../../firebaseConfig';
// === FIN: IMPORTACIONES ===

const { width, height } = Dimensions.get('window');

export default function Home3() {
  const navigation = useNavigation();
  const [usuarios, setUsuarios] = useState([]);
  const [nuevoNombre, setNuevoNombre] = useState('');
  
  // Control de visibilidad del Carrusel Profesional
  const [indiceUsuarioActivo, setIndiceUsuarioActivo] = useState(null); 
  const [mostrarReproductor, setMostrarReproductor] = useState(false);

  const [publicandoId, setPublicandoId] = useState(null);
  const [mostrarCamara, setMostrarCamara] = useState(false);
  const [idDestino, setIdDestino] = useState(null);
  const [progresoSubida, setProgresoSubida] = useState(0);
  
  const router = useRouter(); 
  const flatListRef = useRef(null);

  // Filtrar solo los usuarios que tienen historias listas
  const usuariosConHistorias = usuarios.filter(u => u.publicado && u.historias && u.historias.length > 0);

// --- CONTROL DEL BOTÓN ATRÁS DEFENSIVO ---
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (mostrarReproductor) {
          cerrarReproductor();
          return true; // Bloquea y solo cierra el modal
        }
        if (mostrarCamara) {
          setMostrarCamara(false);
          return true; // Bloquea y solo cierra la cámara
        }
        router.replace('/'); 
        return true; // Retornar true le dice a Android: "Yo ya me encargué de la acción, no hagas nada más"
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove(); 
    }, [mostrarReproductor, mostrarCamara])
  );

  // --- OCULTAR TABS EN REPRODUCTOR ---
  useEffect(() => {
    navigation.getParent()?.setOptions({
      tabBarStyle: mostrarReproductor ? { display: 'none' } : { 
        backgroundColor: '#ffffff',
        position: 'absolute',
        bottom: 30,
        left: 25,
        right: 25,
        borderRadius: 30,
        height: 60,
        display: 'flex',
        borderTopWidth: 0,
      }
    });
  }, [mostrarReproductor]);

  // --- ESCUCHA DE FIREBASE ---
  useEffect(() => {
    const qU = query(collection(db, "usuarios_hls"), orderBy("fecha", "desc"));
    const unsubU = onSnapshot(qU, (snapU) => {
      const users = snapU.docs.map(d => ({ id: d.id, ...d.data() }));
      const qH = query(collection(db, "historias_hls"), orderBy("fecha", "asc"));
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
    await addDoc(collection(db, "usuarios_hls"), {
      nombre: nuevoNombre,
      color: colores[Math.floor(Math.random() * colores.length)],
      fecha: serverTimestamp()
    });
    setNuevoNombre('');
  };

    const finalizarYSubirHLS = async ({ uri, thumbnailUri, idUsuarioDestino, tipo }) => {
    setMostrarCamara(false);
    setPublicandoId(idUsuarioDestino);

    try {
      const archivoId = `${idUsuarioDestino}_${Date.now()}`;
      const respuesta = await fetch(uri);
      const blobArchivo = await respuesta.blob();

      // 📁 DETERMINAMOS LA CARPETA Y EXTENSIÓN SEGÚN EL TIPO
      let storagePath = `hls_lab/${archivoId}.mp4`; // Por defecto video
      let metadata = {};

      if (tipo === 'foto') {
        storagePath = `fotos_lab/${archivoId}.jpg`; // 📸 Carpeta limpia de fotos
        metadata = { contentType: 'image/jpeg' };
      }

      console.log(`📤 [SUBIDA] Subiendo ${tipo || 'video'} a Storage en: ${storagePath}`);
      const archivoRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(archivoRef, blobArchivo, metadata);

      uploadTask.on('state_changed', 
        (s) => setProgresoSubida((s.bytesTransferred / s.totalBytes) * 100),
        (error) => {
           console.error("❌ Error en subida:", error);
           setPublicandoId(null);
        },
        async () => {
          const urlPrincipal = await getDownloadURL(uploadTask.snapshot.ref);
          let urlThumbnail = null;

          // Las miniaturas solo aplican si es un video (las fotos no necesitan otra miniatura extra)
          if (thumbnailUri && tipo !== 'foto') {
            try {
              const resThumb = await fetch(thumbnailUri);
              const blobThumb = await resThumb.blob(); 
              const thumbRef = ref(storage, `thumbnails/${archivoId}.jpg`);
              const thumbTask = uploadBytesResumable(thumbRef, blobThumb, { contentType: 'image/jpeg' });
              
              await new Promise((resolve, reject) => {
                thumbTask.on('state_changed', null, reject, resolve);
              });
              urlThumbnail = await getDownloadURL(thumbTask.snapshot.ref);
            } catch (thumbError) {
              console.warn("⚠️ Falló miniatura:", thumbError.message);
            }
          }

          // 📝 GUARDAMOS EN FIRESTORE CON SU TIPO REAL
          const tipoFirestore = tipo === 'foto' ? 'foto' : 'hls_pending';

          await addDoc(collection(db, "historias_hls"), { 
            url: urlPrincipal, 
            thumbnail: tipo === 'foto' ? urlPrincipal : urlThumbnail, // Si es foto, la miniatura es la foto misma
            usuarioId: idUsuarioDestino, 
            fecha: serverTimestamp(),
            tipo: tipoFirestore 
          });

          console.log(`✅ [FIRESTORE] Registro creado con tipo: ${tipoFirestore}`);

          // Limpieza de archivos temporales del celu
          try {
            await FileSystem.deleteAsync(uri, { idempotent: true });
            if (thumbnailUri) await FileSystem.deleteAsync(thumbnailUri, { idempotent: true });
          } catch (e) {}
          
          setPublicandoId(null);
          setProgresoSubida(0);
        }
      );
    } catch (e) {
      console.error("❌ Error general en la subida:", e);
      setPublicandoId(null);
    }
  };

  const abrirReproductor = (index) => {
    setIndiceUsuarioActivo(index);
    setMostrarReproductor(true);
  };

  const cerrarReproductor = () => {
    setMostrarReproductor(false);
    setIndiceUsuarioActivo(null);
  };

  // Escucha el cambio de página manual por deslizamiento (Swipe)
  const alCambiarDeCelda = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const nuevoIndex = viewableItems[0].index;
      setIndiceUsuarioActivo(nuevoIndex);
    }
  }).current;

  if (mostrarCamara) return (
    <View style={styles.cameraContainer}>
      <CamaraLab3 idUsuario={idDestino} onVideoGrabado={finalizarYSubirHLS} />
      <TouchableOpacity style={styles.btnCerrarCam} onPress={() => setMostrarCamara(false)}>
        <Ionicons name="close" size={35} color="white" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>LABORATORIO HLS</Text>
        <Text style={styles.subHeader}>Streaming Adaptativo Pro</Text>
      </View>

      <View style={styles.inputArea}>
        <TextInput 
          style={styles.input} 
          placeholder="Nombre del nuevo tester..." 
          value={nuevoNombre} 
          onChangeText={setNuevoNombre} 
          placeholderTextColor="#999" 
        />
        <TouchableOpacity style={styles.btnAgregar} onPress={agregarUsuario}>
          <Ionicons name="add" size={30} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.listaUsuarios} contentContainerStyle={{ paddingBottom: 100 }}>
        {usuarios.map(u => (
          <View key={u.id} style={styles.tarjetaTester}>
            <TouchableOpacity 
              style={[styles.avatar, { backgroundColor: u.color || '#007AFF' }]} 
              onPress={() => {
                const idxFiltrado = usuariosConHistorias.findIndex(user => user.id === u.id);
                if (idxFiltrado !== -1) abrirReproductor(idxFiltrado);
              }}
            >
              <Text style={styles.avatarTxt}>{u.nombre ? u.nombre.substring(0, 2).toUpperCase() : 'U'}</Text>
            </TouchableOpacity>
            
            <View style={styles.infoTester}>
              <Text style={styles.nombreTester}>{u.nombre}</Text>
              {publicandoId === u.id && (
                <Text style={styles.subiendoTxt}>Subiendo: {Math.round(progresoSubida)}%</Text>
              )}
            </View>

            <TouchableOpacity style={styles.btnMas} onPress={() => {
              setIdDestino(u.id); 
              setMostrarCamara(true);
            }}>
              <Ionicons name="add-circle" size={35} color="#007AFF" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* CARRUSEL DE PRECARGA NATIVO ESTILO INSTAGRAM */}
      <Modal visible={mostrarReproductor} transparent={false} animationType="fade" onRequestClose={cerrarReproductor}>
        <View style={styles.modalContainer}>
          <FlatList
            ref={flatListRef}
            data={usuariosConHistorias}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            initialScrollIndex={indiceUsuarioActivo}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            onViewableItemsChanged={alCambiarDeCelda}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }} // Evita gatillar reproducciones falsas
            renderItem={({ item, index }) => (
              <View style={{ width, height }}>
                <ReproductorItem
                  usuario={item}
                  estaActivo={index === indiceUsuarioActivo} // <-- CLAVE: Le dice al motor si debe reproducirse o precargarse
                  irSiguienteUsuario={() => {
                    if (index < usuariosConHistorias.length - 1) {
                      flatListRef.current?.scrollToIndex({ index: index + 1, animated: true });
                    } else {
                      cerrarReproductor();
                    }
                  }}
                  irAnteriorUsuario={() => {
                    if (index > 0) {
                      flatListRef.current?.scrollToIndex({ index: index - 1, animated: true });
                    }
                  }}
                  alCerrar={cerrarReproductor}
                />
              </View>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  modalContainer: { flex: 1, backgroundColor: 'black' },
  headerContainer: { marginTop: 60, marginBottom: 10, alignItems: 'center' },
  header: { fontWeight: '900', fontSize: 16, letterSpacing: 2, color: '#000' },
  subHeader: { color: '#007AFF', fontSize: 11, fontWeight: 'bold', marginTop: 2 },
  inputArea: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 15, gap: 12, alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#F2F2F7', borderRadius: 15, paddingHorizontal: 18, height: 55, color: '#000', fontSize: 15 },
  btnAgregar: { backgroundColor: '#007AFF', width: 55, height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  listaUsuarios: { flex: 1, marginTop: 10, paddingHorizontal: 20 },
  cameraContainer: { flex: 1, backgroundColor: 'black' },
  btnCerrarCam: { position: 'absolute', top: 50, left: 20, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 25 },
  tarjetaTester: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', padding: 15, borderRadius: 15, marginBottom: 10, borderWidth: 1, borderColor: '#EEE' },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  infoTester: { flex: 1, marginLeft: 15 },
  nombreTester: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  subiendoTxt: { fontSize: 12, color: '#007AFF', marginTop: 2 },
  btnMas: { padding: 5 }
});