import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { getUiSafeAreaRect, listUiNodesInPaintOrder, resolveUiNode, setUiNodeWorldRect, type UiDocument, type UiDocumentStore, type UiResolvedNode } from '@/core/ui-document';
import type { UiDefinitionRegistry } from '@/core/ui-document/uiDefinition.registry';
import { UiDocumentView } from '@/core/ui-document/UiDocumentView';
import './ui-react-editor.css';

type Rect = { x: number; y: number; width: number; height: number };
type Handle = 'nw' | 'ne' | 'sw' | 'se';
type Interaction =
  | { mode: 'pan'; x: number; y: number; panX: number; panY: number }
  | { mode: 'move'; pointer: { x: number; y: number }; starts: Map<string, Rect> }
  | { mode: 'resize'; id: string; handle: Handle; pointer: { x: number; y: number }; rect: Rect }
  | { mode: 'box'; start: { x: number; y: number }; current: { x: number; y: number }; toggle: boolean };
type Viewport = { zoom: number; panX: number; panY: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** One mounted React document, with a DOM editing layer. Preview only releases event interception. */
export function UiReactEditor({ store, document, registry, selectedIds, editMode, showGrid, showReferenceFrame = true, snapToGrid, viewport, runtimeContext, onViewportChange, onSelectionChange, onChanged, onAction }: {
  store: UiDocumentStore; document: UiDocument; registry: UiDefinitionRegistry; selectedIds: string[];
  editMode: boolean; showGrid: boolean; showReferenceFrame?: boolean; snapToGrid: boolean; viewport: Viewport; runtimeContext?: Record<string, unknown>;
  onViewportChange(viewport: Viewport): void; onSelectionChange(ids: string[], mode?: 'replace' | 'toggle'): void; onChanged(): void; onAction(action: string): void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  const interaction = useRef<Interaction | null>(null);
  const space = useRef(false);
  const [box, setBox] = useState<Rect | null>(null);
  const primaryId = selectedIds.at(-1);
  const effectiveDocument = runtimeContext ? { ...document, previewContext: { ...document.previewContext, ...runtimeContext } } : document;
  const safe = getUiSafeAreaRect(document);
  const finish = (cancel = false) => {
    const current = interaction.current; interaction.current = null;
    if (!current) return;
    if (current.mode === 'move' || current.mode === 'resize') {
      if (cancel) store.rollbackTransaction(); else store.commitTransaction(); onChanged();
    }
    if (current.mode === 'box' && !cancel) {
      const left = Math.min(current.start.x, current.current.x); const top = Math.min(current.start.y, current.current.y);
      const right = Math.max(current.start.x, current.current.x); const bottom = Math.max(current.start.y, current.current.y);
      const ids = listUiNodesInPaintOrder(store.getDocument()).filter(node => node.visible && !node.locked && node.type !== 'group' && node.layout.x < right && node.layout.x + node.layout.width > left && node.layout.y < bottom && node.layout.y + node.layout.height > top).map(node => node.id);
      onSelectionChange(ids, current.toggle ? 'toggle' : 'replace');
    }
    setBox(null);
  };
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || (event.target instanceof HTMLElement && event.target.isContentEditable) || window.document.querySelector('dialog[open]')) return;
      if (event.code === 'Space') { space.current = true; if (root.current?.contains(window.document.activeElement)) event.preventDefault(); }
      if (event.key === 'Escape' && interaction.current) { interaction.current = null; if (store.inTransaction) store.rollbackTransaction(); setBox(null); }
    };
    const up = (event: KeyboardEvent) => { if (event.code === 'Space') space.current = false; };
    const blur = () => { space.current = false; interaction.current = null; if (store.inTransaction) store.rollbackTransaction(); setBox(null); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); if (store.inTransaction) store.rollbackTransaction(); };
  }, [store]);
  const point = (event: PointerEvent<HTMLDivElement>) => {
    const rect = plane.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / viewport.zoom, y: (event.clientY - rect.top) / viewport.zoom };
  };
  const capture = (event: PointerEvent<HTMLDivElement>) => { event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus({ preventScroll: true }); };
  const gridPitch = document.canvas.gridSize * viewport.zoom;
  const gridOrigin = `calc(50% + ${viewport.panX - document.canvas.width * viewport.zoom / 2 + gridPitch / 2}px) calc(50% + ${viewport.panY - document.canvas.height * viewport.zoom / 2 + gridPitch / 2}px)`;
  return <div ref={root} className={`ui-react-workspace${editMode ? ' is-editing' : ''}`} tabIndex={0} aria-label="React UI 布局工作区"
    style={{
      backgroundImage: editMode && showGrid ? `linear-gradient(to right, #7dd3fc16 1px, transparent 1px), linear-gradient(to bottom, #7dd3fc16 1px, transparent 1px), linear-gradient(${document.canvas.backgroundTop}, ${document.canvas.backgroundBottom})` : `linear-gradient(${document.canvas.backgroundTop}, ${document.canvas.backgroundBottom})`,
      backgroundSize: editMode && showGrid ? `${gridPitch}px ${gridPitch}px, ${gridPitch}px ${gridPitch}px, 100% 100%` : '100% 100%',
      backgroundPosition: editMode && showGrid ? `${gridOrigin}, ${gridOrigin}, 0 0` : undefined,
    }}
    onClickCapture={event => { if (editMode) { event.preventDefault(); event.stopPropagation(); } }}
    onDoubleClickCapture={event => { if (editMode) { event.preventDefault(); event.stopPropagation(); } }}
    onWheel={event => {
      if (!editMode) return; event.preventDefault();
      const zoom = clamp(viewport.zoom * (event.deltaY < 0 ? 1.1 : .9), .1, 3);
      const rect = plane.current!.getBoundingClientRect();
      const relativeX = event.clientX - rect.left - rect.width / 2; const relativeY = event.clientY - rect.top - rect.height / 2;
      onViewportChange({ zoom, panX: viewport.panX + relativeX * (1 - zoom / viewport.zoom), panY: viewport.panY + relativeY * (1 - zoom / viewport.zoom) });
    }}
    onPointerDownCapture={event => {
      if (event.button === 1 || (editMode && event.button === 0 && space.current)) {
        interaction.current = { mode: 'pan', x: event.clientX, y: event.clientY, panX: viewport.panX, panY: viewport.panY }; capture(event); return;
      }
      if (!editMode || event.button !== 0 || interaction.current) return;
      const p = point(event); const element = event.target instanceof Element ? event.target : null;
      const handle = element?.closest<HTMLElement>('[data-ui-resize]');
      if (handle) {
        const id = handle.dataset.uiResize!; const node = resolveUiNode(document, id);
        if (!node || node.locked) return;
        store.beginTransaction('调整 React UI 尺寸'); interaction.current = { mode: 'resize', id, handle: handle.dataset.handle as Handle, pointer: p, rect: { ...node.layout } }; capture(event); return;
      }
      // Actual DOM ancestry is the picking source; component-private elements stay inside their node.
      const id = element?.closest<HTMLElement>('[data-ui-node]')?.dataset.uiNode;
      const node = id ? resolveUiNode(document, id) : undefined;
      const toggle = event.ctrlKey || event.metaKey || event.shiftKey;
      if (!node) {
        if (!toggle) onSelectionChange([]);
        interaction.current = { mode: 'box', start: p, current: p, toggle }; setBox({ ...p, width: 0, height: 0 }); capture(event); return;
      }
      if (toggle) { onSelectionChange([node.id], 'toggle'); event.preventDefault(); event.stopPropagation(); return; }
      const ids = selectedIds.includes(node.id) ? selectedIds : [node.id]; if (!selectedIds.includes(node.id)) onSelectionChange(ids);
      const selected = new Set(ids);
      const movable = ids.map(id => resolveUiNode(document, id)).filter((item): item is UiResolvedNode => {
        if (!item || item.locked) return false;
        for (let parent = item.parentId; parent; parent = document.nodes[parent]?.parentId ?? null) if (selected.has(parent)) return false;
        return true;
      });
      if (!movable.length) { event.preventDefault(); event.stopPropagation(); return; }
      store.beginTransaction('移动 React UI'); interaction.current = { mode: 'move', pointer: p, starts: new Map(movable.map(item => [item.id, { ...item.layout }])) }; capture(event);
    }}
    onPointerMoveCapture={event => {
      const current = interaction.current; if (!current) return;
      if (current.mode === 'pan') { onViewportChange({ ...viewport, panX: current.panX + event.clientX - current.x, panY: current.panY + event.clientY - current.y }); return; }
      const p = point(event);
      if (current.mode === 'box') { current.current = p; setBox({ x: Math.min(current.start.x, p.x), y: Math.min(current.start.y, p.y), width: Math.abs(current.start.x - p.x), height: Math.abs(current.start.y - p.y) }); return; }
      const snap = (value: number) => snapToGrid ? Math.round(value / document.canvas.gridSize) * document.canvas.gridSize : value;
      if (current.mode === 'resize') {
        const rect = current.rect; const west = current.handle.includes('w'); const north = current.handle.includes('n');
        const dx = p.x - current.pointer.x; const dy = p.y - current.pointer.y;
        const left = west ? Math.min(rect.x + rect.width - 8, snap(rect.x + dx)) : rect.x;
        const top = north ? Math.min(rect.y + rect.height - 8, snap(rect.y + dy)) : rect.y;
        const right = west ? rect.x + rect.width : Math.max(left + 8, snap(rect.x + rect.width + dx));
        const bottom = north ? rect.y + rect.height : Math.max(top + 8, snap(rect.y + rect.height + dy));
        store.mutate('调整 React UI 尺寸', draft => { const node = draft.nodes[current.id]; if (node) setUiNodeWorldRect(draft, node, { x: left, y: top, width: right - left, height: bottom - top }); }); onChanged(); return;
      }
      const dx = snap(p.x - current.pointer.x); const dy = snap(p.y - current.pointer.y);
      store.mutate('移动 React UI', draft => current.starts.forEach((start, id) => { const node = draft.nodes[id]; if (node) setUiNodeWorldRect(draft, node, { ...start, x: start.x + dx, y: start.y + dy }); })); onChanged();
    }}
    onPointerUpCapture={event => { if (!interaction.current) return; finish(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
    onPointerCancelCapture={() => finish(true)}
    onLostPointerCapture={() => { if (interaction.current) finish(true); }}>
    <div ref={plane} className="ui-react-editor" data-ui-editor-mode={editMode ? 'edit' : 'preview'} style={{ width: document.canvas.width, height: document.canvas.height, transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})` }}>
    <UiDocumentView document={effectiveDocument} registry={registry} mode={editMode ? 'edit' : 'preview'} onAction={onAction} style={{ overflow: 'visible', background: 'transparent' }} />
    {showReferenceFrame && <div className="ui-player-reference" data-ui-reference-frame aria-label={`玩家可视区域 ${document.canvas.width} × ${document.canvas.height}`} style={{ width: document.canvas.width, height: document.canvas.height, borderWidth: 2 / viewport.zoom }}>
      <span style={{ fontSize: 11 / viewport.zoom, top: -25 / viewport.zoom, left: 5 / viewport.zoom }}>玩家可视区域 · {document.canvas.width} × {document.canvas.height}</span>
    </div>}
    {editMode && <div className="ui-edit-overlay" aria-hidden="true">
      <div className="ui-edit-safe-area" style={{ left: safe.x, top: safe.y, width: safe.width, height: safe.height }} />
      {selectedIds.map(id => resolveUiNode(document, id)).filter((node): node is UiResolvedNode => Boolean(node?.visible)).map(node => <div key={node.id} data-ui-selection={node.id} className={`ui-edit-selection${node.id === primaryId ? ' primary' : ''}`} style={{ left: node.layout.x, top: node.layout.y, width: node.layout.width, height: node.layout.height, borderWidth: 1 / viewport.zoom }}>
        {selectedIds.length === 1 && !node.locked && (['nw', 'ne', 'sw', 'se'] as const).map(handle => <div key={handle} data-ui-resize={node.id} data-handle={handle} className={`ui-edit-handle ${handle}`} style={{ width: 8 / viewport.zoom, height: 8 / viewport.zoom }} />)}
      </div>)}
      {box && <div className="ui-edit-box" style={{ left: box.x, top: box.y, width: box.width, height: box.height }} />}
    </div>}
    </div>
  </div>;
}
