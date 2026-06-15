const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

export class AddItemModalView {
  constructor(root) {
    this.root = root;       // #modal-root
    this.presets = [];
    this.onSubmit = null;   // (data) => {}  (InventoryController.addNewItem 연결)
  }

  // 모달 골격 1회 렌더 (기본 숨김)
  render(categories, presets) {
    this.presets = presets || [];
    this.root.innerHTML = `
      <div class="modal-overlay hidden" id="modal-overlay">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="modal-head">
            <h2 id="modal-title">물품 추가</h2>
            <button class="icon-btn" id="modal-close" aria-label="닫기">✕</button>
          </div>

          <div class="preset-row" id="preset-row">
            ${this.presets
              .map((p, i) => `<button class="preset-btn" data-preset="${i}">${esc(p.label)}</button>`)
              .join('')}
          </div>

          <label class="field"><span>물품명</span>
            <input id="m-name" placeholder="예: 계란"></label>

          <label class="field"><span>카테고리</span>
            <select id="m-cat"></select></label>

          <div class="two-col">
            <div class="field"><span>수량</span>
              <div class="stepper big">
                <button class="step-btn" id="m-minus" aria-label="감소">−</button>
                <input id="m-qty" type="number" min="0" value="1" inputmode="numeric">
                <button class="step-btn" id="m-plus" aria-label="증가">+</button>
              </div>
            </div>
            <label class="field"><span>부족 알림 기준</span>
              <input id="m-min" type="number" min="0" value="1"></label>
          </div>

          <label class="field"><span>유통기한 <em class="opt">(없으면 비워두세요)</em></span>
            <input id="m-exp" type="date"></label>

          <p id="m-error" class="auth-error"></p>
          <button id="m-save" class="btn-primary btn-block">저장하기</button>
        </div>
      </div>`;

    this.populateCategories(categories);
    this._bind();
  }

  populateCategories(categories) {
    const sel = this.root.querySelector('#m-cat');
    if (!sel) return;
    sel.innerHTML = categories.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  }

  _bind() {
    const overlay = this.root.querySelector('#modal-overlay');
    this.root.querySelector('#modal-close').addEventListener('click', () => this.hideModal());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.hideModal();
    });

    const qty = this.root.querySelector('#m-qty');
    this.root.querySelector('#m-minus').addEventListener('click', () => {
      qty.value = Math.max(0, (parseInt(qty.value, 10) || 0) - 1);
    });
    this.root.querySelector('#m-plus').addEventListener('click', () => {
      qty.value = (parseInt(qty.value, 10) || 0) + 1;
    });

    // 즐겨찾기(Preset) 버튼
    this.root.querySelectorAll('[data-preset]').forEach((b) =>
      b.addEventListener('click', () => this.loadPresetData(this.presets[Number(b.dataset.preset)]))
    );

    this.root.querySelector('#m-save').addEventListener('click', () => this.submitFormData());
  }

  // +loadPresetData(preset): 즐겨찾기 클릭 시 폼 자동 채움
  loadPresetData(preset) {
    if (!preset) return;
    this.root.querySelector('#m-name').value = preset.name || '';
    this.root.querySelector('#m-cat').value = preset.categoryId || '기타';
    this.root.querySelector('#m-min').value = preset.minAlertQty ?? 1;
    const exp = this.root.querySelector('#m-exp');
    if (preset.days && preset.days > 0) {
      const d = new Date();
      d.setDate(d.getDate() + preset.days);
      exp.value = d.toISOString().slice(0, 10);
    } else {
      exp.value = '';
    }
    this.root.querySelector('#m-name').focus();
  }

  // +showModal() / +hideModal()
  showModal() {
    const overlay = this.root.querySelector('#modal-overlay');
    if (!overlay) return;
    this._resetForm();
    overlay.classList.remove('hidden');
    setTimeout(() => this.root.querySelector('#m-name')?.focus(), 30);
  }
  hideModal() {
    const overlay = this.root.querySelector('#modal-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  _resetForm() {
    this.root.querySelector('#m-name').value = '';
    this.root.querySelector('#m-qty').value = 1;
    this.root.querySelector('#m-min').value = 1;
    this.root.querySelector('#m-exp').value = '';
    this.showError('');
    const sel = this.root.querySelector('#m-cat');
    if (sel.options.length) sel.selectedIndex = 0;
  }

  showError(msg) {
    const el = this.root.querySelector('#m-error');
    if (el) el.textContent = msg || '';
  }

  // +submitFormData(): 폼 데이터 수집 → onSubmit 콜백
  submitFormData() {
    const data = {
      name: this.root.querySelector('#m-name').value.trim(),
      categoryId: this.root.querySelector('#m-cat').value,
      qty: parseInt(this.root.querySelector('#m-qty').value, 10) || 0,
      minAlertQty: parseInt(this.root.querySelector('#m-min').value, 10) || 0,
      expDate: this.root.querySelector('#m-exp').value || null,
    };
    if (this.onSubmit) this.onSubmit(data);
  }
}
