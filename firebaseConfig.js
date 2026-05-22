import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // <--- 1. AGREGADO

const firebaseConfig = {
  apiKey: "AIzaSyAO2cxBBLkzpi6OmEMj6Qi49srNdeYM83g",
  authDomain: "historiaslab-7672a.firebaseapp.com",
  projectId: "historiaslab-7672a",
  storageBucket: "historiaslab-7672a.firebasestorage.app",
  messagingSenderId: "90055872040",
  appId: "1:90055872040:android:e804ce410b1821ea736f1d"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar la Base de Datos (Firestore)
export const db = getFirestore(app);

// Inicializar el Almacenamiento de archivos (Storage)
export const storage = getStorage(app); // <--- 2. AGREGADO