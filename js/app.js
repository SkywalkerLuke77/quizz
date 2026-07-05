import {
  db, collection, doc, setDoc, getDoc, onSnapshot
} from "./firebase.js";

const nameInput = document.getElementById("name");
const joinBtn = document.getElementById("join");
const joinStatus = document.getElementById("joinStatus");
const usersScroller = document.getElementById("usersScroller");
const voteLinkInput = document.getElementById("voteLink");
const copyLinkBtn = document.getElementById("copyLink");
const qrImg = document.getElementById("qr");

const sessionRef = doc(db, "session", "main");
const usersCol = collection(db, "session", "main", "users");

const DEFAULT_JOIN_MS = 2 * 60 * 1000;

function getVoteLink() {
  return `${location.origin}${location.pathname.replace("index.html", "vote.html")}`;
}

function updateScrollList(names) {
  if (!names.length) {
    usersScroller.className = "";
    usersScroller.innerHTML = '<div class="user">Noch niemand angemeldet</div>';
    return;
  }

  const html = names.map((name) => `<div class="user">${name}</div>`).join("");
  usersScroller.innerHTML = `${html}${html}`;
  usersScroller.className = names.length > 4 ? "scrolling" : "";
}

function setJoinState(joinAllowed, joinDeadline) {
  joinBtn.disabled = !joinAllowed;

  if (!joinAllowed) {
    joinStatus.innerText = "Anmeldung ist geschlossen.";
    return;
  }

  const remainingMs = Math.max(0, joinDeadline - Date.now());
  const seconds = Math.ceil(remainingMs / 1000);
  joinStatus.innerText = `Anmeldung offen (${seconds}s verbleibend)`;
}

async function ensureSessionDefaults() {
  const snap = await getDoc(sessionRef);
  if (snap.exists()) return;

  await setDoc(sessionRef, {
    joinOpen: true,
    joinDeadline: Date.now() + DEFAULT_JOIN_MS,
    currentQuestion: 0,
    questionOpen: false,
    showResults: false,
    questionEndsAt: 0,
    questionDurationSec: 20
  });
}

async function refreshJoinState() {
  const snap = await getDoc(sessionRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const stillOpen = Boolean(data.joinOpen) && Date.now() < (data.joinDeadline || 0);

  if (!stillOpen && data.joinOpen) {
    await setDoc(sessionRef, { joinOpen: false }, { merge: true });
  }

  setJoinState(stillOpen, data.joinDeadline || 0);
}

joinBtn.onclick = async () => {
  const name = nameInput.value.trim();
  if (!name) return;

  const sessionSnap = await getDoc(sessionRef);
  if (!sessionSnap.exists()) return;

  const data = sessionSnap.data();
  const joinAllowed = Boolean(data.joinOpen) && Date.now() < (data.joinDeadline || 0);
  if (!joinAllowed) {
    joinStatus.innerText = "Anmeldung ist bereits geschlossen.";
    joinBtn.disabled = true;
    return;
  }

  await setDoc(doc(db, "session", "main", "users", name), {
    name,
    joined: Date.now()
  });

  localStorage.setItem("quiz_username", name);
  joinStatus.innerText = "Anmeldung erfolgreich.";
};

copyLinkBtn.onclick = async () => {
  await navigator.clipboard.writeText(voteLinkInput.value);
  joinStatus.innerText = "Link kopiert.";
};

async function init() {
  await ensureSessionDefaults();

  const voteLink = getVoteLink();
  voteLinkInput.value = voteLink;
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(voteLink)}`;

  onSnapshot(usersCol, (snap) => {
    const names = [];
    snap.forEach((userDoc) => names.push(userDoc.data().name));
    names.sort((a, b) => a.localeCompare(b, "de"));
    updateScrollList(names);
  });

  onSnapshot(sessionRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    const joinAllowed = Boolean(data.joinOpen) && Date.now() < (data.joinDeadline || 0);
    setJoinState(joinAllowed, data.joinDeadline || 0);
  });

  await refreshJoinState();
  setInterval(refreshJoinState, 1000);
}

init();
