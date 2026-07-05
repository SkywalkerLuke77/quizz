import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export {
  collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, onSnapshot
};