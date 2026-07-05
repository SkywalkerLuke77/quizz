import {
  db, collection, doc, setDoc, getDoc, onSnapshot
} from "./firebase.js";

import {
  ensureQuestionsSeeded,
  subscribeQuestions
} from "./question-store.js";

const sessionRef = doc(db, "session", "main");

const usernameInput = document.getElementById("username");
const saveNameBtn = document.getElementById("saveName");
const questionEl = document.getElementById("q");
const metaEl = document.getElementById("meta");
const statusEl = document.getElementById("status");
const btnA = document.getElementById("a");
const btnB = document.getElementById("b");

let sessionState = null;
let currentQuestion = 0;
let currentQuestions = [];

function voteDocRef(index, username) {
  return doc(db, "session", "main", "votes", `q${index}`, "entries", username);
}

function clampQuestionIndex(index) {
  if (!currentQuestions.length) return 0;
  if (!Number.isInteger(index) || index < 0) return 0;
  if (index >= currentQuestions.length) return 0;
  return index;
}

function getUsername() {
  return usernameInput.value.trim();
}

function setVotingEnabled(enabled) {
  btnA.disabled = !enabled;
  btnB.disabled = !enabled;
}

function renderQuestion() {
  if (!currentQuestions.length) {
    questionEl.innerText = "Keine Fragen vorhanden. Bitte Admin informieren.";
    return;
  }

  const safe = clampQuestionIndex(currentQuestion);
  questionEl.innerText = `Frage ${safe + 1}/${currentQuestions.length}: ${currentQuestions[safe].text}`;
}

function renderMeta() {
  if (!sessionState) return;

  const open = Boolean(sessionState.questionOpen);
  const endsAt = Number(sessionState.questionEndsAt || 0);
  const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));

  if (open) {
    metaEl.innerText = `Abstimmung offen | Restzeit: ${remaining}s`;
    return;
  }

  metaEl.innerText = "Abstimmung geschlossen";
}

async function refreshLocalVoteStatus() {
  if (!currentQuestions.length) {
    statusEl.innerText = "Es sind noch keine Fragen angelegt.";
    setVotingEnabled(false);
    return;
  }

  const username = getUsername();
  if (!username) {
    statusEl.innerText = "Bitte Benutzernamen eingeben.";
    setVotingEnabled(false);
    return;
  }

  if (!sessionState || !sessionState.questionOpen) {
    setVotingEnabled(false);
    return;
  }

  const voteSnap = await getDoc(voteDocRef(currentQuestion, username));
  if (voteSnap.exists()) {
    statusEl.innerText = "Du hast bereits abgestimmt.";
    setVotingEnabled(false);
    return;
  }

  statusEl.innerText = "Bitte stimme jetzt ab.";
  setVotingEnabled(true);
}

saveNameBtn.onclick = () => {
  const username = getUsername();
  if (!username) {
    statusEl.innerText = "Benutzername fehlt.";
    return;
  }

  localStorage.setItem("quiz_username", username);
  statusEl.innerText = "Name gespeichert.";
  refreshLocalVoteStatus();
};

async function vote(choice) {
  if (!currentQuestions.length) {
    statusEl.innerText = "Es sind noch keine Fragen angelegt.";
    setVotingEnabled(false);
    return;
  }

  const username = getUsername();
  if (!username) {
    statusEl.innerText = "Bitte Benutzernamen eingeben.";
    return;
  }

  if (!sessionState || !sessionState.questionOpen) {
    statusEl.innerText = "Diese Frage ist geschlossen.";
    setVotingEnabled(false);
    return;
  }

  const ref = voteDocRef(currentQuestion, username);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    statusEl.innerText = "Du hast bereits abgestimmt.";
    setVotingEnabled(false);
    return;
  }

  await setDoc(ref, {
    username,
    choice,
    createdAt: Date.now()
  });

  statusEl.innerText = `Stimme gespeichert: ${choice}`;
  setVotingEnabled(false);
}

btnA.onclick = () => vote("Lara");
btnB.onclick = () => vote("Nathanael");

async function init() {
  await ensureQuestionsSeeded();

  const saved = localStorage.getItem("quiz_username") || "";
  usernameInput.value = saved;

  subscribeQuestions((questions) => {
    currentQuestions = questions;
    renderQuestion();
  });

  onSnapshot(sessionRef, async (snap) => {
    if (!snap.exists()) return;

    sessionState = snap.data();
    currentQuestion = clampQuestionIndex(sessionState.currentQuestion || 0);

    renderQuestion();
    renderMeta();
    await refreshLocalVoteStatus();
  });

  setInterval(() => {
    renderMeta();
  }, 1000);

  onSnapshot(collection(db, "session", "main", "users"), async () => {
    await refreshLocalVoteStatus();
  });
}

init();
