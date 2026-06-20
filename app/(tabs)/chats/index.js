import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    FlatList,
    Image,
    NativeModules,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { KeyboardAvoidingView, KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
// IMPORTACIONES FIREBASE
import * as FileSystem from 'expo-file-system/legacy';
import { addDoc, collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '../../../firebaseConfig';


// COMPONENTES
import AudioMensaje from '../../../components/camara/AudioMensaje'; // O la ruta donde hayas creado el archivo
import ChatMediaViewer from '../../../components/camara/ChatMediaViewer';
import GrabadorAudio from '../../../components/camara/GrabadorAudio';
import VistaPrevia from '../../../components/camara/VistaPrevia';
import { comprimirVideoPro } from '../../../components/componentes_home3/compresor3';



export default function ChatScreen() {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [usuario, setUsuario] = useState('Cristian');
  const [mensajes, setMensajes] = useState([]);
  const [archivoCapturado, setArchivoCapturado] = useState(null);
  const [mensajeSeleccionado, setMensajeSeleccionado] = useState(null);
  const [subiendo, setSubiendo] = useState(false);// subiendo foto, video
  const [audioSonandoId, setAudioSonandoId] = useState(null);//n suenas todos los audios a la vez, guardamos el ID del mensaje que suena para pausar los demás
  const COLOR_CRISTIAN = '#E6F4FF';
  const COLOR_SILVINA = '#FFF3E6';
  const [progreso, setProgreso] = useState(0);// Para mostrar el progreso de subida (opcional)
  const [vaciandoChat, setVaciandoChat] = useState(false);

  const extraerRutaStorageDesdeUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    if (!url.startsWith('http')) return url;

    try {
      const marker = '/o/';
      const start = url.indexOf(marker);
      if (start === -1) return null;

      const encodedPath = url.substring(start + marker.length).split('?')[0];
      if (!encodedPath) return null;

      return decodeURIComponent(encodedPath);
    } catch {
      return null;
    }
  };

  const eliminarMediaStorageSiExiste = async (urlOrPath) => {
    const storagePath = extraerRutaStorageDesdeUrl(urlOrPath);
    if (!storagePath) return;

    try {
      await deleteObject(ref(storage, storagePath));
    } catch (error) {
      if (error?.code !== 'storage/object-not-found') {
        console.warn('No se pudo borrar archivo del storage:', error?.message || error);
      }
    }
  };

  const vaciarChat = async () => {
    setVaciandoChat(true);
    try {
      const q = query(collection(db, 'chat_laboratorio'));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        Alert.alert('Chat vacio', 'No hay mensajes para borrar.');
        return;
      }

      for (const mensajeDoc of snapshot.docs) {
        const data = mensajeDoc.data();
        await eliminarMediaStorageSiExiste(data?.fileUrl);
        if (data?.thumbnailUrl) {
          await eliminarMediaStorageSiExiste(data.thumbnailUrl);
        }
      }

      const batch = writeBatch(db);
      snapshot.docs.forEach((mensajeDoc) => {
        batch.delete(mensajeDoc.ref);
      });
      await batch.commit();

      Alert.alert('Listo', `Se borraron ${snapshot.size} mensajes del chat.`);
    } finally {
      setVaciandoChat(false);
    }
  };

  const confirmarVaciarChat = () => {
    Alert.alert(
      'Vaciar chat',
      'Se borraran todos los mensajes y archivos del chat. Esta accion no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Vaciar',
          style: 'destructive',
          onPress: async () => {
            try {
              await vaciarChat();
            } catch (error) {
              console.error('Error al vaciar chat:', error);
              Alert.alert('Error', 'No se pudo vaciar el chat. Intenta nuevamente.');
            }
          }
        }
      ]
    );
  };

  useFocusEffect(
    // Controlamos el botón físico para volver al menú inicial del laboratorio.
    useCallback(() => {
      const onBackPress = () => {
        if (mensajeSeleccionado) {
          setMensajeSeleccionado(null);
          return true;
        }

        if (archivoCapturado) {
          setArchivoCapturado(null);
          return true;
        }

        router.replace('/');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [mensajeSeleccionado, archivoCapturado, router])
  );

  // LÓGICA DE CÁMARA NATIVA
  const abrirCamaraNativa = async () => {
    if (NativeModules.HistoriasLabNative) {
      try {
        const rutaCrudaAndroid = await NativeModules.HistoriasLabNative.abrirCamaraHistorias();
        const esVideo = rutaCrudaAndroid.endsWith('.mp4');
        setArchivoCapturado({
          tipo: esVideo ? 'video' : 'foto',
          uri: `file://${rutaCrudaAndroid}`
        });
      } catch (error) {
        console.log("Cámara cancelada o falló.");
      }
    }
  };

  // ESCUCHAR MENSAJES
  useEffect(() => {
    const q = query(collection(db, 'chat_laboratorio'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mensajesTraidos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMensajes(mensajesTraidos);
    });
    return () => unsubscribe();
  }, []);

  const enviarMensaje = async () => {
    if (texto.trim() === '') return;
    await addDoc(collection(db, 'chat_laboratorio'), {
      text: texto,
      user: usuario,
      createdAt: serverTimestamp()
    });
    setTexto('');
  };

  const subirAudioAMensaje = async (mensajeId, uriAudio, userName) => {
    const response = await fetch(uriAudio);
    const blob = await response.blob();
    const storageRef = ref(storage, `chat_media/audios/${mensajeId}.m4a`);

    const url = await new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, blob);
      uploadTask.on(
        'state_changed',
        null,
        (err) => reject(err),
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadUrl);
          } catch (err) {
            reject(err);
          }
        }
      );
    });

    await setDoc(doc(db, 'chat_laboratorio', mensajeId), {
      fileUrl: url,
      tipo: 'audio',
      user: userName,
      thumbnailUrl: '',
      estado: 'enviado',
      localUri: ''
    }, { merge: true });

    try {
      if (uriAudio?.startsWith('file://')) {
        await FileSystem.deleteAsync(uriAudio, { idempotent: true });
      }
    } catch (error) {
      console.warn('No se pudo borrar el audio local subido:', error?.message || error);
    }
  };

  const reintentarAudio = async (mensaje) => {
    if (!mensaje?.id) return;
    if (!mensaje.localUri) {
      Alert.alert('No disponible', 'No se encontró el archivo local para reintentar este audio.');
      return;
    }

    await setDoc(doc(db, 'chat_laboratorio', mensaje.id), {
      estado: 'subiendo'
    }, { merge: true });

    try {
      await subirAudioAMensaje(mensaje.id, mensaje.localUri, mensaje.user || usuario);
    } catch (err) {
      console.error(err);
      await setDoc(doc(db, 'chat_laboratorio', mensaje.id), {
        estado: 'error',
        localUri: mensaje.localUri
      }, { merge: true });
    }
  };

// 1. VISTA PREVIA (Solo muestra la vista mientras no se ha presionado publicar)
  if (archivoCapturado) {
    return (
      <View style={{ flex: 1 }}>
        <VistaPrevia 
          archivo={archivoCapturado} 
          onDescartar={subiendo ? null : () => setArchivoCapturado(null)} 
          onPublicar={subiendo ? null : async () => {
            const archivoParaSubir = archivoCapturado; 
            
            // LIMPIEZA INMEDIATA: Cerramos la vista previa para liberar RAM
            setArchivoCapturado(null); 
            setSubiendo(true); 

            try {
              let rutaFinal = archivoParaSubir.uri;
              let rutaLimpia = rutaFinal.replace('file://', '');
              
              if (archivoParaSubir.tipo === 'video') {
                try { rutaFinal = await comprimirVideoPro(rutaLimpia); } 
                catch (compError) { rutaFinal = rutaLimpia; }
              }
              
              const response = await fetch(`file://${rutaFinal.replace('file://', '')}`);
              const blob = await response.blob();

              const mensajeId = `chat_${Date.now()}`;
              const filename = `${mensajeId}.mp4`; 
              
              const storageRef = ref(storage, `hls_lab/${filename}`); 
              const uploadTask = uploadBytesResumable(storageRef, blob);
              
              uploadTask.on('state_changed', 
                (snapshot) => {
                  const porc = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                  setProgreso(porc);
                },
                (err) => { 
                  console.error(err); 
                  setSubiendo(false); 
                }, 
                async () => {
                  await setDoc(doc(db, 'chat_laboratorio', mensajeId), { 
                    fileUrl: await getDownloadURL(uploadTask.snapshot.ref), 
                    tipo: archivoParaSubir.tipo, 
                    user: usuario, 
                    createdAt: serverTimestamp(),
                    thumbnailUrl: "" 
                  });

                  try { await FileSystem.deleteAsync(rutaFinal, { idempotent: true }); } catch(e) {}
                  setSubiendo(false);
                  setProgreso(0);
                }
              );
            } catch (err) { 
              console.error(err); 
              setSubiendo(false); 
            }
          }}
        />
      </View>
    );
  }

// 2. ESTO ES EL CHAT NORMAL
return (
  <KeyboardProvider>
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.backgroundBlobTop} />
      <View style={styles.backgroundBlobBottom} />

      <View style={styles.topBar}>
        <TouchableOpacity 
          onPress={() => setUsuario(usuario === 'Cristian' ? 'Silvina' : 'Cristian')} 
          style={[
            styles.btnCambiarUsuario,
            { backgroundColor: usuario === 'Cristian' ? COLOR_CRISTIAN : COLOR_SILVINA }
          ]}
        >
          <Text style={styles.textoUsuario}>Hablando como: {usuario}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnVaciarChat, vaciandoChat && styles.btnVaciarChatDisabled]}
          onPress={confirmarVaciarChat}
          disabled={vaciandoChat}
        >
          {vaciandoChat ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="trash" size={16} color="#fff" />
          )}
          <Text style={styles.textoVaciar}>{vaciandoChat ? 'Vaciando...' : 'Vaciar chat'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <FlatList
          data={mensajes}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={{ padding: 10 }}
          removeClippedSubviews={false} 
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          // ESTOS 4 CAMBIOS SON LA CLAVE PARA QUE EL TOQUE RESPONDA SIEMPRE
          keyboardShouldPersistTaps="always" 
          bounces={false}
          overScrollMode="never"
          scrollEventThrottle={16}
          renderItem={({ item }) => (
  <View style={[styles.cajaMensaje, item.user === 'Cristian' ? styles.msgCristian : styles.msgSilvina]}>
    <Text style={styles.textoNombre}>{item.user}</Text>
    
    {item.fileUrl ? (
      item.tipo === 'video' ? (
        <Pressable 
          onPress={() => {
            console.log("LOG_FINAL: Toque directo procesado");
            setMensajeSeleccionado(item);
          }}
          onStartShouldSetResponder={() => true}
          style={{ 
            width: 150, 
            height: 150, 
            borderRadius: 10, 
            backgroundColor: '#000', 
            overflow: 'hidden',
            justifyContent: 'center', 
            alignItems: 'center' 
          }}
        >
          <Image 
            source={{ 
              uri: (item.thumbnailUrl && item.thumbnailUrl !== "") 
                   ? item.thumbnailUrl 
                   : 'https://via.placeholder.com/150' 
            }} 
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
          
          <View style={{ position: 'absolute', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="play-circle" size={50} color="white" style={{ opacity: 0.8 }} />
          </View>
        </Pressable>
      ) : item.tipo === 'audio' ? (
        item.fileUrl ? (
          <AudioMensaje 
            uri={item.fileUrl} 
            id={item.id}
            isPlaying={audioSonandoId === item.id} 
            onPlay={(id) => setAudioSonandoId(id)} 
            onEnded={(audioId) => {
              const idxMensaje = mensajes.findIndex(m => m.id === audioId);
              const siguienteMensaje = idxMensaje > 0 ? mensajes[idxMensaje - 1] : null;

              if (siguienteMensaje?.tipo === 'audio' && siguienteMensaje?.fileUrl) {
                setAudioSonandoId(siguienteMensaje.id);
              } else {
                setAudioSonandoId(null);
              }
            }} 
          />
        ) : (
          <View style={styles.audioPendienteContainer}>
            {item.estado === 'error' ? (
              <Ionicons name="alert-circle" size={18} color="#ff3b30" />
            ) : (
              <ActivityIndicator size="small" color="#007AFF" />
            )}
            <Text style={styles.audioPendienteTexto}>
              {item.estado === 'error' ? 'Error al enviar audio' : 'Enviando audio...'}
            </Text>
            {item.estado === 'error' && (
              <TouchableOpacity
                onPress={() => reintentarAudio(item)}
                style={styles.btnReintentarAudio}
                activeOpacity={0.8}
              >
                <Text style={styles.textoReintentarAudio}>Reintentar</Text>
              </TouchableOpacity>
            )}
          </View>
        )
      ) : (
        <TouchableOpacity onPress={() => setMensajeSeleccionado(item)} activeOpacity={0.7}>
          <Image source={{ uri: item.fileUrl }} style={{ width: 150, height: 150, borderRadius: 10 }} resizeMode="cover" />
        </TouchableOpacity>
      )
    ) : (
      <Text>{item.text}</Text>
    )}
  </View>
)}
        />

        <View style={styles.inputWrapper}>
          {texto.length === 0 && (
            <TouchableOpacity style={{ marginRight: 10 }} onPress={abrirCamaraNativa}>
              <Ionicons name="camera" size={28} color="#007AFF" />
            </TouchableOpacity>
          )}
          
          <TextInput 
            style={styles.input} 
            placeholder="Escribe algo..." 
            placeholderTextColor="#353030"
            value={texto} 
            onChangeText={setTexto} 
            multiline 
          />

          {texto.length > 0 ? (
            <TouchableOpacity style={styles.btnEnviar} onPress={enviarMensaje}>
              <Ionicons name="send" size={24} color="white" />
            </TouchableOpacity>
          ) : (
// ... dentro de tu GrabadorAudio ...
<GrabadorAudio onIniciarGrabacion={() => setAudioSonandoId(null)} onEnviar={async (uriAudio) => {
  const mensajeId = `chat_audio_${Date.now()}`;

  await setDoc(doc(db, 'chat_laboratorio', mensajeId), {
    fileUrl: '',
    tipo: 'audio',
    user: usuario,
    createdAt: serverTimestamp(),
    thumbnailUrl: '',
    estado: 'subiendo',
    localUri: uriAudio
  });

  try {
    await subirAudioAMensaje(mensajeId, uriAudio, usuario);
  } catch (err) {
    console.error(err);
    await setDoc(doc(db, 'chat_laboratorio', mensajeId), {
      estado: 'error',
      localUri: uriAudio
    }, { merge: true });
  }
}} />
          )}
        </View>
      </KeyboardAvoidingView>

{/* ESTO REEMPLAZA AL MODAL - Es un View que vive dentro de la pantalla */}
{mensajeSeleccionado && (
  <View style={{ 
    position: 'absolute', 
    top: 0, left: 0, right: 0, bottom: 0, 
    backgroundColor: 'black', 
    zIndex: 9999 // Asegura que tape todo
  }}>
    {mensajeSeleccionado.tipo === 'video' ? (
      <ChatMediaViewer 
        archivo={mensajeSeleccionado} 
        alCerrar={() => setMensajeSeleccionado(null)} 
      />
    ) : (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Image 
          source={{ uri: mensajeSeleccionado.fileUrl }} 
          style={{ width: '100%', height: '80%' }} 
          resizeMode="contain" 
        />
        <TouchableOpacity 
          style={{ position: 'absolute', top: 50, left: 20 }} 
          onPress={() => setMensajeSeleccionado(null)}
        >
          <Ionicons name="close" size={40} color="white" />
        </TouchableOpacity>
      </View>
    )}
  </View>
)}

{/* INDICADOR DE CARGA GLOBAL - Visible siempre que subiendo sea true */}
        {subiendo && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }]}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={{ color: 'white', marginTop: 15, fontSize: 16, fontWeight: 'bold' }}>
              Enviando mensaje: {progreso}%
            </Text>
          </View>
        )}
      </SafeAreaView>
    </KeyboardProvider>
  );
}



const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F8FB',
  },
  backgroundBlobTop: {
    position: 'absolute',
    top: -80,
    right: -55,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: '#DDF0FF',
  },
  backgroundBlobBottom: {
    position: 'absolute',
    bottom: 130,
    left: -70,
    width: 185,
    height: 185,
    borderRadius: 92,
    backgroundColor: '#FFE8D2',
  },
  cajaMensaje: { padding: 10, marginVertical: 5, borderRadius: 10, maxWidth: '80%' },
  msgCristian: {
    backgroundColor: '#EAF4FF',
    borderWidth: 1,
    borderColor: '#CFE6FB',
    alignSelf: 'flex-end',
  },
  msgSilvina: {
    backgroundColor: '#FFF4EA',
    borderWidth: 1,
    borderColor: '#FADFC6',
    alignSelf: 'flex-start',
  },
  textoNombre: { fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D8EAF8',
  },
  btnCambiarUsuario: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  textoUsuario: { fontWeight: '800', color: '#102A43' },
  btnVaciarChat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#C2410C',
  },
  btnVaciarChatDisabled: {
    opacity: 0.65,
  },
  textoVaciar: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  audioPendienteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  audioPendienteTexto: {
    color: '#333',
    fontWeight: '600',
    fontSize: 13,
  },
  btnReintentarAudio: {
    marginLeft: 8,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  textoReintentarAudio: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  inputWrapper: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#D8EAF8',
  },
  input: {
    flex: 1,
    minHeight: 45,
    backgroundColor: '#F7FBFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E5F0F9',
    color: '#102A43',
  },
  btnEnviar: {
    marginLeft: 10,
    backgroundColor: '#0B3B60',
    padding: 10,
    borderRadius: 18,
    justifyContent: 'center'
  }
});