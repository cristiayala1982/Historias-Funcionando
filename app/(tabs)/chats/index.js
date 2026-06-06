import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  NativeModules,
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
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '../../../firebaseConfig';


// COMPONENTES
import AudioMensaje from '../../../components/camara/AudioMensaje'; // O la ruta donde hayas creado el archivo
import ChatMediaViewer from '../../../components/camara/ChatMediaViewer';
import GrabadorAudio from '../../../components/camara/GrabadorAudio';
import MiniaturaVideo from '../../../components/camara/MiniaturaVideo';
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

 // 1. ESTO ES LO QUE VA A MOSTRAR LA VISTA PREVIA CON EL CARGANDO DENTRO
  if (archivoCapturado) {
    return (
      <View style={{ flex: 1 }}>
        <VistaPrevia 
          archivo={archivoCapturado} 
          onDescartar={subiendo ? null : () => setArchivoCapturado(null)} 
          onPublicar={subiendo ? null : async () => {
            setSubiendo(true);
            try {
              let rutaFinal = archivoCapturado.uri;
              let rutaLimpia = rutaFinal.replace('file://', '');
              
              if (archivoCapturado.tipo === 'video') {
                try { rutaFinal = await comprimirVideoPro(rutaLimpia); } 
                catch (compError) { rutaFinal = rutaLimpia; }
              }
              
              const response = await fetch(`file://${rutaFinal.replace('file://', '')}`);
              const blob = await response.blob();
              const filename = `chat_${Date.now()}.${archivoCapturado.tipo === 'video' ? 'mp4' : 'jpg'}`;
              const storageRef = ref(storage, `chat_media/${filename}`);
              
              const uploadTask = uploadBytesResumable(storageRef, blob);
              uploadTask.on('state_changed', null, (err) => { console.error(err); setSubiendo(false); }, async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                await addDoc(collection(db, 'chat_laboratorio'), { fileUrl: url, tipo: archivoCapturado.tipo, user: usuario, createdAt: serverTimestamp() });
                try { await FileSystem.deleteAsync(rutaFinal, { idempotent: true }); } catch(e) {}
                setSubiendo(false);
                setArchivoCapturado(null);
              });
            } catch (err) { console.error(err); setSubiendo(false); }
          }} 
        />
        
        {/* EL CARGANDO AHORA ESTÁ AQUÍ ADENTRO Y SE VA A VER */}
        {subiendo && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }]}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={{ color: 'white', marginTop: 10, fontWeight: 'bold' }}>Enviando mensaje...</Text>
          </View>
        )}
      </View>
    );
  }

  // 2. ESTO ES EL CHAT NORMAL
  return (
    <KeyboardProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <TouchableOpacity onPress={() => setUsuario(usuario === 'Cristian' ? 'Silvina' : 'Cristian')} style={styles.btnCambiarUsuario}>
          <Text style={styles.textoUsuario}>Hablando como: {usuario}</Text>
        </TouchableOpacity>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
          <FlatList
            data={mensajes}
            keyExtractor={(item) => item.id}
            inverted
            contentContainerStyle={{ padding: 10 }}
            renderItem={({ item }) => (
            <View style={[styles.cajaMensaje, item.user === 'Cristian' ? styles.msgCristian : styles.msgSilvina]}>
              <Text style={styles.textoNombre}>{item.user}</Text>
              
              {item.fileUrl ? (
                item.tipo === 'video' ? (
                  <TouchableOpacity 
                    onPress={() => setMensajeSeleccionado(item)} 
                    style={{ width: 150, height: 150, borderRadius: 10, backgroundColor: '#000', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}
                  >
                    <MiniaturaVideo uri={item.fileUrl} />
                    <View style={{ position: 'absolute' }}>
                      <Ionicons name="play-circle" size={50} color="white" style={{ opacity: 0.6 }} />
                    </View>
                  </TouchableOpacity>
                ) : item.tipo === 'audio' ? (
                  // AHORA PASAMOS LAS PROPS NECESARIAS PARA EL CONTROL CENTRALIZADO
                <AudioMensaje 
                  uri={item.fileUrl} 
                  id={item.id}
                  isPlaying={audioSonandoId === item.id} 
                  // Ahora le pasamos una función que decide: 
                  // si ya está sonando, enviamos null (pausa); si no, enviamos el id (play)
                  onPlay={(valor) => setAudioSonandoId(valor)} 
                />
                ) : (
                  // FOTO
                  <TouchableOpacity onPress={() => setMensajeSeleccionado(item)}>
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
                value={texto} 
                onChangeText={setTexto} 
                multiline 
              />

              {texto.length > 0 ? (
                // BOTÓN ENVIAR TEXTO
                <TouchableOpacity style={styles.btnEnviar} onPress={enviarMensaje}>
                  <Ionicons name="send" size={24} color="white" />
                </TouchableOpacity>
              ) : (
                // BOTÓN GRABAR AUDIO (El componente que creamos)
                <GrabadorAudio onEnviar={async (uriAudio) => {
                  setSubiendo(true);
                  try {
                    const response = await fetch(uriAudio);
                    const blob = await response.blob();
                    const filename = `chat_audio_${Date.now()}.m4a`;
                    const storageRef = ref(storage, `chat_media/${filename}`);
                    
                    const uploadTask = uploadBytesResumable(storageRef, blob);
                    
                    uploadTask.on('state_changed', null, (err) => { console.error(err); setSubiendo(false); }, async () => {
                      const url = await getDownloadURL(uploadTask.snapshot.ref);
                      await addDoc(collection(db, 'chat_laboratorio'), {
                        fileUrl: url,
                        tipo: 'audio',
                        user: usuario,
                        createdAt: serverTimestamp()
                      });
                      setSubiendo(false);
                    });
                  } catch (err) { 
                    console.error(err); 
                    setSubiendo(false); 
                  }
                }} />
              )}
            </View>
        </KeyboardAvoidingView>

        <Modal visible={!!mensajeSeleccionado} animationType="fade" transparent={true}>
          {mensajeSeleccionado && (
            mensajeSeleccionado.tipo === 'video' ? (
              <ChatMediaViewer key={mensajeSeleccionado.id} archivo={mensajeSeleccionado} alCerrar={() => setMensajeSeleccionado(null)} />
            ) : (
              <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center' }}>
                <Image source={{ uri: mensajeSeleccionado.fileUrl }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />
                <TouchableOpacity style={{ position: 'absolute', top: 50, left: 20 }} onPress={() => setMensajeSeleccionado(null)}>
                  <Ionicons name="close" size={40} color="white" />
                </TouchableOpacity>
              </View>
            )
          )}
        </Modal>
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
  input: { flex: 1, minHeight: 45, backgroundColor: '#eee', borderRadius: 20, paddingHorizontal: 15 },
  btnEnviar: { marginLeft: 10, backgroundColor: '#007AFF', padding: 10, borderRadius: 20, justifyContent: 'center' }
});