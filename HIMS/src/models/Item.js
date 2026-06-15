
export const ItemStatus = {
  IN_STOCK: 'IN_STOCK',        // 정상 보유
  LOW_STOCK: 'LOW_STOCK',      // 재고 부족 (minAlertQty 이하)
  EXPIRING_SOON: 'EXPIRING_SOON', // 기한 임박 (D-3 이내)
  EXPIRED: 'EXPIRED',          // 기한 지남
  OUT_OF_STOCK: 'OUT_OF_STOCK',// 소진
};

export class Item {
  // <<create>> +Item(id, uid, name, qty, exp)  (+ 설계 확장: categoryId, minAlertQty)
  constructor(id, ownerUid, name, qty, exp, categoryId = '기타', minAlertQty = 1) {
    this.itemId = id;                       // 아이템 고유 식별자
    this.ownerUid = ownerUid;               // 소유 유저 UID
    this.name = name;                       // 물품명
    this.categoryId = categoryId;           // 소속 카테고리 ID
    this.quantity = Number(qty) || 0;       // 현재 보유 수량
    this.minAlertQty = Number(minAlertQty) || 0; // 재고 부족 알림 임계 수량
    this.expirationDate = exp || null;      // 유통기한 'YYYY-MM-DD' | null
  }

  // +increaseQty(amount): 물건을 사 와서 수량 증가
  increaseQty(amount) {
    this.quantity += Math.abs(Number(amount) || 0);
    return this.quantity;
  }

  // +decreaseQty(amount): 소모하여 수량 감소 (0 미만 방지)
  decreaseQty(amount) {
    this.quantity = Math.max(0, this.quantity - Math.abs(Number(amount) || 0));
    return this.quantity;
  }

  // +calculateDDay(): 현재 날짜와 유통기한을 비교해 남은 일수(D-Day) 반환
  calculateDDay() {
    if (!this.expirationDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(this.expirationDate + 'T00:00:00');
    if (isNaN(exp.getTime())) return null;
    return Math.round((exp - today) / 86400000);
  }

  // 현재 객체가 어떤 상태(State)인지 산출 (대시보드 시각 강조에 사용)
  getStatus() {
    if (this.quantity <= 0) return ItemStatus.OUT_OF_STOCK;
    const d = this.calculateDDay();
    if (d !== null && d < 0) return ItemStatus.EXPIRED;
    if (d !== null && d <= 3) return ItemStatus.EXPIRING_SOON;
    if (this.quantity <= this.minAlertQty) return ItemStatus.LOW_STOCK;
    return ItemStatus.IN_STOCK;
  }

  // Firestore 저장용 평탄화 객체 (itemId는 문서 ID로 별도 관리)
  toJSON() {
    return {
      ownerUid: this.ownerUid,
      name: this.name,
      categoryId: this.categoryId,
      quantity: this.quantity,
      minAlertQty: this.minAlertQty,
      expirationDate: this.expirationDate,
    };
  }

  // Firestore 문서 → Item 객체 복원
  static fromDoc(id, data) {
    return new Item(
      id,
      data.ownerUid,
      data.name,
      data.quantity,
      data.expirationDate || null,
      data.categoryId || '기타',
      data.minAlertQty || 0
    );
  }
}
