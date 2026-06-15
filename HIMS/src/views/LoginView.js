export class LoginView {
  // <<create>> +LoginView()
  constructor(root) {
    this.root = root;        // #auth-view 컨테이너
    this.mode = 'login';     // 'login' | 'register'
    this.onLogin = null;     // (email, pw) => {}        (AuthController.initiateLogin 연결)
    this.onRegister = null;  // (email, pw, role) => {}  (AuthController.registerNewUser 연결)
  }

  // +renderLoginScreen(): 로그인 폼/UI 렌더링
  renderLoginScreen() {
    const isLogin = this.mode === 'login';
    this.root.innerHTML = `
      <div class="auth-card">
        <div class="auth-brand">
          <span class="logo-mark" aria-hidden="true">▦</span>
          <div>
            <h1 class="brand-name">HIMS</h1>
            <p class="brand-sub">자취 살림, 한눈에 관리</p>
          </div>
        </div>

        <div class="auth-tabs" role="tablist">
          <button class="auth-tab ${isLogin ? 'active' : ''}" data-mode="login">로그인</button>
          <button class="auth-tab ${!isLogin ? 'active' : ''}" data-mode="register">회원가입</button>
        </div>

        <label class="field">
          <span>이메일</span>
          <input id="auth-email" type="email" placeholder="you@example.com" autocomplete="username">
        </label>

        <label class="field">
          <span>비밀번호</span>
          <input id="auth-pw" type="password" placeholder="6자 이상" autocomplete="${isLogin ? 'current-password' : 'new-password'}">
        </label>

        <label class="field role-field ${isLogin ? 'hidden' : ''}">
          <span>가입 유형</span>
          <select id="auth-role">
            <option value="USER">일반 사용자</option>
            <option value="ADMIN">관리자 (Admin)</option>
          </select>
        </label>

        <p id="auth-error" class="auth-error" role="alert"></p>

        <button id="auth-submit" class="btn-primary btn-block">
          ${isLogin ? '로그인' : '가입하고 시작하기'}
        </button>

        <p class="auth-hint">
          ${isLogin ? '처음이신가요? 위에서 회원가입을 선택하세요.' : '이미 계정이 있다면 로그인을 선택하세요.'}
        </p>
      </div>`;
    this._bind();
  }

  _bind() {
    this.root.querySelectorAll('.auth-tab').forEach((b) =>
      b.addEventListener('click', () => {
        this.mode = b.dataset.mode;
        this.renderLoginScreen();
      })
    );
    this.root.querySelector('#auth-submit').addEventListener('click', () => this._submit());
    this.root.querySelector('#auth-pw').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._submit();
    });
  }

  _submit() {
    const email = this.root.querySelector('#auth-email').value.trim();
    const pw = this.root.querySelector('#auth-pw').value;
    this.showErrorMessage('');
    if (this.mode === 'login') {
      if (this.onLogin) this.onLogin(email, pw);
    } else {
      const role = this.root.querySelector('#auth-role').value;
      if (this.onRegister) this.onRegister(email, pw, role);
    }
  }

  // +showErrorMessage(msg): 예외 상황 메시지 표시
  showErrorMessage(msg) {
    const el = this.root.querySelector('#auth-error');
    if (el) el.textContent = msg || '';
  }

  setLoading(on) {
    const b = this.root.querySelector('#auth-submit');
    if (!b) return;
    b.disabled = on;
    b.textContent = on ? '처리 중…' : this.mode === 'login' ? '로그인' : '가입하고 시작하기';
  }
}
