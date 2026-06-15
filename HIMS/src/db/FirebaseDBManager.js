

import { firebaseConfig } from '../config/firebase-config.js';
import {
  initializeApp,
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from '../config/firebase-sdk.js';

export class FirebaseDBManager {
  // <<create>> +FirebaseDBManager()
  constructor() {
    this.dbInstance = null;   // Firestore 인스턴스
    this.authInstance = null; // Auth 인스턴스
    this.isConnected = false; // 서버 연결 상태
    this._app = null;
  }

  // +connectToServer(): 초기 연결 시도, 성공 여부 반환
  connectToServer() {
    try {
      this._app = initializeApp(firebaseConfig);
      this.authInstance = getAuth(this._app);
      this.dbInstance = getFirestore(this._app);
      this.isConnected = true;
      return true;
    } catch (e) {
      console.error('[FirebaseDBManager] 서버 연결 실패:', e);
      this.isConnected = false;
      return false;
    }
  }

  // ---------------- 인증(Auth) ----------------
  signUp(email, pw) {
    return createUserWithEmailAndPassword(this.authInstance, email, pw);
  }
  signIn(email, pw) {
    return signInWithEmailAndPassword(this.authInstance, email, pw);
  }
  signOutUser() {
    return signOut(this.authInstance);
  }
  onAuthChange(callback) {
    return onAuthStateChanged(this.authInstance, callback);
  }

  // ---------------- Firestore (설계서 명세 메소드) ----------------

  // +readData(collection, docId): 단일 문서 읽기 → 객체 | null
  async readData(collectionName, docId) {
    const snap = await getDoc(doc(this.dbInstance, collectionName, docId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  // +writeData(collection, docId, data): 지정 경로에 문서 저장(덮어쓰기)
  async writeData(collectionName, docId, data) {
    await setDoc(doc(this.dbInstance, collectionName, docId), data);
    return true;
  }

  // +updateData(collection, docId, field, value): 특정 필드만 부분 수정
  async updateData(collectionName, docId, field, value) {
    await updateDoc(doc(this.dbInstance, collectionName, docId), { [field]: value });
    return true;
  }

  // ---------------- 보조 메소드 ----------------

  // 문서 자동 ID로 추가 → 생성된 ID 반환
  async addData(collectionName, data) {
    const ref = await addDoc(collection(this.dbInstance, collectionName), data);
    return ref.id;
  }

  // 문서 삭제
  async deleteData(collectionName, docId) {
    await deleteDoc(doc(this.dbInstance, collectionName, docId));
    return true;
  }

  // 특정 필드 == 값 조건으로 조회 → 배열
  async queryByField(collectionName, field, value) {
    const q = query(collection(this.dbInstance, collectionName), where(field, '==', value));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // 컬렉션 전체 조회 → 배열
  async readAll(collectionName) {
    const snap = await getDocs(collection(this.dbInstance, collectionName));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // 서버 타임스탬프 (소비 로그 기록용)
  serverTime() {
    return serverTimestamp();
  }
}
