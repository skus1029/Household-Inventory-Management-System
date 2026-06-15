import { ItemStatus } from '../models/Item.js';

const STATUS_META = {
  [ItemStatus.IN_STOCK]:      { label: '정상',       cls: 'st-ok' },
  [ItemStatus.LOW_STOCK]:     { label: '부족',       cls: 'st-low' },
  [ItemStatus.EXPIRING_SOON]: { label: '임박',       cls: 'st-warn' },
  [ItemStatus.EXPIRED]:       { label: '기한 지남',  cls: 'st-bad' },
  [ItemStatus.OUT_OF_STOCK]:  { label: '소진',       cls: 'st-out' },
};

// 순수 함수: 수량/D-Day/임계값으로 상태 산출 (updateItemUI에서 재사용)
function deriveStatus(qty, dday, minAlert) {
  if (qty <= 0) return ItemStatus.OUT_OF_STOCK;
  if (dday !== null && dday < 0) return ItemStatus.EXPIRED;
  if (dday !== null && dday <= 3) return ItemStatus.EXPIRING_SOON;
  if (qty <= minAlert) return ItemStatus.LOW_STOCK;
  return ItemStatus.IN_STOCK;
}

function ddayBadge(dday) {
  if (dday === null) return { text: '기한 없음', cls: 'dday-none' };
  if (dday < 0) return { text: `+${-dday}일 지남`, cls: 'dday-bad' };
  if (dday === 0) return { text: 'D-DAY', cls: 'dday-warn' };
  if (dday <= 3) return { text: `D-${dday}`, cls: 'dday-warn' };
  return { text: `D-${dday}`, cls: 'dday-ok' };
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

export class MainDashboardView {
  // <<create>> +MainDashboardView()
  constructor(root) {
    this.root = root; // #app-view
    this.categoryMap = {};
    this.isAdmin = false;

    // 콜백 (app.js가 컨트롤러와 연결)
    this.onLogout = null;
    this.onAddClick = null;
    this.onSearch = null;
    this.onSort = null;
    this.onCategoryFilter = null;
    this.onTabChange = null;
    this.onIncrement = null;
    this.onDecrement = null;
    this.onSetAlert = null;
    this.onDelete = null;
    this.onPostPromo = null;
    this.onDeletePromo = null;
    this.onAddCategory = null;
    this.onDeleteCategory = null;

    this._sortOn = false;
  }

  // 메인 화면 골격(헤더/배너/툴바/탭) 1회 렌더
  renderShell(user) {
    this.root.innerHTML = `
      <header class="topbar">
        <div class="topbar-inner">
          <div class="brand-row">
            <span class="logo-mark sm" aria-hidden="true">▦</span>
            <span class="brand-name sm">HIMS</span>
          </div>
          <div class="user-row">
            <span class="user-email" title="${esc(user.email)}">${esc(user.email)}</span>
            ${this.isAdmin ? '<span class="role-badge">ADMIN</span>' : ''}
            <button id="btn-logout" class="btn-ghost">로그아웃</button>
          </div>
        </div>
      </header>

      <div id="promo-banner" class="promo-banner" hidden></div>

      <main class="container">
        <nav class="tabs" role="tablist">
          <button class="tab active" data-tab="inventory">재고</button>
          <button class="tab" data-tab="analytics">소비 분석</button>
          ${this.isAdmin ? '<button class="tab" data-tab="admin">관리자</button>' : ''}
        </nav>

        <!-- 재고 탭 -->
        <section id="tab-inventory" class="tab-panel">
          <div id="summary" class="summary"></div>
          <div class="toolbar">
            <input id="search-box" class="search-box" type="search" placeholder="물품명 검색…">
            <select id="cat-filter" class="cat-filter"><option value="ALL">전체 카테고리</option></select>
            <button id="btn-sort" class="btn-toggle">유통기한순</button>
            <button id="btn-add" class="btn-primary">+ 물품 추가</button>
          </div>
          <div id="item-list" class="item-grid"></div>
        </section>

        <!-- 분석 탭 -->
        <section id="tab-analytics" class="tab-panel hidden"></section>

        <!-- 관리자 탭 -->
        ${this.isAdmin ? '<section id="tab-admin" class="tab-panel hidden"></section>' : ''}
      </main>`;

    this._bindShell();
  }

  _bindShell() {
    this.root.querySelector('#btn-logout').addEventListener('click', () => this.onLogout && this.onLogout());
    this.root.querySelector('#btn-add').addEventListener('click', () => this.onAddClick && this.onAddClick());

    const search = this.root.querySelector('#search-box');
    search.addEventListener('input', () => this.onSearch && this.onSearch(search.value));

    this.root.querySelector('#cat-filter').addEventListener('change', (e) =>
      this.onCategoryFilter && this.onCategoryFilter(e.target.value)
    );

    const sortBtn = this.root.querySelector('#btn-sort');
    sortBtn.addEventListener('click', () => {
      this._sortOn = !this._sortOn;
      sortBtn.classList.toggle('on', this._sortOn);
      this.onSort && this.onSort(this._sortOn);
    });

    // 탭 전환
    this.root.querySelectorAll('.tab').forEach((t) =>
      t.addEventListener('click', () => this._switchTab(t.dataset.tab))
    );

    // 재고 카드 버튼 이벤트 위임
    this.root.querySelector('#item-list').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'inc') this.onIncrement && this.onIncrement(id);
      else if (action === 'dec') this.onDecrement && this.onDecrement(id);
      else if (action === 'alert') this.onSetAlert && this.onSetAlert(id);
      else if (action === 'del') this.onDelete && this.onDelete(id);
    });
  }

  _switchTab(tab) {
    this.root.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    this.root.querySelector('#tab-inventory').classList.toggle('hidden', tab !== 'inventory');
    this.root.querySelector('#tab-analytics').classList.toggle('hidden', tab !== 'analytics');
    const adminPanel = this.root.querySelector('#tab-admin');
    if (adminPanel) adminPanel.classList.toggle('hidden', tab !== 'admin');
    this.onTabChange && this.onTabChange(tab);
  }

  populateCategoryFilter(categories) {
    const sel = this.root.querySelector('#cat-filter');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML =
      '<option value="ALL">전체 카테고리</option>' +
      categories.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    sel.value = cur && [...sel.options].some((o) => o.value === cur) ? cur : 'ALL';
  }

  // +renderItemList(items): 카드 리스트 렌더 + 요약 + 임박 강조
  renderItemList(items) {
    const list = this.root.querySelector('#item-list');
    this._renderSummary(items);

    if (!items || items.length === 0) {
      list.innerHTML = `
        <div class="empty">
          <p class="empty-title">표시할 재고가 없습니다.</p>
          <p class="empty-sub">오른쪽 위 <b>+ 물품 추가</b>로 첫 항목을 등록해 보세요.</p>
        </div>`;
      return;
    }
    list.innerHTML = items.map((it) => this._cardHTML(it)).join('');
  }

  _cardHTML(it) {
    const dday = it.calculateDDay();
    const status = it.getStatus();
    const meta = STATUS_META[status];
    const badge = ddayBadge(dday);
    const catName = this.categoryMap[it.categoryId] || it.categoryId || '기타';
    const low = it.quantity <= it.minAlertQty;
    return `
      <article class="card ${meta.cls}" data-item-id="${esc(it.itemId)}"
               data-min="${it.minAlertQty}" data-dday="${dday === null ? '' : dday}">
        <div class="card-edge"></div>
        <div class="card-top">
          <h3 class="card-name" title="${esc(it.name)}">${esc(it.name)}</h3>
          <button class="icon-btn del" data-action="del" data-id="${esc(it.itemId)}" title="삭제" aria-label="삭제">✕</button>
        </div>
        <div class="card-meta">
          <span class="chip">${esc(catName)}</span>
          <span class="dday ${badge.cls}">${badge.text}</span>
        </div>
        <div class="card-bottom">
          <div class="stepper" role="group" aria-label="수량 조절">
            <button class="step-btn" data-action="dec" data-id="${esc(it.itemId)}" aria-label="수량 감소">−</button>
            <span class="qty"><span class="qty-num">${it.quantity}</span><span class="qty-unit">개</span></span>
            <button class="step-btn" data-action="inc" data-id="${esc(it.itemId)}" aria-label="수량 증가">+</button>
          </div>
          <button class="alert-btn ${low ? 'on' : ''}" data-action="alert" data-id="${esc(it.itemId)}"
                  title="재고 부족 알림 기준 설정 (현재 ${it.minAlertQty}개)">
            🔔 ${it.minAlertQty}
          </button>
        </div>
        <span class="status-pill ${meta.cls}">${meta.label}</span>
      </article>`;
  }

  _renderSummary(items) {
    const box = this.root.querySelector('#summary');
    if (!box) return;
    const c = { ok: 0, low: 0, soon: 0, out: 0 };
    (items || []).forEach((it) => {
      const s = it.getStatus();
      if (s === ItemStatus.OUT_OF_STOCK) c.out++;
      else if (s === ItemStatus.EXPIRING_SOON || s === ItemStatus.EXPIRED) c.soon++;
      else if (s === ItemStatus.LOW_STOCK) c.low++;
      else c.ok++;
    });
    box.innerHTML = `
      <div class="sum-chip total"><b>${(items || []).length}</b><span>전체</span></div>
      <div class="sum-chip ok"><b>${c.ok}</b><span>정상</span></div>
      <div class="sum-chip low"><b>${c.low}</b><span>부족</span></div>
      <div class="sum-chip warn"><b>${c.soon}</b><span>임박</span></div>
      <div class="sum-chip out"><b>${c.out}</b><span>소진</span></div>`;
  }

  // +updateItemUI(itemId, newQty): 전체 새로고침 없이 해당 카드만 갱신
  updateItemUI(itemId, newQty) {
    const card = this.root.querySelector(`.card[data-item-id="${CSS.escape(itemId)}"]`);
    if (card == null) return;
    const numEl = card.querySelector('.qty-num');
    if (numEl) numEl.textContent = newQty;

    const ddayStr = card.dataset.dday;
    const dday = ddayStr === '' ? null : Number(ddayStr);
    const minAlert = Number(card.dataset.min) || 0;
    const status = deriveStatus(newQty, dday, minAlert);
    const meta = STATUS_META[status];

    card.className = `card ${meta.cls}`;
    const pill = card.querySelector('.status-pill');
    if (pill) {
      pill.className = `status-pill ${meta.cls}`;
      pill.textContent = meta.label;
    }
    const alertBtn = card.querySelector('.alert-btn');
    if (alertBtn) alertBtn.classList.toggle('on', newQty <= minAlert);
  }

  // +renderPromoBanner(promos): 상단 할인/공동구매 배너
  renderPromoBanner(promos) {
    const banner = this.root.querySelector('#promo-banner');
    if (!banner) return;
    if (!promos || promos.length === 0) {
      banner.hidden = true;
      return;
    }
    banner.hidden = false;
    banner.innerHTML =
      '<span class="promo-tag">📢 할인 소식</span>' +
      '<div class="promo-track">' +
      promos
        .map(
          (p) =>
            `<span class="promo-item"><b>${esc(p.store || '마트')}</b> · ${esc(p.title)}${
              p.detail ? ` <em>(${esc(p.detail)})</em>` : ''
            }</span>`
        )
        .join('<span class="promo-dot">•</span>') +
      '</div>';
  }

  // ----- 소비 분석 탭 렌더 -----
  renderAnalytics({ ratio, monthly, cycles, categoryMap, ym, totalItems }) {
    const panel = this.root.querySelector('#tab-analytics');
    const entries = Object.entries(ratio).sort((a, b) => b[1] - a[1]);
    const pie = this._pieSVG(entries, categoryMap);
    const legend = entries
      .map(
        ([cat, pct], i) =>
          `<li><span class="dot" style="background:${PIE_COLORS[i % PIE_COLORS.length]}"></span>
            ${esc(categoryMap[cat] || cat)} <b>${pct}%</b></li>`
      )
      .join('');

    const monthEntries = Object.entries(monthly).sort((a, b) => b[1] - a[1]);
    const maxM = Math.max(1, ...monthEntries.map((e) => e[1]));
    const bars = monthEntries.length
      ? monthEntries
          .map(
            ([cat, n]) => `
        <div class="bar-row">
          <span class="bar-label">${esc(categoryMap[cat] || cat)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${(n / maxM) * 100}%"></div></div>
          <span class="bar-val">${n}</span>
        </div>`
          )
          .join('')
      : '<p class="muted">이번 달 소비 기록이 아직 없습니다. 수량 감소(−) 버튼을 누르면 소비로 기록됩니다.</p>';

    const cycleRows = cycles.length
      ? cycles
          .map((c) => `<li><span>${esc(c.name)}</span><b>약 ${c.days}일 주기</b></li>`)
          .join('')
      : '<p class="muted">소진 데이터가 2회 이상 쌓이면 품목별 재구매 주기를 예측합니다.</p>';

    panel.innerHTML = `
      <div class="analytics-grid">
        <section class="panel-card">
          <h2 class="panel-h">카테고리별 보유 비중</h2>
          ${totalItems ? `<div class="pie-wrap">${pie}<ul class="legend">${legend}</ul></div>`
                        : '<p class="muted">재고를 추가하면 비중이 표시됩니다.</p>'}
        </section>
        <section class="panel-card">
          <h2 class="panel-h">이번 달 소비량 <span class="sub">(${esc(ym)})</span></h2>
          <div class="bars">${bars}</div>
        </section>
        <section class="panel-card">
          <h2 class="panel-h">품목별 재구매 주기 예측</h2>
          <ul class="cycle-list">${cycleRows}</ul>
        </section>
      </div>`;
  }

  _pieSVG(entries, categoryMap) {
    const total = entries.reduce((s, e) => s + e[1], 0) || 1;
    let acc = 0;
    const R = 80, C = 100, cx = 110, cy = 110;
    const segs = entries
      .map(([cat, val], i) => {
        const frac = val / total;
        const a0 = acc * 2 * Math.PI - Math.PI / 2;
        acc += frac;
        const a1 = acc * 2 * Math.PI - Math.PI / 2;
        const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
        const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
        const large = frac > 0.5 ? 1 : 0;
        const color = PIE_COLORS[i % PIE_COLORS.length];
        return `<path d="M${cx},${cy} L${x0.toFixed(2)},${y0.toFixed(2)} A${R},${R} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z" fill="${color}"/>`;
      })
      .join('');
    return `<svg viewBox="0 0 220 220" class="pie" role="img" aria-label="카테고리 비중 파이 차트">
      ${segs}<circle cx="${cx}" cy="${cy}" r="46" fill="var(--surface)"/></svg>`;
  }

  // ----- 관리자 탭 렌더 -----
  renderAdmin({ categories, promos }) {
    const panel = this.root.querySelector('#tab-admin');
    if (!panel) return;
    panel.innerHTML = `
      <div class="admin-grid">
        <section class="panel-card">
          <h2 class="panel-h">할인 정보 게시</h2>
          <label class="field"><span>마트/매장명</span><input id="pm-store" placeholder="예: 이마트 ○○점"></label>
          <label class="field"><span>제목</span><input id="pm-title" placeholder="예: 라면 1+1 행사"></label>
          <label class="field"><span>상세 (선택)</span><input id="pm-detail" placeholder="예: ~6/30, 카드할인"></label>
          <button id="pm-post" class="btn-primary">게시하기</button>
          <h3 class="panel-sub">게시된 소식</h3>
          <ul class="admin-list">
            ${
              (promos || []).length
                ? promos
                    .map(
                      (p) =>
                        `<li><span><b>${esc(p.store || '마트')}</b> · ${esc(p.title)}</span>
                          <button class="icon-btn del" data-del-promo="${esc(p.id)}" title="삭제">✕</button></li>`
                    )
                    .join('')
                : '<li class="muted">게시된 할인 소식이 없습니다.</li>'
            }
          </ul>
        </section>

        <section class="panel-card">
          <h2 class="panel-h">카테고리 관리</h2>
          <p class="muted small">사용자가 물품 등록 시 선택하는 표준 카테고리입니다.</p>
          <div class="inline-add">
            <input id="cat-name" placeholder="새 카테고리명">
            <button id="cat-add" class="btn-primary">추가</button>
          </div>
          <ul class="admin-list">
            ${categories
              .map(
                (c) =>
                  `<li><span>${esc(c.name)}</span>
                    <button class="icon-btn del" data-del-cat="${esc(c.id)}" title="삭제">✕</button></li>`
              )
              .join('')}
          </ul>
        </section>
      </div>`;

    panel.querySelector('#pm-post').addEventListener('click', () => {
      const store = panel.querySelector('#pm-store').value.trim();
      const title = panel.querySelector('#pm-title').value.trim();
      const detail = panel.querySelector('#pm-detail').value.trim();
      if (!title) return;
      this.onPostPromo && this.onPostPromo({ store, title, detail });
    });
    panel.querySelector('#cat-add').addEventListener('click', () => {
      const name = panel.querySelector('#cat-name').value.trim();
      if (!name) return;
      this.onAddCategory && this.onAddCategory(name);
    });
    panel.querySelectorAll('[data-del-promo]').forEach((b) =>
      b.addEventListener('click', () => this.onDeletePromo && this.onDeletePromo(b.dataset.delPromo))
    );
    panel.querySelectorAll('[data-del-cat]').forEach((b) =>
      b.addEventListener('click', () => this.onDeleteCategory && this.onDeleteCategory(b.dataset.delCat))
    );
  }
}

const PIE_COLORS = ['#1F6B4A', '#E2683C', '#C98A1B', '#3E7CB1', '#8E5BA6', '#5C6B62', '#C0392B'];
