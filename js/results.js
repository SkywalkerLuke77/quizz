/**
 * results.js
 * ---------------------------------------------------------------------------
 * Logik für results.html - die gesammelte Ergebnis-Übersicht über alle 16
 * Fragen. Baut für jede Frage aus questions.js einen Block auf (Frage,
 * darunter Bild + horizontale Ergebnisbalken) und hält alle Balken live per
 * Firestore-Listener (watchAllVotes) synchron - ganz ohne Polling.
 * ---------------------------------------------------------------------------
 */

import { ensureSessionExists, watchAllVotes } from './firestore.js';
import { questions, ANSWER_A_LABEL, ANSWER_B_LABEL } from './questions.js';
import { getSessionId, formatPercent } from './utils.js';

const sessionId = getSessionId();
const listEl = document.getElementById('results-list');
const sessionLabelEl = document.getElementById('session-label');
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightbox-image');
const lightboxPlaceholder = document.getElementById('lightbox-placeholder');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxPrev = document.getElementById('lightbox-prev');
const lightboxNext = document.getElementById('lightbox-next');

let lightboxIndex = 0;

init();

async function init() {
  if (sessionLabelEl) sessionLabelEl.textContent = sessionId;

  buildSkeleton();
  bindLightbox();
  await ensureSessionExists(sessionId);
  watchAllVotes(sessionId, onVotesUpdate);
}

/* --------------------------------- Lightbox --------------------------------- */

function bindLightbox() {
  lightboxClose.addEventListener('click', closeLightbox);
  lightboxPrev.addEventListener('click', () => stepLightbox(-1));
  lightboxNext.addEventListener('click', () => stepLightbox(1));

  // Klick auf den dunklen Hintergrund (nicht auf Bild/Buttons) schließt ebenfalls.
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') stepLightbox(-1);
    if (e.key === 'ArrowRight') stepLightbox(1);
  });
}

function openLightbox(index) {
  lightboxIndex = index;
  renderLightboxImage();
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.hidden = true;
  lightboxImage.src = '';
  document.body.style.overflow = '';
}

/** Wechselt zum vorherigen (-1) oder nächsten (+1) Bild - läuft am Ende/Anfang zyklisch um. */
function stepLightbox(delta) {
  lightboxIndex = (lightboxIndex + delta + questions.length) % questions.length;
  renderLightboxImage();
}

function renderLightboxImage() {
  const q = questions[lightboxIndex];
  lightboxImage.hidden = false;
  lightboxPlaceholder.hidden = true;

  if (!q || !q.bild) {
    lightboxImage.hidden = true;
    lightboxPlaceholder.hidden = false;
    return;
  }

  lightboxImage.onerror = () => {
    lightboxImage.hidden = true;
    lightboxPlaceholder.hidden = false;
  };
  lightboxImage.src = q.bild;
}

/** Erzeugt für jede Frage einmalig den HTML-Block (Bild + leere Balken). */
function buildSkeleton() {
  listEl.innerHTML = '';
  questions.forEach((q, index) => {
    const block = document.createElement('article');
    block.className = 'question-block';
    block.id = `question-block-${index}`;

    block.innerHTML = `
      <p class="question-block-eyebrow">Frage ${index + 1} von ${questions.length}</p>
      <h2 class="question-block-title">${escapeText(q.frage)}</h2>
      <div class="question-block-row">
        <div class="question-block-bars">
          ${buildBarRowHtml('a', ANSWER_A_LABEL)}
          ${buildBarRowHtml('b', ANSWER_B_LABEL)}
          <p class="question-block-total" id="total-${index}">0 Stimmen abgegeben</p>
        </div>
        <div class="question-block-image" id="image-${index}"></div>
      </div>
    `;

    listEl.appendChild(block);
    renderImage(index, q.bild);
  });
}

function buildBarRowHtml(key, label) {
  return `
    <div class="hbar-row">
      <span class="hbar-label">${escapeText(label)}</span>
      <div class="hbar-track">
        <div class="hbar-fill hbar-fill--${key}" id="bar-${key}-fill" style="width: 0%;"></div>
      </div>
      <span class="hbar-percent" id="bar-${key}-percent">0%</span>
    </div>
  `;
}

function renderImage(index, src) {
  const wrap = document.getElementById(`image-${index}`);
  if (!wrap) return;

  wrap.addEventListener('click', () => openLightbox(index));

  if (!src) {
    wrap.appendChild(buildPlaceholder());
    return;
  }
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.loading = 'lazy';
  img.onerror = () => {
    wrap.innerHTML = '';
    wrap.appendChild(buildPlaceholder());
  };
  wrap.appendChild(img);
}

function buildPlaceholder() {
  const div = document.createElement('div');
  div.className = 'question-block-image-placeholder';
  div.innerHTML = `
    <div class="ring-signature ring-signature--sm">
      <span class="ring ring--left"></span>
      <span class="ring ring--right"></span>
    </div>
  `;
  return div;
}

/** Wird bei jeder Firestore-Änderung mit dem kompletten, aggregierten Stand aufgerufen. */
function onVotesUpdate(byQuestion) {
  questions.forEach((_, index) => {
    const data = byQuestion[index] || { countA: 0, countB: 0, total: 0 };
    updateQuestionBlock(index, data);
  });
}

function updateQuestionBlock(index, { countA, countB, total }) {
  const block = document.getElementById(`question-block-${index}`);
  if (!block) return;

  const fillA = block.querySelector('#bar-a-fill');
  const fillB = block.querySelector('#bar-b-fill');
  const percentA = block.querySelector('#bar-a-percent');
  const percentB = block.querySelector('#bar-b-percent');
  const totalEl = block.querySelector(`#total-${index}`);

  fillA.style.width = (total ? (countA / total) * 100 : 0) + '%';
  fillB.style.width = (total ? (countB / total) * 100 : 0) + '%';
  percentA.textContent = formatPercent(countA, total);
  percentB.textContent = formatPercent(countB, total);
  totalEl.textContent = `${total} ${total === 1 ? 'Stimme' : 'Stimmen'} abgegeben`;
}

function escapeText(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
