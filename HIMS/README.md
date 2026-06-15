# HIMS — Household Inventory Management System

1인 가구·자취생을 위한 **가계 자산 및 생필품 재고 관리 웹 앱**입니다.
유통기한 추적, 재고 부족 알림, 소비 패턴 분석, 관리자 할인 정보 배포 기능을 제공합니다.

- **구현 언어:** JavaScript (ES6 Class 기반 객체지향, 모듈 시스템)
- **백엔드:** Firebase (Authentication + Firestore)
- **빌드/번들러:** 없음 — 브라우저가 ES 모듈을 그대로 실행 (정적 호스팅이면 어디든 배포 가능)

---

## 1. 폴더 구조 (설계서 Class Diagram → 파일 1:1 매핑)

```
HIMS/
├─ index.html                     진입 HTML
├─ css/styles.css                  디자인 시스템(상태색 카드 UI)
├─ firestore.rules                 Firestore 보안 규칙
├─ README.md                       (이 문서)
└─ src/
   ├─ app.js                       진입점 / 객체 생성·연결 (Composition Root)
   ├─ config/
   │   ├─ firebase-config.js       ★ 본인 Firebase 설정값 입력
   │   ├─ firebase-sdk.js          Firebase SDK import (버전 한 곳 관리)
   │   └─ defaults.js              기본 카테고리·즐겨찾기
   ├─ db/
   │   └─ FirebaseDBManager.js     Firestore/Auth 통신 전담
   ├─ models/
   │   ├─ Item.js                  Item 엔티티 (D-Day, 상태 산출)
   │   └─ UserAccount.js           UserAccount 엔티티 (권한)
   ├─ controllers/
   │   ├─ AuthController.js         인증 로직
   │   ├─ InventoryController.js    재고 CRUD·정렬·검색
   │   └─ AnalyticsController.js    소비 통계·교체 주기 예측
   └─ views/
       ├─ LoginView.js             로그인/회원가입 화면
       ├─ MainDashboardView.js     대시보드(재고/분석/관리자) + 배너
       └─ AddItemModalView.js      물품 추가 모달
```

---

## 2. Firebase 셋업 (최초 1회, 약 10분)

> 아래 5단계만 마치면 됩니다. 평가자는 이 과정을 할 필요가 없습니다(아래 6번 참고).

### ① 프로젝트 생성
1. https://console.firebase.google.com 접속 → **프로젝트 추가**
2. 이름 입력(예: `hims`) → Google 애널리틱스는 꺼도 됩니다 → 만들기

### ② 로그인(Authentication) 사용 설정
1. 왼쪽 메뉴 **빌드 > Authentication > 시작하기**
2. **Sign-in method** 탭 → **이메일/비밀번호** 선택 → **사용 설정** → 저장

### ③ 데이터베이스(Firestore) 만들기
1. 왼쪽 메뉴 **빌드 > Firestore Database > 데이터베이스 만들기**
2. 위치 선택(예: `asia-northeast3` 서울) → 다음
3. 시작 모드는 아무거나 선택 후 만들기 (어차피 ④에서 규칙을 교체합니다)

### ④ 웹 앱 등록 → 설정값 붙여넣기
1. **프로젝트 설정(⚙️) > 일반 > 내 앱**에서 **웹(`</>`)** 아이콘 클릭
2. 앱 닉네임 입력 후 등록 (호스팅 체크는 안 해도 됩니다)
3. 표시되는 `firebaseConfig` 객체를 복사
4. `src/config/firebase-config.js` 를 열어 값을 그대로 교체:

```js
export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "hims-xxxx.firebaseapp.com",
  projectId: "hims-xxxx",
  storageBucket: "hims-xxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123...:web:abc...",
};
```

### ⑤ 보안 규칙 적용
1. **Firestore Database > 규칙(Rules)** 탭으로 이동
2. 이 저장소의 **`firestore.rules`** 파일 내용을 전부 복사해 붙여넣기 → **게시**

> 규칙 핵심: 재고/소비로그는 **본인 UID 데이터만** 접근 가능(비기능 요구사항 충족),
> 카테고리/할인정보는 **관리자(ADMIN)만 작성** 가능합니다.

---

## 3. 데모용 테스트 계정 & 데이터 세팅

발표 시연을 위해 **앱 화면에서 직접** 계정을 미리 만들어 두는 방법이 가장 간단합니다.

1. 앱을 실행(로컬 또는 배포본)하고 **회원가입** 탭 선택
2. **일반 사용자** 계정 생성 — 예) `user@hims.com` / `test1234`
3. **관리자** 계정 생성 — 가입 유형을 **관리자(Admin)** 로 선택 — 예) `admin@hims.com` / `admin1234`
4. 관리자로 로그인 → **관리자 탭**에서
   - 할인 소식 1~2개 게시 (상단 배너에 노출됩니다)
   - 필요하면 카테고리 추가
5. 일반 사용자로 로그인 → 물품 몇 개 추가(즐겨찾기 버튼 활용) → 시연 준비 완료

> 더 엄격하게 하려면 관리자 권한을 콘솔에서 부여할 수도 있습니다:
> Firestore의 `users/{uid}` 문서에서 `role` 필드를 `ADMIN` 으로 직접 수정.
> (현재 규칙은 데모 편의를 위해 앱 내 관리자 가입을 허용합니다.)

---

## 4. 배포해서 URL 받기 (제출용)

정적 파일이라 아래 **셋 중 하나**만 하면 됩니다. 가장 쉬운 건 Netlify Drop입니다.

### 방법 A — Netlify Drop (CLI 불필요, 가장 빠름)
1. https://app.netlify.com/drop 접속
2. `HIMS` **폴더 전체**를 브라우저로 드래그&드롭
3. 몇 초 뒤 `https://랜덤이름.netlify.app` URL 발급 → 이 주소를 제출

### 방법 B — Firebase Hosting (설계 스택과 동일)
```bash
npm install -g firebase-tools
firebase login
cd HIMS
firebase init hosting
#  - 기존 프로젝트 선택
#  - public directory:  .   (점 하나. index.html이 루트에 있으므로)
#  - single-page app:   No
#  - index.html 덮어쓰기: No
firebase deploy
# → https://프로젝트ID.web.app 발급
```

### 방법 C — Vercel
GitHub 저장소를 https://vercel.com 에 import → Framework Preset은 **Other** → Deploy.

> ⚠️ 과제 참고사항대로, 배포한 서버(호스팅)는 **6월 25일까지 살려 두세요.**
> 위 무료 호스팅은 별도 조작 없이 계속 유지됩니다.

---

## 5. 로컬에서 테스트할 때

이 앱은 ES 모듈을 사용하므로 `index.html`을 **더블클릭(file://)** 하면 동작하지 않습니다.
간단한 로컬 서버로 열어주세요.

```bash
cd HIMS
python3 -m http.server 8000      # 또는:  npx serve .
# 브라우저에서 http://localhost:8000 접속
```

---

## 6. 평가자 안내 (Zero-Config)

평가자는 **아무 설정도 필요 없습니다.**
1. 제출된 **URL** 접속
2. 미리 만들어 둔 테스트 계정으로 로그인
   - 일반: `user@hims.com` / `test1234`
   - 관리자: `admin@hims.com` / `admin1234`
3. 재고 추가/수량 변경/검색·정렬/알림 설정/소비 분석/관리자 할인 게시까지 바로 확인 가능

*(위 계정/비밀번호는 본인이 3번에서 실제로 만든 값으로 맞춰 적어 제출하세요.)*

---

## 7. 기능 ↔ 설계 시퀀스 매핑

| 설계 시퀀스 | 구현 위치 |
| :-- | :-- |
| 회원가입 / 로그인 | `AuthController.registerNewUser / initiateLogin` + `LoginView` |
| 신규 생필품 등록 | `AddItemModalView.submitFormData` → `InventoryController.addNewItem` |
| 재고 수량 변경 | `MainDashboardView` (±) → `InventoryController.modifyItemQuantity` → `updateItemUI` |
| 재고 검색 / 정렬 | `InventoryController.searchItems / sortItemsByDate` |
| 재고 부족 알림 설정 | `InventoryController.setAlertThreshold` → `FirebaseDBManager.updateData` |
| 소비 패턴 분석 | `AnalyticsController.calculateCategoryRatio / extractMonthlyData / predictReplacementCycle` |
| 할인 정보 조회 | `MainDashboardView.renderPromoBanner` (promotions 컬렉션 읽기) |
| 할인 정보 게시(Admin) | 관리자 탭 → `promotions` 컬렉션 쓰기 |
| 카테고리 관리(Admin) | 관리자 탭 → `categories` 컬렉션 쓰기 |

---

## 8. Firebase SDK 버전 변경

`src/config/firebase-sdk.js` 상단의 `11.10.0` 세 곳만 원하는 버전으로 바꾸면 됩니다.
(최신 버전은 Firebase 공식 문서의 “Add Firebase to your JavaScript project” 참고)

---

## 9. Firestore 데이터 모델 요약

```
users/{uid}              { email, role: 'USER' | 'ADMIN' }
items/{autoId}           { ownerUid, name, categoryId, quantity, minAlertQty, expirationDate }
consumptionLogs/{autoId} { ownerUid, itemId, name, categoryId, delta, ts, ym }
categories/{name}        { name }
promotions/{autoId}      { store, title, detail, createdAt }
```
