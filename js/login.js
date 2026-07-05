/**
 * login.js
 * ---------------------------------------------------------------------------
 * Logik für login.html. Ein Gast gibt seinen Namen ein, wird als Teilnehmer
 * in Firestore registriert und wartet anschließend, bis der Moderator die
 * Umfrage startet - dann erfolgt automatisch die Weiterleitung zu vote.html.
 * ---------------------------------------------------------------------------
 */

import { ensureSessionExists, registerParticipant, watchSession } from './firestore.js';
import {
  getSessionId,
  getOrCreateParticipantId,
  getStoredParticipantName,
  setStoredParticipantName,
  escapeHtml,
} from './utils.js';

const sessionId = getSessionId();
const participantId = getOrCreateParticipantId(sessionId);

const form = document.getElementById('login-form');
const nameInput = document.getElementById('name-input');
const messageEl = document.getElementById('form-message');
const submitBtn = document.getElementById('submit-btn');
const statusBanner = document.getElementById('status-banner');

let sessionUnsubscribe = null;
let registered = false;

init();

async function init() {
  await ensureSessionExists(sessionId);

  const existingName = getStoredParticipantName(sessionId);
  if (existingName) {
    nameInput.value = existingName;
  }

  form.addEventListener('submit', handleSubmit);

  // Live-Status beobachten, um automatisch weiterzuleiten, sobald die
  // Umfrage vom Moderator gestartet wird ("voting_open").
  sessionUnsubscribe = watchSession(sessionId, (session) => {
    if (!session) return;

    if (session.status === 'registration_closed' && !registered) {
      setMessage('Die Anmeldung ist leider bereits geschlossen.', 'error');
      submitBtn.disabled = true;
    }

    if (registered && (session.status === 'voting_open' || session.status === 'voting_closed')) {
      window.location.href = `vote.html?session=${encodeURIComponent(sessionId)}`;
    }
  });
}

async function handleSubmit(e) {
  e.preventDefault();
  const name = nameInput.value.trim();

  if (!name) {
    setMessage('Bitte gib deinen Namen ein.', 'error');
    return;
  }
  if (name.length > 40) {
    setMessage('Der Name ist zu lang (max. 40 Zeichen).', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Wird gespeichert …';
  setMessage('', '');

  try {
    await registerParticipant(sessionId, participantId, name);
    setStoredParticipantName(sessionId, name);
    registered = true;
    setMessage(`Willkommen, ${escapeHtml(name)}! Du bist angemeldet.`, 'success');
    statusBanner.textContent = 'Du wirst automatisch weitergeleitet, sobald die Umfrage startet.';
    statusBanner.style.display = 'block';
    submitBtn.textContent = 'Angemeldet ✓';
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Anmelden';
    if (err.code === 'NAME_TAKEN') {
      setMessage('Dieser Name ist bereits vergeben. Bitte wähle einen anderen (z. B. mit Nachnamen).', 'error');
    } else {
      console.error(err);
      setMessage('Etwas ist schiefgelaufen. Bitte versuche es erneut.', 'error');
    }
  }
}

function setMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = 'form-message' + (type ? ' ' + type : '');
}

window.addEventListener('beforeunload', () => {
  if (sessionUnsubscribe) sessionUnsubscribe();
});
