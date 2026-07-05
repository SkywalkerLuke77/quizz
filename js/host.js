import {
  db, collection, doc, setDoc, getDoc, getDocs, onSnapshot
} from "./firebase.js";

import {
  ensureQuestionsSeeded,
  subscribeQuestions
} from "./question-store.js";

const sessionRef = doc(db, "session", "main");

const questionEl = document.getElementById("question");
const metaEl = document.getElementById("meta");
const roundStatusEl = document.getElementById("roundStatus");
const resultsEl = document.getElementById("results");

const DEFAULT_JOIN_MS = 2 * 60 * 1000;
const DEFAULT_QUESTION_SEC = 20;

let sessionState = null;
let usersCount = 0;
let votesUnsubscribe = null;
let currentQuestions = [];

function votesCollectionFor(index) {
  return collection(db, "session", "main", "votes", `q${index}`, "entries");
}

function clampQuestionIndex(index) {
  if (!currentQuestions.length) return 0;
  if (!Number.isInteger(index) || index < 0) return 0;
  if (index >= currentQuestions.length) return 0;
  return index;
}

async function ensureSessionDefaults() {
  const snap = await getDoc(sessionRef);
  if (snap.exists()) return;

  await setDoc(sessionRef, {
    joinOpen: true,
    joinDeadline: Date.now() + DEFAULT_JOIN_MS,
    currentQuestion: 0,
    questionOpen: false,
    questionEndsAt: 0,
    questionDurationSec: DEFAULT_QUESTION_SEC,
    showResults: false
  });
}

function questionText(index) {
  if (!currentQuestions.length) return "Keine Fragen vorhanden. Bitte in Admin Fragen anlegen.";
  const safe = clampQuestionIndex(index);
  return `Frage ${safe + 1}/${currentQuestions.length}: ${currentQuestions[safe].text}`;
}

async function openJoinWindow(ms = DEFAULT_JOIN_MS) {
  await setDoc(sessionRef, {
    joinOpen: true,
    joinDeadline: Date.now() + ms
  }, { merge: true });
}

async function closeJoinWindow() {
  await setDoc(sessionRef, { joinOpen: false }, { merge: true });
}

async function startQuestion(index) {
  const safe = clampQuestionIndex(index);
  const current = sessionState || {};
  const durationSec = Number.isFinite(current.questionDurationSec)
    ? Number(current.questionDurationSec)
    : DEFAULT_QUESTION_SEC;

  await setDoc(sessionRef, {
    currentQuestion: safe,
    questionOpen: true,
    showResults: false,
    questionEndsAt: Date.now() + durationSec * 1000
  }, { merge: true });
}

async function closeQuestion(showResults = true) {
  await setDoc(sessionRef, {
    questionOpen: false,
    showResults,
    questionEndsAt: 0
  }, { merge: true });
}

async function renderResults(index) {
  const votesSnap = await getDocs(votesCollectionFor(index));
  let lara = 0;
  let nathanael = 0;

  votesSnap.forEach((voteDoc) => {
    const choice = voteDoc.data().choice;
    if (choice === "Lara") lara += 1;
    if (choice === "Nathanael") nathanael += 1;
  });

  const total = lara + nathanael;
  const safeTotal = total || 1;
  const laraPct = Math.round((lara / safeTotal) * 100);
  const nathanaelPct = Math.round((nathanael / safeTotal) * 100);

  resultsEl.innerHTML = `
    <div class="barRow">
      <div>Lara: ${lara} Stimmen (${laraPct}%)</div>
      <div class="barBg">
        <div class="barFill" style="width:${laraPct}%;background:#ff6fae;">${laraPct}%</div>
      </div>
    </div>
    <div class="barRow">
      <div>Nathanael: ${nathanael} Stimmen (${nathanaelPct}%)</div>
      <div class="barBg">
        <div class="barFill" style="width:${nathanaelPct}%;background:#5bbcff;">${nathanaelPct}%</div>
      </div>
    </div>
  `;
}

function renderMeta() {
  if (!sessionState) return;

  const joinOpen = Boolean(sessionState.joinOpen) && Date.now() < (sessionState.joinDeadline || 0);
  const joinInfo = joinOpen ? "offen" : "geschlossen";
  metaEl.innerText = `Teilnehmer: ${usersCount} | Anmeldung: ${joinInfo}`;
}

function renderRoundStatus(votesCount) {
  if (!sessionState) return;

  const index = clampQuestionIndex(sessionState.currentQuestion || 0);
  const open = Boolean(sessionState.questionOpen);
  const endsAt = Number(sessionState.questionEndsAt || 0);
  const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));

  if (open) {
    roundStatusEl.innerText = `Frage offen | Stimmen: ${votesCount}/${usersCount} | Restzeit: ${remaining}s`;
    return;
  }

  roundStatusEl.innerText = `Frage geschlossen | Aktuelle Frage: ${index + 1}`;
}

function watchCurrentQuestionVotes() {
  if (!sessionState) return;

  const index = clampQuestionIndex(sessionState.currentQuestion || 0);

  if (votesUnsubscribe) {
    votesUnsubscribe();
    votesUnsubscribe = null;
  }

  votesUnsubscribe = onSnapshot(votesCollectionFor(index), async (snap) => {
    const votesCount = snap.size;
    renderRoundStatus(votesCount);

    const shouldAutoClose = Boolean(sessionState.questionOpen) && usersCount > 0 && votesCount >= usersCount;
    if (shouldAutoClose) {
      await closeQuestion(true);
      return;
    }

    if (sessionState.showResults) {
      await renderResults(index);
    } else {
      resultsEl.innerHTML = "";
    }
  });
}

document.getElementById("openJoin").onclick = async () => {
  await openJoinWindow();
};

document.getElementById("closeJoin").onclick = async () => {
  await closeJoinWindow();
};

document.getElementById("next").onclick = async () => {
  if (!currentQuestions.length) return;
  const current = sessionState ? clampQuestionIndex(sessionState.currentQuestion || 0) : -1;
  const next = (current + 1) % currentQuestions.length;
  await startQuestion(next);
};

document.getElementById("closeQuestion").onclick = async () => {
  await closeQuestion(false);
};

document.getElementById("show").onclick = async () => {
  await closeQuestion(true);
};

async function init() {
  await ensureSessionDefaults();
  await ensureQuestionsSeeded();

  subscribeQuestions((questions) => {
    currentQuestions = questions;

    if (!sessionState) {
      questionEl.innerText = questionText(0);
      return;
    }

    const index = clampQuestionIndex(sessionState.currentQuestion || 0);
    questionEl.innerText = questionText(index);
  });

  onSnapshot(collection(db, "session", "main", "users"), (snap) => {
    usersCount = snap.size;
    renderMeta();
  });

  onSnapshot(sessionRef, async (snap) => {
    if (!snap.exists()) return;
    sessionState = snap.data();

    const index = clampQuestionIndex(sessionState.currentQuestion || 0);
    questionEl.innerText = questionText(index);

    if (Boolean(sessionState.joinOpen) && Date.now() >= Number(sessionState.joinDeadline || 0)) {
      await closeJoinWindow();
    }

    renderMeta();
    watchCurrentQuestionVotes();

    if (sessionState.showResults) {
      await renderResults(index);
    } else {
      resultsEl.innerHTML = "";
    }
  });

  setInterval(async () => {
    if (!sessionState) return;

    const open = Boolean(sessionState.questionOpen);
    const timedOut = Date.now() >= Number(sessionState.questionEndsAt || 0);
    if (open && timedOut) {
      await closeQuestion(true);
      return;
    }

    if (Boolean(sessionState.joinOpen) && Date.now() >= Number(sessionState.joinDeadline || 0)) {
      await closeJoinWindow();
    }
  }, 1000);
}

init();
