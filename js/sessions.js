/**
 * sessions.js
 * ---------------------------------------------------------------------------
 * Logik für sessions.html - die zentrale Übersicht über alle vorhandenen
 * Sessions (Hochzeiten/Testläufe) in diesem Firebase-Projekt. Ermöglicht es,
 * eine neue Session anzulegen, ohne alte Ergebnisse zu verlieren, und
 * liefert für jede vorhandene Session direkte Links zu allen Ansichten.
 * ---------------------------------------------------------------------------
 */

import { listSessions, ensureSessionExists } from './firestore.js';
import { slugify, STATUS_LABELS } from './utils.js';

const el = {
  list: document.getElementById('sessions-list'),
  empty: document.getElementById('sessions-empty'),
  loading: document.getElementById('sessions-loading'),
  form: document.getElementById('create-session-form'),
  input: document.getElementById('new-session-name'),
  message: document.getElementById('create-session-message'),
  submitBtn: document.getElementById('create-session-btn'),
};

init();

async function init() {
  el.form.addEventListener('submit', handleCreate);
  await loadSessions();
}

async function loadSessions() {
  el.loading.style.display = 'block';
  el.empty.style.display = 'none';
  el.list.innerHTML = '';

  try {
    const sessions = await listSessions();
    el.loading.style.display = 'none';

    if (sessions.length === 0) {
      el.empty.style.display = 'block';
      return;
    }

    el.list.innerHTML = sessions.map(buildSessionCardHtml).join('');
  } catch (err) {
    console.error(err);
    el.loading.textContent = 'Sessions konnten nicht geladen werden.';
  }
}

function buildSessionCardHtml(session) {
  const statusLabel = STATUS_LABELS[session.status] || session.status || 'unbekannt';
  const created = formatDate(session.createdAt);
  const encoded = encodeURIComponent(session.id);

  return `
    <article class="session-card">
      <div class="session-card-header">
        <h3 class="session-card-title">${escapeText(session.id)}</h3>
        <span class="status-pill">${escapeText(statusLabel)}</span>
      </div>
      <p class="session-card-meta">
        ${session.participantCount} ${session.participantCount === 1 ? 'Teilnehmer' : 'Teilnehmer'}
        ${created ? ' · angelegt ' + created : ''}
      </p>
      <div class="session-card-links">
        <a href="host.html?session=${encoded}">🎤 Moderator</a>
        <a href="display.html?session=${encoded}">📺 Anzeige</a>
        <a href="login.html?session=${encoded}">📱 Anmeldung</a>
        <a href="results.html?session=${encoded}">📊 Ergebnis</a>
        <a href="ranking.html?session=${encoded}">🏆 Rangliste</a>
      </div>
    </article>
  `;
}

async function handleCreate(e) {
  e.preventDefault();
  const rawName = el.input.value.trim();
  const slug = slugify(rawName);

  if (!slug) {
    setMessage('Bitte gib einen gültigen Namen ein (mind. ein Buchstabe oder eine Zahl).', 'error');
    return;
  }

  el.submitBtn.disabled = true;
  el.submitBtn.textContent = 'Wird angelegt …';
  setMessage('', '');

  try {
    await ensureSessionExists(slug);
    window.location.href = `host.html?session=${encodeURIComponent(slug)}`;
  } catch (err) {
    console.error(err);
    setMessage('Session konnte nicht angelegt werden. Bitte versuche es erneut.', 'error');
    el.submitBtn.disabled = false;
    el.submitBtn.textContent = 'Session anlegen';
  }
}

function setMessage(text, type) {
  el.message.textContent = text;
  el.message.className = 'form-message' + (type ? ' ' + type : '');
}

function formatDate(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== 'function') return '';
  try {
    return timestamp.toDate().toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function escapeText(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
