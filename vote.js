import {
  db, doc, updateDoc, getDoc, setDoc
} from "./firebase.js";

import { questions } from "./questions.js";

const qEl = document.getElementById("q");

let index = 0;

const sessionRef = doc(db, "session", "main");

// LOAD QUESTION
setInterval(async () => {
  const snap = await getDoc(sessionRef);
  if (snap.exists()) {
    index = snap.data().index || 0;
    qEl.innerText = questions[index].question;
  }
}, 1000);

// VOTE
async function vote(option) {
  const ref = doc(db, "session", "votes", "q" + index);
  const snap = await getDoc(ref);

  let data = snap.exists() ? snap.data() : { Lara: 0, Nathanael: 0 };

  data[option]++;

  await setDoc(ref, data);
}

document.getElementById("a").onclick = () => vote("Lara");
document.getElementById("b").onclick = () => vote("Nathanael");