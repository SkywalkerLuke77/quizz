import {
  db, doc, getDoc, setDoc, updateDoc, onSnapshot
} from "./firebase.js";

import { questions } from "./questions.js";

let index = 0;

const qEl = document.getElementById("question");
const resultsEl = document.getElementById("results");

const sessionRef = doc(db, "session", "main");

// INIT
async function load() {
  qEl.innerText = questions[index].question;
}
load();

// NEXT QUESTION
document.getElementById("next").onclick = async () => {
  index++;
  if (index >= questions.length) index = 0;

  await setDoc(sessionRef, {
    index
  });

  qEl.innerText = questions[index].question;
};

// SHOW RESULTS
document.getElementById("show").onclick = async () => {
  const snap = await getDoc(doc(db, "session", "votes", "q" + index));

  const data = snap.exists() ? snap.data() : { Lara: 0, Nathanael: 0 };

  const total = data.Lara + data.Nathanael || 1;

  resultsEl.innerHTML = `
    <div style="background:#ff6fae;width:${(data.Lara/total)*100}%"
         class="bar">Lara ${data.Lara}</div>

    <div style="background:#5bbcff;width:${(data.Nathanael/total)*100}%"
         class="bar">Nathanael ${data.Nathanael}</div>
  `;
};