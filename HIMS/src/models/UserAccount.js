
export const Role = {
  USER: 'USER',   // 일반 사용자
  ADMIN: 'ADMIN', // 시스템 관리자
};

export class UserAccount {
  // <<create>> +UserAccount(uid, email, pw, role)
  constructor(uid, email, pw, role = Role.USER) {
    this.uid = uid;          // 고유 식별자(UID)
    this.email = email;      // 이메일
    this.password = pw;      // 비밀번호 (인증은 Firebase Auth가 처리, 평문 저장 안 함)
    this.role = role || Role.USER; // 권한 (USER / ADMIN)
  }

  // +getUid(): 고유 식별자 문자열 반환
  getUid() {
    return this.uid;
  }

  getRole() {
    return this.role;
  }

  // +setRole(newRole): 이용 권한 변경/세팅
  setRole(newRole) {
    this.role = newRole;
    return this.role;
  }

  isAdmin() {
    return this.role === Role.ADMIN;
  }

  // Firestore users 문서 → UserAccount 객체 복원
  static fromDoc(uid, data) {
    return new UserAccount(uid, data.email, null, data.role || Role.USER);
  }
}
