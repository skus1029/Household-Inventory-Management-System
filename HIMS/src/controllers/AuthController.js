
import { UserAccount, Role } from '../models/UserAccount.js';

export class AuthController {
  // <<create>> +AuthController(db: FirebaseDBManager)
  constructor(db) {
    this.dbManager = db; // DB 매니저 의존
  }

  // -validateEmailFormat(email): 이메일 형식 내부 검증
  validateEmailFormat(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
  }

  // +registerNewUser(email, pw, role): 신규 유저 등록 → UserAccount 반환
  async registerNewUser(email, pw, role = Role.USER) {
    if (!this.validateEmailFormat(email)) throw new Error('이메일 형식이 올바르지 않습니다.');
    if (!pw || pw.length < 6) throw new Error('비밀번호는 6자 이상이어야 합니다.');

    const cred = await this.dbManager.signUp(email, pw);
    const uid = cred.user.uid;

    // users/{uid} 문서에 프로필(이메일, 권한) 저장
    await this.dbManager.writeData('users', uid, { email, role });
    return new UserAccount(uid, email, null, role);
  }

  // +initiateLogin(email, pw): 로그인 검증 → UserAccount 반환
  async initiateLogin(email, pw) {
    if (!this.validateEmailFormat(email)) throw new Error('이메일 형식이 올바르지 않습니다.');

    const cred = await this.dbManager.signIn(email, pw);
    const uid = cred.user.uid;

    // 프로필(권한 포함) 로드. 없으면 일반 사용자로 생성
    let profile = await this.dbManager.readData('users', uid);
    if (!profile) {
      await this.dbManager.writeData('users', uid, { email, role: Role.USER });
      profile = { email, role: Role.USER };
    }
    return UserAccount.fromDoc(uid, profile);
  }

  logout() {
    return this.dbManager.signOutUser();
  }
}
