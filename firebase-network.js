"use strict";
(async function () {
  function emit(name, detail = {}) { window.dispatchEvent(new CustomEvent(`firebase-battle-${name}`, { detail })); }
  if (!window.firebase) { emit("error", { message: "Firebase SDKを読み込めませんでした" }); return; }

  const firebaseConfig = {
    apiKey: "AIzaSyDP21S2IaZEkqoesf50NqW6MZFkPR6TKc8",
    authDomain: "haku-yuya-balloon-battle-6b262.firebaseapp.com",
    projectId: "haku-yuya-balloon-battle-6b262",
    storageBucket: "haku-yuya-balloon-battle-6b262.firebasestorage.app",
    messagingSenderId: "173985605485",
    appId: "1:173985605485:web:d79deac5468baf107c1c64"
  };
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth(), db = firebase.firestore(), stamp = () => firebase.firestore.FieldValue.serverTimestamp();
  let user = null, stopRoom = null, stopMoves = null;

  function watchRoom(code) {
    stopRoom?.(); stopMoves?.();
    stopRoom = db.collection("rooms").doc(code).onSnapshot(snap => { if (snap.exists) emit("room", { code, ...snap.data() }); }, error => emit("error", { message: error.message }));
    stopMoves = db.collection("rooms").doc(code).collection("moves").onSnapshot(snap => { const moves = {}; snap.forEach(item => { moves[item.id] = item.data(); }); emit("moves", { code, moves }); }, error => emit("error", { message: error.message }));
  }

  window.firebaseBattle = {
    get uid() { return user?.uid || null; },
    async createRoom(code) {
      if (!user) throw new Error("Firebaseへの接続準備中です");
      await db.collection("rooms").doc(code).set({ hostUid:user.uid, guestUid:null, status:"waiting", hakuHp:100, yuyaHp:100, round:1, lastResult:null, createdAt:stamp(), updatedAt:stamp() });
      watchRoom(code);
    },
    async joinRoom(code) {
      if (!user) throw new Error("Firebaseへの接続準備中です");
      const ref=db.collection("rooms").doc(code), snap=await ref.get();
      if (!snap.exists) throw new Error("部屋が見つかりません");
      const data=snap.data();
      if (data.guestUid && data.guestUid!==user.uid) throw new Error("この部屋にはすでに参加者がいます");
      await ref.update({ guestUid:user.uid, status:"playing", updatedAt:stamp() }); watchRoom(code);
    },
    async submitMove(code,role,action,round) { await db.collection("rooms").doc(code).collection("moves").doc(role).set({ action,round,uid:user.uid,updatedAt:stamp() }); },
    async publishResult(code,result) { const room=db.collection("rooms").doc(code),batch=db.batch();batch.update(room,{...result,updatedAt:stamp()});batch.delete(room.collection("moves").doc("haku"));batch.delete(room.collection("moves").doc("yuya"));await batch.commit(); },
    async resetRoom(code) { const room=db.collection("rooms").doc(code),batch=db.batch();batch.update(room,{hakuHp:100,yuyaHp:100,round:1,status:"playing",lastResult:null,updatedAt:stamp()});batch.delete(room.collection("moves").doc("haku"));batch.delete(room.collection("moves").doc("yuya"));await batch.commit(); },
    disconnect() { stopRoom?.();stopMoves?.();stopRoom=stopMoves=null; }
  };

  try { const result=await auth.signInAnonymously();user=result.user;emit("ready",{uid:user.uid}); }
  catch(error) { emit("error",{message:`Firebase接続エラー：${error.message}`}); }
})();
