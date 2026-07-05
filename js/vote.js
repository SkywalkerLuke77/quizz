/**
 * vote.js
 * ---------------------------------------------------------------------------
 * Logik für vote.html (Smartphone-Ansicht der Teilnehmer).
 *
 * Ablauf:
 *  1. Session & Teilnehmer-Identität laden.
 *  2. Live auf die Session hören (Status + aktuelle Frage).
 *  3. Bei Statuswechsel zu "voting_open" die passende Frage aus questions.js
 *     anzeigen und prüfen, ob für diese Frage schon abgestimmt wurde
 *     (localStorage als schnelle Prüfung + Firestore als verbindliche Quelle).
 *  4. Beim Klick auf einen Button: Stimme per Transaction abgeben. Danach
 *     werden beide Buttons deaktiviert, auch nach einem Reload.
 * ---------------------------------------------------------------------------
 */

import { ensureSessionExists, watchSession, castVote, hasVoted } from './firestore.js';
import { questions, ANSWER_A_LABEL, ANSWER_B_LABEL } from './questions.js';
import {
  getSessionId,
  getOrCreateParticipantId,
  getStoredParticipantName,
  hasVotedLocally,
  markVotedLocally,
  unmarkVotedLocally,
} from './utils.js';

const sessionId = getSessionId();
const participantId = getOrCreateParticipantId(sessionId);
const participantName = getStoredParticipantName(sessionId);

const els = {
  participantName: document.getElementById('participant-name'),
  questionWrap: document.getElementById('question-wrap'),
  questionText: document.getElementById('question-text'),
  buttonsWrap: document.getElementById('buttons-wrap'),
  btnA: document.getElementById('btn-a'),
  btnB: document.getElementById('btn-b'),
  waiting: document.getElementById('waiting-view'),
  waitingText: document.getElementById('waiting-text'),
  confirmation: document.getElementById('confirmation'),
};

let currentQuestionIndex = null;
let currentStatus = null;
let voteInFlight = false;

init();

async function init() {
  if (!participantName) {
    // Ohne Registrierung kein Zugriff auf die Voting-Seite.
    window.location.href = `login.html?session=${encodeURIComponent(sessionId)}`;
    return;
  }

  els.participantName.textContent = participantName;
  els.btnA.querySelector('.vote-btn-label').textContent = ANSWER_A_LABEL;
  els.btnB.querySelector('.vote-btn-label').textContent = ANSWER_B_LABEL;
  els.btnA.addEventListener('click', () => handleVote('A'));
  els.btnB.addEventListener('click', () => handleVote('B'));

  await ensureSessionExists(sessionId);

  watchSession(sessionId, onSessionUpdate);
}

async function onSessionUpdate(session) {
  if (!session) return;
  currentStatus = session.status;
  const index = session.currentQuestionIndex ?? 0;

  if (currentStatus === 'registration_open') {
    // Dieser Fall tritt vor allem nach einem "Komplette Session
    // zurücksetzen" ein: Der Teilnehmer-Eintrag in Firestore wurde
    // gelöscht, das Handy selbst weiß das aber nicht (der Name steht noch
    // im localStorage). Ohne diese Weiterleitung würde das Gerät hier
    // endlos auf eine Umfrage warten, obwohl es in Firestore gar nicht
    // mehr als Teilnehmer existiert. Zurück zur Anmeldung schicken - der
    // Name ist dort bereits vorausgefüllt, ein Tippen auf "Anmelden"
    // genügt.
    window.location.href = `login.html?session=${encodeURIComponent(sessionId)}`;
    return;
  }

  if (index !== currentQuestionIndex) {
    currentQuestionIndex = index;
    await renderQuestion(index);
  }

  if (currentStatus === 'voting_open') {
    setButtonsMode('active');
  } else if (currentStatus === 'voting_closed' || currentStatus === 'results_visible') {
    setButtonsMode('closed');
  }
}

async function renderQuestion(index) {
  const q = questions[index];
  if (!q) {
    showWaiting('Das Quiz ist beendet. Vielen Dank fürs Mitspielen! 💕');
    return;
  }

  els.waiting.style.display = 'none';
  els.questionWrap.style.display = 'block';
  els.buttonsWrap.style.display = 'flex';
  els.confirmation.style.display = 'none';
  els.questionText.textContent = q.frage;

  els.btnA.disabled = false;
  els.btnB.disabled = false;
  els.btnA.classList.remove('is-selected');
  els.btnB.classList.remove('is-selected');

  // Firestore ist die einzige verbindliche Quelle dafür, ob bereits
  // abgestimmt wurde. Der lokale Merker (localStorage) dient nur als
  // schnelle UI-Abkürzung und wird hier bei jeder Frage mit Firestore
  // abgeglichen - so kann ein veralteter lokaler Merker (z. B. von vor
  // einem "Komplette Session zurücksetzen") niemals dauerhaft verhindern,
  // dass jemand abstimmt.
  const existingAnswer = await hasVoted(sessionId, index, participantId);

  if (existingAnswer) {
    markVotedLocally(sessionId, index);
    lockButtonsAfterVote(existingAnswer);
  } else {
    unmarkVotedLocally(sessionId, index);
  }
}

function showWaiting(text) {
  els.waiting.style.display = 'flex';
  els.questionWrap.style.display = 'none';
  els.buttonsWrap.style.display = 'none';
  els.confirmation.style.display = 'none';
  els.waitingText.textContent = text;
}

function setButtonsMode(mode) {
  if (currentQuestionIndex === null) return;
  const alreadyVoted = hasVotedLocally(sessionId, currentQuestionIndex);
  if (mode === 'closed' && !alreadyVoted) {
    els.btnA.disabled = true;
    els.btnB.disabled = true;
  }
}

async function handleVote(answer) {
  if (voteInFlight) return;
  if (currentQuestionIndex === null) return;
  if (currentStatus !== 'voting_open') return;
  if (hasVotedLocally(sessionId, currentQuestionIndex)) return;

  voteInFlight = true;
  els.btnA.disabled = true;
  els.btnB.disabled = true;

  try {
    await castVote(sessionId, currentQuestionIndex, participantId, answer);
    markVotedLocally(sessionId, currentQuestionIndex);
    lockButtonsAfterVote(answer);
  } catch (err) {
    if (err.code === 'ALREADY_VOTED') {
      markVotedLocally(sessionId, currentQuestionIndex);
      lockButtonsAfterVote(answer);
    } else {
      console.error(err);
      els.btnA.disabled = (currentStatus !== 'voting_open');
      els.btnB.disabled = (currentStatus !== 'voting_open');
      alert('Deine Stimme konnte nicht gespeichert werden. Bitte versuche es erneut.');
    }
  } finally {
    voteInFlight = false;
  }
}

function lockButtonsAfterVote(answer) {
  els.btnA.disabled = true;
  els.btnB.disabled = true;
  if (answer === 'A') els.btnA.classList.add('is-selected');
  if (answer === 'B') els.btnB.classList.add('is-selected');
  els.confirmation.style.display = 'block';
  els.confirmation.textContent = 'Deine Stimme wurde gespeichert. ✓';
}
