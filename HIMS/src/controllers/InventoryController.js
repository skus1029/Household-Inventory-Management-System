
import { Item } from '../models/Item.js';

export class InventoryController {
  // <<create>> +InventoryController()
  constructor(db) {
    this.dbManager = db;        // DB 통신 객체
    this.currentItemList = [];  // 현재 로그인 사용자의 재고 목록
  }

  // +fetchUserItems(uid): UID 기준으로 사용자의 모든 재고 로드
  async fetchUserItems(uid) {
    const rows = await this.dbManager.queryByField('items', 'ownerUid', uid);
    this.currentItemList = rows.map((r) => Item.fromDoc(r.id, r));
    return this.currentItemList;
  }

  // +addNewItem(name, qty, categoryId, expDate): 신규 물품 등록 (+ ownerUid, minAlertQty 확장)
  async addNewItem(ownerUid, name, qty, categoryId, expDate, minAlertQty = 1) {
    const temp = new Item(null, ownerUid, name, qty, expDate, categoryId, minAlertQty);
    const id = await this.dbManager.addData('items', temp.toJSON()); // 서버에 기록
    temp.itemId = id;
    this.currentItemList.push(temp);
    return temp;
  }

  // +modifyItemQuantity(itemId, offset): 수량을 offset(증감분)만큼 실시간 조절
  async modifyItemQuantity(itemId, offset) {
    const item = this.currentItemList.find((i) => i.itemId === itemId);
    if (!item) return null;

    if (offset >= 0) item.increaseQty(offset);
    else item.decreaseQty(-offset);

    await this.dbManager.updateData('items', itemId, 'quantity', item.quantity);

    // 소비(감소)한 경우 분석용 로그 기록
    if (offset < 0) {
      await this.dbManager.addData('consumptionLogs', {
        ownerUid: item.ownerUid,
        itemId,
        name: item.name,
        categoryId: item.categoryId,
        delta: offset,
        ts: this.dbManager.serverTime(),
        ym: new Date().toISOString().slice(0, 7), // 'YYYY-MM' (월별 집계용)
      });
    }
    return item.quantity;
  }

  // 재고 부족 알림 임계 수량 설정 (Set Stock Alert)
  async setAlertThreshold(itemId, minQty) {
    const item = this.currentItemList.find((i) => i.itemId === itemId);
    if (!item) return false;
    item.minAlertQty = Number(minQty) || 0;
    await this.dbManager.updateData('items', itemId, 'minAlertQty', item.minAlertQty);
    return true;
  }

  // 항목 삭제 (State Machine: Deleted)
  async deleteItem(itemId) {
    await this.dbManager.deleteData('items', itemId);
    this.currentItemList = this.currentItemList.filter((i) => i.itemId !== itemId);
    return true;
  }

  // +sortItemsByDate(): 유통기한 임박 순 정렬 (기한 없는 항목은 뒤로)
  sortItemsByDate() {
    return [...this.currentItemList].sort((a, b) => {
      const da = a.calculateDDay();
      const db = b.calculateDDay();
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  }

  // 검색: 물품명에 키워드 포함되는 항목 필터
  searchItems(keyword) {
    const k = String(keyword || '').toLowerCase().trim();
    if (!k) return this.currentItemList;
    return this.currentItemList.filter((i) => i.name.toLowerCase().includes(k));
  }
}
