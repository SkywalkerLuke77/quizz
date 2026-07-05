/**
 * host.js
 * ---------------------------------------------------------------------------
 * Logik für host.html (Moderator-Ansicht). Steuert den gesamten Ablauf des
 * Quiz über einfache Buttons, die direkt auf die Firestore-Session wirken.
 * Alle anderen Ansichten (Display, Vote) reagieren live über onSnapshot auf
 * diese Änderungen - der Moderator selbst braucht keine Verbindung zu ihnen.
 * ---------------------------------------------------------------------------
 */

import {
  ensureSessionExists,
  watchSession,
  watchParticipants,
  watchVotesForQuestion,
  updateSessionStatus,
  setCurrentQuestionIndex,
  deleteAllParticipants,
  deleteAllVotes,
  resetSessionCompletely,
} from './firestore.js';
import { questions } from './questions.js';
import { getSessionId, STATUS_LABELS } from './utils.js';

const sessionId = getSessionId();

const el = {
  sessionLabel: document.getElementById('session-label'),
  statusPill: document.getElementById('status-pill'),
  participantCount: document.getElementById('participant-count-value'),
  voteCount: document.getElementById('vote-count-value'),
  questionPreview: document.getElementById('question-preview'),

  btnOpenReg: document.getElementById('btn-open-registration'),
  btnCloseReg: document.getElementById('btn-close-registration'),
  btnStartQuiz: document.getElementById('btn-start-quiz'),
  btnCloseVoting: document.getElementById('btn-close-voting'),
  btnShowResults: document.getElementById('btn-show-results'),
  btnNextQuestion: document.getElementById('btn-next-question'),
  btnPrevQuestion: document.getElementById('btn-prev-question'),

  btnResetParticipants: document.getElementById('btn-reset-participants'),
  btnResetVotes: document.getElementById('btn-reset-votes'),
  btnResetSession: document.getElementById('btn-reset-session'),

  log: document.getElementById('log-line'),
};

let currentSession = null;
let votesUnsubscribe = null;

init();

async function init() {
  el.sessionLabel.textContent = sessionId;

  await ensureSessionExists(sessionId);

  watchSession(sessionId, onSessionUpdate);
  watchParticipants(sessionId, (list) => {
    el.participantCount.textContent = list.length;
  });

  bindButtons();
}

function onSessionUpdate(session) {
  if (!session) return;
  currentSession = session;
  const index = session.currentQuestionIndex ?? 0;
  const status = session.status;

  el.statusPill.textContent = STATUS_LABELS[status] || status;
  renderQuestionPreview(index);
  updateVotesWatch(index);
  updateButtonAvailability(status, index);
}

function renderQuestionPreview(index) {
  const q = questions[index];
  el.questionPreview.innerHTML = q
    ? `<span class="q-index">Frage ${index + 1}/${questions.length}</span>${escapeText(q.frage)}`
    : '<em>Keine Frage aktiv</em>';
}

function updateVotesWatch(index) {
  if (votesUnsubscribe) votesUnsubscribe();
  votesUnsubscribe = watchVotesForQuestion(sessionId, index, ({ total }) => {
    el.voteCount.textContent = total;
  });
}

function updateButtonAvailability(status, index) {
  el.btnOpenReg.disabled = status === 'registration_open';
  el.btnCloseReg.disabled = status !== 'registration_open';
  el.btnStartQuiz.disabled = !(status === 'registration_closed' || status === 'voting_closed' || status === 'results_visible') || (status === 'voting_open');
  el.btnCloseVoting.disabled = status !== 'voting_open';
  el.btnShowResults.disabled = status !== 'voting_closed';
  el.btnPrevQuestion.disabled = index <= 0;
  el.btnNextQuestion.disabled = index >= questions.length - 1;
}

function bindButtons() {
  el.btnOpenReg.addEventListener('click', () => run(() => updateSessionStatus(sessionId, 'registration_open'), 'Anmeldung geöffnet.'));
  el.btnCloseReg.addEventListener('click', () => run(() => updateSessionStatus(sessionId, 'registration_closed'), 'Anmeldung geschlossen.'));

  el.btnStartQuiz.addEventListener('click', () => run(async () => {
    const index = currentSession?.currentQuestionIndex ?? 0;
    await setCurrentQuestionIndex(sessionId, index);
  }, 'Umfrage gestartet.'));

  el.btnCloseVoting.addEventListener('click', () => run(() => updateSessionStatus(sessionId, 'voting_closed'), 'Abstimmung geschlossen.'));
  el.btnShowResults.addEventListener('click', () => run(() => updateSessionStatus(sessionId, 'results_visible'), 'Ergebnis wird angezeigt.'));

  el.btnNextQuestion.addEventListener('click', () => run(async () => {
    const index = Math.min((currentSession?.currentQuestionIndex ?? 0) + 1, questions.length - 1);
    await setCurrentQuestionIndex(sessionId, index);
  }, 'Nächste Frage.'));

  el.btnPrevQuestion.addEventListener('click', () => run(async () => {
    const index = Math.max((currentSession?.currentQuestionIndex ?? 0) - 1, 0);
    await setCurrentQuestionIndex(sessionId, index);
  }, 'Vorherige Frage.'));

  el.btnResetParticipants.addEventListener('click', () => {
    if (!confirm('Alle Teilnehmer wirklich löschen?')) return;
    run(() => deleteAllParticipants(sessionId), 'Teilnehmer zurückgesetzt.');
  });

  el.btnResetVotes.addEventListener('click', () => {
    if (!confirm('Alle Stimmen wirklich löschen?')) return;
    run(() => deleteAllVotes(sessionId), 'Stimmen zurückgesetzt.');
  });

  el.btnResetSession.addEventListener('click', () => {
    if (!confirm('Die komplette Session (Teilnehmer, Stimmen, Status) wirklich zurücksetzen?')) return;
    run(() => resetSessionCompletely(sessionId), 'Komplette Session zurückgesetzt.');
  });
}

async function run(action, successMessage) {
  try {
    await action();
    el.log.textContent = successMessage + ' (' + new Date().toLocaleTimeString('de-DE') + ')';
  } catch (err) {
    console.error(err);
    el.log.textContent = 'Fehler: ' + err.message;
  }
}

function escapeText(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

window.addEventListener('beforeunload', () => {
  if (votesUnsubscribe) votesUnsubscribe();
});
