import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyB6Z9zT1ba7Ab0sTSIdkoTaEABfW98Wxag",
  authDomain: "noova-sac.firebaseapp.com",
  projectId: "noova-sac",
  storageBucket: "noova-sac.appspot.com",
  messagingSenderId: "545069328523",
  appId: "1:545069328523:web:7e05cf0d62af8c31b58c8e",
  measurementId: "G-2Q4860JL2V"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('No se pudo habilitar la persistencia local de Firebase Auth:', error);
});
const db = getFirestore(app);
const functions = getFunctions(app);

// Emuladores locales (opt-in): solo se activan si en .env.local existe
// VITE_USE_EMULATORS=true. En caso contrario el frontend habla directo con
// Firebase de producción.
const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS === 'true';

if (USE_EMULATORS) {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectFunctionsEmulator(functions, 'localhost', 5001);
  console.info('Emuladores activos (Firestore :8080, Functions :5001)');
} else {
  console.info('Modo producción: conectado a Firebase real');
}

export { auth, authPersistenceReady, db, functions };
