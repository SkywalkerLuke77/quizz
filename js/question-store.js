import {
  db, collection, doc, setDoc, getDocs, onSnapshot
} from "./firebase.js";

import { questions as defaultQuestions } from "./questions.js";

export const QUESTIONS_COLLECTION = collection(db, "session", "main", "questions");

function sanitizeQuestionText(value) {
  return String(value || "").trim();
}

function toQuestionList(snapshot) {
  const items = [];
  snapshot.forEach((questionDoc) => {
    const data = questionDoc.data();
    items.push({
      id: questionDoc.id,
      order: Number(data.order || 0),
      text: sanitizeQuestionText(data.text)
    });
  });

  items.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return items;
}

export async function ensureQuestionsSeeded() {
  const snap = await getDocs(QUESTIONS_COLLECTION);
  if (!snap.empty) return;

  const writes = defaultQuestions.map((item, index) => {
    const id = `q${String(index + 1).padStart(3, "0")}`;
    return setDoc(doc(db, "session", "main", "questions", id), {
      text: sanitizeQuestionText(item.question),
      order: index
    });
  });

  await Promise.all(writes);
}

export async function fetchQuestionsOnce() {
  const snap = await getDocs(QUESTIONS_COLLECTION);
  return toQuestionList(snap);
}

export function subscribeQuestions(callback) {
  return onSnapshot(QUESTIONS_COLLECTION, (snapshot) => {
    callback(toQuestionList(snapshot));
  });
}

export async function normalizeQuestionOrder(items) {
  const writes = items.map((item, index) => {
    return setDoc(doc(db, "session", "main", "questions", item.id), {
      order: index
    }, { merge: true });
  });

  await Promise.all(writes);
}
