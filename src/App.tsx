import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  RotateCcw,
  Info,
  ChevronRight,
  Undo2,
  Redo2,
  Eraser,
  Layers,
  Settings,
  LayoutDashboard,
  Plus,
  Pencil,
  Trash2,
  Check,
  X
} from 'lucide-react';
import {
  MEDICINES as DEFAULT_MEDICINES,
  BOX_TYPES as DEFAULT_BOX_TYPES,
  CABINET_WIDTH,
  CABINET_HEIGHT,
  LAYERS_COUNT,
  Medicine,
  BoxType,
  PlacedBox
} from './constants';

const SCALE = 12;

const PRESET_COLORS = [
  '#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e',
  '#10b981','#14b8a6','#06b6d4','#0ea5e9','#3b82f6','#6366f1',
  '#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#64748b','#475569','#334155',
];

// ─── form string state types ──────────────────────────────────────────────────
interface MedFormState {
  id?: string;
  name: string;
  usage: string;
  width: string;   // 長
  height: string;  // 寬
  color: string;
}

interface BoxFormState {
  id: string;
  width: string;   // 長
  height: string;  // 寬
  depth: string;   // 高
  color: string;
}

const EMPTY_MED: MedFormState = { name: '', usage: '', width: '', height: '', color: PRESET_COLORS[0] };
const EMPTY_BOX: BoxFormState = { id: '', width: '', height: '', depth: '6', color: '#94a3b8' };

function medToForm(m: Medicine): MedFormState {
  return { id: m.id, name: m.name, usage: String(m.usage), width: String(m.width), height: String(m.height), color: m.color };
}
function boxToForm(b: BoxType): BoxFormState {
  return { id: b.id, width: String(b.width), height: String(b.height), depth: String(b.depth), color: b.color };
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [medicines, setMedicines] = useState<Medicine[]>(DEFAULT_MEDICINES);
  const [boxTypes, setBoxTypes]   = useState<BoxType[]>(DEFAULT_BOX_TYPES);

  const [layers, setLayers]           = useState<PlacedBox[][]>(Array(LAYERS_COUNT).fill([]));
  const [history, setHistory]         = useState<PlacedBox[][][]>([Array(LAYERS_COUNT).fill([])]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [activeLayer, setActiveLayer] = useState(0);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [draggedBoxType, setDraggedBoxType]     = useState<BoxType | null>(null);
  const [showInfo, setShowInfo]       = useState(false);
  const [previewRotated, setPreviewRotated]     = useState<Record<string, boolean>>({});

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; onConfirm: () => void;
  } | null>(null);

  const cabinetRef    = useRef<HTMLDivElement>(null);
  const clickTimeout  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeTab, setActiveTab]     = useState<'simulate' | 'settings'>('simulate');
  const [settingsTab, setSettingsTab] = useState<'medicine' | 'box'>('medicine');

  // medicine editor
  const [editingMedForm, setEditingMedForm]   = useState<MedFormState | null>(null);
  const [newMedForm, setNewMedForm]           = useState<MedFormState>(EMPTY_MED);
  const [showNewMedForm, setShowNewMedForm]   = useState(false);

  // box editor
  const [editingBoxForm, setEditingBoxForm]   = useState<BoxFormState | null>(null);
  const [newBoxForm, setNewBoxForm]           = useState<BoxFormState>(EMPTY_BOX);
  const [showNewBoxForm, setShowNewBoxForm]   = useState(false);

  // ── capacity helpers ─────────────────────────────────────────────────────────
  const getBestMedicineFit = (boxW: number, boxH: number, med: Medicine) => {
    const c1 = Math.floor(boxW / med.width),  r1 = Math.floor(boxH / med.height), n1 = c1 * r1;
    const c2 = Math.floor(boxW / med.height), r2 = Math.floor(boxH / med.width),  n2 = c2 * r2;
    if (n1 >= n2 && n1 > 0) return { count: n1, cols: c1, rows: r1, medW: med.width,  medH: med.height };
    if (n2 > 0)             return { count: n2, cols: c2, rows: r2, medW: med.height, medH: med.width  };
    return { count: 0, cols: 0, rows: 0, medW: 0, medH: 0 };
  };

  // height layers uses the box's own depth
  const getHeightLayers = (med: Medicine, boxDepth: number): number =>
    Math.floor(boxDepth / Math.min(med.width, med.height));

  const calculateCapacity = (box: BoxType, med: Medicine, isBoxRotated: boolean) => {
    const boxW = isBoxRotated ? box.height : box.width;
    const boxH = isBoxRotated ? box.width  : box.height;
    const flatCount   = getBestMedicineFit(boxW, boxH, med).count;
    const heightLayers = getHeightLayers(med, box.depth);
    return { flatCount, heightLayers, total: flatCount * heightLayers };
  };

  // ── history ──────────────────────────────────────────────────────────────────
  const saveToHistory = (nl: PlacedBox[][]) => {
    const h = history.slice(0, historyIndex + 1);
    h.push(JSON.parse(JSON.stringify(nl)));
    if (h.length > 50) h.shift();
    setHistory(h); setHistoryIndex(h.length - 1); setLayers(nl);
  };
  const undo = () => { if (historyIndex > 0) { const i = historyIndex - 1; setHistoryIndex(i); setLayers(JSON.parse(JSON.stringify(history[i]))); } };
  const redo = () => { if (historyIndex < history.length - 1) { const i = historyIndex + 1; setHistoryIndex(i); setLayers(JSON.parse(JSON.stringify(history[i]))); } };

  // ── collision ────────────────────────────────────────────────────────────────
  const checkCollision = (layerIdx: number, boxId: string | null, x: number, y: number, w: number, h: number) => {
    const EPS = 0.01;
    if (x < -EPS || y < -EPS || x + w > CABINET_WIDTH + EPS || y + h > CABINET_HEIGHT + EPS) return true;
    return layers[layerIdx].some(other => {
      if (other.id === boxId) return false;
      const ot = boxTypes.find(bt => bt.id === other.boxTypeId)!;
      const ow = other.isRotated ? ot.height : ot.width;
      const oh = other.isRotated ? ot.width  : ot.height;
      return x < other.x + ow - EPS && x + w > other.x + EPS && y < other.y + oh - EPS && y + h > other.y + EPS;
    });
  };

  // ── placement ────────────────────────────────────────────────────────────────
  const addBoxToLayer = (boxType: BoxType, x: number, y: number, isRotated = false) => {
    const orig = boxTypes.find(bt => bt.id === boxType.id)!;
    const w = isRotated ? orig.height : orig.width;
    const h = isRotated ? orig.width  : orig.height;
    if (checkCollision(activeLayer, null, x, y, w, h)) { alert('此位置無法放置藥盒（重疊或超出邊界）'); return; }
    const newBox: PlacedBox = { id: Math.random().toString(36).substr(2, 9), boxTypeId: boxType.id, x, y, isRotated };
    const nl = [...layers]; nl[activeLayer] = [...nl[activeLayer], newBox]; saveToHistory(nl);
  };

  const findAndPlaceBox = (boxType: BoxType) => {
    const isRot = !!previewRotated[boxType.id];
    const w = isRot ? boxType.height : boxType.width;
    const h = isRot ? boxType.width  : boxType.height;
    for (let y = 0; y <= CABINET_HEIGHT - h; y += 0.5)
      for (let x = 0; x <= CABINET_WIDTH - w; x += 0.5)
        if (!checkCollision(activeLayer, null, x, y, w, h)) { addBoxToLayer(boxType, x, y, isRot); return; }
    alert('藥櫃空間不足，無法自動送入此藥盒');
  };

  const toggleBoxRotation = (layerIdx: number, boxId: string) => {
    const nl = [...layers]; const layer = [...nl[layerIdx]];
    const bi = layer.findIndex(b => b.id === boxId); if (bi === -1) return;
    const box = layer[bi]; const bt = boxTypes.find(t => t.id === box.boxTypeId)!;
    const next = !box.isRotated;
    const w = next ? bt.height : bt.width; const h = next ? bt.width : bt.height;
    if (!checkCollision(layerIdx, boxId, box.x, box.y, w, h)) {
      const med = box.medicineId ? medicines.find(m => m.id === box.medicineId) : null;
      const cap = med ? calculateCapacity(bt, med, next) : null;
      layer[bi] = { ...box, isRotated: next, medicineCount: cap?.flatCount, medicineDepthLayers: cap?.heightLayers, medicineTotalCount: cap?.total };
      nl[layerIdx] = layer; saveToHistory(nl);
    } else alert('空間不足，無法旋轉藥盒');
  };

  const updateBoxPosition = (layerIdx: number, boxId: string, x: number, y: number) => {
    const nl = [...layers]; const layer = [...nl[layerIdx]];
    const bi = layer.findIndex(b => b.id === boxId); if (bi === -1) return;
    const box = layer[bi]; const bt = boxTypes.find(t => t.id === box.boxTypeId)!;
    const w = box.isRotated ? bt.height : bt.width; const h = box.isRotated ? bt.width : bt.height;
    const fx = Math.max(0, Math.min(CABINET_WIDTH - w,  Math.round(x * 2) / 2));
    const fy = Math.max(0, Math.min(CABINET_HEIGHT - h, Math.round(y * 2) / 2));
    if (!checkCollision(layerIdx, boxId, fx, fy, w, h)) { layer[bi] = { ...box, x: fx, y: fy }; nl[layerIdx] = layer; saveToHistory(nl); }
  };

  const removeBox = (layerIdx: number, boxId: string) => {
    const nl = [...layers]; nl[layerIdx] = nl[layerIdx].filter(b => b.id !== boxId); saveToHistory(nl);
  };

  const fillMedicine = (layerIdx: number, boxId: string, med: Medicine) => {
    const nl = [...layers]; const layer = [...nl[layerIdx]];
    const bi = layer.findIndex(b => b.id === boxId); if (bi === -1) return;
    const box = layer[bi]; const bt = boxTypes.find(t => t.id === box.boxTypeId)!;
    const cap = calculateCapacity(bt, med, box.isRotated);
    layer[bi] = { ...box, medicineId: med.id, medicineCount: cap.flatCount, medicineDepthLayers: cap.heightLayers, medicineTotalCount: cap.total };
    nl[layerIdx] = layer; saveToHistory(nl);
  };

  const clearAll = () => setConfirmDialog({ title: '清空所有藥櫃', message: '確定要清空所有藥櫃的排布嗎？', onConfirm: () => { saveToHistory(Array(LAYERS_COUNT).fill([])); setConfirmDialog(null); } });
  const clearCurrentLayer = () => setConfirmDialog({ title: `清空第 ${activeLayer + 1} 層`, message: `確定要清空第 ${activeLayer + 1} 層的排布嗎？`, onConfirm: () => { const nl = [...layers]; nl[activeLayer] = []; saveToHistory(nl); setConfirmDialog(null); } });

  const totalMedicineCount = layers[activeLayer].reduce((s, b) => s + (b.medicineTotalCount ?? 0), 0);

  // ── medicine CRUD ─────────────────────────────────────────────────────────────
  const parseMedForm = (f: MedFormState): Medicine | string => {
    const w = parseFloat(f.width), h = parseFloat(f.height), u = parseFloat(f.usage);
    if (!f.name.trim()) return '請輸入藥品名稱';
    if (isNaN(w) || w <= 0) return '長度必須大於 0';
    if (isNaN(h) || h <= 0) return '寬度必須大於 0';
    if (isNaN(u) || u < 0)  return '週用量必須 ≥ 0';
    return { id: f.id ?? 'm' + Date.now(), name: f.name.trim(), width: w, height: h, usage: u, color: f.color };
  };

  const addMed = () => {
    const result = parseMedForm(newMedForm);
    if (typeof result === 'string') { alert(result); return; }
    setMedicines(prev => [...prev, result]);
    setNewMedForm(EMPTY_MED); setShowNewMedForm(false);
  };

  const saveMed = () => {
    if (!editingMedForm) return;
    const result = parseMedForm(editingMedForm);
    if (typeof result === 'string') { alert(result); return; }
    setMedicines(prev => prev.map(m => m.id === result.id ? result : m));
    setEditingMedForm(null);
  };

  const deleteMed = (id: string) => setConfirmDialog({ title: '刪除藥品', message: '確定要刪除此藥品嗎？', onConfirm: () => { setMedicines(prev => prev.filter(m => m.id !== id)); if (selectedMedicine?.id === id) setSelectedMedicine(null); setConfirmDialog(null); } });

  // ── box CRUD ──────────────────────────────────────────────────────────────────
  const parseBoxForm = (f: BoxFormState, isNew: boolean): BoxType | string => {
    const w = parseFloat(f.width), h = parseFloat(f.height), d = parseFloat(f.depth);
    if (isNew && !f.id.trim()) return '請輸入藥盒編號';
    if (isNew && boxTypes.find(b => b.id === f.id.trim())) return '藥盒編號已存在';
    if (isNaN(w) || w <= 0) return '長度必須大於 0';
    if (isNaN(h) || h <= 0) return '寬度必須大於 0';
    if (isNaN(d) || d <= 0) return '高度必須大於 0';
    return { id: f.id.trim(), width: w, height: h, depth: d, color: f.color };
  };

  const addBox = () => {
    const result = parseBoxForm(newBoxForm, true);
    if (typeof result === 'string') { alert(result); return; }
    setBoxTypes(prev => [...prev, result]);
    setNewBoxForm(EMPTY_BOX); setShowNewBoxForm(false);
  };

  const saveBox = () => {
    if (!editingBoxForm) return;
    const result = parseBoxForm(editingBoxForm, false);
    if (typeof result === 'string') { alert(result); return; }
    setBoxTypes(prev => prev.map(b => b.id === result.id ? result : b));
    setEditingBoxForm(null);
  };

  const deleteBox = (id: string) => setConfirmDialog({ title: '刪除藥盒', message: '確定要刪除此藥盒嗎？', onConfirm: () => { setBoxTypes(prev => prev.filter(b => b.id !== id)); setConfirmDialog(null); } });

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg text-white"><Package size={22} /></div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">藥櫃智慧排布模擬器</h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Pharmacy Cabinet Optimizer</p>
          </div>
        </div>

        <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
          <button onClick={() => setActiveTab('simulate')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'simulate' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
            <LayoutDashboard size={15} /> 排布模擬
          </button>
          <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'settings' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
            <Settings size={15} /> 參數設定
          </button>
        </div>

        {activeTab === 'simulate' && (
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 rounded-full p-1">
              <button onClick={undo} disabled={historyIndex === 0} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-full transition-all disabled:opacity-30" title="上一步"><Undo2 size={17} /></button>
              <button onClick={redo} disabled={historyIndex === history.length - 1} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-full transition-all disabled:opacity-30" title="下一步"><Redo2 size={17} /></button>
            </div>
            <div className="h-6 w-[1px] bg-slate-200" />
            <button onClick={clearCurrentLayer} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-full" title="清空當前層"><Eraser size={18} /></button>
            <button onClick={clearAll} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full" title="清空所有"><RotateCcw size={18} /></button>
            <button onClick={() => setShowInfo(!showInfo)} className={`p-2 rounded-full ${showInfo ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}><Info size={18} /></button>
          </div>
        )}
      </header>

      {/* Info Banner */}
      <AnimatePresence>
        {showInfo && activeTab === 'simulate' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-indigo-50 border-b border-indigo-100 overflow-hidden">
            <div className="px-6 py-2.5 text-xs text-indigo-800 flex flex-wrap gap-5">
              <div className="flex items-center gap-1.5"><Layers size={13} className="text-indigo-600" /><span><strong>高度計算：</strong>藥盒高度 ÷ 藥品最短邊（min(長,寬)）= 高度層數</span></div>
              <div><strong>總數量</strong> = 鋪平數 × 高度層數</div>
              <div><strong>操作：</strong>點擊送入藥盒 | 雙擊旋轉 | 選藥品後點盒填充 | 右鍵刪除</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════ SIMULATE TAB ═══════════════════ */}
      {activeTab === 'simulate' && (
        <main className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <aside className="w-72 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
            {/* Box Types */}
            <div className="p-3 border-b border-slate-100">
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">藥盒類型 (點擊送入 / 雙擊旋轉)</h2>
              <div className="grid grid-cols-2 gap-2">
                {boxTypes.map(box => {
                  const isRot = !!previewRotated[box.id];
                  const dW = isRot ? box.height : box.width;
                  const dH = isRot ? box.width  : box.height;
                  return (
                    <div
                      key={box.id} draggable
                      onDragStart={() => setDraggedBoxType({ ...box, width: dW, height: dH })}
                      onClick={() => {
                        if (clickTimeout.current) {
                          clearTimeout(clickTimeout.current); clickTimeout.current = null;
                          setPreviewRotated(prev => ({ ...prev, [box.id]: !prev[box.id] }));
                        } else {
                          clickTimeout.current = setTimeout(() => { findAndPlaceBox(box); clickTimeout.current = null; }, 250);
                        }
                      }}
                      className="group cursor-pointer p-2 border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/30 transition-all select-none"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{box.id}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{dW}×{dH}</span>
                      </div>
                      <div className="flex items-center justify-center h-14">
                        <motion.div animate={{ rotate: isRot ? 90 : 0 }} className="border-2 border-dashed border-slate-300 rounded group-hover:border-indigo-400 transition-colors" style={{ width: box.width * 2, height: box.height * 2, backgroundColor: box.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Medicine List */}
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">藥品清單 (依使用量排序)</h2>
              <div className="space-y-1">
                {[...medicines].sort((a, b) => b.usage - a.usage).map(med => (
                  <button
                    key={med.id}
                    onClick={() => setSelectedMedicine(selectedMedicine?.id === med.id ? null : med)}
                    className={`w-full text-left p-2 rounded-xl border transition-all flex items-center gap-2 group ${
                      selectedMedicine?.id === med.id
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg'
                        : 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="rounded-sm flex-shrink-0 border border-white/20" style={{ width: Math.min(med.width * 3, 32), height: Math.min(med.height * 3, 32), minWidth: 8, minHeight: 8, backgroundColor: med.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{med.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[10px] ${selectedMedicine?.id === med.id ? 'text-indigo-100' : 'text-slate-400'}`}>長{med.width}×寬{med.height}cm</span>
                      </div>
                    </div>
                    <ChevronRight size={11} className={selectedMedicine?.id === med.id ? 'text-white flex-shrink-0' : 'text-slate-300 flex-shrink-0'} />
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Main Workspace */}
          <section className="flex-1 bg-[#f1f5f9] p-6 overflow-y-auto flex flex-col items-center gap-6 custom-scrollbar">
            {/* Layer Selection */}
            <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
              {[1, 2, 3, 4].map(n => (
                <button key={n} onClick={() => setActiveLayer(n - 1)} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeLayer === n - 1 ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>第 {n} 層</button>
              ))}
            </div>

            {/* Cabinet */}
            <div className="relative">
              <div className="mb-3 flex justify-between items-end flex-wrap gap-2">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">藥櫃第 {activeLayer + 1} 層</h3>
                  <p className="text-xs text-slate-500">尺寸: {CABINET_WIDTH}cm × {CABINET_HEIGHT}cm | 1cm = {SCALE}px</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      佔用長: {layers[activeLayer].reduce((max, b) => { const bt = boxTypes.find(t => t.id === b.boxTypeId)!; return Math.max(max, b.x + (b.isRotated ? bt.height : bt.width)); }, 0).toFixed(1)} / {CABINET_WIDTH} cm
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      佔用寬: {layers[activeLayer].reduce((max, b) => { const bt = boxTypes.find(t => t.id === b.boxTypeId)!; return Math.max(max, b.y + (b.isRotated ? bt.width : bt.height)); }, 0).toFixed(1)} / {CABINET_HEIGHT} cm
                    </span>
                    {totalMedicineCount > 0 && (
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded flex items-center gap-1"><Layers size={10} />本層總計: {totalMedicineCount} 盒</span>
                    )}
                  </div>
                </div>
                {selectedMedicine && (
                  <div className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: selectedMedicine.color }} />
                    已選: {selectedMedicine.name}
                    <button onClick={() => setSelectedMedicine(null)} className="ml-1 opacity-70 hover:opacity-100">✕</button>
                  </div>
                )}
              </div>

              <div
                ref={cabinetRef}
                className="bg-white rounded-2xl shadow-2xl border-[8px] border-slate-800 relative overflow-hidden"
                style={{ width: CABINET_WIDTH * SCALE + 16, height: CABINET_HEIGHT * SCALE + 16 }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  if (!draggedBoxType || !cabinetRef.current) return;
                  const rect = cabinetRef.current.getBoundingClientRect();
                  const x = Math.round(((e.clientX - rect.left - 8) / SCALE) * 2) / 2;
                  const y = Math.round(((e.clientY - rect.top  - 8) / SCALE) * 2) / 2;
                  const orig = boxTypes.find(bt => bt.id === draggedBoxType.id)!;
                  addBoxToLayer(orig, x, y, draggedBoxType.width !== orig.width);
                  setDraggedBoxType(null);
                }}
              >
                <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`, backgroundSize: `${SCALE / 2}px ${SCALE / 2}px` }} />

                <AnimatePresence>
                  {layers[activeLayer].map(box => {
                    const bt  = boxTypes.find(t => t.id === box.boxTypeId)!;
                    const med = box.medicineId ? medicines.find(m => m.id === box.medicineId) : null;
                    const w   = box.isRotated ? bt.height : bt.width;
                    const h   = box.isRotated ? bt.width  : bt.height;

                    return (
                      <motion.div
                        key={box.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1, x: box.x * SCALE, y: box.y * SCALE, width: w * SCALE, height: h * SCALE }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        drag dragMomentum={false} dragElastic={0}
                        onDragEnd={(_e, info) => {
                          if (!cabinetRef.current) return;
                          const rect = cabinetRef.current.getBoundingClientRect();
                          updateBoxPosition(activeLayer, box.id, (info.point.x - rect.left - 8) / SCALE - w / 2, (info.point.y - rect.top - 8) / SCALE - h / 2);
                        }}
                        className="absolute group cursor-grab active:cursor-grabbing z-10"
                        style={{ backgroundColor: bt.color }}
                        onClick={() => { if (selectedMedicine) fillMedicine(activeLayer, box.id, selectedMedicine); else toggleBoxRotation(activeLayer, box.id); }}
                        onContextMenu={e => { e.preventDefault(); removeBox(activeLayer, box.id); }}
                      >
                        <div className="absolute inset-0 border border-slate-300 group-hover:border-indigo-500 transition-colors rounded-sm" />

                        {/* Medicine grid dots */}
                        {med && box.medicineCount != null && box.medicineCount > 0 && (
                          <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            {(() => {
                              const fit = getBestMedicineFit(w, h, med);
                              const mw = fit.medW * SCALE; const mh = fit.medH * SCALE;
                              const items: React.ReactNode[] = [];
                              for (let r = 0; r < fit.rows; r++)
                                for (let c = 0; c < fit.cols; c++)
                                  items.push(<div key={`${r}-${c}`} className="absolute rounded-[1px] border border-white/30" style={{ left: c * mw, top: r * mh, width: mw - 1, height: mh - 1, backgroundColor: med.color, opacity: 0.85 }} />);
                              return items;
                            })()}
                          </div>
                        )}

                        {/* Box label: type ID + medicine name + total count */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-0.5 px-0.5">
                          <span className="text-[8px] font-black text-slate-700 bg-white/80 px-1 rounded-sm leading-tight">{bt.id}</span>
                          {med && box.medicineTotalCount != null && box.medicineTotalCount > 0 && (
                            <>
                              <span className="text-[11px] font-bold text-slate-700 bg-white/75 px-1.5 py-0.5 rounded-sm leading-tight">{med.name}</span>
                              <span className="text-[11px] font-black text-white bg-indigo-600/90 px-1.5 py-0.5 rounded-sm leading-tight shadow">{box.medicineTotalCount} 盒</span>
                            </>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>

            {/* Stats Table */}
            {layers[activeLayer].some(b => b.medicineId) && (
              <div className="w-full max-w-4xl bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                  <Layers size={15} className="text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-700">第 {activeLayer + 1} 層 — 藥品數量明細</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left px-4 py-2 text-slate-500 font-semibold">藥盒</th>
                        <th className="text-left px-4 py-2 text-slate-500 font-semibold">藥品</th>
                        <th className="text-right px-4 py-2 text-slate-500 font-semibold">長×寬(cm)</th>
                        <th className="text-right px-4 py-2 text-indigo-600 font-semibold">鋪平數</th>
                        <th className="text-right px-4 py-2 text-purple-600 font-semibold">高度層數</th>
                        <th className="text-right px-4 py-2 text-emerald-600 font-semibold">總數量</th>
                      </tr>
                    </thead>
                    <tbody>
                      {layers[activeLayer].filter(b => b.medicineId).map(box => {
                        const bt  = boxTypes.find(t => t.id === box.boxTypeId)!;
                        const med = medicines.find(m => m.id === box.medicineId)!;
                        return (
                          <tr key={box.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                            <td className="px-4 py-2 font-bold text-slate-700">{bt.id}{box.isRotated && <span className="text-slate-400 ml-1">(旋轉)</span>}</td>
                            <td className="px-4 py-2"><div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: med.color }} /><span className="truncate max-w-[140px]">{med.name}</span></div></td>
                            <td className="px-4 py-2 text-right font-mono text-slate-500">{med.width}×{med.height}</td>
                            <td className="px-4 py-2 text-right text-indigo-700 font-bold">{box.medicineCount}</td>
                            <td className="px-4 py-2 text-right text-purple-700 font-bold">×{box.medicineDepthLayers}</td>
                            <td className="px-4 py-2 text-right text-emerald-700 font-black text-sm">{box.medicineTotalCount}</td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td colSpan={5} className="px-4 py-2 text-right font-bold text-slate-700">本層合計</td>
                        <td className="px-4 py-2 text-right font-black text-emerald-700 text-sm">{totalMedicineCount}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </main>
      )}

      {/* ═══════════════════ SETTINGS TAB ═══════════════════ */}
      {activeTab === 'settings' && (
        <main className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-fit">
              <button onClick={() => setSettingsTab('medicine')} className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all ${settingsTab === 'medicine' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-600'}`}>藥品管理</button>
              <button onClick={() => setSettingsTab('box')}      className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all ${settingsTab === 'box'      ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-600'}`}>藥盒管理</button>
            </div>

            {/* ── Medicine ── */}
            {settingsTab === 'medicine' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h2 className="text-base font-bold text-slate-800">藥品清單</h2>
                  <button onClick={() => { setShowNewMedForm(true); setEditingMedForm(null); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-sm">
                    <Plus size={15} /> 新增藥品
                  </button>
                </div>

                <AnimatePresence>
                  {showNewMedForm && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                      <h3 className="text-sm font-bold text-indigo-800">新增藥品</h3>
                      <MedForm state={newMedForm} onChange={setNewMedForm} />
                      <div className="flex gap-2">
                        <button onClick={addMed} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700"><Check size={13} /> 儲存</button>
                        <button onClick={() => { setShowNewMedForm(false); setNewMedForm(EMPTY_MED); }} className="flex items-center gap-1 px-3 py-1.5 bg-white text-slate-500 text-xs font-bold rounded-lg border hover:bg-slate-50"><X size={13} /> 取消</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-50 text-slate-500 text-xs font-semibold">
                      <th className="text-left px-4 py-2.5">色</th>
                      <th className="text-left px-4 py-2.5">品名</th>
                      <th className="text-right px-4 py-2.5">週用量</th>
                      <th className="text-right px-4 py-2.5">長(cm)</th>
                      <th className="text-right px-4 py-2.5">寬(cm)</th>
                      <th className="text-right px-4 py-2.5">高度層數*</th>
                      <th className="px-4 py-2.5"></th>
                    </tr></thead>
                    <tbody>
                      {[...medicines].sort((a, b) => b.usage - a.usage).map(med => (
                        <React.Fragment key={med.id}>
                          <tr className="border-t border-slate-50 hover:bg-slate-50/50">
                            <td className="px-4 py-2"><div className="w-5 h-5 rounded" style={{ backgroundColor: med.color }} /></td>
                            <td className="px-4 py-2 font-medium text-slate-800">{med.name}</td>
                            <td className="px-4 py-2 text-right text-slate-500">{med.usage}</td>
                            <td className="px-4 py-2 text-right font-mono text-slate-600">{med.width}</td>
                            <td className="px-4 py-2 text-right font-mono text-slate-600">{med.height}</td>
                            <td className="px-4 py-2 text-right font-bold text-purple-600">
                              ×{getHeightLayers(med, 6)}<span className="text-slate-300 font-normal text-[10px] ml-0.5">(高6)</span>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex justify-end gap-1">
                                <button onClick={() => { setEditingMedForm(medToForm(med)); setShowNewMedForm(false); }} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><Pencil size={14} /></button>
                                <button onClick={() => deleteMed(med.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                              </div>
                            </td>
                          </tr>
                          {editingMedForm?.id === med.id && (
                            <tr className="bg-indigo-50 border-t border-indigo-100">
                              <td colSpan={7} className="px-4 py-3">
                                <div className="space-y-2">
                                  <MedForm state={editingMedForm} onChange={setEditingMedForm} />
                                  <div className="flex gap-2">
                                    <button onClick={saveMed} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700"><Check size={13} /> 儲存</button>
                                    <button onClick={() => setEditingMedForm(null)} className="flex items-center gap-1 px-3 py-1.5 bg-white text-slate-500 text-xs font-bold rounded-lg border hover:bg-slate-50"><X size={13} /> 取消</button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                  <p className="px-4 py-2 text-[10px] text-slate-400 border-t border-slate-50">*高度層數以藥盒高度6cm為例；實際依各藥盒設定計算</p>
                </div>
              </div>
            )}

            {/* ── Box ── */}
            {settingsTab === 'box' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h2 className="text-base font-bold text-slate-800">藥盒清單</h2>
                  <button onClick={() => { setShowNewBoxForm(true); setEditingBoxForm(null); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-sm">
                    <Plus size={15} /> 新增藥盒
                  </button>
                </div>

                <AnimatePresence>
                  {showNewBoxForm && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                      <h3 className="text-sm font-bold text-indigo-800">新增藥盒</h3>
                      <BoxForm state={newBoxForm} onChange={setNewBoxForm} isNew />
                      <div className="flex gap-2">
                        <button onClick={addBox} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700"><Check size={13} /> 儲存</button>
                        <button onClick={() => { setShowNewBoxForm(false); setNewBoxForm(EMPTY_BOX); }} className="flex items-center gap-1 px-3 py-1.5 bg-white text-slate-500 text-xs font-bold rounded-lg border hover:bg-slate-50"><X size={13} /> 取消</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-50 text-slate-500 text-xs font-semibold">
                      <th className="text-left px-4 py-2.5">色</th>
                      <th className="text-left px-4 py-2.5">編號</th>
                      <th className="text-right px-4 py-2.5">長(cm)</th>
                      <th className="text-right px-4 py-2.5">寬(cm)</th>
                      <th className="text-right px-4 py-2.5">高(cm)</th>
                      <th className="px-4 py-2.5"></th>
                    </tr></thead>
                    <tbody>
                      {boxTypes.map(box => (
                        <React.Fragment key={box.id}>
                          <tr className="border-t border-slate-50 hover:bg-slate-50/50">
                            <td className="px-4 py-2"><div className="w-10 h-6 rounded border border-slate-200" style={{ backgroundColor: box.color }} /></td>
                            <td className="px-4 py-2 font-bold text-slate-700">{box.id}</td>
                            <td className="px-4 py-2 text-right font-mono text-slate-600">{box.width}</td>
                            <td className="px-4 py-2 text-right font-mono text-slate-600">{box.height}</td>
                            <td className="px-4 py-2 text-right font-mono text-slate-600">{box.depth}</td>
                            <td className="px-4 py-2">
                              <div className="flex justify-end gap-1">
                                <button onClick={() => { setEditingBoxForm(boxToForm(box)); setShowNewBoxForm(false); }} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><Pencil size={14} /></button>
                                <button onClick={() => deleteBox(box.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                              </div>
                            </td>
                          </tr>
                          {editingBoxForm?.id === box.id && (
                            <tr className="bg-indigo-50 border-t border-indigo-100">
                              <td colSpan={6} className="px-4 py-3">
                                <div className="space-y-2">
                                  <BoxForm state={editingBoxForm} onChange={setEditingBoxForm} isNew={false} />
                                  <div className="flex gap-2">
                                    <button onClick={saveBox} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700"><Check size={13} /> 儲存</button>
                                    <button onClick={() => setEditingBoxForm(null)} className="flex items-center gap-1 px-3 py-1.5 bg-white text-slate-500 text-xs font-bold rounded-lg border hover:bg-slate-50"><X size={13} /> 取消</button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* Confirm Dialog */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
              <div className="p-5">
                <h3 className="text-base font-bold text-slate-900 mb-1.5">{confirmDialog.title}</h3>
                <p className="text-sm text-slate-500">{confirmDialog.message}</p>
              </div>
              <div className="bg-slate-50 px-5 py-3 flex justify-end gap-2">
                <button onClick={() => setConfirmDialog(null)} className="px-4 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-700">取消</button>
                <button onClick={confirmDialog.onConfirm} className="px-5 py-1.5 text-sm font-bold bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-sm">確定</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`.custom-scrollbar::-webkit-scrollbar{width:6px}.custom-scrollbar::-webkit-scrollbar-track{background:transparent}.custom-scrollbar::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:10px}.custom-scrollbar::-webkit-scrollbar-thumb:hover{background:#cbd5e1}`}</style>
    </div>
  );
}

// ─── Form sub-components ──────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
      {label}{children}
    </label>
  );
}

function NumInput({ value, onChange, placeholder, step = '0.1' }: { value: string; onChange: (v: string) => void; placeholder?: string; step?: string }) {
  return (
    <input
      type="number" value={value} placeholder={placeholder ?? '輸入數字'} step={step} min="0"
      onChange={e => onChange(e.target.value)}
      className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
    />
  );
}

function MedForm({ state, onChange }: { state: MedFormState; onChange: (s: MedFormState) => void }) {
  const set = (k: keyof MedFormState) => (v: string) => onChange({ ...state, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Field label="品名"><input type="text" value={state.name} onChange={e => set('name')(e.target.value)} placeholder="藥品名稱" className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white col-span-2" /></Field>
      <Field label="週用量"><NumInput value={state.usage} onChange={set('usage')} placeholder="0" step="1" /></Field>
      <Field label="長(cm)"><NumInput value={state.width}  onChange={set('width')}  /></Field>
      <Field label="寬(cm)"><NumInput value={state.height} onChange={set('height')} /></Field>
      <div className="col-span-2 sm:col-span-3 flex flex-col gap-1 text-xs font-semibold text-slate-600">
        顏色
        <div className="flex flex-wrap gap-1.5">
          {PRESET_COLORS.map(c => (
            <button key={c} type="button" onClick={() => onChange({ ...state, color: c })} className={`w-6 h-6 rounded-md border-2 transition-all ${state.color === c ? 'border-slate-700 scale-110' : 'border-transparent hover:scale-105'}`} style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BoxForm({ state, onChange, isNew }: { state: BoxFormState; onChange: (s: BoxFormState) => void; isNew: boolean }) {
  const set = (k: keyof BoxFormState) => (v: string) => onChange({ ...state, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Field label="編號">
        <input type="text" value={state.id} onChange={e => set('id')(e.target.value)} disabled={!isNew} placeholder="A1" className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white disabled:bg-slate-100 disabled:text-slate-400" />
      </Field>
      <Field label="長(cm)"><NumInput value={state.width}  onChange={set('width')}  step="0.5" /></Field>
      <Field label="寬(cm)"><NumInput value={state.height} onChange={set('height')} step="0.5" /></Field>
      <Field label="高(cm)"><NumInput value={state.depth}  onChange={set('depth')}  step="0.5" /></Field>
      <div className="col-span-2 sm:col-span-4 flex flex-col gap-1 text-xs font-semibold text-slate-600">
        顏色
        <div className="flex gap-2 items-center">
          <input type="color" value={state.color} onChange={e => set('color')(e.target.value)} className="w-8 h-8 rounded border border-slate-200 cursor-pointer" />
          <span className="text-slate-400 text-xs font-mono">{state.color}</span>
        </div>
      </div>
    </div>
  );
}
