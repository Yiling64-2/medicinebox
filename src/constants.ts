export interface Medicine {
  id: string;
  name: string;
  usage: number;
  width: number;
  height: number;
  color: string;
}

export interface BoxType {
  id: string;
  width: number;
  height: number;
  depth: number;
  color: string;
}

export interface PlacedBox {
  id: string;
  boxTypeId: string;
  x: number;
  y: number;
  isRotated: boolean;
  medicineId?: string;
  medicineCount?: number;
  medicineDepthLayers?: number;
  medicineTotalCount?: number;
}

export const MEDICINES: Medicine[] = [
  { id: 'm1', name: '帝斯坦乾粉注射劑', usage: 104, width: 7, height: 3, color: '#ef4444' },
  { id: 'm2', name: '斷血炎注射液', usage: 90, width: 6.8, height: 1.6, color: '#f97316' },
  { id: 'm3', name: '諾安得理那寧注射劑', usage: 82, width: 4.5, height: 2, color: '#f59e0b' },
  { id: 'm4', name: '扶如泄民注射液', usage: 80, width: 6, height: 1.1, color: '#eab308' },
  { id: 'm5', name: '保衛康治潰樂凍晶注射劑', usage: 60, width: 8, height: 3.5, color: '#84cc16' },
  { id: 'm6', name: '帝拔癲注射劑', usage: 55, width: 8.5, height: 4.2, color: '#22c55e' },
  { id: 'm7', name: '老虎黴素凍晶注射劑', usage: 55, width: 4.3, height: 1.8, color: '#10b981' },
  { id: 'm8', name: '嘉體民注射液', usage: 44, width: 5, height: 1, color: '#14b8a6' },
  { id: 'm9', name: '優閒濃縮輸注', usage: 36, width: 4.5, height: 2, color: '#06b6d4' },
  { id: 'm10', name: '樂麗康注射液', usage: 32, width: 11, height: 2, color: '#0ea5e9' },
  { id: 'm11', name: '美達研注射液', usage: 28, width: 9.8, height: 2.2, color: '#3b82f6' },
  { id: 'm12', name: '得保命注射液', usage: 20, width: 7, height: 1.6, color: '#6366f1' },
  { id: 'm13', name: '湍泰低注射液', usage: 17, width: 7.3, height: 2, color: '#8b5cf6' },
  { id: 'm14', name: '萬克黴凍晶注射劑', usage: 15, width: 6.5, height: 3.2, color: '#a855f7' },
  { id: 'm15', name: '臟得樂注射液', usage: 10, width: 7, height: 1.3, color: '#d946ef' },
  { id: 'm16', name: '喜達隆注射劑', usage: 9, width: 5, height: 1.8, color: '#ec4899' },
  { id: 'm17', name: '鹽酸二苯胺明注射液', usage: 8, width: 5, height: 0.8, color: '#f43f5e' },
  { id: 'm18', name: '可活能靜脈注射劑', usage: 7, width: 7.5, height: 3.5, color: '#64748b' },
  { id: 'm19', name: '維帕特輸液', usage: 6, width: 6.5, height: 2.8, color: '#475569' },
];

export const BOX_TYPES: BoxType[] = [
  { id: 'A1', width: 7.5, height: 6.5, depth: 6, color: '#f1f5f9' },
  { id: 'A2', width: 16.5, height: 6.5, depth: 6, color: '#e2e8f0' },
  { id: 'A3', width: 25, height: 6.5, depth: 6, color: '#cbd5e1' },
  { id: 'A4', width: 16, height: 16, depth: 6, color: '#94a3b8' },
  { id: 'A6', width: 25, height: 16, depth: 6, color: '#64748b' },
];

export const CABINET_WIDTH = 50;
export const CABINET_HEIGHT = 30;
export const CABINET_DEPTH = 6;
export const LAYERS_COUNT = 4;
