/**
 * ranking.js
 * ---------------------------------------------------------------------------
 * Logik für ranking.html - die Rangliste der Teilnehmer.
 *
 * Punktevergabe: Für jede Frage wird ermittelt, welche Antwort (Lara oder
 * Nathanael) die Mehrheit (> 50 % der abgegebenen Stimmen) erhalten hat.
 * Jeder Teilnehmer, der bei dieser Frage die Mehrheitsantwort gewählt hat,
 * bekommt 1 Punkt. Bei genau 50 / 50 (keine echte Mehrheit) gibt es für
 * diese Frage für niemanden einen Punkt. Am Ende werden alle Punkte pro
 * Teilnehmer summiert und absteigend sortiert dargestellt.
 *
 * Läuft komplett live über zwei Firestore-Listener (Stimmen + Teilnehmer) -
 * die Rangliste aktualisiert sich also von selbst, während noch abgestimmt
 * wird.
 * ---------------------------------------------------------------------------
 */

import { ensureSessionExists, watchAllVotesDetailed, watchParticipants } from './firestore.js';
import { questions } from './questions.js';
import { getSessionId } from './utils.js';

const sessionId = getSessionId();

const el = {
  sessionLabel: document.getElementById('session-label'),
  list: document.getElementById('ranking-list'),
  emptyState: document.getElementById('ranking-empty'),
  participantCount: document.getElementById('ranking-participant-count'),
};

let participants = []; // [{ id, name }]
let allVotes = []; // [{ participantId, questionIndex, answer }]

init();

async function init() {
  if (el.sessionLabel) el.sessionLabel.textContent = sessionId;

  await ensureSessionExists(sessionId);

  watchParticipants(sessionId, (list) => {
    participants = list;
    render();
  });

  watchAllVotesDetailed(sessionId, (votes) => {
    allVotes = votes;
    render();
  });
}

/**
 * Ermittelt je Frage die Mehrheitsantwort ('A' | 'B' | null bei
 * Gleichstand/keinen Stimmen) und vergibt anschließend die Punkte.
 * Gibt eine Map participantId -> Punktzahl zurück.
 */
function computeScores() {
  // 1. Stimmen je Frage zählen.
  const countsByQuestion = {};
  allVotes.forEach((v) => {
    if (!countsByQuestion[v.questionIndex]) {
      countsByQuestion[v.questionIndex] = { A: 0, B: 0 };
    }
    if (v.answer === 'A' || v.answer === 'B') {
      countsByQuestion[v.questionIndex][v.answer] += 1;
    }
  });

  // 2. Mehrheitsantwort je Frage bestimmen (> 50 % der Stimmen dieser Frage).
  const majorityByQuestion = {};
  Object.entries(countsByQuestion).forEach(([index, counts]) => {
    const total = counts.A + counts.B;
    if (total === 0) {
      majorityByQuestion[index] = null;
      return;
    }
    if (counts.A / total > 0.5) majorityByQuestion[index] = 'A';
    else if (counts.B / total > 0.5) majorityByQuestion[index] = 'B';
    else majorityByQuestion[index] = null; // genau 50/50 -> keine Mehrheit
  });

  // 3. Punkte pro Teilnehmer vergeben.
  const scores = {};
  allVotes.forEach((v) => {
    const majority = majorityByQuestion[v.questionIndex];
    if (majority && v.answer === majority) {
      scores[v.participantId] = (scores[v.participantId] || 0) + 1;
    }
  });

  return scores;
}

function render() {
  if (participants.length === 0) {
    el.list.innerHTML = '';
    el.emptyState.style.display = 'block';
    el.participantCount.textContent = '';
    return;
  }
  el.emptyState.style.display = 'none';

  const scores = computeScores();

  const rows = participants.map((p) => ({
    id: p.id,
    name: p.name,
    score: scores[p.id] || 0,
  }));

  // Sortierung: höchste Punktzahl zuerst, bei Gleichstand alphabetisch.
  rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'de'));

  // Standard-Rangfolge: gleiche Punktzahl -> gleicher Rang (1, 1, 3, 4 ...).
  let rank = 0;
  let previousScore = null;
  rows.forEach((row, i) => {
    if (row.score !== previousScore) {
      rank = i + 1;
      previousScore = row.score;
    }
    row.rank = rank;
  });

  el.participantCount.textContent = `${participants.length} ${participants.length === 1 ? 'Teilnehmer' : 'Teilnehmer'} · ${questions.length} Fragen`;

  el.list.innerHTML = rows.map(buildRowHtml).join('');
}

function buildRowHtml(row) {
  const medal = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : '';
  const topClass = row.rank <= 3 ? ` ranking-row--top${row.rank}` : '';
  const pct = questions.length ? Math.round((row.score / questions.length) * 100) : 0;

  return `
    <li class="ranking-row${topClass}">
      <span class="ranking-rank">${medal || row.rank}</span>
      <span class="ranking-name">${escapeText(row.name)}</span>
      <span class="ranking-bar-track">
        <span class="ranking-bar-fill" style="width:${pct}%;"></span>
      </span>
      <span class="ranking-score">${row.score} / ${questions.length}</span>
    </li>
  `;
}

function escapeText(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
