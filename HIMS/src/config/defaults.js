
export const DEFAULT_CATEGORIES = [
  { id: '식품', name: '식품' },
  { id: '음료', name: '음료' },
  { id: '위생', name: '위생용품' },
  { id: '세제', name: '세제/청소' },
  { id: '주방', name: '주방용품' },
  { id: '기타', name: '기타' },
];

// days: 유통기한 기본 일수 (0 이면 유통기한 없음 = 비식품)
export const DEFAULT_PRESETS = [
  { label: '💧 생수',  name: '생수',     categoryId: '음료', days: 180, minAlertQty: 2 },
  { label: '🥚 계란',  name: '계란',     categoryId: '식품', days: 21,  minAlertQty: 3 },
  { label: '🥛 우유',  name: '우유',     categoryId: '식품', days: 10,  minAlertQty: 1 },
  { label: '🍜 라면',  name: '라면',     categoryId: '식품', days: 150, minAlertQty: 3 },
  { label: '🧻 화장지', name: '화장지',  categoryId: '위생', days: 0,   minAlertQty: 2 },
  { label: '🧴 샴푸',  name: '샴푸',     categoryId: '위생', days: 0,   minAlertQty: 1 },
  { label: '🧺 세제',  name: '세탁세제', categoryId: '세제', days: 0,   minAlertQty: 1 },
];
