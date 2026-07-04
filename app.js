import {
  db, doc, setDoc, onSnapshot
} from "./firebase.js";

const nameInput = document.getElementById("name");
const joinBtn = document.getElementById("join");
const usersDiv = document.getElementById("users");

const sessionRef = doc(db, "session", "main");

// JOIN USER
joinBtn.onclick = async () => {
  const name = nameInput.value.trim();
  if (!name) return;

  await setDoc(doc(db, "session", "users", name), {
    name,
    joined: Date.now()
  });
};

// LIVE USERS
onSnapshot(doc(db, "session", "users"), (snap) => {
  usersDiv.innerHTML = "";
});