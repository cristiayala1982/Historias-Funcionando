import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '../../../firebaseConfig';


// COMPONENTES
import AudioMensaje from '../../../components/camara/AudioMensaje'; // O la ruta donde hayas creado el archivo
import ChatMediaViewer from '../../../components/camara/ChatMediaViewer';
import GrabadorAudio from '../../../components/camara/GrabadorAudio';
import VistaPrevia from '../../../components/camara/VistaPrevia';
import { comprimirVideoPro } from '../../../components/componentes_home3/compresor3';



export default function ChatScreen() {
  const [texto, setTexto] = useState('');
  const [usuario, setUsuario] = useState('Cristian');
  const [mensajes, setMensajes] = useState([]);
  const [archivoCapturado, setArchivoCapturado] = useState(null);
  const [mensajeSeleccionado, setMensajeSeleccionado] = useState(null);
  const [subiendo, setSubiendo] = useState(false);// subiendo foto, video
  const [audioSonandoId, setAudioSonandoId] = useState(null);//n suenas todos los audios a la vez, guardamos el ID del mensaje que suena para pausar los demás
  const COLOR_CRISTIAN = '#97fd48'; // El verde que usás en tus burbujas
  const COLOR_SILVINA = '#f5ace9';  // El rosadito/violeta que usás en tus burbujas
  const [progreso, setProgreso] = useState(0);// Para mostrar el progreso de subida (opcional)
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <TouchableOpacity 
        onPress={() => setUsuario(usuario === 'Cristian' ? 'Silvina' : 'Cristian')} 
        style={[
          styles.btnCambiarUsuario, 
          { backgroundColor: usuario === 'Cristian' ? COLOR_CRISTIAN : COLOR_SILVINA }
        ]}
      >
        <Text style={styles.textoUsuario}>Hablando como: {usuario}</Text>
      </TouchableOpacity>

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
        <AudioMensaje 
          uri={item.fileUrl} 
          id={item.id}
          isPlaying={audioSonandoId === item.id} 
          onPlay={(id) => setAudioSonandoId(id)} 
        />
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
              <Ionicons name="camera" size={28} color="white" />
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
<GrabadorAudio onEnviar={async (uriAudio) => {
  setSubiendo(true);
  try {
    const response = await fetch(uriAudio);
    const blob = await response.blob();
    const filename = `chat_audio_${Date.now()}.m4a`;
    const storageRef = ref(storage, 'chat_media/videos/' + filename);
    
    // CORRECCIÓN AQUÍ: Faltaba definir uploadTask
    const uploadTask = uploadBytesResumable(storageRef, blob);
    
    uploadTask.on('state_changed', null, (err) => { 
      console.error(err); setSubiendo(false); 
    }, async () => {
      const url = await getDownloadURL(uploadTask.snapshot.ref);
      await addDoc(collection(db, 'chat_laboratorio'), { 
        fileUrl: url, 
        tipo: 'audio', 
        user: usuario, 
        createdAt: serverTimestamp(), 
        thumbnailUrl: ""
      });
      setSubiendo(false);
    });
  } catch (err) { console.error(err); setSubiendo(false); }
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
  cajaMensaje: { padding: 10, marginVertical: 5, borderRadius: 10, maxWidth: '80%' },
  msgCristian: { backgroundColor: '#97fd48', alignSelf: 'flex-end' },
  msgSilvina: { backgroundColor: '#f5ace9', alignSelf: 'flex-start' },
  textoNombre: { fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  btnCambiarUsuario: { backgroundColor: '#23f04f', padding: 10, alignItems: 'center' },
  textoUsuario: { fontWeight: 'bold' },
  inputWrapper: { flexDirection: 'row', paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10, backgroundColor: '#559c03', alignItems: 'center' },
  input: { flex: 1, minHeight: 45, backgroundColor: '#ffffff', borderRadius: 20, paddingHorizontal: 15 },
  btnEnviar: { marginLeft: 10, backgroundColor: '#007AFF', padding: 10, borderRadius: 20, justifyContent: 'center' }
});