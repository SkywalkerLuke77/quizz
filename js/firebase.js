/**
 * firebase.js
 * ---------------------------------------------------------------------------
 * Zentrale Firebase-Initialisierung. Alle anderen Module importieren die
 * Firestore-Instanz ausschließlich von hier, damit die App nur eine einzige
 * Firebase-App-Instanz besitzt.
 *
 * WICHTIG: Trage hier deine eigenen Firebase-Projektdaten ein
 * (Firebase Console -> Projekteinstellungen -> "Deine Apps" -> Web-App).
 * Siehe README.md, Abschnitt "Firebase-Einrichtung".
 * ---------------------------------------------------------------------------
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore,
  connectFirestoreEmulator,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// TODO: Ersetze diese Platzhalter durch deine echte Firebase-Konfiguration.
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

const firebaseConfig = {
  apiKey: "AIzaSyCU8rdfwinf5ELa8OmhquVD0gGhB8b3kOM",
  authDomain: "lnquizz.firebaseapp.com",
  projectId: "lnquizz",
  storageBucket: "lnquizz.firebasestorage.app",
  messagingSenderId: "232438389870",
  appId: "1:232438389870:web:58f57fec98b1cc9d78da7f",
  measurementId: "G-GVCCRRHK9F"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

// Für lokale Entwicklung mit dem Firestore-Emulator:
// URL-Parameter ?emulator=1 anhängen, z. B. host.html?emulator=1
const params = new URLSearchParams(window.location.search);
if (params.get('emulator') === '1') {
  connectFirestoreEmulator(db, 'localhost', 8080);
  console.info('[firebase.js] Verbunden mit lokalem Firestore-Emulator.');
}
