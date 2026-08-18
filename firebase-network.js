import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, onSnapshot, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDP21S2IaZEkqoesf50NqW6MZFkPR6TKc8",
  authDomain: "haku-yuya-balloon-battle-6b262.firebaseapp.com",
  projectId: "haku-yuya-balloon-battle-6b262",
  storageBucket: "haku-yuya-balloon-battle-6b262.firebasestorage.app",
  messagingSenderId: "173985605485",
  appId: "1:173985605485:web:d79deac5468baf107c1c64"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let user = null;
let stopRoom = null;
let stopMoves = null;

function emit(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(`firebase-battle-${name}`, { detail }));
}

function watchRoom(code) {
  stopRoom?.(); stopMoves?.();
  stopRoom = onSnapshot(doc(db, "rooms", code), snap => {
    if (snap.exists()) emit("room", { code, ...snap.data() });
  }, error => emit("error", { message: error.message }));
  stopMoves = onSnapshot(collection(db, "rooms", code, "moves"), snap => {
    const moves = {};
    snap.forEach(item => { moves[item.id] = item.data(); });
    emit("moves", { code, moves });
  }, error => emit("error", { message: error.message }));
}

const api = {
  get uid() { return user?.uid || null; },

  async createRoom(code) {
    if (!user) throw new Error("Firebaseへの接続準備中です");
    const ref = doc(db, "rooms", code);
    await setDoc(ref, {
      hostUid: user.uid, guestUid: null, status: "waiting",
      hakuHp: 100, yuyaHp: 100, round: 1, lastResult: null,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    watchRoom(code);
  },

  async joinRoom(code) {
    if (!user) throw new Error("Firebaseへの接続準備中です");
    const ref = doc(db, "rooms", code);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("部屋が見つかりません");
    const data = snap.data();
    if (data.guestUid && data.guestUid !== user.uid) throw new Error("この部屋にはすでに参加者がいます");
    await updateDoc(ref, { guestUid: user.uid, status: "playing", updatedAt: serverTimestamp() });
    watchRoom(code);
  },

  async submitMove(code, role, action, round) {
    await setDoc(doc(db, "rooms", code, "moves", role), { action, round, uid: user.uid, updatedAt: serverTimestamp() });
  },

  async publishResult(code, result) {
    const roomRef = doc(db, "rooms", code);
    const batch = writeBatch(db);
    batch.update(roomRef, { ...result, updatedAt: serverTimestamp() });
    batch.delete(doc(db, "rooms", code, "moves", "haku"));
    batch.delete(doc(db, "rooms", code, "moves", "yuya"));
    await batch.commit();
  },

  async resetRoom(code) {
    const batch = writeBatch(db);
    batch.update(doc(db, "rooms", code), { hakuHp: 100, yuyaHp: 100, round: 1, status: "playing", lastResult: null, updatedAt: serverTimestamp() });
    batch.delete(doc(db, "rooms", code, "moves", "haku"));
    batch.delete(doc(db, "rooms", code, "moves", "yuya"));
    await batch.commit();
  },

  disconnect() { stopRoom?.(); stopMoves?.(); stopRoom = stopMoves = null; }
};

window.firebaseBattle = api;
try {
  const credential = await signInAnonymously(auth);
  user = credential.user;
  emit("ready", { uid: user.uid });
} catch (error) {
  emit("error", { message: `Firebase接続エラー：${error.message}` });
}
