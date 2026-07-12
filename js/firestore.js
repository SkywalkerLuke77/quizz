/**
 * firestore.js
 * ---------------------------------------------------------------------------
 * Kapselt sämtlichen Zugriff auf Cloud Firestore. Keine andere Datei greift
 * direkt auf `db` zu - so bleibt das Datenmodell an einer einzigen Stelle
 * gebündelt und leicht änderbar.
 *
 * Datenmodell (siehe auch README.md):
 *
 * sessions/{sessionId}
 *    status:              string   ('registration_open' | 'registration_closed'
 *                                   | 'voting_open' | 'voting_closed'
 *                                   | 'results_visible')
 *    currentQuestionIndex: number  (0-basierter Index in questions.js)
 *    createdAt:            Timestamp
 *    updatedAt:            Timestamp
 *
 * sessions/{sessionId}/participants/{participantId}
 *    name:      string
 *    joinedAt:  Timestamp
 *
 * sessions/{sessionId}/votes/{questionIndex_participantId}
 *    participantId: string
 *    questionIndex: number
 *    answer:        'A' | 'B'
 *    createdAt:     Timestamp
 *
 * Die zusammengesetzte Dokument-ID im votes-Collection (`<questionIndex>_
 * <participantId>`) ist der zentrale Trick gegen Mehrfachabstimmungen: Ein
 * Dokument mit dieser ID kann pro Frage und Teilnehmer nur genau einmal
 * existieren. Die Prüfung + das Schreiben laufen in einer Firestore
 * Transaction, damit es auch bei gleichzeitigen Anfragen (z. B. Doppelklick)
 * race-condition-frei bleibt.
 * ---------------------------------------------------------------------------
 */

import { db } from './firebase.js';
import {
  doc,
  collection,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/* --------------------------------- Session -------------------------------- */

function sessionDocRef(sessionId) {
  return doc(db, 'sessions', sessionId);
}

/** Legt die Session an, falls sie noch nicht existiert. */
export async function ensureSessionExists(sessionId) {
  const ref = sessionDocRef(sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      status: 'registration_open',
      currentQuestionIndex: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  return ref;
}

export function watchSession(sessionId, callback) {
  return onSnapshot(sessionDocRef(sessionId), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

export async function getSessionOnce(sessionId) {
  const snap = await getDoc(sessionDocRef(sessionId));
  return snap.exists() ? snap.data() : null;
}

export async function updateSessionStatus(sessionId, status) {
  await updateDoc(sessionDocRef(sessionId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function setCurrentQuestionIndex(sessionId, index) {
  await updateDoc(sessionDocRef(sessionId), {
    currentQuestionIndex: index,
    status: 'voting_open',
    updatedAt: serverTimestamp(),
  });
}

/* ------------------------------- Teilnehmer ------------------------------- */

function participantsCollectionRef(sessionId) {
  return collection(db, 'sessions', sessionId, 'participants');
}

function participantDocRef(sessionId, participantId) {
  return doc(db, 'sessions', sessionId, 'participants', participantId);
}

/** Prüft, ob ein Benutzername in der Session bereits vergeben ist. */
export async function nameExists(sessionId, name) {
  const q = query(
    participantsCollectionRef(sessionId),
    where('nameLower', '==', name.trim().toLowerCase())
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/**
 * Registriert einen Teilnehmer. Wirft einen Fehler mit dem Code
 * 'NAME_TAKEN', falls der Name (case-insensitive) bereits vergeben ist -
 * außer es handelt sich um dieselbe participantId (z. B. nach Reload).
 */
export async function registerParticipant(sessionId, participantId, name) {
  const trimmed = name.trim();
  const nameLower = trimmed.toLowerCase();

  await runTransaction(db, async (tx) => {
    const ownRef = participantDocRef(sessionId, participantId);
    const ownSnap = await tx.get(ownRef);

    if (!ownSnap.exists()) {
      // Nur bei neuer Registrierung auf Namenskollision prüfen.
      const q = query(
        participantsCollectionRef(sessionId),
        where('nameLower', '==', nameLower)
      );
      const existing = await getDocs(q);
      if (!existing.empty) {
        const err = new Error('Dieser Name ist bereits vergeben.');
        err.code = 'NAME_TAKEN';
        throw err;
      }
    }

    tx.set(ownRef, {
      name: trimmed,
      nameLower,
      joinedAt: ownSnap.exists() ? ownSnap.data().joinedAt : serverTimestamp(),
    });
  });
}

export function watchParticipants(sessionId, callback) {
  const q = query(participantsCollectionRef(sessionId), orderBy('joinedAt', 'asc'));
  return onSnapshot(q, (snap) => {
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    callback(list);
  });
}

export async function deleteAllParticipants(sessionId) {
  const snap = await getDocs(participantsCollectionRef(sessionId));
  await batchDelete(snap.docs.map((d) => d.ref));
}

/* ---------------------------------- Votes --------------------------------- */

function votesCollectionRef(sessionId) {
  return collection(db, 'sessions', sessionId, 'votes');
}

function voteDocId(questionIndex, participantId) {
  return `${questionIndex}_${participantId}`;
}

/**
 * Gibt eine Stimme für eine Frage ab. Nutzt eine Transaction, damit pro
 * Frage + Teilnehmer garantiert nur ein Stimm-Dokument entstehen kann - auch
 * bei parallelen Schreibversuchen (Race Condition-Schutz).
 * Wirft einen Fehler mit code 'ALREADY_VOTED', falls bereits abgestimmt wurde.
 */
export async function castVote(sessionId, questionIndex, participantId, answer) {
  const ref = doc(db, 'sessions', sessionId, 'votes', voteDocId(questionIndex, participantId));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) {
      const err = new Error('Für diese Frage wurde bereits abgestimmt.');
      err.code = 'ALREADY_VOTED';
      throw err;
    }
    tx.set(ref, {
      participantId,
      questionIndex,
      answer,
      createdAt: serverTimestamp(),
    });
  });
}

/** Prüft (einmalig, ohne Live-Listener), ob für eine Frage bereits abgestimmt wurde. */
export async function hasVoted(sessionId, questionIndex, participantId) {
  const ref = doc(db, 'sessions', sessionId, 'votes', voteDocId(questionIndex, participantId));
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().answer : null;
}

/** Live-Listener auf alle Stimmen einer bestimmten Frage (für Ergebnis-Anzeige). */
export function watchVotesForQuestion(sessionId, questionIndex, callback) {
  const q = query(votesCollectionRef(sessionId), where('questionIndex', '==', questionIndex));
  return onSnapshot(q, (snap) => {
    let countA = 0;
    let countB = 0;
    snap.forEach((d) => {
      const data = d.data();
      if (data.answer === 'A') countA += 1;
      else if (data.answer === 'B') countB += 1;
    });
    callback({ countA, countB, total: countA + countB });
  });
}

/**
 * Live-Listener auf ALLE Stimmen der Session, gruppiert nach Fragen-Index.
 * Wird von der Ergebnis-Übersichtsseite (results.html) genutzt, die alle
 * 16 Fragen gleichzeitig anzeigt. Der Callback erhält ein Objekt der Form
 * { [questionIndex]: { countA, countB, total } }.
 */
export function watchAllVotes(sessionId, callback) {
  return onSnapshot(votesCollectionRef(sessionId), (snap) => {
    const byQuestion = {};
    snap.forEach((d) => {
      const data = d.data();
      const idx = data.questionIndex;
      if (!byQuestion[idx]) byQuestion[idx] = { countA: 0, countB: 0, total: 0 };
      if (data.answer === 'A') byQuestion[idx].countA += 1;
      else if (data.answer === 'B') byQuestion[idx].countB += 1;
      byQuestion[idx].total += 1;
    });
    callback(byQuestion);
  });
}

export async function deleteAllVotes(sessionId) {
  const snap = await getDocs(votesCollectionRef(sessionId));
  await batchDelete(snap.docs.map((d) => d.ref));
}

/* --------------------------------- Reset ---------------------------------- */

/** Setzt die komplette Session zurück: Status, Frage-Index, Teilnehmer, Stimmen. */
export async function resetSessionCompletely(sessionId) {
  await deleteAllParticipants(sessionId);
  await deleteAllVotes(sessionId);
  await setDoc(sessionDocRef(sessionId), {
    status: 'registration_open',
    currentQuestionIndex: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/* --------------------------------- Helfer --------------------------------- */

async function batchDelete(refs) {
  // Firestore erlaubt max. 500 Operationen pro Batch - für ~100 Gäste und
  // 16 Fragen (max. 1600 Stimmen-Dokumente) wird ggf. in mehreren Batches
  // gelöscht.
  const chunkSize = 450;
  for (let i = 0; i < refs.length; i += chunkSize) {
    const chunk = refs.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}
