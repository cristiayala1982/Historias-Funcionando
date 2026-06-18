// === INICIO: IMPORTACIONES ===
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Dimensions, FlatList, Modal, NativeModules, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// --- COMPONENTES ---
import VistaPrevia from '../../../components/camara/VistaPrevia';
import { comprimirVideoPro } from '../../../components/componentes_home3/compresor3';
import ReproductorItem from '../../../components/componentes_home3/ReproductorVideo.js';
// --- FIREBASE ---
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
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
        const stories = snapH.docs.map(d => ({ id: d.id, ...d.data() }));
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

  const eliminarArchivoStorageSiExiste = async (archivoRefOrUrl) => {
    if (!archivoRefOrUrl || typeof archivoRefOrUrl !== 'string') return;
    try {
      await deleteObject(ref(storage, archivoRefOrUrl));
    } catch (error) {
      if (error?.code !== 'storage/object-not-found') {
        console.warn('⚠️ No se pudo borrar archivo en Storage:', error?.message || error);
      }
    }
  };

  const eliminarHistoriaIndividual = async (historia) => {
    if (!historia?.id) return;

    await eliminarArchivoStorageSiExiste(historia.url);
    if (historia.thumbnail && historia.thumbnail !== historia.url) {
      await eliminarArchivoStorageSiExiste(historia.thumbnail);
    }

    await deleteDoc(doc(db, "historias_hls", historia.id));
  };

  const eliminarHistoriasUsuario = async (usuario) => {
    if (!usuario?.id) return;

    const qHistoriasUsuario = query(
      collection(db, "historias_hls"),
      where("usuarioId", "==", usuario.id)
    );

    const snapHistorias = await getDocs(qHistoriasUsuario);
    if (snapHistorias.empty) {
      Alert.alert("Sin historias", `${usuario.nombre} no tiene historias para borrar.`);
      return;
    }

    const batch = writeBatch(db);
    for (const historiaDoc of snapHistorias.docs) {
      const data = historiaDoc.data();
      await eliminarArchivoStorageSiExiste(data?.url);
      if (data?.thumbnail && data.thumbnail !== data.url) {
        await eliminarArchivoStorageSiExiste(data.thumbnail);
      }
      batch.delete(historiaDoc.ref);
    }
    await batch.commit();
  };

  const confirmarEliminarHistoriasUsuario = (usuario) => {
    if (!usuario?.id) return;

    Alert.alert(
      "Borrar todas",
      `Se borraran todas las historias de ${usuario.nombre}. ¿Continuar?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar todo",
          style: "destructive",
          onPress: async () => {
            await eliminarHistoriasUsuario(usuario);
          }
        }
      ]
    );
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
      <View style={styles.backgroundBlobTop} />
      <View style={styles.backgroundBlobBottom} />

      <View style={styles.headerContainer}>
        <Text style={styles.kicker}>HISTORIASLAB</Text>
        <Text style={styles.header}>Laboratorio HLS</Text>
        <Text style={styles.subHeader}>Streaming adaptativo y pruebas multimedia</Text>
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
                <View style={styles.filaNombreAcciones}>
                  <Text style={styles.nombreTester}>{u.nombre}</Text>
                  {cantidadHistorias > 0 && (
                    <TouchableOpacity
                      style={styles.btnBorrarTodas}
                      onPress={() => confirmarEliminarHistoriasUsuario(u)}
                    >
                      <Ionicons name="trash" size={16} color="#FF3B30" />
                    </TouchableOpacity>
                  )}
                </View>
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
                  onEliminarHistoria={eliminarHistoriaIndividual}
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
  container: { flex: 1, backgroundColor: '#F4F8FB' },
  modalContainer: { flex: 1, backgroundColor: 'black' },
  backgroundBlobTop: {
    position: 'absolute',
    top: -75,
    right: -55,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: '#DDF0FF',
  },
  backgroundBlobBottom: {
    position: 'absolute',
    bottom: 90,
    left: -70,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: '#FFE8D2',
  },
  headerContainer: {
    marginTop: 52,
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#0B3B60',
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 16,
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
    letterSpacing: 1.3,
  },
  header: {
    marginTop: 6,
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 28,
    lineHeight: 32,
  },
  subHeader: {
    color: '#DCEEFF',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 7,
  },
  inputArea: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D8EAF8',
  },
  input: {
    flex: 1,
    backgroundColor: '#F7FBFF',
    borderRadius: 13,
    paddingHorizontal: 16,
    height: 50,
    color: '#102A43',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E5F0F9',
  },
  btnAgregar: {
    backgroundColor: '#0B3B60',
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listaUsuarios: { flex: 1, marginTop: 12, paddingHorizontal: 20 },
  cameraContainer: { flex: 1, backgroundColor: 'black' },
  btnCerrarCam: { position: 'absolute', top: 50, left: 20, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 25 },
  
  // Modificado: Se le dio un pelín más de padding
  tarjetaTester: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF', 
    padding: 16, 
    borderRadius: 18, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#D8EAF8',
    shadowColor: '#2C4A65',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
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

  filaNombreAcciones: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Modificado: Subió el tamaño de la letra a 17 para equilibrar el diseño
  nombreTester: { fontSize: 17, fontWeight: 'bold', color: '#212529' },

  btnBorrarTodas: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFEAEA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modificado: ¡Letras grandes de subida! Saltó a 14px, negrita gruesa y un coral vibrante
  subiendoTxt: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#0B7A45', 
    marginTop: 4 
  },

  btnMas: {
    padding: 6,
    backgroundColor: '#EAF4FF',
    borderRadius: 16,
  }
});