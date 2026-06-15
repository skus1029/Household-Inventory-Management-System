

export class AnalyticsController {
  constructor(db) {
    this.dbManager = db; // DB 통신 객체
  }

  // +extractMonthlyData(uid, month): 특정 월('YYYY-MM') 소비 로그 추출
  async extractMonthlyData(uid, month) {
    const logs = await this.dbManager.queryByField('consumptionLogs', 'ownerUid', uid);
    return month ? logs.filter((l) => l.ym === month) : logs;
  }

  // +calculateCategoryRatio(items): 카테고리별 소비/보유 비중(%) 계산 → 객체(Map)
  calculateCategoryRatio(items) {
    const tally = {};
    let total = 0;
    items.forEach((i) => {
      const q = Math.max(0, i.quantity);
      tally[i.categoryId] = (tally[i.categoryId] || 0) + q;
      total += q;
    });
    const ratio = {};
    Object.keys(tally).forEach((k) => {
      ratio[k] = total > 0 ? Math.round((tally[k] / total) * 100) : 0;
    });
    return ratio; // { categoryId: percent }
  }

  // +predictReplacementCycle(uid, itemId): 과거 소진 로그로 재구매 주기(일수) 예측
  async predictReplacementCycle(uid, itemId) {
    const times = (await this.dbManager.queryByField('consumptionLogs', 'ownerUid', uid))
      .filter((l) => l.itemId === itemId && l.ts)
      .map((l) => (l.ts.seconds ? l.ts.seconds * 1000 : new Date(l.ts).getTime()))
      .sort((a, b) => a - b);

    if (times.length < 2) return null; // 데이터 부족

    let gapSum = 0;
    for (let i = 1; i < times.length; i++) gapSum += times[i] - times[i - 1];
    const avgDays = gapSum / (times.length - 1) / 86400000;
    return Math.max(1, Math.round(avgDays));
  }
}
