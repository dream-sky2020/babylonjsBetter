import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createDialoguePreviewDefinitionRegistry,
  createDialoguePreviewPreset,
  loadDialoguePreviewPresetLibrary,
  saveDialoguePreviewPresetLibrary,
  type DialoguePreviewPresetLibrary,
} from '@/core/dialogue-preview';
import { applyUiAnchorPreset, convertUiNodeToAbsolute, convertUiNodeToRectTransform, getUiLayoutParentRect, getUiSafeAreaRect, hitTestUiDocument, listUiNodesInPaintOrder, renderUiDocument, resolveUiNode, setUiNodeWorldRect, UiDocumentStore, type UiDefinition, type UiNode, type UiPropertyField, type UiResolvedNode } from '@/core/ui-document';
import { InspectorPanel, ObjectHierarchy, type EditorHierarchyDropIntent, type EditorHierarchyItem } from '@/core/ui/editor-kit';
import './dialogue-preview-canvas-lab.css';

const registry = createDialoguePreviewDefinitionRegistry();
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const nodeList = (store?: UiDocumentStore) => store ? Object.values(store.getDocument().nodes) : [];
const anchorPresets = [
  ['左上', 0, 0, 0, 0], ['上中', .5, 0, .5, 0], ['右上', 1, 0, 1, 0],
  ['左中', 0, .5, 0, .5], ['中心', .5, .5, .5, .5], ['右中', 1, .5, 1, .5],
  ['左下', 0, 1, 0, 1], ['下中', .5, 1, .5, 1], ['右下', 1, 1, 1, 1],
  ['横向拉伸', 0, .5, 1, .5], ['纵向拉伸', .5, 0, .5, 1], ['全拉伸', 0, 0, 1, 1],
] as const;

const UiNodeIcon = ({ group }: { group: boolean }) => <svg viewBox="0 0 24 24" aria-hidden="true">{group ? <><path d="M4 6h6l2 2h8v10H4z" /><path d="M8 12h8M12 9v6" /></> : <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 8h8v8H8z" /></>}</svg>;

type CanvasProps = {
  store: UiDocumentStore;
  selectedIds: string[];
  editMode: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  viewport: { zoom: number; panX: number; panY: number };
  onViewportChange(viewport: { zoom: number; panX: number; panY: number }): void;
  onSelectionChange(ids: string[], mode?: 'replace' | 'toggle'): void;
  onChanged(): void;
};

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';
type NodeRect = { x: number; y: number; width: number; height: number };
type CanvasInteraction =
  | { mode: 'pan'; clientX: number; clientY: number; panX: number; panY: number }
  | { mode: 'move'; ids: string[]; pointer: { x: number; y: number }; starts: Map<string, NodeRect> }
  | { mode: 'resize'; id: string; handle: ResizeHandle; pointer: { x: number; y: number }; rect: NodeRect; descendants: Map<string, NodeRect> }
  | { mode: 'box'; start: { x: number; y: number }; current: { x: number; y: number }; toggle: boolean };

const selectionBounds = (nodes: UiResolvedNode[]) => {
  const left = Math.min(...nodes.map((node) => node.layout.x)); const top = Math.min(...nodes.map((node) => node.layout.y));
  const right = Math.max(...nodes.map((node) => node.layout.x + node.layout.width)); const bottom = Math.max(...nodes.map((node) => node.layout.y + node.layout.height));
  return { left, top, right, bottom, centerX: (left + right) / 2, centerY: (top + bottom) / 2 };
};

const PreviewCanvas: React.FC<CanvasProps> = ({ store, selectedIds, editMode, showGrid, snapToGrid, viewport, onViewportChange, onSelectionChange, onChanged }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const interactionRef = useRef<CanvasInteraction | undefined>(undefined);
  const [overlay, setOverlay] = useState<{ box?: { x: number; y: number; width: number; height: number }; guideX?: number; guideY?: number }>({});
  const document = store.getDocument();
  const primaryId = selectedIds.at(-1) ?? '';

  useEffect(() => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); if (!canvas || !ctx) return;
    canvas.width = document.canvas.width; canvas.height = document.canvas.height;
    renderUiDocument(ctx, document, registry, {
      mode: editMode ? 'edit' : 'preview',
      beforeNodes: editMode ? (gridContext) => {
        const { width, height, gridSize } = document.canvas; gridContext.save();
        if (showGrid) {
          gridContext.strokeStyle = 'rgba(125,211,252,.12)'; gridContext.lineWidth = 1; gridContext.beginPath();
          for (let x = 0; x <= width; x += gridSize) { gridContext.moveTo(x, 0); gridContext.lineTo(x, height); }
          for (let y = 0; y <= height; y += gridSize) { gridContext.moveTo(0, y); gridContext.lineTo(width, y); }
          gridContext.stroke();
        }
        const safe = getUiSafeAreaRect(document); gridContext.strokeStyle = 'rgba(94,234,212,.6)'; gridContext.lineWidth = 2; gridContext.setLineDash([12, 8]); gridContext.strokeRect(safe.x, safe.y, safe.width, safe.height); gridContext.restore();
      } : undefined,
    });
    if (editMode) {
      selectedIds.map((id) => resolveUiNode(document, id)).filter((node): node is UiNode => Boolean(node?.visible)).forEach((node) => {
        const { x, y, width, height } = node.layout; ctx.save(); ctx.strokeStyle = node.id === primaryId ? '#f5c96a' : '#67d7f0'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.strokeRect(x - 5, y - 5, width + 10, height + 10); ctx.restore();
      });
      const primary = resolveUiNode(document, primaryId);
      if (primary?.visible && selectedIds.length === 1) {
        const { x, y, width, height } = primary.layout; ctx.save(); ctx.fillStyle = '#f5c96a'; [[x - 7, y - 7], [x + width - 1, y - 7], [x - 7, y + height - 1], [x + width - 1, y + height - 1]].forEach(([handleX, handleY]) => ctx.fillRect(handleX, handleY, 8, 8)); ctx.restore();
        const source = document.nodes[primaryId]; if (source?.layout.mode === 'rect-transform') {
          const parent = source.parentId ? resolveUiNode(document, source.parentId)?.layout : source.layout.relativeTo === 'safe-area' ? getUiSafeAreaRect(document) : { x: 0, y: 0, width: document.canvas.width, height: document.canvas.height };
          if (parent) { const minX = parent.x + parent.width * source.layout.anchorMin.x; const minY = parent.y + parent.height * source.layout.anchorMin.y; const maxX = parent.x + parent.width * source.layout.anchorMax.x; const maxY = parent.y + parent.height * source.layout.anchorMax.y; ctx.save(); ctx.fillStyle = '#5eead4'; ctx.strokeStyle = 'rgba(94,234,212,.7)'; ctx.setLineDash([5, 5]); ctx.strokeRect(minX, minY, Math.max(1, maxX - minX), Math.max(1, maxY - minY)); [[minX, minY], [maxX, maxY]].forEach(([anchorX, anchorY]) => { ctx.beginPath(); ctx.arc(anchorX, anchorY, 6, 0, Math.PI * 2); ctx.fill(); }); ctx.restore(); }
        }
      }
      if (overlay.guideX !== undefined || overlay.guideY !== undefined) {
        ctx.save(); ctx.strokeStyle = '#5eead4'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.beginPath();
        if (overlay.guideX !== undefined) { ctx.moveTo(overlay.guideX, 0); ctx.lineTo(overlay.guideX, document.canvas.height); }
        if (overlay.guideY !== undefined) { ctx.moveTo(0, overlay.guideY); ctx.lineTo(document.canvas.width, overlay.guideY); }
        ctx.stroke(); ctx.restore();
      }
      if (overlay.box) { ctx.save(); ctx.fillStyle = 'rgba(103,215,240,.12)'; ctx.strokeStyle = '#67d7f0'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.fillRect(overlay.box.x, overlay.box.y, overlay.box.width, overlay.box.height); ctx.strokeRect(overlay.box.x, overlay.box.y, overlay.box.width, overlay.box.height); ctx.restore(); }
    }
  }, [document, editMode, overlay, primaryId, selectedIds, showGrid]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * document.canvas.width / rect.width, y: (event.clientY - rect.top) * document.canvas.height / rect.height };
  };
  const resizeHandleAt = (pointValue: { x: number; y: number }, unitsPerPixel: number): ResizeHandle | undefined => {
    if (selectedIds.length !== 1) return undefined; const node = resolveUiNode(document, primaryId); if (!node || node.locked) return undefined;
    const { x, y, width, height } = node.layout; const radius = 12 * unitsPerPixel;
    const handles: [ResizeHandle, number, number][] = [['nw', x, y], ['ne', x + width, y], ['sw', x, y + height], ['se', x + width, y + height]];
    return handles.find(([, handleX, handleY]) => Math.abs(pointValue.x - handleX) <= radius && Math.abs(pointValue.y - handleY) <= radius)?.[0];
  };

  const finishInteraction = (rollback = false) => {
    const interaction = interactionRef.current; if (!interaction) return; interactionRef.current = undefined;
    if (interaction.mode === 'move' || interaction.mode === 'resize') { if (rollback) store.rollbackTransaction(); else store.commitTransaction(); onChanged(); }
    if (interaction.mode === 'box' && !rollback) {
      const left = Math.min(interaction.start.x, interaction.current.x); const right = Math.max(interaction.start.x, interaction.current.x); const top = Math.min(interaction.start.y, interaction.current.y); const bottom = Math.max(interaction.start.y, interaction.current.y);
      const ids = listUiNodesInPaintOrder(store.getDocument()).filter((node) => node.type !== 'group' && node.visible && node.layout.x < right && node.layout.x + node.layout.width > left && node.layout.y < bottom && node.layout.y + node.layout.height > top).map((node) => node.id);
      onSelectionChange(ids, interaction.toggle ? 'toggle' : 'replace');
    }
    setOverlay({});
  };

  return <div className="preview-canvas-viewport" style={{ transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})` }}><canvas ref={canvasRef} className={`preview-canvas${editMode ? ' is-editing' : ''}`} aria-label="对话界面 Canvas 预览"
    onWheel={(event) => { if (!editMode) return; event.preventDefault(); const zoom = clamp(viewport.zoom * (event.deltaY < 0 ? 1.1 : .9), .25, 3); onViewportChange({ ...viewport, zoom }); }}
    onPointerDown={(event) => {
      if (!editMode) return;
      if (event.button === 1) { interactionRef.current = { mode: 'pan', clientX: event.clientX, clientY: event.clientY, panX: viewport.panX, panY: viewport.panY }; event.currentTarget.setPointerCapture(event.pointerId); return; }
      const rect = event.currentTarget.getBoundingClientRect(); const p = point(event); const handle = resizeHandleAt(p, document.canvas.width / rect.width);
      if (handle) {
        const target = document.nodes[primaryId]; const resolved = resolveUiNode(document, primaryId); if (!target || !resolved) return;
        const descendants = new Map<string, NodeRect>();
        const collect = (id: string) => document.nodes[id]?.childIds.forEach((childId) => { const child = resolveUiNode(document, childId); if (child) { descendants.set(childId, { ...child.layout }); collect(childId); } }); collect(primaryId);
        store.beginTransaction('缩放 UI 节点'); interactionRef.current = { mode: 'resize', id: primaryId, handle, pointer: p, rect: { ...resolved.layout }, descendants }; event.currentTarget.setPointerCapture(event.pointerId); return;
      }
      const target = hitTestUiDocument(document, registry, p); const toggle = event.ctrlKey || event.metaKey || event.shiftKey;
      if (!target) { if (!toggle) onSelectionChange([]); interactionRef.current = { mode: 'box', start: p, current: p, toggle }; event.currentTarget.setPointerCapture(event.pointerId); return; }
      if (toggle) { onSelectionChange([target.id], 'toggle'); return; }
      const moveIds = selectedIds.includes(target.id) ? selectedIds : [target.id]; if (!selectedIds.includes(target.id)) onSelectionChange([target.id]);
      const selectedSet = new Set(moveIds); const hasSelectedAncestor = (node: UiNode) => { let parentId = node.parentId; while (parentId) { if (selectedSet.has(parentId)) return true; parentId = document.nodes[parentId]?.parentId ?? null; } return false; };
      const movable = moveIds.map((id) => document.nodes[id]).filter((node): node is UiNode => Boolean(node && !resolveUiNode(document, node)?.locked && !hasSelectedAncestor(node))); if (!movable.length) return;
      store.beginTransaction('移动 UI 节点'); interactionRef.current = { mode: 'move', ids: movable.map((node) => node.id), pointer: p, starts: new Map(movable.map((node) => { const resolved = resolveUiNode(document, node); return [node.id, resolved ? { ...resolved.layout } : { x: 0, y: 0, width: 8, height: 8 }]; })) }; event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => {
      const interaction = interactionRef.current; if (!interaction) return;
      if (interaction.mode === 'pan') { onViewportChange({ ...viewport, panX: interaction.panX + event.clientX - interaction.clientX, panY: interaction.panY + event.clientY - interaction.clientY }); return; }
      const p = point(event);
      if (interaction.mode === 'box') { interaction.current = p; const x = Math.min(interaction.start.x, p.x); const y = Math.min(interaction.start.y, p.y); setOverlay({ box: { x, y, width: Math.abs(p.x - interaction.start.x), height: Math.abs(p.y - interaction.start.y) } }); return; }
      if (interaction.mode === 'resize') {
        const dx = p.x - interaction.pointer.x; const dy = p.y - interaction.pointer.y; const original = interaction.rect; const west = interaction.handle.includes('w'); const north = interaction.handle.includes('n');
        let left = west ? clamp(original.x + dx, 0, original.x + original.width - 8) : original.x; let right = west ? original.x + original.width : clamp(original.x + original.width + dx, original.x + 8, document.canvas.width);
        let top = north ? clamp(original.y + dy, 0, original.y + original.height - 8) : original.y; let bottom = north ? original.y + original.height : clamp(original.y + original.height + dy, original.y + 8, document.canvas.height);
        if (snapToGrid) { left = Math.round(left / document.canvas.gridSize) * document.canvas.gridSize; right = Math.round(right / document.canvas.gridSize) * document.canvas.gridSize; top = Math.round(top / document.canvas.gridSize) * document.canvas.gridSize; bottom = Math.round(bottom / document.canvas.gridSize) * document.canvas.gridSize; }
        const width = Math.round(Math.max(8, right - left)); const height = Math.round(Math.max(8, bottom - top)); const scaleX = width / original.width; const scaleY = height / original.height;
        store.mutate('缩放 UI 节点', (draft) => {
          const node = draft.nodes[interaction.id]; if (!node) return; setUiNodeWorldRect(draft, node, { x: left, y: top, width, height });
          interaction.descendants.forEach((rect, id) => { const child = draft.nodes[id]; if (child) setUiNodeWorldRect(draft, child, { x: left + (rect.x - original.x) * scaleX, y: top + (rect.y - original.y) * scaleY, width: Math.max(8, rect.width * scaleX), height: Math.max(8, rect.height * scaleY) }); });
        }); onChanged(); return;
      }
      const current = store.getDocument(); const movingNodes = interaction.ids.map((id) => resolveUiNode(current, id)).filter((node): node is UiNode => Boolean(node)); if (!movingNodes.length) return;
      const originalNodes = movingNodes.map((node) => { const start = interaction.starts.get(node.id); return { ...node, layout: { ...node.layout, x: start?.x ?? node.layout.x, y: start?.y ?? node.layout.y } }; }); const bounds = selectionBounds(originalNodes); let dx = p.x - interaction.pointer.x; let dy = p.y - interaction.pointer.y;
      if (snapToGrid) { dx = Math.round((bounds.left + dx) / current.canvas.gridSize) * current.canvas.gridSize - bounds.left; dy = Math.round((bounds.top + dy) / current.canvas.gridSize) * current.canvas.gridSize - bounds.top; }
      const excluded = new Set(interaction.ids); const collectExcluded = (id: string) => current.nodes[id]?.childIds.forEach((childId) => { excluded.add(childId); collectExcluded(childId); }); interaction.ids.forEach(collectExcluded);
      const others = listUiNodesInPaintOrder(current).filter((node) => node.visible && !excluded.has(node.id)); const threshold = 8 * current.canvas.width / event.currentTarget.getBoundingClientRect().width; let guideX: number | undefined; let guideY: number | undefined; let bestX = threshold; let bestY = threshold; let snapDx = 0; let snapDy = 0;
      const movingX = [bounds.left + dx, bounds.centerX + dx, bounds.right + dx]; const movingY = [bounds.top + dy, bounds.centerY + dy, bounds.bottom + dy];
      others.forEach((node) => { const target = selectionBounds([node]); [target.left, target.centerX, target.right].forEach((value) => movingX.forEach((moving) => { const difference = value - moving; if (Math.abs(difference) < bestX) { bestX = Math.abs(difference); snapDx = difference; guideX = value; } })); [target.top, target.centerY, target.bottom].forEach((value) => movingY.forEach((moving) => { const difference = value - moving; if (Math.abs(difference) < bestY) { bestY = Math.abs(difference); snapDy = difference; guideY = value; } })); }); dx = clamp(dx + snapDx, -bounds.left, current.canvas.width - bounds.right); dy = clamp(dy + snapDy, -bounds.top, current.canvas.height - bounds.bottom);
      store.mutate('移动 UI 节点', (draft) => interaction.ids.forEach((id) => { const node = draft.nodes[id]; const start = interaction.starts.get(id); if (node && start) setUiNodeWorldRect(draft, node, { ...start, x: start.x + dx, y: start.y + dy }); })); setOverlay({ guideX, guideY }); onChanged();
    }}
    onPointerUp={() => finishInteraction()}
    onPointerCancel={() => finishInteraction(true)} /></div>;
};

const NumberField = ({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; onChange(value: number): void }) => <label className="control-field"><span>{label}</span><input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
const getProp = (node: UiNode, path: string): unknown => path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, node.props);
const setProp = (node: UiNode, path: string, value: unknown) => {
  const parts = path.split('.'); let target = node.props;
  parts.slice(0, -1).forEach((part) => { if (!target[part] || typeof target[part] !== 'object') target[part] = {}; target = target[part] as Record<string, unknown>; });
  target[parts.at(-1) ?? path] = value;
};

const PropertyControl = ({ field, node, update }: { field: UiPropertyField; node: UiNode; update(value: unknown): void }) => {
  const value = getProp(node, field.path);
  if (field.control === 'textarea') return <label className="text-field"><span>{field.label}</span><textarea rows={4} value={String(value ?? '')} onChange={(event) => update(event.target.value)} /></label>;
  if (field.control === 'select') return <label className="select-field"><span>{field.label}</span><select value={String(value ?? '')} onChange={(event) => update(event.target.value)}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  if (field.control === 'color') return <label className="control-field control-field--color"><span>{field.label}</span><input type="color" value={String(value ?? '#000000')} onChange={(event) => update(event.target.value)} /><code>{String(value ?? '')}</code></label>;
  if (field.control === 'checkbox') return <label className="select-field"><span>{field.label}</span><input type="checkbox" checked={Boolean(value)} onChange={(event) => update(event.target.checked)} /></label>;
  if (field.control === 'number') return <NumberField label={field.label} value={Number(value ?? 0)} min={field.min} max={field.max} step={field.step} onChange={update} />;
  return <label className="text-field"><span>{field.label}</span><input value={String(value ?? '')} onChange={(event) => update(event.target.value)} /></label>;
};

export const DialoguePreviewCanvasLab: React.FC = () => {
  const [stores, setStores] = useState(() => new Map<string, UiDocumentStore>()); const unsubscribersRef = useRef<(() => void)[]>([]);
  const [revision, setRevision] = useState(0); const [activeKey, setActiveKey] = useState(''); const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState('正在载入界面预设…'); const [isError, setIsError] = useState(false); const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(true); const [showGrid, setShowGrid] = useState(true); const [snapToGrid, setSnapToGrid] = useState(false);
  const [viewport, setViewport] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [expandedUiIds, setExpandedUiIds] = useState<Set<string>>(() => new Set());
  const [newKey, setNewKey] = useState('dialogue_ui_copy'); const [newName, setNewName] = useState('对话界面副本');
  const selectedId = selectedIds.at(-1) ?? ''; const store = stores.get(activeKey); const preset = store?.getDocument(); const selected = preset?.nodes[selectedId]; const definition = selected ? registry.get(selected.type) : undefined;
  const dirty = useMemo(() => { void revision; return [...stores.values()].some((item) => item.dirty); }, [revision, stores]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const subscribeStore = useCallback((nextStore: UiDocumentStore) => { unsubscribersRef.current.push(nextStore.subscribe(refresh)); }, [refresh]);
  const currentLibrary = (): DialoguePreviewPresetLibrary => Object.fromEntries([...stores].map(([key, item]) => [key, item.getDocument()]));

  const load = useCallback(async () => {
    try {
      const library = await loadDialoguePreviewPresetLibrary(); unsubscribersRef.current.forEach((unsubscribe) => unsubscribe()); unsubscribersRef.current = [];
      const nextStores = new Map(Object.entries(library).map(([key, document]) => [key, new UiDocumentStore(document)] as const)); nextStores.forEach(subscribeStore); setStores(nextStores);
      const key = Object.keys(library)[0] ?? ''; setActiveKey(key); setSelectedIds(library[key]?.rootIds[0] ? [library[key].rootIds[0]] : []); setMessage(`已载入 ${Object.keys(library).length} 个界面预设；旧格式会在保存时升级到 V2。`); setIsError(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); setIsError(true); }
  }, [subscribeStore]);
  // Initial async repository hydration is the intended external synchronization for this Lab.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); return () => unsubscribersRef.current.forEach((unsubscribe) => unsubscribe()); }, [load]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      const activeStore = stores.get(activeKey); if (!activeStore) return;
      const redo = event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey); const undo = event.key.toLowerCase() === 'z' && !event.shiftKey;
      if ((undo && activeStore.undo()) || (redo && activeStore.redo())) { event.preventDefault(); refresh(); }
    };
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeKey, refresh, stores]);

  const updateNode = (label: string, mutation: (node: UiNode) => void) => { if (!store || !selected) return; store.updateNode(selected.id, label, mutation); refresh(); };
  const updateMargin = (side: 'left' | 'right' | 'top' | 'bottom', value: number) => {
    if (!store || !selected) return; store.mutate(`修改${side}边距`, (draft) => { const node = draft.nodes[selected.id]; if (!node) return; const resolved = resolveUiNode(draft, node); const parent = getUiLayoutParentRect(draft, node); if (!resolved || !parent) return; const rect = { ...resolved.layout };
      if (side === 'left') { const right = rect.x + rect.width; rect.x = parent.x + value; rect.width = Math.max(8, right - rect.x); }
      else if (side === 'right') rect.width = Math.max(8, parent.x + parent.width - value - rect.x);
      else if (side === 'top') { const bottom = rect.y + rect.height; rect.y = parent.y + value; rect.height = Math.max(8, bottom - rect.y); }
      else rect.height = Math.max(8, parent.y + parent.height - value - rect.y); setUiNodeWorldRect(draft, node, rect);
    }); refresh();
  };
  const changeSelection = (ids: string[], mode: 'replace' | 'toggle' = 'replace') => setSelectedIds((current) => {
    if (mode === 'replace') return [...new Set(ids)]; const next = new Set(current); ids.forEach((id) => { if (next.has(id)) next.delete(id); else next.add(id); }); return [...next];
  });
  const alignSelection = (mode: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom') => {
    if (!store || selectedIds.length < 2) return; const document = store.getDocument(); const nodes = selectedIds.map((id) => resolveUiNode(document, id)).filter((node): node is UiResolvedNode => Boolean(node && !node.locked)); if (nodes.length < 2) return;
    const bounds = selectionBounds(nodes); store.mutate('对齐 UI 节点', (draft) => nodes.forEach((source) => { const node = draft.nodes[source.id]; if (!node) return;
      const rect = { ...source.layout }; if (mode === 'left') rect.x = bounds.left; else if (mode === 'center-x') rect.x = Math.round(bounds.centerX - rect.width / 2); else if (mode === 'right') rect.x = bounds.right - rect.width;
      else if (mode === 'top') rect.y = bounds.top; else if (mode === 'center-y') rect.y = Math.round(bounds.centerY - rect.height / 2); else rect.y = bounds.bottom - rect.height; setUiNodeWorldRect(draft, node, rect);
    })); refresh();
  };
  const groupSelection = () => {
    if (!store || selectedIds.length < 2) return; const document = store.getDocument(); const selectedSet = new Set(selectedIds);
    const topLevelIds = selectedIds.filter((id) => { let parentId = document.nodes[id]?.parentId; while (parentId) { if (selectedSet.has(parentId)) return false; parentId = document.nodes[parentId]?.parentId ?? null; } return Boolean(document.nodes[id]); });
    const resolved = topLevelIds.map((id) => resolveUiNode(document, id)).filter((node): node is UiResolvedNode => Boolean(node)); if (resolved.length < 2) return;
    const bounds = selectionBounds(resolved); let index = 1; while (document.nodes[`group-${index}`]) index += 1; const id = `group-${index}`;
    store.mutate('创建 Group', (draft) => {
      topLevelIds.forEach((nodeId) => { const node = draft.nodes[nodeId]; if (!node) return; if (node.parentId) { const parent = draft.nodes[node.parentId]; if (parent) parent.childIds = parent.childIds.filter((childId) => childId !== nodeId); } else draft.rootIds = draft.rootIds.filter((rootId) => rootId !== nodeId); });
      draft.nodes[id] = { id, type: 'group', definitionVersion: 1, name: `Group ${index}`, parentId: null, childIds: [...topLevelIds], layout: { mode: 'absolute', x: Math.round(bounds.left), y: Math.round(bounds.top), width: Math.max(8, Math.round(bounds.right - bounds.left)), height: Math.max(8, Math.round(bounds.bottom - bounds.top)), zIndex: Math.min(...resolved.map((node) => node.layout.zIndex)) }, visible: true, locked: false, opacity: 1, props: {} };
      draft.rootIds.push(id); topLevelIds.forEach((nodeId) => { const node = draft.nodes[nodeId]; const world = resolved.find((item) => item.id === nodeId); if (node && world) { node.parentId = id; node.layout = { ...world.layout, x: Math.round(world.layout.x - bounds.left), y: Math.round(world.layout.y - bounds.top) }; } });
    }); setSelectedIds([id]); refresh();
  };
  const ungroupSelected = () => {
    if (!store || selected?.type !== 'group') return; const document = store.getDocument(); const group = document.nodes[selected.id]; const groupWorld = resolveUiNode(document, group); if (!group || !groupWorld) return; const childIds = [...group.childIds]; const worlds = new Map(childIds.map((id) => [id, resolveUiNode(document, id)?.layout]));
    store.mutate('取消 Group', (draft) => {
      const current = draft.nodes[group.id]; if (!current) return; if (current.parentId) { const parent = draft.nodes[current.parentId]; if (parent) parent.childIds = parent.childIds.flatMap((id) => id === current.id ? childIds : [id]); } else draft.rootIds = draft.rootIds.flatMap((id) => id === current.id ? childIds : [id]);
      childIds.forEach((childId) => { const child = draft.nodes[childId]; const world = worlds.get(childId); if (child && world) { child.parentId = current.parentId; child.layout = { ...world, x: 0, y: 0 }; setUiNodeWorldRect(draft, child, world); } }); delete draft.nodes[current.id];
    }); setSelectedIds(childIds); refresh();
  };
  const moveHierarchyNodes = (intent: EditorHierarchyDropIntent) => {
    if (!store) return; const document = store.getDocument(); const selectedSet = new Set(intent.sourceIds);
    const movingIds = intent.sourceIds.filter((id) => {
      const node = document.nodes[id]; if (!node || node.locked) return false;
      let parentId = node.parentId; while (parentId) { if (selectedSet.has(parentId)) return false; parentId = document.nodes[parentId]?.parentId ?? null; } return true;
    });
    if (!movingIds.length) return;
    const displayIds = (ids: string[]) => ids.map((id, index) => ({ id, index })).sort((left, right) => (document.nodes[right.id]?.layout.zIndex ?? 0) - (document.nodes[left.id]?.layout.zIndex ?? 0) || left.index - right.index).map(entry => entry.id);
    const displayOrder: string[] = []; const visit = (ids: string[]) => displayIds(ids).forEach((id) => { displayOrder.push(id); visit(document.nodes[id]?.childIds ?? []); }); visit(document.rootIds);
    const order = new Map(displayOrder.map((id, index) => [id, index])); movingIds.sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
    const worlds = new Map(movingIds.map((id) => [id, resolveUiNode(document, id)?.layout]));
    const label = intent.placement === 'inside' ? '移入 Group' : intent.placement === 'root-end' ? '移至根层级' : '重排 UI 节点';
    store.mutate(label, (draft) => {
      movingIds.forEach((id) => { const node = draft.nodes[id]; if (!node) return; if (node.parentId) { const parent = draft.nodes[node.parentId]; if (parent) parent.childIds = parent.childIds.filter(childId => childId !== id); } else draft.rootIds = draft.rootIds.filter(rootId => rootId !== id); });
      const parentId = intent.parentId; const siblings = parentId ? draft.nodes[parentId]?.childIds : draft.rootIds; if (!siblings) return;
      const ordered = siblings.map((id, index) => ({ id, index })).sort((left, right) => (draft.nodes[right.id]?.layout.zIndex ?? 0) - (draft.nodes[left.id]?.layout.zIndex ?? 0) || left.index - right.index).map(entry => entry.id);
      let insertIndex = Math.min(intent.targetIndex, ordered.length);
      if (intent.targetId && intent.placement !== 'inside') { const targetIndex = ordered.indexOf(intent.targetId); if (targetIndex >= 0) insertIndex = targetIndex + (intent.placement === 'after' ? 1 : 0); }
      if (intent.placement === 'inside' || intent.placement === 'root-end') insertIndex = ordered.length;
      ordered.splice(insertIndex, 0, ...movingIds); siblings.splice(0, siblings.length, ...ordered);
      movingIds.forEach((id) => { const node = draft.nodes[id]; const world = worlds.get(id); if (!node || !world) return; node.parentId = parentId; setUiNodeWorldRect(draft, node, world); });
      ordered.forEach((id, index) => { const node = draft.nodes[id]; if (node) node.layout.zIndex = ordered.length - index - 1; });
    }); setSelectedIds(movingIds); refresh();
  };
  const save = async () => { setSaving(true); try { await saveDialoguePreviewPresetLibrary(currentLibrary()); stores.forEach((item) => item.markSaved()); setMessage(`已保存 ${stores.size} 个 V2 界面预设。`); setIsError(false); refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); setIsError(true); } finally { setSaving(false); } };
  const addNode = (entry: UiDefinition) => {
    if (!store || !preset) return; const ids = new Set(Object.keys(preset.nodes)); let index = 1; while (ids.has(`${entry.type}-${index}`)) index += 1; const id = `${entry.type}-${index}`;
    store.addNode({ id, type: entry.type, definitionVersion: entry.version, name: `${entry.label} ${index}`, parentId: null, childIds: [], layout: { mode: 'absolute', x: 320 + index * 20, y: 260 + index * 20, width: entry.defaultSize.width, height: entry.defaultSize.height, zIndex: Math.max(0, ...nodeList(store).map((item) => item.layout.zIndex)) + 1 }, visible: true, locked: false, opacity: 1, props: entry.createDefaultProps() }); setSelectedIds([id]); refresh();
  };
  const createPreset = () => {
    const key = newKey.trim(); if (!/^[A-Za-z0-9_-]+$/.test(key) || stores.has(key)) { setMessage(stores.has(key) ? '这个预设 Key 已存在。' : '预设 Key 只能使用字母、数字、下划线和连字符。'); setIsError(true); return; }
    const next = createDialoguePreviewPreset(key, newName.trim() || key); const nextStore = new UiDocumentStore(next); subscribeStore(nextStore); setStores((current) => new Map(current).set(key, nextStore)); setActiveKey(key); setSelectedIds(next.rootIds[0] ? [next.rootIds[0]] : []); setMessage(`已创建“${next.name}”，保存全部后写入预设库。`); setIsError(false); refresh();
  };

  if (!store || !preset) return <main className="preview-empty"><h1>Dialogue Preview Canvas Lab</h1><p className={isError ? 'is-error' : ''}>{message}</p><button onClick={() => void load()}>重新加载</button></main>;
  const groups = new Map<string, UiPropertyField[]>();
  definition?.fields.forEach((field) => { const group = field.group ?? '属性'; groups.set(group, [...(groups.get(group) ?? []), field]); });
  const selectedResolved = selected ? resolveUiNode(preset, selected) : undefined; const selectedParentRect = selected ? getUiLayoutParentRect(preset, selected) : undefined;
  const margins = selectedResolved && selectedParentRect ? { left: selectedResolved.layout.x - selectedParentRect.x, right: selectedParentRect.x + selectedParentRect.width - selectedResolved.layout.x - selectedResolved.layout.width, top: selectedResolved.layout.y - selectedParentRect.y, bottom: selectedParentRect.y + selectedParentRect.height - selectedResolved.layout.y - selectedResolved.layout.height } : undefined;
  const treeIds = (ids: string[]) => ids.map((id, index) => ({ id, index })).sort((left, right) => (preset.nodes[right.id]?.layout.zIndex ?? 0) - (preset.nodes[left.id]?.layout.zIndex ?? 0) || left.index - right.index).map((entry) => entry.id);
  const hierarchyItems = Object.fromEntries(Object.values(preset.nodes).map((node): [string, EditorHierarchyItem] => {
    const entry = registry.get(node.type); const badges: EditorHierarchyItem['badges'] = [];
    if (!node.visible) badges.push('hidden'); if (node.locked) badges.push('locked'); if (node.bindings && Object.keys(node.bindings).length) badges.push('bound'); if (!entry) badges.push('warning');
    return [node.id, { id: node.id, label: node.name, typeLabel: node.type === 'group' ? 'Group' : entry?.label ?? '缺失', parentId: node.parentId, childIds: treeIds(node.childIds), icon: <UiNodeIcon group={node.type === 'group'} />, disabled: !node.visible, locked: node.locked, draggable: !node.locked, acceptsChildren: node.type === 'group', badges, searchText: node.type, title: `${node.name} · ${node.type}` }];
  }));
  return <div className="preview-lab">
    <header className="preview-header"><div><span className="eyebrow">GAME UI DOCUMENT V2 · DEFINITION DRIVEN</span><h1>Dialogue Preview Canvas Lab</h1></div><div className={`save-status${isError ? ' is-error' : ''}`}><i />{message}</div></header>
    <aside className="preview-sidebar">
      <ObjectHierarchy className="dialogue-hierarchy" eyebrow="UI OBJECTS" title="界面对象与关系" status={`${Object.keys(preset.nodes).length}`}
        items={hierarchyItems} rootIds={treeIds(preset.rootIds)} selectedIds={selectedIds} expandedIds={expandedUiIds} onExpandedChange={setExpandedUiIds}
        searchPlaceholder="搜索 UI 对象" onSelectionChange={changeSelection} onMove={moveHierarchyNodes} onClearSelection={() => setSelectedIds([])}
        footer={<><span>{Object.keys(preset.nodes).length} 个对象</span><span>拖拽重排 · Ctrl 多选</span></>}
      />
      <section className="panel"><div className="panel-heading"><span>界面预设</span><strong>{stores.size}</strong></div>
        <label className="select-field"><span>当前预设</span><select value={activeKey} onChange={(event) => { const key = event.target.value; const firstId = stores.get(key)?.getDocument().rootIds[0]; setActiveKey(key); setSelectedIds(firstId ? [firstId] : []); setViewport({ zoom: 1, panX: 0, panY: 0 }); }}>{[...stores].map(([key, item]) => <option key={key} value={key}>{item.getDocument().name}</option>)}</select></label>
        <label className="text-field"><span>预设名称</span><input value={preset.name} onChange={(event) => { store.mutate('重命名预设', (draft) => { draft.name = event.target.value; }); refresh(); }} /></label>
        <div className="new-preset"><input value={newKey} onChange={(event) => setNewKey(event.target.value)} aria-label="新预设 Key" /><input value={newName} onChange={(event) => setNewName(event.target.value)} aria-label="新预设名称" /><button onClick={createPreset}>创建新预设</button></div>
      </section>
      <section className="panel"><div className="panel-heading"><span>画布与安全区域</span><strong>{preset.canvas.width}×{preset.canvas.height}</strong></div><div className="control-grid">
        <NumberField label="画布宽" value={preset.canvas.width} min={320} onChange={(value) => { store.mutate('修改画布宽度', (draft) => { draft.canvas.width = Math.max(320, value); }); refresh(); }} />
        <NumberField label="画布高" value={preset.canvas.height} min={180} onChange={(value) => { store.mutate('修改画布高度', (draft) => { draft.canvas.height = Math.max(180, value); }); refresh(); }} />
        {(['top', 'right', 'bottom', 'left'] as const).map((side) => <NumberField key={side} label={{ top: '安全区上', right: '安全区右', bottom: '安全区下', left: '安全区左' }[side]} value={preset.canvas.safeArea?.[side] ?? 0} min={0} onChange={(value) => { store.mutate('修改安全区域', (draft) => { draft.canvas.safeArea ??= { top: 0, right: 0, bottom: 0, left: 0 }; draft.canvas.safeArea[side] = Math.max(0, value); }); refresh(); }} />)}
      </div></section>
      <section className="panel component-panel"><div className="panel-heading"><span>UI Definition</span><strong>{registry.list().length}</strong></div>
        <div className="add-row">{registry.list().map((entry) => <button key={entry.type} onClick={() => addNode(entry)}>＋{entry.label}</button>)}</div>
      </section>
    </aside>
    <main className="preview-stage"><div className="stage-toolbar"><div><strong>{preset.name}</strong><span>{preset.presetKey}</span>{dirty ? <em>● 未保存</em> : <em className="is-saved">✓ 已保存</em>}</div><div className="toolbar-actions">
      <button disabled={!store.canUndo} onClick={() => { store.undo(); refresh(); }}>撤销</button><button disabled={!store.canRedo} onClick={() => { store.redo(); refresh(); }}>重做</button><button className={editMode ? 'is-active' : ''} onClick={() => setEditMode(true)}>编辑模式</button><button className={!editMode ? 'is-active' : ''} onClick={() => setEditMode(false)}>纯预览</button><label><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} /> 网格</label><label><input type="checkbox" checked={snapToGrid} onChange={(event) => setSnapToGrid(event.target.checked)} /> 吸附</label><button className="save-button" disabled={saving} onClick={() => void save()}>{saving ? '保存中…' : '保存全部'}</button>
    </div></div>
      <div className="canvas-shell"><div className="viewport-toolbar"><button onClick={() => setViewport((current) => ({ ...current, zoom: clamp(current.zoom / 1.2, .25, 3) }))}>−</button><button onClick={() => setViewport({ zoom: 1, panX: 0, panY: 0 })}>{Math.round(viewport.zoom * 100)}%</button><button onClick={() => setViewport((current) => ({ ...current, zoom: clamp(current.zoom * 1.2, .25, 3) }))}>＋</button>{selectedIds.length > 1 ? <><i /><button onClick={groupSelection}>成组</button><button onClick={() => alignSelection('left')}>左</button><button onClick={() => alignSelection('center-x')}>水平中</button><button onClick={() => alignSelection('right')}>右</button><button onClick={() => alignSelection('top')}>顶</button><button onClick={() => alignSelection('center-y')}>垂直中</button><button onClick={() => alignSelection('bottom')}>底</button></> : null}{selected?.type === 'group' ? <><i /><button onClick={ungroupSelected}>取消 Group</button></> : null}</div><PreviewCanvas store={store} selectedIds={selectedIds} editMode={editMode} showGrid={showGrid} snapToGrid={snapToGrid} viewport={viewport} onViewportChange={setViewport} onSelectionChange={changeSelection} onChanged={refresh} /><div className="canvas-caption"><span>{editMode ? '拖动空白框选 · Ctrl/Shift 多选 · 树中拖拽重排/移入 Group' : '运行时同源 Canvas 预览'}</span><span>{selectedIds.length ? `已选择 ${selectedIds.length} 项 · ` : ''}{preset.canvas.width} × {preset.canvas.height}</span></div></div>
    </main>
    <InspectorPanel className="preview-inspector" eyebrow="INSPECTOR" title={selected ? definition?.label ?? selected.type : '对象属性'} status={selected ? (selected.locked ? '已锁定' : '可编辑') : undefined} footer={<><span>{selectedIds.length ? `已选择 ${selectedIds.length} 项` : '未选择对象'}</span><span>UI Document V2</span></>}>{selected ? <>
      <section className="panel inspector-title"><div><span>{definition?.label ?? '缺少 Definition'}</span><h2>{selected.name}</h2><code>{selected.id}</code></div><div className="tiny-actions"><button onClick={() => updateNode('切换可见性', (node) => { node.visible = !node.visible; })}>{selected.visible ? '隐藏' : '显示'}</button><button onClick={() => updateNode('切换锁定', (node) => { node.locked = !node.locked; })}>{selected.locked ? '解锁' : '锁定'}</button></div></section>
      {!definition ? <section className="panel"><h3>缺少组件定义</h3><p>类型 <code>{selected.type}</code> 当前未注册。原始参数会被保留，仍可移动或删除此节点。</p></section> : null}
      <section className="panel"><div className="panel-heading"><span>Rect Transform</span><button onClick={() => { store.mutate('切换布局模式', (draft) => { const node = draft.nodes[selected.id]; if (!node) return; if (node.layout.mode === 'absolute') convertUiNodeToRectTransform(draft, node); else convertUiNodeToAbsolute(draft, node); }); refresh(); }}>{selected.layout.mode === 'absolute' ? '启用锚点' : '转绝对布局'}</button></div>
        {selected.layout.mode === 'absolute' ? <div className="control-grid"><NumberField label="X" value={selected.layout.x} onChange={(value) => updateNode('修改 X', (node) => { if (node.layout.mode === 'absolute') node.layout.x = value; })} /><NumberField label="Y" value={selected.layout.y} onChange={(value) => updateNode('修改 Y', (node) => { if (node.layout.mode === 'absolute') node.layout.y = value; })} /><NumberField label="宽度" value={selected.layout.width} min={8} onChange={(value) => updateNode('修改宽度', (node) => { if (node.layout.mode === 'absolute') node.layout.width = Math.max(8, value); })} /><NumberField label="高度" value={selected.layout.height} min={8} onChange={(value) => updateNode('修改高度', (node) => { if (node.layout.mode === 'absolute') node.layout.height = Math.max(8, value); })} /></div> : <>
          <div className="anchor-presets">{anchorPresets.map(([label, minX, minY, maxX, maxY]) => <button key={label} title={label} onClick={() => { store.mutate(`锚点预设：${label}`, (draft) => { const node = draft.nodes[selected.id]; if (node) applyUiAnchorPreset(draft, node, { x: minX, y: minY }, { x: maxX, y: maxY }); }); refresh(); }}>{label}</button>)}</div>
          <label className="select-field"><span>根节点参考区域</span><select disabled={Boolean(selected.parentId)} value={selected.layout.relativeTo} onChange={(event) => updateNode('修改参考区域', (node) => { if (node.layout.mode === 'rect-transform') { const world = resolveUiNode(preset, node)?.layout; node.layout.relativeTo = event.target.value === 'safe-area' ? 'safe-area' : 'parent'; if (world) setUiNodeWorldRect(preset, node, world); } })}><option value="parent">画布 / 父节点</option><option value="safe-area">安全区域</option></select></label>
          <div className="control-grid"><NumberField label="位置 X" value={selected.layout.anchoredPosition.x} onChange={(value) => updateNode('修改锚点位置 X', (node) => { if (node.layout.mode === 'rect-transform') node.layout.anchoredPosition.x = value; })} /><NumberField label="位置 Y" value={selected.layout.anchoredPosition.y} onChange={(value) => updateNode('修改锚点位置 Y', (node) => { if (node.layout.mode === 'rect-transform') node.layout.anchoredPosition.y = value; })} /><NumberField label="尺寸 ΔX" value={selected.layout.sizeDelta.x} onChange={(value) => updateNode('修改尺寸 X', (node) => { if (node.layout.mode === 'rect-transform') node.layout.sizeDelta.x = value; })} /><NumberField label="尺寸 ΔY" value={selected.layout.sizeDelta.y} onChange={(value) => updateNode('修改尺寸 Y', (node) => { if (node.layout.mode === 'rect-transform') node.layout.sizeDelta.y = value; })} /><NumberField label="Pivot X" value={selected.layout.pivot.x} min={0} max={1} step={.05} onChange={(value) => updateNode('修改 Pivot X', (node) => { if (node.layout.mode === 'rect-transform') node.layout.pivot.x = clamp(value, 0, 1); })} /><NumberField label="Pivot Y" value={selected.layout.pivot.y} min={0} max={1} step={.05} onChange={(value) => updateNode('修改 Pivot Y', (node) => { if (node.layout.mode === 'rect-transform') node.layout.pivot.y = clamp(value, 0, 1); })} /></div>
          {margins && (selected.layout.anchorMin.x !== selected.layout.anchorMax.x || selected.layout.anchorMin.y !== selected.layout.anchorMax.y) ? <><h3 className="subheading">拉伸边距</h3><div className="control-grid">{selected.layout.anchorMin.x !== selected.layout.anchorMax.x ? <><NumberField label="左" value={Math.round(margins.left)} onChange={(value) => updateMargin('left', value)} /><NumberField label="右" value={Math.round(margins.right)} onChange={(value) => updateMargin('right', value)} /></> : null}{selected.layout.anchorMin.y !== selected.layout.anchorMax.y ? <><NumberField label="上" value={Math.round(margins.top)} onChange={(value) => updateMargin('top', value)} /><NumberField label="下" value={Math.round(margins.bottom)} onChange={(value) => updateMargin('bottom', value)} /></> : null}</div></> : null}
        </>}
        <div className="control-grid"><NumberField label="层级" value={selected.layout.zIndex} onChange={(value) => updateNode('修改层级', (node) => { node.layout.zIndex = value; })} /><NumberField label="透明度" value={selected.opacity} min={0} max={1} step={.05} onChange={(value) => updateNode('修改透明度', (node) => { node.opacity = clamp(value, 0, 1); })} /></div>
      </section>
      <section className="panel"><h3>节点</h3><label className="text-field"><span>节点名称</span><input value={selected.name} onChange={(event) => updateNode('重命名节点', (node) => { node.name = event.target.value; })} /></label><label className="text-field"><span>Definition Type</span><input value={selected.type} readOnly /></label><label className="text-field"><span>父节点</span><input value={selected.parentId ? preset.nodes[selected.parentId]?.name ?? selected.parentId : 'Root'} readOnly /></label></section>
      {[...groups].map(([group, fields]) => <section className="panel" key={group}><h3>{group}</h3><div className={fields.every((field) => field.control === 'color') ? 'color-grid' : 'control-grid'}>{fields.map((field) => <PropertyControl key={field.path} field={field} node={selected} update={(value) => updateNode(`修改 ${field.label}`, (node) => setProp(node, field.path, value))} />)}</div></section>)}
      <section className="panel danger-row"><button onClick={() => {
        const copy = structuredClone(selected); let index = 1; let id = `${selected.id}-copy`; while (preset.nodes[id]) id = `${selected.id}-copy-${++index}`; copy.id = id; copy.name = `${selected.name} 副本`; copy.parentId = null; copy.childIds = []; if (copy.layout.mode === 'absolute') { copy.layout.x += 24; copy.layout.y += 24; } else { copy.layout.anchoredPosition.x += 24; copy.layout.anchoredPosition.y += 24; } copy.layout.zIndex += 1; store.addNode(copy); setSelectedIds([id]); refresh();
      }}>复制节点</button><button className="danger" onClick={() => { store.removeNode(selected.id); setSelectedIds((current) => current.filter((id) => id !== selected.id)); refresh(); }}>删除节点</button></section>
    </> : <section className="panel empty-inspector"><strong>未选择节点</strong><p>进入编辑模式后点击 Canvas 节点，或从左侧层级列表选择。</p></section>}</InspectorPanel>
  </div>;
};
