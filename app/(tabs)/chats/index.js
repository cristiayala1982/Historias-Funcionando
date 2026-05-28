// === INICIO: IMPORTACIONES ===
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// --- FIREBASE ---
import { addDoc, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
// === FIN: IMPORTACIONES ===

export default function ChatLab() {
  const router = useRouter();
  const navigation = useNavigation();

  const [usuarioActual, setUsuarioActual] = useState('Cristian'); 
  const [textoMensaje, setTextoMensaje] = useState('');
  const [mensajes, setMensajes] = useState([]); 

  // --- ESCUCHAR MENSAJES DE FIREBASE EN TIEMPO REAL ---
  useEffect(() => {
    const q = query(collection(db, 'chat_laboratorio'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const listaMensajes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMensajes(listaMensajes);
    });

    return () => unsubscribe();
  }, []);

  // --- FUNCIÓN PARA ENVIAR MENSAJE A FIREBASE ---
  const enviarMensaje = async () => {
    if (textoMensaje.trim() === '') return;

    try {
      const textoAEnviar = textoMensaje;
      setTextoMensaje(''); 

      await addDoc(collection(db, 'chat_laboratorio'), {
        text: textoAEnviar,
        user: usuarioActual,
        createdAt: Date.now() 
      });
    } catch (error) {
      console.log("Error al enviar mensaje:", error);
    }
  };

  // --- CONTROL DEL BOTÓN ATRÁS DEFENSIVO ---
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.replace('/'); 
        return true; 
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove(); 
    }, [])
  );

  // --- CONTROL DE LA BARRA DE TABS ---
  useEffect(() => {
    navigation.getParent()?.setOptions({
      tabBarStyle: { display: 'none' }
    });

    return () => {
      navigation.getParent()?.setOptions({
        tabBarStyle: { 
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
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* CABECERA */}
      <View style={styles.header}>
        <Text style={styles.headerTitulo}>LAB CHAT</Text>
        <View style={styles.selectorContenedor}>
          <Text style={styles.selectorTexto}>Dispositivo actual:</Text>
          <View style={styles.botonesUser}>
            <TouchableOpacity 
              style={[styles.btnUser, usuarioActual === 'Cristian' && styles.btnUserActivo]} 
              onPress={() => setUsuarioActual('Cristian')}
            >
              <Text style={[styles.btnUserTxt, usuarioActual === 'Cristian' && styles.btnUserTxtActivo]}>Cristian</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.btnUser, usuarioActual === 'Juan' && styles.btnUserActivo]} 
              onPress={() => setUsuarioActual('Juan')}
            >
              <Text style={[styles.btnUserTxt, usuarioActual === 'Juan' && styles.btnUserTxtActivo]}>Juan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* CUERPO CON CONTENEDOR DE TECLADO GENERAL */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={styles.keyboardContainer}
      >
        {/* Zona de Mensajes */}
        <View style={styles.zonaMensajes}>
          <FlatList
            data={mensajes}
            keyExtractor={item => item.id}
            inverted 
            contentContainerStyle={styles.listaContenido}
            renderItem={({ item }) => {
              const esMio = item.user === usuarioActual;
              return (
                <View style={[styles.globo, esMio ? styles.globoMio : styles.globoOtro]}>
                  <Text style={[styles.globoUsuario, esMio ? styles.txtMio : styles.txtOtro]}>{item.user}</Text>
                  <Text style={styles.globoTexto}>{item.text}</Text>
                </View>
              );
            }}
          />
        </View>

        {/* BARRA DE ENTRADA */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Escribí un mensaje..."
            placeholderTextColor="#888"
            value={textoMensaje}
            onChangeText={setTextoMensaje}
            multiline 
          />
          <TouchableOpacity style={styles.btnEnviar} onPress={enviarMensaje}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardContainer: { flex: 1 },
  
  header: { 
    backgroundColor: '#F8F9FA', 
    padding: 15, 
    borderBottomWidth: 1, 
    borderColor: '#E9ECEF', 
    paddingTop: 50 
  },
  headerTitulo: { color: '#212529', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  selectorContenedor: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectorTexto: { color: '#495057', fontSize: 13 },
  botonesUser: { flexDirection: 'row', gap: 10 },
  btnUser: { backgroundColor: '#E9ECEF', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#CED4DA' },
  btnUserActivo: { backgroundColor: '#1E90FF', borderColor: '#1E90FF' },
  btnUserTxt: { color: '#495057', fontSize: 12, fontWeight: 'bold' },
  btnUserTxtActivo: { color: '#FFFFFF' },

  zonaMensajes: { flex: 1, backgroundColor: '#F1F3F5' },
  listaContenido: { paddingHorizontal: 15, paddingVertical: 10 },
  
  globo: { padding: 10, borderRadius: 15, marginVertical: 4, maxWidth: '75%' },
  globoMio: { backgroundColor: '#1E90FF', alignSelf: 'flex-end', borderBottomRightRadius: 2 },
  globoOtro: { backgroundColor: '#E9ECEF', alignSelf: 'flex-start', borderBottomLeftRadius: 2 },
  globoUsuario: { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  txtMio: { color: '#B0E0E6' },
  txtOtro: { color: '#1E90FF' },
  globoTexto: { color: '#212529', fontSize: 15 },

  inputWrapper: { 
    flexDirection: 'row', 
    paddingHorizontal: 12, 
    paddingTop: 10,
    paddingBottom: Platform.OS === 'android' ? 15 : 12, // Ajustado prolijo para Android nativo
    backgroundColor: '#FFFFFF', 
    alignItems: 'center', 
    borderTopWidth: 1, 
    borderColor: '#E9ECEF'
  },
  input: { 
    flex: 1, 
    backgroundColor: '#F1F3F5', 
    color: '#212529', 
    borderRadius: 25, 
    paddingHorizontal: 15, 
    paddingVertical: 10, 
    fontSize: 15, 
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    maxHeight: 100
  },
  btnEnviar: { backgroundColor: '#1E90FF', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' }
});