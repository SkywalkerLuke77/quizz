/**
 * utils.js
 * ---------------------------------------------------------------------------
 * Kleine, wiederverwendbare Hilfsfunktionen, die von mehreren Seiten genutzt
 * werden: Session-Verwaltung, Teilnehmer-Identität (UUID) und ein paar
 * allgemeine Helfer (Debounce, Prozentrechnung, Escaping).
 * ---------------------------------------------------------------------------
 */

/**
 * Liefert die aktuelle Session-ID.
 *
 * Die Session-ID erlaubt es, mehrere unabhängige Hochzeiten / Testläufe im
 * selben Firestore-Projekt zu betreiben, ohne dass sich die Daten
 * vermischen. Sie wird aus dem URL-Parameter "session" gelesen
 * (z. B. vote.html?session=lara-und-nathanael). Ist kein Parameter
 * vorhanden, wird eine feste Standard-Session verwendet, damit die App auch
 * ohne Parameter sofort funktioniert.
 */
export function getSessionId() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('session');
  if (fromUrl && fromUrl.trim().length > 0) {
    // Session-ID im Browser merken, damit sie beim Wechsel zwischen den
    // Seiten (Login -> Voting) erhalten bleibt, auch falls der Parameter
    // auf der Zielseite einmal fehlen sollte.
    localStorage.setItem('hq_sessionId', fromUrl.trim());
    return fromUrl.trim();
  }
  const stored = localStorage.getItem('hq_sessionId');
  if (stored) return stored;

  const fallback = 'lara-und-nathanael';
  localStorage.setItem('hq_sessionId', fallback);
  return fallback;
}

/**
 * Erzeugt eine zufällige UUID v4 (ausreichend für Client-seitige,
 * nicht-kryptografische Identifikation).
 */
export function generateUUID() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  // Fallback für ältere Browser
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const PARTICIPANT_ID_KEY_PREFIX = 'hq_participantId_';
const PARTICIPANT_NAME_KEY_PREFIX = 'hq_participantName_';

/**
 * Liefert die eindeutige Teilnehmer-ID für die aktuelle Session.
 * Wird beim ersten Aufruf erzeugt und dauerhaft im localStorage gespeichert.
 * Dadurch bleibt ein Teilnehmer auch nach einem Reload eindeutig
 * identifizierbar - unabhängig vom (änderbaren) Benutzernamen.
 */
export function getOrCreateParticipantId(sessionId) {
  const key = PARTICIPANT_ID_KEY_PREFIX + sessionId;
  let id = localStorage.getItem(key);
  if (!id) {
    id = generateUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function getStoredParticipantName(sessionId) {
  return localStorage.getItem(PARTICIPANT_NAME_KEY_PREFIX + sessionId);
}

export function setStoredParticipantName(sessionId, name) {
  localStorage.setItem(PARTICIPANT_NAME_KEY_PREFIX + sessionId, name);
}

/**
 * Merkt sich lokal, für welche Fragen-Indizes bereits abgestimmt wurde.
 * Dies ist eine zusätzliche, rein clientseitige Absicherung gegen
 * Mehrfachklicks - die eigentliche, verbindliche Prüfung erfolgt serverseitig
 * über eine Firestore-Transaction (siehe firestore.js:castVote).
 */
export function hasVotedLocally(sessionId, questionIndex) {
  const raw = localStorage.getItem('hq_votedQuestions_' + sessionId);
  if (!raw) return false;
  try {
    const arr = JSON.parse(raw);
    return arr.includes(questionIndex);
  } catch {
    return false;
  }
}

export function markVotedLocally(sessionId, questionIndex) {
  const raw = localStorage.getItem('hq_votedQuestions_' + sessionId);
  let arr = [];
  if (raw) {
    try {
      arr = JSON.parse(raw);
    } catch {
      arr = [];
    }
  }
  if (!arr.includes(questionIndex)) {
    arr.push(questionIndex);
  }
  localStorage.setItem('hq_votedQuestions_' + sessionId, JSON.stringify(arr));
}

/**
 * Entfernt einen einzelnen Fragen-Index aus dem lokalen "abgestimmt"-Merker.
 * Wird benötigt, um veraltete Einträge zu korrigieren - z. B. wenn der
 * Moderator die komplette Session zurückgesetzt hat: Die Stimme in
 * Firestore ist dann gelöscht, aber der lokale Merker auf dem Handy bliebe
 * ohne diese Funktion fälschlich auf "schon abgestimmt" stehen und würde
 * jeden weiteren Klick auf die Antwort-Buttons stillschweigend blockieren.
 */
export function unmarkVotedLocally(sessionId, questionIndex) {
  const raw = localStorage.getItem('hq_votedQuestions_' + sessionId);
  if (!raw) return;
  try {
    const arr = JSON.parse(raw).filter((i) => i !== questionIndex);
    localStorage.setItem('hq_votedQuestions_' + sessionId, JSON.stringify(arr));
  } catch {
    localStorage.removeItem('hq_votedQuestions_' + sessionId);
  }
}

export function clearVotedLocally(sessionId) {
  localStorage.removeItem('hq_votedQuestions_' + sessionId);
}

/**
 * Wandelt einen frei eingegebenen Session-Namen in eine sichere, als
 * Firestore-Dokument-ID nutzbare Form um (nur Kleinbuchstaben, Ziffern und
 * Bindestriche). Wird beim Anlegen einer neuen Session auf sessions.html
 * verwendet, z. B. "Hochzeit 2027!" -> "hochzeit-2027".
 */
export function slugify(str) {
  return str
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // übrige Akzente entfernen (é -> e, ...)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Rundet einen Prozentwert kaufmännisch und formatiert ihn als String. */
export function formatPercent(count, total) {
  if (!total) return '0%';
  return Math.round((count / total) * 100) + '%';
}

/** Sehr simples HTML-Escaping für nutzergenerierte Strings (Namen). */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Debounce-Helfer, z. B. für Eingabefelder. */
export function debounce(fn, delay = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Menschlich lesbare Status-Bezeichnungen für Moderator & Display. */
export const STATUS_LABELS = {
  registration_open: 'Anmeldung offen',
  registration_closed: 'Anmeldung geschlossen',
  voting_open: 'Abstimmung offen',
  voting_closed: 'Abstimmung geschlossen',
  results_visible: 'Ergebnis sichtbar',
};
