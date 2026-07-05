/**
 * display.js
 * ---------------------------------------------------------------------------
 * Logik für display.html (Beamer / Surface Pro, keine Bedienelemente).
 *
 * Reagiert ausschließlich auf Firestore-Änderungen (onSnapshot) und zeigt
 * je nach Session-Status eine von drei Ansichten:
 *   - registration_open / registration_closed  -> Startbildschirm (QR + Liste)
 *   - voting_open / voting_closed               -> aktuelle Frage
 *   - results_visible                            -> Balkendiagramm
 *
 * Die Teilnehmerliste läuft als Endlos-Loop kontinuierlich nach oben
 * (reine CSS/JS-Animation über requestAnimationFrame).
 * ---------------------------------------------------------------------------
 */

import {
  ensureSessionExists,
  watchSession,
  watchParticipants,
  watchVotesForQuestion,
} from './firestore.js';
import { questions, ANSWER_A_LABEL, ANSWER_B_LABEL } from './questions.js';
import { getSessionId, escapeHtml, formatPercent } from './utils.js';

const sessionId = getSessionId();

const loginUrl = new URL('login.html', window.location.href);
loginUrl.searchParams.set('session', sessionId);

const views = {
  start: document.getElementById('view-start'),
  question: document.getElementById('view-question'),
  results: document.getElementById('view-results'),
};

const el = {
  startUrl: document.getElementById('start-url'),
  participantCount: document.getElementById('participant-count'),
  participantTrack: document.getElementById('participant-track'),
  questionEyebrow: document.getElementById('question-eyebrow'),
  questionText: document.getElementById('question-text'),
  questionImageWrap: document.getElementById('question-image-wrap'),
  resultsQuestion: document.getElementById('results-question'),
  barA: document.getElementById('bar-a'),
  barB: document.getElementById('bar-b'),
  percentA: document.getElementById('percent-a'),
  percentB: document.getElementById('percent-b'),
  countA: document.getElementById('count-a'),
  countB: document.getElementById('count-b'),
};

let knownParticipantIds = new Set();
let currentVotesUnsubscribe = null;
let currentResultsIndex = null;

init();

async function init() {
  el.startUrl.textContent = loginUrl.href.replace(/^https?:\/\//, '');
  renderQrCode(loginUrl.href);

  await ensureSessionExists(sessionId);

  watchSession(sessionId, onSessionUpdate);
  watchParticipants(sessionId, onParticipantsUpdate);
  startParticipantMarquee();
}

function onSessionUpdate(session) {
  if (!session) return;
  const index = session.currentQuestionIndex ?? 0;
  const status = session.status;

  if (status === 'registration_open' || status === 'registration_closed') {
    showView('start');
    stopVotesWatch();
  } else if (status === 'voting_open' || status === 'voting_closed') {
    showQuestion(index);
    stopVotesWatch();
  } else if (status === 'results_visible') {
    showResults(index);
  }
}

function showView(name) {
  Object.entries(views).forEach(([key, node]) => {
    node.classList.toggle('is-active', key === name);
  });
}

/* ------------------------------ Startbildschirm ---------------------------- */

function renderQrCode(url) {
  const wrap = document.getElementById('qr-canvas-wrap');
  wrap.innerHTML = '';
  const canvas = document.createElement('canvas');
  wrap.appendChild(canvas);
  if (window.QRCode && window.QRCode.toCanvas) {
    window.QRCode.toCanvas(canvas, url, { width: 320, margin: 1 }, (err) => {
      if (err) console.error('QR-Code Fehler:', err);
    });
  } else {
    wrap.innerHTML = '<p style="padding:40px;max-width:240px;">QR-Bibliothek nicht geladen. Bitte URL manuell öffnen.</p>';
  }
}

function onParticipantsUpdate(list) {
  el.participantCount.textContent = `${list.length} ${list.length === 1 ? 'Teilnehmer' : 'Teilnehmer'} angemeldet`;

  const currentIds = new Set(list.map((p) => p.id));
  const newIds = [...currentIds].filter((id) => !knownParticipantIds.has(id));
  knownParticipantIds = currentIds;

  el.participantTrack.innerHTML = '';
  // Liste doppelt rendern für nahtlosen Endlos-Scroll-Loop.
  [...list, ...list].forEach((p, i) => {
    const chip = document.createElement('div');
    chip.className = 'participant-chip' + (i < list.length && newIds.includes(p.id) ? ' is-new' : '');
    chip.innerHTML = `<span class="dot"></span><span>${escapeHtml(p.name)}</span>`;
    el.participantTrack.appendChild(chip);
  });
}

function startParticipantMarquee() {
  let offset = 0;
  const speed = 0.35; // px pro Frame, ruhiges, kontinuierliches Scrollen
  function step() {
    const track = el.participantTrack;
    if (track && track.scrollHeight > 0) {
      const half = track.scrollHeight / 2;
      if (half > 0) {
        offset += speed;
        if (offset >= half) offset = 0;
        track.style.transform = `translateY(-${offset}px)`;
      }
    }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ---------------------------------- Frage ---------------------------------- */

function showQuestion(index) {
  showView('question');
  const q = questions[index];
  if (!q) return;
  el.questionEyebrow.textContent = `Frage ${index + 1} von ${questions.length}`;
  el.questionText.textContent = q.frage;
  renderQuestionImage(q.bild);
}

function renderQuestionImage(src) {
  el.questionImageWrap.innerHTML = '';
  if (!src) {
    el.questionImageWrap.appendChild(buildPlaceholder());
    return;
  }
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.onerror = () => {
    el.questionImageWrap.innerHTML = '';
    el.questionImageWrap.appendChild(buildPlaceholder());
  };
  el.questionImageWrap.appendChild(img);
}

function buildPlaceholder() {
  const div = document.createElement('div');
  div.className = 'question-image-placeholder';
  div.innerHTML = `
    <div class="ring-signature">
      <span class="ring ring--left"></span>
      <span class="ring ring--right"></span>
    </div>
    <span>Lara &amp; Nathanael</span>
  `;
  return div;
}

/* -------------------------------- Ergebnis --------------------------------- */

function showResults(index) {
  showView('results');
  const q = questions[index];
  if (!q) return;
  el.resultsQuestion.textContent = q.frage;

  el.barA.parentElement.querySelector('.result-label-a').textContent = ANSWER_A_LABEL;
  el.barB.parentElement.querySelector('.result-label-b').textContent = ANSWER_B_LABEL;

  if (currentResultsIndex !== index) {
    // Balken vor neuer Animation zurücksetzen.
    el.barA.style.height = '4%';
    el.barB.style.height = '4%';
    currentResultsIndex = index;
  }

  stopVotesWatch();
  currentVotesUnsubscribe = watchVotesForQuestion(sessionId, index, ({ countA, countB, total }) => {
    const pctA = total ? Math.round((countA / total) * 100) : 0;
    const pctB = total ? 100 - pctA : 0;

    // Minimalhöhe von 4%, damit auch 0-Stimmen-Balken sichtbar bleiben.
    requestAnimationFrame(() => {
      el.barA.style.height = Math.max(pctA, 10) + '%';
      el.barB.style.height = Math.max(pctB, 10) + '%';
      console.log(`[display.js] Höhe Balken A ${pctA}, B ${pctB}`);
    });

    el.percentA.textContent = formatPercent(countA, total);
    el.percentB.textContent = formatPercent(countB, total);
    el.countA.textContent = `${countA} ${countA === 1 ? 'Stimme' : 'Stimmen'}`;
    el.countB.textContent = `${countB} ${countB === 1 ? 'Stimme' : 'Stimmen'}`;
  });
}

function stopVotesWatch() {
  if (currentVotesUnsubscribe) {
    currentVotesUnsubscribe();
    currentVotesUnsubscribe = null;
  }
}
