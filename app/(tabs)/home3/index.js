// === INICIO: IMPORTACIONES ===
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Dimensions, FlatList, Modal, NativeModules, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// --- COMPONENTES ---
import VistaPrevia from '../../../components/camara/VistaPrevia';
import { comprimirVideoPro } from '../../../components/componentes_home3/compresor3';
import ReproductorItem from '../../../components/componentes_home3/ReproductorVideo.js';
// --- FIREBASE ---
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
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
  const [idDestino, setIdDestino] = useState(null);
  const [progresoSubida, setProgresoSubida] = useState(0);
  const [archivoCapturado, setArchivoCapturado] = useState(null); // <-- ARCHIVO DE KOTLIN
  const router = useRouter(); 
  const flatListRef = useRef(null);

  // Filtrar solo los usuarios que tienen historias listas
  const usuariosConHistorias = usuarios.filter(u => u.publicado && u.historias && u.historias.length > 0);

  // --- CONTROL DEL BOTÓN ATRÁS DEFENSIVO ---
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (archivoCapturado) {
          setArchivoCapturado(null); // Descarta la vista previa si está abierta
          return true;
        }
        if (mostrarReproductor) {
          cerrarReproductor();
          return true; 
        }
        router.replace('/'); 
        return true; 
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove(); 
    }, [mostrarReproductor, archivoCapturado])
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

// --- LEVANTAR CÁMARA NATIVA EN KOTLIN (CON COMPRESIÓN AL INSTANTE COMO ANTES) ---
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
        console.log("ℹ️ Captura nativa cancelada o falló.");
      }
    }
  };

const finalizarYSubirHLS = async ({ uri, thumbnailUri, idUsuarioDestino, tipo }) => {
    setPublicandoId(idUsuarioDestino);

    try {
      // Usamos un ID consistente: usuario + timestamp
      const archivoId = `${idUsuarioDestino}_${Date.now()}`;
      
      const respuesta = await fetch(uri);
      const blobArchivo = await respuesta.blob();

      let storagePath = `hls_lab/${archivoId}.mp4`; 
      let metadata = {};

      if (tipo === 'foto') {
        storagePath = `fotos_lab/${archivoId}.jpg`; 
        metadata = { contentType: 'image/jpeg' };
      }

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

          // ... (mantén tu lógica de subir miniatura tal cual la tenías) ...
          if (thumbnailUri && tipo !== 'foto') {
             // ... lógica de fetch y uploadBytesResumable para miniatura ...
          }

          // AQUI ESTA LA CLAVE: Usamos setDoc con el ID específico
          // Esto crea el documento de forma atómica y limpia
          await setDoc(doc(db, "historias_hls", archivoId), { 
            url: urlPrincipal, 
            thumbnail: tipo === 'foto' ? urlPrincipal : urlThumbnail, 
            usuarioId: idUsuarioDestino, 
            fecha: serverTimestamp(),
            tipo: tipo === 'foto' ? 'foto' : 'video' // Ya no ponemos hls_pending
          });

          console.log(`✅ [FIRESTORE] Registro limpio creado con ID: ${archivoId}`);

          try {
            await FileSystem.deleteAsync(uri, { idempotent: true });
            if (thumbnailUri) await FileSystem.deleteAsync(thumbnailUri, { idempotent: true });
          } catch (e) {}
          
          setPublicandoId(null);
          setProgresoSubida(0);
        }
      );
    } catch (e) {
      console.error("❌ Error general:", e);
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

  const alCambiarDeCelda = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const nuevoIndex = viewableItems[0].index;
      setIndiceUsuarioActivo(nuevoIndex);
    }
  }).current;

 // === INTERRUPTOR 1: MOSTRAR VISTA PREVIA ===
  if (archivoCapturado) {
    return (
      <VistaPrevia 
        archivo={archivoCapturado} 
        onDescartar={() => setArchivoCapturado(null)} 
        onPublicar={async () => {
          // 1. Activamos al toque el porcentaje en el usuario de la lista
          setPublicandoId(idDestino);
          setProgresoSubida(0);
          
          // 2. Cerramos la vista previa YA para volver a la pantalla principal
          const infoArchivo = { ...archivoCapturado };
          setArchivoCapturado(null); 

          // 3. Dejamos corriendo la compresión y la subida de fondo en silencio
          (async () => {
            let rutaFinal = infoArchivo.uri;

            if (infoArchivo.tipo === 'video') {
              try {
                console.log("⚙️ Compresor corriendo de fondo...");
                rutaFinal = await comprimirVideoPro(infoArchivo.uri);
              } catch (err) {
                console.log("⚠️ Error compresor, usando original.");
              }
            }

            // Se lo mandamos a tu función de siempre para que empiece a subir el porcentaje
            await finalizarYSubirHLS({
              uri: rutaFinal,
              thumbnailUri: null,
              idUsuarioDestino: idDestino,
              tipo: infoArchivo.tipo
            });
          })();
        }} 
      />
    );
  }

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
        {usuarios.map(u => {
          const cantidadHistorias = u.historias?.length || 0;

          return (
            <View key={u.id} style={styles.tarjetaTester}>
              
              {/* AVATAR + CONTADOR */}
              <View style={styles.avatarContenedor}>
                <TouchableOpacity 
                  style={[styles.avatar, { backgroundColor: u.color || '#007AFF' }]} 
                  onPress={() => {
                    const idxFiltrado = usuariosConHistorias.findIndex(user => user.id === u.id);
                    if (idxFiltrado !== -1) abrirReproductor(idxFiltrado);
                  }}
                >
                  <Text style={styles.avatarTxt}>
                    {u.nombre ? u.nombre.substring(0, 2).toUpperCase() : 'U'}
                  </Text>
                </TouchableOpacity>

                {cantidadHistorias > 0 && (
                  <View style={styles.globoContador}>
                    <Text style={styles.textoContador}>{cantidadHistorias}</Text>
                  </View>
                )}
              </View>
              
              {/* INFO + PORCENTAJE */}
              <View style={styles.infoTester}>
                <Text style={styles.nombreTester}>{u.nombre}</Text>
                {publicandoId === u.id && (
                  <Text style={styles.subiendoTxt}>
                    ⚡ Subiendo: {Math.round(progresoSubida)}%
                  </Text>
                )}
              </View>

              {/* DISPARADOR DE CÁMARA KOTLIN */}
              <TouchableOpacity style={styles.btnMas} onPress={() => levantarCamaraKotlin(u.id)}>
                <Ionicons name="add-circle" size={38} color="#007AFF" />
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {/* CARRUSEL DE PRECARGA */}
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
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }} 
            renderItem={({ item, index }) => (
              <View style={{ width, height }}>
                <ReproductorItem
                  usuario={item}
                  estaActivo={index === indiceUsuarioActivo} 
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

// Tus estilos se mantienen intactos tal cual los tenés guardados abajo...

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
  
  // Modificado: Se le dio un pelín más de padding
  tarjetaTester: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F9F9F9', 
    padding: 16, 
    borderRadius: 18, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#EAEAEA' 
  },

  // ¡NUEVO! Contenedor que encierra al avatar y permite al globo flotar en la esquina
  avatarContenedor: {
    position: 'relative',
    width: 54,
    height: 54,
  },

  // Modificado: Crecieron a 54px para darle mejor presencia con el globo
  avatar: { 
    width: 54, 
    height: 54, 
    borderRadius: 27, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  avatarTxt: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  // ¡NUEVO! El globo celeste luminoso con sombra para que resalte
  globoContador: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    backgroundColor: '#00B4DB', // Color celeste claro vivo
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF', // Línea blanca divisoria
    elevation: 4, // Sombra para Android
    shadowColor: '#000', // Sombra para iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
  },

  // ¡NUEVO! Texto de la cantidad de historias (Bien visible y grueso)
  textoContador: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // Modificado: Ajustado el margen izquierdo a 18 para no pisarse con el globo
  infoTester: { flex: 1, marginLeft: 18 },

  // Modificado: Subió el tamaño de la letra a 17 para equilibrar el diseño
  nombreTester: { fontSize: 17, fontWeight: 'bold', color: '#212529' },

  // Modificado: ¡Letras grandes de subida! Saltó a 14px, negrita gruesa y un coral vibrante
  subiendoTxt: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#FF512F', 
    marginTop: 4 
  },

  btnMas: { padding: 5 }
});