// ============================================================
//  app.js  -  애플리케이션 진입점 (Composition Root)
//  FirebaseDBManager / Controller / View 를 생성하고 서로 연결한다.
// ============================================================

import { FirebaseDBManager } from './db/FirebaseDBManager.js';
import { AuthController } from './controllers/AuthController.js';
import { InventoryController } from './controllers/InventoryController.js';
import { AnalyticsController } from './controllers/AnalyticsController.js';
import { LoginView } from './views/LoginView.js';
import { MainDashboardView } from './views/MainDashboardView.js';
import { AddItemModalView } from './views/AddItemModalView.js';
import { DEFAULT_CATEGORIES, DEFAULT_PRESETS } from './config/defaults.js';
import { isConfigPlaceholder } from './config/firebase-config.js';
import { Role } from './models/UserAccount.js';

const $ = (id) => document.getElementById(id);

// ---- 1) 인프라 + 컨트롤러 구성 ----
const db = new FirebaseDBManager();
const authC = new AuthController(db);
const invC = new InventoryController(db);
const anaC = new AnalyticsController(db);

// ---- 2) 뷰 구성 ----
const loginView = new LoginView($('auth-view'));
const dash = new MainDashboardView($('app-view'));
const modal = new AddItemModalView($('modal-root'));

// ---- 상태 ----
let currentUser = null;
let categories = [...DEFAULT_CATEGORIES];
let categoryMap = {};
let filterCategory = 'ALL';
let sortByDate = false;
let searchKeyword = '';

const rebuildCategoryMap = () => {
  categoryMap = {};
  categories.forEach((c) => (categoryMap[c.id] = c.name));
};
rebuildCategoryMap();

// ---- 0) 설정값 미입력 가드 ----
if (isConfigPlaceholder) {
  $('auth-view').innerHTML = `
    <div class="auth-card">
      <h1 class="brand-name">설정이 필요합니다</h1>
      <p class="brand-sub" style="margin-top:10px;line-height:1.6">
        <code>src/config/firebase-config.js</code> 파일을 열어 본인의 Firebase 설정값으로 교체한 뒤
        다시 실행해 주세요. 자세한 순서는 <b>README.md</b>를 참고하세요.
      </p>
    </div>`;
} else {
  bootstrap();
}

function bootstrap() {
  const ok = db.connectToServer();
  if (!ok) {
    $('auth-view').innerHTML =
      '<div class="auth-card"><h1 class="brand-name">연결 실패</h1>' +
      '<p class="brand-sub" style="margin-top:10px">Firebase 초기화에 실패했습니다. 설정값과 네트워크 연결을 확인해 주세요.</p></div>';
    return;
  }

  // 로그인/회원가입 콜백
  loginView.onLogin = async (email, pw) => {
    try {
      loginView.setLoading(true);
      await authC.initiateLogin(email, pw);
    } catch (e) {
      loginView.showErrorMessage(humanizeAuthError(e));
    } finally {
      loginView.setLoading(false);
    }
  };
  loginView.onRegister = async (email, pw, role) => {
    try {
      loginView.setLoading(true);
      await authC.registerNewUser(email, pw, role);
    } catch (e) {
      loginView.showErrorMessage(humanizeAuthError(e));
    } finally {
      loginView.setLoading(false);
    }
  };

  // 인증 상태 변화 → 화면 전환 (Sequence: Login)
  db.onAuthChange(async (fbUser) => {
    if (fbUser) {
      let profile = await db.readData('users', fbUser.uid);
      if (!profile) {
        await db.writeData('users', fbUser.uid, { email: fbUser.email, role: Role.USER });
        profile = { email: fbUser.email, role: Role.USER };
      }
      currentUser = { uid: fbUser.uid, email: fbUser.email, role: profile.role || Role.USER };
      await enterApp();
    } else {
      currentUser = null;
      $('app-view').classList.add('hidden');
      $('auth-view').classList.remove('hidden');
      loginView.renderLoginScreen();
    }
  });

  loginView.renderLoginScreen();
}

// ---- 로그인 성공 후 메인 진입 ----
async function enterApp() {
  $('auth-view').classList.add('hidden');
  $('app-view').classList.remove('hidden');

  await loadCategories();
  rebuildCategoryMap();

  dash.categoryMap = categoryMap;
  dash.isAdmin = currentUser.role === Role.ADMIN;
  dash.renderShell(currentUser);
  wireDashboard();
  dash.populateCategoryFilter(categories);

  modal.render(categories, DEFAULT_PRESETS);
  modal.onSubmit = async (data) => {
    if (!data.name) {
      modal.showError('물품명을 입력하세요.');
      return;
    }
    await invC.addNewItem(currentUser.uid, data.name, data.qty, data.categoryId, data.expDate, data.minAlertQty);
    modal.hideModal();
    dash.renderItemList(getVisibleItems());
  };

  await refreshItems();
  await loadPromos();
}

// ---- 재고 가시 목록 계산 (검색 + 카테고리 필터 + 정렬) ----
function getVisibleItems() {
  let list = invC.currentItemList;
  if (searchKeyword) list = invC.searchItems(searchKeyword);
  if (filterCategory !== 'ALL') list = list.filter((i) => i.categoryId === filterCategory);
  if (sortByDate) {
    const ids = new Set(list.map((i) => i.itemId));
    list = invC.sortItemsByDate().filter((i) => ids.has(i.itemId));
  }
  return list;
}

async function refreshItems() {
  await invC.fetchUserItems(currentUser.uid);
  dash.renderItemList(getVisibleItems());
}

// ---- 대시보드 콜백 연결 ----
function wireDashboard() {
  dash.onLogout = () => authC.logout();
  dash.onAddClick = () => modal.showModal();
  dash.onSearch = (kw) => {
    searchKeyword = kw;
    dash.renderItemList(getVisibleItems());
  };
  dash.onSort = (on) => {
    sortByDate = on;
    dash.renderItemList(getVisibleItems());
  };
  dash.onCategoryFilter = (cat) => {
    filterCategory = cat;
    dash.renderItemList(getVisibleItems());
  };
  dash.onTabChange = (tab) => {
    if (tab === 'analytics') renderAnalyticsTab();
    if (tab === 'admin') renderAdminTab();
  };

  // 수량 +/- → 해당 카드만 갱신 (Sequence: Update Stock Quantity)
  dash.onIncrement = async (id) => {
    const q = await invC.modifyItemQuantity(id, +1);
    if (q !== null) dash.updateItemUI(id, q);
  };
  dash.onDecrement = async (id) => {
    const q = await invC.modifyItemQuantity(id, -1);
    if (q !== null) dash.updateItemUI(id, q);
  };

  // 재고 부족 알림 설정 (Sequence: Set Stock Alert)
  dash.onSetAlert = async (id) => {
    const item = invC.currentItemList.find((i) => i.itemId === id);
    const v = prompt(`'${item?.name}'의 재고 부족 알림 기준 수량을 입력하세요`, item?.minAlertQty ?? 1);
    if (v === null) return;
    await invC.setAlertThreshold(id, parseInt(v, 10) || 0);
    dash.renderItemList(getVisibleItems());
  };

  // 삭제 (State: Deleted)
  dash.onDelete = async (id) => {
    const item = invC.currentItemList.find((i) => i.itemId === id);
    if (!confirm(`'${item?.name}' 항목을 삭제할까요?`)) return;
    await invC.deleteItem(id);
    dash.renderItemList(getVisibleItems());
  };
}

// ---- 소비 분석 탭 (Sequence: View Consumption Analytics) ----
async function renderAnalyticsTab() {
  const items = invC.currentItemList;
  const ratio = anaC.calculateCategoryRatio(items);
  const ym = new Date().toISOString().slice(0, 7);
  const logs = await anaC.extractMonthlyData(currentUser.uid, ym).catch(() => []);

  const monthly = {};
  logs.forEach((l) => {
    monthly[l.categoryId] = (monthly[l.categoryId] || 0) + Math.abs(l.delta || 0);
  });

  const cycles = [];
  for (const it of items.slice(0, 8)) {
    const c = await anaC.predictReplacementCycle(currentUser.uid, it.itemId).catch(() => null);
    if (c) cycles.push({ name: it.name, days: c });
  }

  dash.renderAnalytics({ ratio, monthly, cycles, categoryMap, ym, totalItems: items.length });
}

// ---- 관리자 탭 (Sequence: Post Discount / Manage Categories) ----
async function renderAdminTab() {
  const promos = await db.readAll('promotions').catch(() => []);
  promos.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  dash.renderAdmin({ categories, promos });

  dash.onPostPromo = async (p) => {
    await db.addData('promotions', { ...p, createdAt: db.serverTime() });
    renderAdminTab();
    loadPromos();
  };
  dash.onDeletePromo = async (id) => {
    await db.deleteData('promotions', id);
    renderAdminTab();
    loadPromos();
  };
  dash.onAddCategory = async (name) => {
    await db.writeData('categories', name.trim(), { name });
    await loadCategories();
    rebuildCategoryMap();
    dash.categoryMap = categoryMap;
    modal.populateCategories(categories);
    dash.populateCategoryFilter(categories);
    renderAdminTab();
  };
  dash.onDeleteCategory = async (id) => {
    await db.deleteData('categories', id);
    await loadCategories();
    rebuildCategoryMap();
    dash.categoryMap = categoryMap;
    modal.populateCategories(categories);
    dash.populateCategoryFilter(categories);
    renderAdminTab();
  };
}

// ---- 카테고리 로드 (DB + 기본값 병합) ----
async function loadCategories() {
  try {
    const rows = await db.readAll('categories');
    const merged = [...DEFAULT_CATEGORIES];
    rows.forEach((r) => {
      if (!merged.find((m) => m.id === r.id)) merged.push({ id: r.id, name: r.name || r.id });
    });
    categories = merged;
  } catch {
    categories = [...DEFAULT_CATEGORIES];
  }
}

// ---- 할인 배너 로드 (Sequence: View Discount Curation) ----
async function loadPromos() {
  try {
    const promos = await db.readAll('promotions');
    promos.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    dash.renderPromoBanner(promos);
  } catch {
    dash.renderPromoBanner([]);
  }
}

// ---- Firebase Auth 에러 메시지 한글화 ----
function humanizeAuthError(e) {
  const c = e?.code || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found'))
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (c.includes('email-already-in-use')) return '이미 가입된 이메일입니다. 로그인해 주세요.';
  if (c.includes('invalid-email')) return '이메일 형식이 올바르지 않습니다.';
  if (c.includes('weak-password')) return '비밀번호는 6자 이상이어야 합니다.';
  if (c.includes('too-many-requests')) return '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  if (c.includes('network')) return '네트워크 연결을 확인해 주세요.';
  return e?.message || '오류가 발생했습니다. 다시 시도해 주세요.';
}
