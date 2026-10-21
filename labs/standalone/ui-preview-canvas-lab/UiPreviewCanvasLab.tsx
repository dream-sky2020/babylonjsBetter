import { createEquipmentPreview, equipmentPreviewContext, runEquipmentPreview } from './equipmentPreview.ts';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createDialoguePreviewPreset,
  loadDialoguePreviewPresetLibrary,
  saveDialoguePreviewPresetLibrary,
  type DialoguePreviewPresetLibrary,
} from '@/core/dialogue-preview';
import { applyUiAnchorPreset, convertUiNodeToAbsolute, convertUiNodeToRectTransform, getUiLayoutParentRect, resolveUiNode, setUiNodeWorldRect, UiDocumentStore, type UiDefinition, type UiNode, type UiPropertyField, type UiResolvedNode } from '@/core/ui-document';
import { canReparentUiNode, reparentUiNode, duplicateUiSubtree } from '@/core/ui-document';
import { createReactUiDefinitionRegistry } from '@/core/ui-document/react/uiReactDefinitions';
import { UiReactEditor } from './UiReactEditor';
import { InspectorPanel, InspectorSection, ObjectHierarchy, type EditorHierarchyDropIntent, type EditorHierarchyItem } from '@/core/ui/editor-kit';
import { UiPreviewWorkbench } from './UiPreviewWorkbench';
import { readUiPreviewWorkspace, type UiPreviewWorkspace } from './uiPreviewWorkspace';
import './ui-preview-canvas-lab.css';

const registry = createReactUiDefinitionRegistry();
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const anchorPresets = [
  ['左上', 0, 0, 0, 0], ['上中', .5, 0, .5, 0], ['右上', 1, 0, 1, 0],
  ['左中', 0, .5, 0, .5], ['中心', .5, .5, .5, .5], ['右中', 1, .5, 1, .5],
  ['左下', 0, 1, 0, 1], ['下中', .5, 1, .5, 1], ['右下', 1, 1, 1, 1],
  ['横向拉伸', 0, .5, 1, .5], ['纵向拉伸', .5, 0, .5, 1], ['全拉伸', 0, 0, 1, 1],
] as const;

const UiNodeIcon = ({ group }: { group: boolean }) => <svg viewBox="0 0 24 24" aria-hidden="true">{group ? <><path d="M4 6h6l2 2h8v10H4z" /><path d="M8 12h8M12 9v6" /></> : <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 8h8v8H8z" /></>}</svg>;

const selectionBounds = (nodes: UiResolvedNode[]) => {
  const left = Math.min(...nodes.map((node) => node.layout.x)); const top = Math.min(...nodes.map((node) => node.layout.y));
  const right = Math.max(...nodes.map((node) => node.layout.x + node.layout.width)); const bottom = Math.max(...nodes.map((node) => node.layout.y + node.layout.height));
  return { left, top, right, bottom, centerX: (left + right) / 2, centerY: (top + bottom) / 2 };
};

const NumberField = ({ label, value, min, max, step = 1, onChange }: { label: string; value: number | string; min?: number; max?: number; step?: number; onChange(value: number): void }) => <label className="control-field"><span>{label}</span><input type="number" value={value} min={min} max={max} step={step} onChange={(event) => { if (event.target.value !== '' && Number.isFinite(event.target.valueAsNumber)) onChange(event.target.valueAsNumber); }} /></label>;
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

export const UiPreviewCanvasLab: React.FC = () => {
  const [workspace, setWorkspace] = useState<UiPreviewWorkspace>(() => readUiPreviewWorkspace(localStorage, window.innerWidth));
  const [componentQuery, setComponentQuery] = useState('');
  const canvasShellRef = useRef<HTMLDivElement>(null);
  const [autoFit, setAutoFit] = useState(true);
  const [equipment, setEquipment] = useState(createEquipmentPreview);
  const [stores, setStores] = useState(() => new Map<string, UiDocumentStore>()); const unsubscribersRef = useRef<(() => void)[]>([]);
  const [revision, setRevision] = useState(0); const [activeKey, setActiveKey] = useState(''); const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState('正在载入界面预设…'); const [isError, setIsError] = useState(false); const [saving, setSaving] = useState(false);
  const [keepWorldPosition, setKeepWorldPosition] = useState(true);
  const [addToSelection, setAddToSelection] = useState(true);
  const [editMode, setEditMode] = useState(true); const [showGrid, setShowGrid] = useState(true); const [snapToGrid, setSnapToGrid] = useState(false);
  const [viewport, setViewport] = useState({ zoom: new URLSearchParams(window.location.search).get('preset') === 'equipment_ui' ? .65 : 1, panX: 0, panY: 0 });
  const [expandedUiIds, setExpandedUiIds] = useState<Set<string>>(() => new Set());
  const [newKey, setNewKey] = useState('dialogue_ui_copy'); const [newName, setNewName] = useState('对话界面副本');
  const selectedId = selectedIds.at(-1) ?? ''; const store = stores.get(activeKey);
  // The store is mutable; explicitly invalidate snapshots so React Compiler cannot reuse stale reads.
  const preset = useMemo(() => { void revision; return store?.getDocument(); }, [store, revision]);
  const history = useMemo(() => { void revision; return { canUndo: store?.canUndo ?? false, canRedo: store?.canRedo ?? false }; }, [store, revision]);
  const selected = preset?.nodes[selectedId]; const definition = selected ? registry.get(selected.type) : undefined;
  const runtimeContext = useMemo(() => preset?.metadata?.runtime === 'equipment-preview' ? equipmentPreviewContext(equipment) : undefined, [equipment, preset?.metadata?.runtime]);
  const canvasWidth = preset?.canvas.width; const canvasHeight = preset?.canvas.height; const canvasKey = preset?.presetKey;
  useEffect(() => {
    const shell = canvasShellRef.current; if (!shell || !canvasWidth || !canvasHeight || !autoFit) return;
    const fit = () => setViewport({ zoom: clamp(Math.min((shell.clientWidth - 120) / canvasWidth, (shell.clientHeight - 140) / canvasHeight, 1), .1, 3), panX: 0, panY: 0 });
    const observer = new ResizeObserver(fit); observer.observe(shell); return () => observer.disconnect();
  }, [autoFit, canvasWidth, canvasHeight, canvasKey]);
  const dirty = useMemo(() => { void revision; return [...stores.values()].some((item) => item.dirty); }, [revision, stores]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const subscribeStore = useCallback((nextStore: UiDocumentStore) => { unsubscribersRef.current.push(nextStore.subscribe(refresh)); }, [refresh]);
  const currentLibrary = (): DialoguePreviewPresetLibrary => Object.fromEntries([...stores].map(([key, item]) => [key, item.getDocument()]));

  const load = useCallback(async () => {
    try {
      const library = await loadDialoguePreviewPresetLibrary(); unsubscribersRef.current.forEach((unsubscribe) => unsubscribe()); unsubscribersRef.current = [];
      const nextStores = new Map(Object.entries(library).map(([key, document]) => [key, new UiDocumentStore(document)] as const)); nextStores.forEach(subscribeStore); setStores(nextStores);
      const requested = new URLSearchParams(window.location.search).get('preset'); const key = requested && library[requested] ? requested : Object.keys(library)[0] ?? ''; setActiveKey(key); setSelectedIds(library[key]?.rootIds[0] ? [library[key].rootIds[0]] : []); setMessage(`已载入 ${Object.keys(library).length} 个界面预设。`); setIsError(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); setIsError(true); }
  }, [subscribeStore]);
  // Initial async repository hydration is the intended external synchronization for this Lab.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); return () => unsubscribersRef.current.forEach((unsubscribe) => unsubscribe()); }, [load]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]') || !(event.ctrlKey || event.metaKey) || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
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
    const resolved = topLevelIds.map((id) => resolveUiNode(document, id)).filter((node): node is UiResolvedNode => Boolean(node)); if (resolved.length < 2 || resolved.some(node => node.locked)) return;
    const commonParentId = document.nodes[topLevelIds[0]].parentId;
    const parentId = topLevelIds.every(id => document.nodes[id].parentId === commonParentId) ? commonParentId : null;
    const parentRect = parentId ? resolveUiNode(document, parentId)?.layout : undefined;
    const bounds = selectionBounds(resolved); let index = 1; while (document.nodes[`group-${index}`]) index += 1; const id = `group-${index}`;
    store.mutate('创建 Group', (draft) => {
      topLevelIds.forEach((nodeId) => { const node = draft.nodes[nodeId]; if (!node) return; if (node.parentId) { const parent = draft.nodes[node.parentId]; if (parent) parent.childIds = parent.childIds.filter((childId) => childId !== nodeId); } else draft.rootIds = draft.rootIds.filter((rootId) => rootId !== nodeId); });
      draft.nodes[id] = { id, type: 'group', definitionVersion: 1, name: `Group ${index}`, parentId, childIds: [...topLevelIds], layout: { mode: 'absolute', x: Math.round(bounds.left - (parentRect?.x ?? 0)), y: Math.round(bounds.top - (parentRect?.y ?? 0)), width: Math.max(8, Math.round(bounds.right - bounds.left)), height: Math.max(8, Math.round(bounds.bottom - bounds.top)), zIndex: Math.min(...resolved.map((node) => node.layout.zIndex)) }, visible: true, locked: false, opacity: 1, props: {} };
      (parentId ? draft.nodes[parentId].childIds : draft.rootIds).push(id); topLevelIds.forEach((nodeId) => { const node = draft.nodes[nodeId]; const world = resolved.find((item) => item.id === nodeId); if (node && world) { node.parentId = id; setUiNodeWorldRect(draft, node, world.layout); } });
    }); setSelectedIds([id]); refresh();
  };
  const ungroupSelected = () => {
    if (!store || selected?.type !== 'group') return; const document = store.getDocument(); const group = document.nodes[selected.id]; const groupWorld = resolveUiNode(document, group); if (!group || !groupWorld) return; const childIds = [...group.childIds]; const worlds = new Map(childIds.map((id) => [id, resolveUiNode(document, id)?.layout]));
    store.mutate('取消 Group', (draft) => {
      const current = draft.nodes[group.id]; if (!current) return; if (current.parentId) { const parent = draft.nodes[current.parentId]; if (parent) parent.childIds = parent.childIds.flatMap((id) => id === current.id ? childIds : [id]); } else draft.rootIds = draft.rootIds.flatMap((id) => id === current.id ? childIds : [id]);
      childIds.forEach((childId) => { const child = draft.nodes[childId]; const world = worlds.get(childId); if (child && world) { child.parentId = current.parentId; setUiNodeWorldRect(draft, child, world); } }); delete draft.nodes[current.id];
    }); setSelectedIds(childIds); refresh();
  };
  const moveHierarchyNodes = (intent: EditorHierarchyDropIntent) => {
    if (!store) return; const document = store.getDocument(); const selectedSet = new Set(intent.sourceIds);
    const movingIds = intent.sourceIds.filter((id) => {
      const node = document.nodes[id]; if (!node || resolveUiNode(document, node)?.locked) return false;
      let parentId = node.parentId; while (parentId) { if (selectedSet.has(parentId)) return false; parentId = document.nodes[parentId]?.parentId ?? null; } return true;
    });
    if (!movingIds.length || !movingIds.every(id => canReparentUiNode(document, id, intent.parentId))) return;
    const displayIds = (ids: string[]) => ids.map((id, index) => ({ id, index })).sort((left, right) => (document.nodes[right.id]?.layout.zIndex ?? 0) - (document.nodes[left.id]?.layout.zIndex ?? 0) || left.index - right.index).map(entry => entry.id);
    const displayOrder: string[] = []; const visit = (ids: string[]) => displayIds(ids).forEach((id) => { displayOrder.push(id); visit(document.nodes[id]?.childIds ?? []); }); visit(document.rootIds);
    const order = new Map(displayOrder.map((id, index) => [id, index])); movingIds.sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
    const worlds = new Map(movingIds.map((id) => [id, resolveUiNode(document, id)?.layout]));
    const label = intent.placement === 'inside' ? '移入父节点' : intent.placement === 'root-end' ? '移至根层级' : '重排 UI 节点';
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
    }); if (intent.parentId) setExpandedUiIds(current => new Set([...current, intent.parentId!])); setSelectedIds(movingIds); refresh();
  };
  const save = async () => { setSaving(true); try { await saveDialoguePreviewPresetLibrary(currentLibrary()); stores.forEach((item) => item.markSaved()); setMessage(`已保存 ${stores.size} 个 V2 界面预设。`); setIsError(false); refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); setIsError(true); } finally { setSaving(false); } };
  const addNode = (entry: UiDefinition) => {
    if (!store || !preset) return; const ids = new Set(Object.keys(preset.nodes)); let index = 1; while (ids.has(`${entry.type}-${index}`)) index += 1; const id = `${entry.type}-${index}`;
    const parentId = addToSelection && selected && !resolveUiNode(preset, selected)?.locked ? selected.id : null;
    store.addNode({ id, type: entry.type, definitionVersion: entry.version, name: `${entry.label} ${index}`, parentId, childIds: [], layout: { mode: 'rect-transform', anchorMin: { x: .5, y: .5 }, anchorMax: { x: .5, y: .5 }, pivot: { x: .5, y: .5 }, anchoredPosition: { x: 0, y: 0 }, sizeDelta: { x: entry.defaultSize.width, y: entry.defaultSize.height }, relativeTo: 'parent', zIndex: Math.max(-1, ...(parentId ? preset.nodes[parentId].childIds : preset.rootIds).map(sibling => preset.nodes[sibling].layout.zIndex)) + 1 }, visible: true, locked: false, opacity: 1, props: entry.createDefaultProps() });
    if (parentId) setExpandedUiIds(current => new Set([...current, parentId]));
    setSelectedIds([id]); refresh();
  };
  const createPreset = () => {
    const key = newKey.trim(); if (!/^[A-Za-z0-9_-]+$/.test(key) || stores.has(key)) { setMessage(stores.has(key) ? '这个预设 Key 已存在。' : '预设 Key 只能使用字母、数字、下划线和连字符。'); setIsError(true); return; }
    const next = createDialoguePreviewPreset(key, newName.trim() || key); const nextStore = new UiDocumentStore(next); subscribeStore(nextStore); setStores((current) => new Map(current).set(key, nextStore)); setActiveKey(key); setSelectedIds(next.rootIds[0] ? [next.rootIds[0]] : []); setMessage(`已创建“${next.name}”，保存全部后写入预设库。`); setIsError(false); refresh();
  };

  if (!store || !preset) return <main className="preview-empty"><h1>React UI Layout Lab</h1><p className={isError ? 'is-error' : ''}>{message}</p><button onClick={() => void load()}>重新加载</button></main>;
  const groups = new Map<string, UiPropertyField[]>();
  definition?.fields.forEach((field) => { const group = field.group ?? '属性'; groups.set(group, [...(groups.get(group) ?? []), field]); });
  const selectedResolved = selected ? resolveUiNode(preset, selected) : undefined; const selectedParentRect = selected ? getUiLayoutParentRect(preset, selected) : undefined;
  const margins = selectedResolved && selectedParentRect ? { left: selectedResolved.layout.x - selectedParentRect.x, right: selectedParentRect.x + selectedParentRect.width - selectedResolved.layout.x - selectedResolved.layout.width, top: selectedResolved.layout.y - selectedParentRect.y, bottom: selectedParentRect.y + selectedParentRect.height - selectedResolved.layout.y - selectedResolved.layout.height } : undefined;
  const treeIds = (ids: string[]) => ids.map((id, index) => ({ id, index })).sort((left, right) => (preset.nodes[right.id]?.layout.zIndex ?? 0) - (preset.nodes[left.id]?.layout.zIndex ?? 0) || left.index - right.index).map((entry) => entry.id);
  const hierarchyItems = Object.fromEntries(Object.values(preset.nodes).map((node): [string, EditorHierarchyItem] => {
    const entry = registry.get(node.type); const badges: EditorHierarchyItem['badges'] = [];
    if (!node.visible) badges.push('hidden'); if (node.locked) badges.push('locked'); if (node.bindings && Object.keys(node.bindings).length) badges.push('bound'); if (!entry) badges.push('warning');
    return [node.id, { id: node.id, label: node.name, typeLabel: node.type === 'group' ? 'Group' : entry?.label ?? '缺失', parentId: node.parentId, childIds: treeIds(node.childIds), icon: <UiNodeIcon group={node.type === 'group'} />, disabled: !resolveUiNode(preset, node)?.visible, locked: Boolean(resolveUiNode(preset, node)?.locked), draggable: !resolveUiNode(preset, node)?.locked, acceptsChildren: !resolveUiNode(preset, node)?.locked, badges, searchText: node.type, title: `${node.name} · ${node.type}` }];
  }));
  const sectionProps = (id: string, defaultOpen: boolean) => ({
    id: `ui-inspector-${id}`, open: workspace.sections[id] ?? defaultOpen,
    onOpenChange: (open: boolean) => setWorkspace(current => ({ ...current, sections: { ...current.sections, [id]: open } })),
  });
  const chosenNodes = selectedIds.map(id => preset.nodes[id]).filter((node): node is UiNode => Boolean(node));
  const commonOpacity = chosenNodes.length && chosenNodes.every(node => node.opacity === chosenNodes[0].opacity) ? chosenNodes[0].opacity : '';
  const patchSelection = (mutation: (node: UiNode) => void) => { store.mutate('修改选区共同属性', draft => { chosenNodes.forEach(node => { if (!resolveUiNode(draft, node.id)?.locked) mutation(draft.nodes[node.id]); }); }); refresh(); };
  const locateSelected = () => {
    setWorkspace(current => ({ ...current, leftOpen: true, tab: 'objects', ...(window.innerWidth < 1050 ? { rightOpen: false } : {}) }));
    const ancestors = new Set(expandedUiIds); selectedIds.forEach(id => { let parent = preset.nodes[id]?.parentId; while (parent) { ancestors.add(parent); parent = preset.nodes[parent]?.parentId; } }); setExpandedUiIds(ancestors);
    requestAnimationFrame(() => window.document.querySelector('.dialogue-hierarchy .editor-hierarchy-row.selected')?.scrollIntoView({ block: 'nearest' }));
  };
  const issues = Object.values(preset.nodes).filter(node => !registry.get(node.type)?.component).map(node => ({ nodeId: node.id, message: `未注册 React 组件：${node.type}` }));
  return <UiPreviewWorkbench workspace={workspace} onWorkspaceChange={setWorkspace}
    documentBar={<>        <label className="select-field"><select aria-label="当前预设" value={activeKey} onChange={(event) => { const key = event.target.value; const firstId = stores.get(key)?.getDocument().rootIds[0]; setActiveKey(key); setSelectedIds(firstId ? [firstId] : []); setViewport({ zoom: key === 'equipment_ui' ? .65 : 1, panX: 0, panY: 0 }); }}>{[...stores].map(([key, item]) => <option key={key} value={key}>{item.getDocument().name}</option>)}</select></label><span className={dirty ? 'ui-dirty' : 'ui-saved'}>{dirty ? '● 未保存' : '✓ 已保存'}</span></>}
    objects={<><div className="ui-tree-tools"><button onClick={locateSelected} disabled={!selectedIds.length}>定位所选</button><button onClick={() => setExpandedUiIds(new Set(Object.keys(preset.nodes)))}>展开全部</button><button onClick={() => setExpandedUiIds(new Set())}>折叠全部</button></div>      <ObjectHierarchy className="dialogue-hierarchy" eyebrow="UI OBJECTS" title="对象层级" showTypeLabels={false} status={`${Object.keys(preset.nodes).length}`}
        items={hierarchyItems} rootIds={treeIds(preset.rootIds)} selectedIds={selectedIds} expandedIds={expandedUiIds} onExpandedChange={setExpandedUiIds}
        searchPlaceholder="搜索 UI 对象" onSelectionChange={(ids, mode) => changeSelection(ids, mode === 'toggle' ? 'toggle' : 'replace')} onMove={moveHierarchyNodes} onClearSelection={() => setSelectedIds([])}
        renderRowMetadata={id => { const node = preset.nodes[id]; const resolved = resolveUiNode(preset, id); return <><small title={node.type}>{registry.get(node.type)?.label ?? node.type}</small><button className="ui-row-action" title={node.visible ? '隐藏对象' : '显示对象'} aria-label={`${node.name}：${node.visible ? '隐藏' : '显示'}`} onClick={event => { event.stopPropagation(); store.updateNode(id, '切换可见性', item => { item.visible = !item.visible; }); }}>{node.visible ? '◉' : '○'}</button><button className="ui-row-action" title={resolved?.locked && !node.locked ? '继承父级锁定' : node.locked ? '解锁对象' : '锁定对象'} aria-label={`${node.name}：锁定`} onClick={event => { event.stopPropagation(); store.updateNode(id, '切换锁定', item => { item.locked = !item.locked; }); }}>{resolved?.locked ? '◆' : '◇'}</button></>; }}
        footer={<><span>{Object.keys(preset.nodes).length} 个对象</span><span>拖拽重排 · Ctrl 多选</span></>}
      /></>}
    components={<section className="ui-component-library"><h2>组件库</h2><label className="text-field"><span>搜索组件</span><input aria-label="搜索组件" placeholder="名称、类型或分类" value={componentQuery} onChange={event => setComponentQuery(event.target.value)} /></label><label className="checkbox-field"><input type="checkbox" checked={addToSelection} onChange={event => setAddToSelection(event.target.checked)} />添加到所选节点下</label><p className="hint">插入位置：{addToSelection && selected && !selectedResolved?.locked ? selected.name : '画布根节点'}</p><div className="ui-component-cards">{registry.list().filter(entry => `${entry.label} ${entry.type} ${entry.category}`.toLowerCase().includes(componentQuery.trim().toLowerCase())).map(entry => <button key={entry.type} onClick={() => addNode(entry)}><strong>＋ {entry.label}</strong><small>{entry.category} · {entry.defaultSize.width} × {entry.defaultSize.height}</small><span>{entry.description ?? entry.type}</span></button>)}</div></section>}
    inspector={    <InspectorPanel className="preview-inspector" eyebrow="INSPECTOR" title={selected ? definition?.label ?? selected.type : '对象属性'} action={<button aria-label="收起属性面板" onClick={() => setWorkspace(current => ({ ...current, rightOpen: false }))}>›</button>} status={selected ? (selectedResolved?.locked ? '已锁定' : '可编辑') : undefined} footer={<><span>{selectedIds.length ? `已选择 ${selectedIds.length} 项` : '未选择对象'}</span><span>UI Document V2</span></>}>{chosenNodes.length > 1 ? <section className="ui-multi-inspector panel"><h2>已选择 {chosenNodes.length} 个对象</h2><p className="hint">共同操作仅影响未锁定对象。</p><div className="ui-wrap-actions">{([['left', '左对齐'], ['center-x', '水平居中'], ['right', '右对齐'], ['top', '顶对齐'], ['center-y', '垂直居中'], ['bottom', '底对齐']] as const).map(([mode, label]) => <button key={mode} onClick={() => alignSelection(mode)}>{label}</button>)}<button onClick={groupSelection}>成组</button></div><h3>共同属性</h3><div className="ui-wrap-actions"><button onClick={() => patchSelection(node => { node.visible = true; })}>显示选区</button><button onClick={() => patchSelection(node => { node.visible = false; })}>隐藏选区</button></div><NumberField label="透明度（多个值时留空）" value={commonOpacity} min={0} max={1} step={.05} onChange={value => patchSelection(node => { node.opacity = clamp(value, 0, 1); })} /></section> : selected ? <>
      <section className="panel inspector-title"><div><span>{definition?.label ?? '缺少 Definition'}</span><h2>{selected.name}</h2><p className="ui-parent-path">{selected.parentId ? preset.nodes[selected.parentId]?.name : preset.name} / {selected.name}</p></div><div className="tiny-actions"><button onClick={() => updateNode('切换可见性', (node) => { node.visible = !node.visible; })}>{selected.visible ? '隐藏' : '显示'}</button><button onClick={() => updateNode('切换锁定', (node) => { node.locked = !node.locked; })}>{selected.locked ? '解锁' : '锁定'}</button></div></section>
      {!definition ? <section className="panel"><h3>缺少组件定义</h3><p>类型 <code>{selected.type}</code> 当前未注册。原始参数会被保留，仍可移动或删除此节点。</p></section> : null}
      <InspectorSection title="布局" subtitle={selectedResolved ? `${Math.round(selectedResolved.layout.width)} × ${Math.round(selectedResolved.layout.height)} · ${selected.layout.mode === 'absolute' ? '父级相对' : '锚点布局'}` : undefined} {...sectionProps('layout', true)}><div className="panel-heading"><span>相对位置与尺寸</span><button onClick={() => { store.mutate('切换布局模式', (draft) => { const node = draft.nodes[selected.id]; if (!node) return; if (node.layout.mode === 'absolute') convertUiNodeToRectTransform(draft, node); else convertUiNodeToAbsolute(draft, node); }); refresh(); }}>{selected.layout.mode === 'absolute' ? '启用锚点' : '转绝对布局'}</button></div>
        {selected.layout.mode === 'absolute' ? <div className="control-grid"><NumberField label="相对 X" value={selected.layout.x} onChange={(value) => updateNode('修改 X', (node) => { if (node.layout.mode === 'absolute') node.layout.x = value; })} /><NumberField label="相对 Y" value={selected.layout.y} onChange={(value) => updateNode('修改 Y', (node) => { if (node.layout.mode === 'absolute') node.layout.y = value; })} /><NumberField label="宽度" value={selected.layout.width} min={8} onChange={(value) => updateNode('修改宽度', (node) => { if (node.layout.mode === 'absolute') node.layout.width = Math.max(8, value); })} /><NumberField label="高度" value={selected.layout.height} min={8} onChange={(value) => updateNode('修改高度', (node) => { if (node.layout.mode === 'absolute') node.layout.height = Math.max(8, value); })} /></div> : <>
          <div className="anchor-presets">{anchorPresets.map(([label, minX, minY, maxX, maxY]) => <button key={label} title={label} onClick={() => { store.mutate(`锚点预设：${label}`, (draft) => { const node = draft.nodes[selected.id]; if (node) applyUiAnchorPreset(draft, node, { x: minX, y: minY }, { x: maxX, y: maxY }); }); refresh(); }}>{label}</button>)}</div>
          <InspectorSection title="自定义锚点" subtitle="0–1 比例" {...sectionProps('anchors', false)}>          <p className="hint">锚点使用父节点宽高的 0–1 比例。位置是自身轴心相对锚点的像素偏移；尺寸 Δ 是拉伸后的增减量。</p>
          <div className="control-grid">{(['anchorMin', 'anchorMax'] as const).flatMap(key => (['x', 'y'] as const).map(axis => <NumberField key={`${key}-${axis}`} label={`${key === 'anchorMin' ? '锚点起点' : '锚点终点'} ${axis.toUpperCase()}`} value={selected.layout.mode === 'rect-transform' ? selected.layout[key][axis] : 0} min={0} max={1} step={.05} onChange={value => { store.mutate('修改锚点范围', draft => { const node = draft.nodes[selected.id]; if (node.layout.mode !== 'rect-transform') return; const world = resolveUiNode(draft, node)?.layout; node.layout[key][axis] = clamp(value, 0, 1); if (key === 'anchorMin') node.layout.anchorMax[axis] = Math.max(node.layout.anchorMax[axis], node.layout.anchorMin[axis]); else node.layout.anchorMin[axis] = Math.min(node.layout.anchorMin[axis], node.layout.anchorMax[axis]); if (world) setUiNodeWorldRect(draft, node, world); }); refresh(); }} />))}</div>
          </InspectorSection>
          <label className="select-field"><span>根节点参考区域</span><select disabled={Boolean(selected.parentId)} value={selected.layout.relativeTo} onChange={(event) => { const relativeTo = event.target.value === 'safe-area' ? 'safe-area' : 'parent'; store.mutate('修改参考区域', draft => { const node = draft.nodes[selected.id]; if (node.layout.mode !== 'rect-transform') return; const world = resolveUiNode(draft, node)?.layout; node.layout.relativeTo = relativeTo; if (world) setUiNodeWorldRect(draft, node, world); }); refresh(); }}><option value="parent">画布 / 父节点</option><option value="safe-area">安全区域</option></select></label>
          <div className="control-grid"><NumberField label="位置 X" value={selected.layout.anchoredPosition.x} onChange={(value) => updateNode('修改锚点位置 X', (node) => { if (node.layout.mode === 'rect-transform') node.layout.anchoredPosition.x = value; })} /><NumberField label="位置 Y" value={selected.layout.anchoredPosition.y} onChange={(value) => updateNode('修改锚点位置 Y', (node) => { if (node.layout.mode === 'rect-transform') node.layout.anchoredPosition.y = value; })} /><NumberField label="尺寸 ΔX" value={selected.layout.sizeDelta.x} onChange={(value) => updateNode('修改尺寸 X', (node) => { if (node.layout.mode === 'rect-transform') node.layout.sizeDelta.x = value; })} /><NumberField label="尺寸 ΔY" value={selected.layout.sizeDelta.y} onChange={(value) => updateNode('修改尺寸 Y', (node) => { if (node.layout.mode === 'rect-transform') node.layout.sizeDelta.y = value; })} /><NumberField label="Pivot X" value={selected.layout.pivot.x} min={0} max={1} step={.05} onChange={(value) => updateNode('修改 Pivot X', (node) => { if (node.layout.mode === 'rect-transform') node.layout.pivot.x = clamp(value, 0, 1); })} /><NumberField label="Pivot Y" value={selected.layout.pivot.y} min={0} max={1} step={.05} onChange={(value) => updateNode('修改 Pivot Y', (node) => { if (node.layout.mode === 'rect-transform') node.layout.pivot.y = clamp(value, 0, 1); })} /></div>
          {margins && (selected.layout.anchorMin.x !== selected.layout.anchorMax.x || selected.layout.anchorMin.y !== selected.layout.anchorMax.y) ? <><h3 className="subheading">拉伸边距</h3><div className="control-grid">{selected.layout.anchorMin.x !== selected.layout.anchorMax.x ? <><NumberField label="左" value={Math.round(margins.left)} onChange={(value) => updateMargin('left', value)} /><NumberField label="右" value={Math.round(margins.right)} onChange={(value) => updateMargin('right', value)} /></> : null}{selected.layout.anchorMin.y !== selected.layout.anchorMax.y ? <><NumberField label="上" value={Math.round(margins.top)} onChange={(value) => updateMargin('top', value)} /><NumberField label="下" value={Math.round(margins.bottom)} onChange={(value) => updateMargin('bottom', value)} /></> : null}</div></> : null}
        </>}
        <div className="control-grid"><NumberField label="层级" value={selected.layout.zIndex} onChange={(value) => updateNode('修改层级', (node) => { node.layout.zIndex = value; })} /><NumberField label="透明度" value={selected.opacity} min={0} max={1} step={.05} onChange={(value) => updateNode('修改透明度', (node) => { node.opacity = clamp(value, 0, 1); })} /></div>
      </InspectorSection>
      <InspectorSection title="节点与父级" subtitle={selected.parentId ? preset.nodes[selected.parentId]?.name : '画布根节点'} {...sectionProps('node', false)}><label className="text-field"><span>节点名称</span><input value={selected.name} onChange={(event) => updateNode('重命名节点', (node) => { node.name = event.target.value; })} /></label><label className="select-field"><span>父节点</span><select aria-label="父节点" value={selected.parentId ?? ''} disabled={selectedResolved?.locked} onChange={event => {
        const parentId = event.target.value || null;
        store.mutate('修改父节点', draft => reparentUiNode(draft, selected.id, parentId, keepWorldPosition));
        if (parentId) setExpandedUiIds(current => new Set([...current, parentId])); refresh();
      }}><option value="">画布根节点</option>{Object.values(preset.nodes).filter(node => node.id === selected.parentId || canReparentUiNode(preset, selected.id, node.id)).map(node => <option key={node.id} value={node.id}>{node.name} · {node.id}</option>)}</select></label><label className="checkbox-field"><input type="checkbox" checked={keepWorldPosition} onChange={event => setKeepWorldPosition(event.target.checked)} />换父级时保持画布位置</label><p className="hint">坐标相对于父节点；父节点移动时子节点跟随，调整父节点尺寸时按子节点锚点布局。</p></InspectorSection>
      {[...groups].map(([group, fields]) => <InspectorSection key={group} title={group} subtitle={`${fields.length} 项设置`} {...sectionProps(`props-${group}`, group !== '样式' && group !== '外观')}><div className={fields.every((field) => field.control === 'color') ? 'color-grid' : 'control-grid'}>{fields.map((field) => <PropertyControl key={field.path} field={field} node={selected} update={(value) => updateNode(`修改 ${field.label}`, (node) => setProp(node, field.path, value))} />)}</div></InspectorSection>)}
      <InspectorSection title="数据绑定" subtitle={`${Object.keys(selected.bindings ?? {}).length} 项`} {...sectionProps('bindings', false)}>{Object.entries(selected.bindings ?? {}).map(([path, binding]) => <div className="ui-binding-row" key={path}><strong>{path}</strong><code>{binding.source}</code><span>{String((runtimeContext ?? preset.previewContext)?.[binding.source] ?? binding.fallback ?? '未提供预览值')}</span></div>)}<p className="hint">这里显示当前预设绑定。新的数据选择器按组件接入规范另行实现。</p></InspectorSection>
      <InspectorSection title="高级信息" subtitle={selected.type} {...sectionProps('advanced', false)}><label className="text-field"><span>节点 ID</span><input value={selected.id} readOnly /></label><label className="text-field"><span>组件类型</span><input value={selected.type} readOnly /></label><p className="hint">组件版本 {selected.definitionVersion} · UI Document V2</p></InspectorSection>
      <section className="panel danger-row"><button onClick={() => {
        let id = ''; store.mutate('复制节点及子树', draft => { id = duplicateUiSubtree(draft, selected.id); }); setSelectedIds([id]); refresh();
      }}>复制节点及子树</button><button className="danger" onClick={() => { store.removeNode(selected.id); setSelectedIds((current) => current.filter((id) => Boolean(store.getDocument().nodes[id]))); refresh(); }}>删除节点</button></section>
    </> : <section className="panel empty-inspector"><strong>未选择节点</strong><p>{preset.name} · {Object.keys(preset.nodes).length} 个节点<br />{preset.canvas.width} × {preset.canvas.height}<br />点击画面或对象树开始编辑；可视区域尺寸与安全区在顶部“文档设置”。</p></section>}</InspectorPanel>}
    documentSettings={<>      <section className="panel"><div className="panel-heading"><span>界面预设</span><strong>{stores.size}</strong></div>

        {stores.has('equipment_ui') && <button onClick={() => { setActiveKey('equipment_ui'); setSelectedIds([]); setViewport({ zoom: .65, panX: 0, panY: 0 }); }}>打开角色整备示例</button>}
        <label className="text-field"><span>预设名称</span><input value={preset.name} onChange={(event) => { store.mutate('重命名预设', (draft) => { draft.name = event.target.value; }); refresh(); }} /></label>
        <div className="new-preset"><input value={newKey} onChange={(event) => setNewKey(event.target.value)} aria-label="新预设 Key" /><input value={newName} onChange={(event) => setNewName(event.target.value)} aria-label="新预设名称" /><button onClick={createPreset}>创建新预设</button></div>
      </section>
      <section className="panel"><div className="panel-heading"><span>玩家可视区域与安全区</span><strong>{preset.canvas.width}×{preset.canvas.height}</strong></div><div className="control-grid">
        <NumberField label="可视区宽" value={preset.canvas.width} min={320} onChange={(value) => { store.mutate('修改画布宽度', (draft) => { draft.canvas.width = Math.max(320, value); }); refresh(); }} />
        <NumberField label="可视区高" value={preset.canvas.height} min={180} onChange={(value) => { store.mutate('修改画布高度', (draft) => { draft.canvas.height = Math.max(180, value); }); refresh(); }} />
        {(['top', 'right', 'bottom', 'left'] as const).map((side) => <NumberField key={side} label={{ top: '安全区上', right: '安全区右', bottom: '安全区下', left: '安全区左' }[side]} value={preset.canvas.safeArea?.[side] ?? 0} min={0} onChange={(value) => { store.mutate('修改安全区域', (draft) => { draft.canvas.safeArea ??= { top: 0, right: 0, bottom: 0, left: 0 }; draft.canvas.safeArea[side] = Math.max(0, value); }); refresh(); }} />)}
      </div></section>
</>}
    viewSettings={<section className="panel"><h2>视图辅助</h2><label className="checkbox-field"><input type="checkbox" checked={workspace.referenceFrameVisible} onChange={event => setWorkspace(current => ({ ...current, referenceFrameVisible: event.target.checked }))} />显示玩家可视区域参考框</label><p className="hint">绿色边框仅标示玩家可见范围，不限制工作区。可以在框外放置、选中、拖动 UI；中键或空格拖动可平移工作区。</p><label className="checkbox-field"><input type="checkbox" checked={showGrid} onChange={event => setShowGrid(event.target.checked)} />显示网格</label><label className="checkbox-field"><input type="checkbox" checked={snapToGrid} onChange={event => setSnapToGrid(event.target.checked)} />拖动吸附网格</label><p className="hint">侧栏宽度可拖动分隔条调整，也可用方向键调整；双击恢复默认宽度。折叠状态与侧栏布局保存在本机，不写入界面预设。</p><button onClick={() => setWorkspace(current => ({ ...current, sections: {} }))}>恢复默认属性分组</button><h3>当前渲染方式</h3><p>{editMode ? 'React 组件编辑' : 'React 组件预览'}</p><p className="hint">编辑和预览共用真实 React 组件。编辑模式拦截交互用于布局，预览模式释放原生交互。</p></section>}
    previewStatus={runtimeContext && <><span aria-label="整备演示状态">{String(runtimeContext['actor.name'])} · {String(runtimeContext['selection.name'])} · {equipment.message}</span><button onClick={() => setEquipment(createEquipmentPreview())}>重置演示</button></>}
    status={<span className={isError ? 'is-error' : ''}>{message} · {chosenNodes.length} 项选择 · {preset.canvas.width} × {preset.canvas.height}</span>}
    issues={issues} onIssueSelect={issue => { setSelectedIds([issue.nodeId]); setWorkspace(current => ({ ...current, rightOpen: true, sections: { ...current.sections, advanced: true } })); requestAnimationFrame(() => window.document.getElementById('ui-inspector-advanced')?.scrollIntoView({ block: 'nearest' })); }}
  >    <main className="preview-stage"><div className="stage-toolbar"><div><strong>{preset.name}</strong><span>{preset.presetKey}</span>{dirty ? <em>● 未保存</em> : <em className="is-saved">✓ 已保存</em>}</div><div className="toolbar-actions">
      <button disabled={!history.canUndo} onClick={() => { store.undo(); refresh(); }}>撤销</button><button disabled={!history.canRedo} onClick={() => { store.redo(); refresh(); }}>重做</button><button className={editMode ? 'is-active' : ''} onClick={() => setEditMode(true)}>编辑模式</button><button className={!editMode ? 'is-active' : ''} onClick={() => setEditMode(false)}>预览</button><button className="save-button" disabled={saving} onClick={() => void save()}>{saving ? '保存中…' : '保存全部'}</button>
    </div></div>
      <div ref={canvasShellRef} className="canvas-shell"><div className="viewport-toolbar"><button onClick={() => { setAutoFit(false); setViewport((current) => ({ ...current, zoom: clamp(current.zoom / 1.2, .1, 3) })); }}>−</button><button onClick={() => { setAutoFit(false); setViewport({ zoom: 1, panX: 0, panY: 0 }); }}>{Math.round(viewport.zoom * 100)}%</button><button onClick={() => { setAutoFit(false); setViewport((current) => ({ ...current, zoom: clamp(current.zoom * 1.2, .1, 3) })); }}>＋</button><button aria-pressed={autoFit} onClick={() => setAutoFit(true)}>适应参考框</button>{selectedIds.length > 1 ? <><i /><button onClick={groupSelection}>成组</button><button onClick={() => alignSelection('left')}>左</button><button onClick={() => alignSelection('center-x')}>水平中</button><button onClick={() => alignSelection('right')}>右</button><button onClick={() => alignSelection('top')}>顶</button><button onClick={() => alignSelection('center-y')}>垂直中</button><button onClick={() => alignSelection('bottom')}>底</button></> : null}{selected?.type === 'group' ? <><i /><button onClick={ungroupSelected}>取消 Group</button></> : null}</div><UiReactEditor store={store} document={preset} registry={registry} selectedIds={selectedIds} editMode={editMode} showGrid={showGrid} showReferenceFrame={workspace.referenceFrameVisible} snapToGrid={snapToGrid} viewport={viewport} onViewportChange={next => { setAutoFit(false); setViewport(next); }} onSelectionChange={changeSelection} onChanged={refresh} runtimeContext={runtimeContext} onAction={action => setEquipment(previous => runEquipmentPreview(previous, action))} /><div className="canvas-caption"><span>{editMode ? '拖动空白框选 · Ctrl/Shift 多选 · 树中拖拽重排/设置父子关系' : 'React 组件预览 · 原生交互'}</span><span>{selectedIds.length ? `已选择 ${selectedIds.length} 项 · ` : ''}{preset.canvas.width} × {preset.canvas.height}</span></div></div>
    </main></UiPreviewWorkbench>;
};
