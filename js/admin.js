import {
  db, doc, setDoc, deleteDoc
} from "./firebase.js";

import {
  ensureQuestionsSeeded,
  subscribeQuestions,
  normalizeQuestionOrder
} from "./question-store.js";

const newQuestionInput = document.getElementById("newQuestion");
const addQuestionBtn = document.getElementById("addQuestion");
const listEl = document.getElementById("list");
const statusEl = document.getElementById("status");

let currentQuestions = [];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setStatus(message) {
  statusEl.innerText = message;
}

function questionRef(id) {
  return doc(db, "session", "main", "questions", id);
}

function nextQuestionId() {
  return `q${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function addQuestion() {
  const text = newQuestionInput.value.trim();
  if (!text) {
    setStatus("Bitte zuerst eine Frage eingeben.");
    return;
  }

  const order = currentQuestions.length;
  await setDoc(questionRef(nextQuestionId()), { text, order });
  newQuestionInput.value = "";
  setStatus("Frage hinzugefuegt.");
}

async function saveQuestion(id, text) {
  const trimmed = text.trim();
  if (!trimmed) {
    setStatus("Leere Frage ist nicht erlaubt.");
    return;
  }

  await setDoc(questionRef(id), { text: trimmed }, { merge: true });
  setStatus("Frage gespeichert.");
}

async function removeQuestion(id) {
  await deleteDoc(questionRef(id));
  const remaining = currentQuestions.filter((q) => q.id !== id);
  await normalizeQuestionOrder(remaining);
  setStatus("Frage geloescht.");
}

function renderList() {
  if (!currentQuestions.length) {
    listEl.innerHTML = '<div class="row"><div></div><div>Noch keine Fragen vorhanden.</div><div></div><div></div></div>';
    return;
  }

  const rows = currentQuestions.map((item, idx) => {
    return `
      <div class="row" data-id="${item.id}">
        <div class="num">${idx + 1}.</div>
        <input type="text" value="${escapeHtml(item.text)}">
        <button class="saveBtn">Speichern</button>
        <button class="deleteBtn">Loeschen</button>
      </div>
    `;
  }).join("");

  listEl.innerHTML = rows;

  listEl.querySelectorAll(".saveBtn").forEach((button) => {
    button.onclick = async () => {
      const row = button.closest(".row");
      const id = row.dataset.id;
      const input = row.querySelector("input");
      await saveQuestion(id, input.value);
    };
  });

  listEl.querySelectorAll(".deleteBtn").forEach((button) => {
    button.onclick = async () => {
      const row = button.closest(".row");
      const id = row.dataset.id;
      await removeQuestion(id);
    };
  });
}

addQuestionBtn.onclick = addQuestion;
newQuestionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") addQuestion();
});

async function init() {
  await ensureQuestionsSeeded();

  subscribeQuestions((questions) => {
    currentQuestions = questions;
    renderList();
  });
}

init();
