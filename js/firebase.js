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
const firebaseConfig = {
  apiKey: 'DEIN_API_KEY',
  authDomain: 'DEIN_PROJEKT.firebaseapp.com',
  projectId: 'DEIN_PROJEKT_ID',
  storageBucket: 'DEIN_PROJEKT.appspot.com',
  messagingSenderId: 'DEINE_SENDER_ID',
  appId: 'DEINE_APP_ID',
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
