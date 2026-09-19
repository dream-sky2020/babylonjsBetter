import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DIALOGUE_MAP_GRID_SIZE,
  cloneDialogueEditorDocument,
  createDefaultDialogueNodeDisplay,
  createDialogueEditorDocument,
  createDialogueEditorNode,
  dialogueEdgeId,
  dialogueLineId,
  dialogueNodeInputPortId,
  dialogueOptionOutputPortId,
  encodeDialogueEditorDocumentLibrary,
  loadDialogueEditorDocumentLibrary,
  resolveDialogueEditorSelection,
  saveDialogueEditorDocumentLibrary,
  validateDialogueEditorDocument,
  type DialogueEditorDocument,
  type DialogueEditorDocumentLibrary,
  type DialogueEditorEdge,
  type DialogueEditorNode,
  type DialogueEditorSelection,
  type DialogueNodeDisplay,
  type DialogueNodeKind,
} from '@/core/dialogue-map';
import './dialogue-map-canvas-lab.css';

const GRID = DIALOGUE_MAP_GRID_SIZE;
const KIND_LABEL: Record<DialogueNodeKind, string> = { dialogue: '对话', choice: '选择', end: '结束' };
const SHAPE_LABEL: Record<DialogueNodeDisplay['shape'], string> = {
  rectangle: '无圆角长方形',
  rounded: '圆角长方形',
  diamond: '菱形',
  hexagon: '六边形',
  pill: '胶囊形',
  document: '文档形',
};
const COLOR_TOKENS: Record<string, { body: string; header: string }> = {
  'blue-muted': { body: '#17243a', header: '#385675' },
  'violet-muted': { body: '#241f38', header: '#5c4d78' },
  'red-muted': { body: '#302027', header: '#76505a' },
  'green-muted': { body: '#192c29', header: '#456a62' },
  'gray-muted': { body: '#202735', header: '#4b596b' },
};
const HEADER_TOKENS: Record<string, string> = {
  'blue-header': '#385675', 'violet-header': '#5c4d78', 'red-header': '#76505a', 'green-header': '#456a62', 'gray-header': '#4b596b',
};

const makeId = (prefix: string, existing: ReadonlySet<string>): string => {
  let id = prefix; let index = 1;
  while (existing.has(id)) id = `${prefix}_${index++}`;
  return id;
};
const shortText = (value: string, length: number): string => value.length > length ? `${value.slice(0, length - 1)}…` : value;
const snap = (value: number): number => Math.round(value / GRID) * GRID;
const nodeSize = (node: DialogueEditorNode) => ({ width: node.display.widthUnits * GRID, height: node.display.heightUnits * GRID });
const optionStartUnits = (node: DialogueEditorNode): number => 2 + node.lineOrder.length * 2;
const requiredHeightUnits = (node: DialogueEditorNode): number => optionStartUnits(node) + node.optionOrder.length + 1;
const selectionEquals = (selection: DialogueEditorSelection, kind: DialogueEditorSelection['kind'], id: string): boolean => {
  if (selection.kind !== kind) return false;
  if (kind === 'edge') return 'edgeId' in selection && selection.edgeId === id;
  if (kind === 'line') return 'lineId' in selection && selection.lineId === id;
  if (kind === 'option') return 'optionId' in selection && selection.optionId === id;
  if (kind === 'port') return 'portId' in selection && selection.portId === id;
  return 'nodeId' in selection && selection.nodeId === id;
};

type Point = { x: number; y: number };
const distanceToSegment = (point: Point, start: Point, end: Point): number => {
  const dx = end.x - start.x; const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
};
const portPosition = (node: DialogueEditorNode, portId: string): Point => {
  const port = node.ports.get(portId); const size = nodeSize(node);
  if (!port || port.direction === 'input') return { x: node.position.x, y: node.position.y + GRID };
  const optionIndex = port.optionId ? Math.max(0, node.optionOrder.indexOf(port.optionId)) : 0;
  return { x: node.position.x + size.width, y: node.position.y + (optionStartUnits(node) + optionIndex) * GRID + GRID / 2 };
};
const edgePoints = (document: DialogueEditorDocument, edge: DialogueEditorEdge): [Point, Point] | undefined => {
  const from = document.graph.nodes.get(edge.from.nodeId); const to = document.graph.nodes.get(edge.to.nodeId);
  if (!from || !to) return undefined;
  return [portPosition(from, edge.from.portId), portPosition(to, edge.to.portId)];
};

const nodePath = (ctx: CanvasRenderingContext2D, node: DialogueEditorNode, x: number, y: number, width: number, height: number) => {
  ctx.beginPath();
  if (node.display.shape === 'diamond') {
    ctx.moveTo(x + width / 2, y); ctx.lineTo(x + width, y + height / 2); ctx.lineTo(x + width / 2, y + height); ctx.lineTo(x, y + height / 2); ctx.closePath();
  } else if (node.display.shape === 'hexagon') {
    const cut = Math.min(width * .1, GRID); ctx.moveTo(x + cut, y); ctx.lineTo(x + width - cut, y); ctx.lineTo(x + width, y + height / 2); ctx.lineTo(x + width - cut, y + height); ctx.lineTo(x + cut, y + height); ctx.lineTo(x, y + height / 2); ctx.closePath();
  } else if (node.display.shape === 'document') {
    const fold = Math.min(26, width * .14); ctx.moveTo(x + 8, y); ctx.lineTo(x + width - fold, y); ctx.lineTo(x + width, y + fold); ctx.lineTo(x + width, y + height - 8); ctx.quadraticCurveTo(x + width, y + height, x + width - 8, y + height); ctx.lineTo(x + 8, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - 8); ctx.lineTo(x, y + 8); ctx.quadraticCurveTo(x, y, x + 8, y); ctx.closePath();
  } else if (node.display.shape === 'rectangle') {
    ctx.rect(x, y, width, height);
  } else {
    ctx.roundRect(x, y, width, height, node.display.shape === 'pill' ? height / 2 : 9);
  }
};

type CanvasProps = {
  document: DialogueEditorDocument;
  selection: DialogueEditorSelection;
  resetViewToken: number;
  onSelectionChange: (selection: DialogueEditorSelection) => void;
  onMoveNode: (nodeId: string, position: Point) => void;
};

const DialogueCanvas: React.FC<CanvasProps> = ({ document, selection, resetViewToken, onSelectionChange, onMoveNode }) => {
  const hostRef = useRef<HTMLDivElement>(null); const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 }); const [view, setView] = useState({ x: 48, y: 48, scale: 1 });
  const gesture = useRef<{ mode: 'node' | 'pan'; nodeId?: string; start: Point; origin: Point; nodeOrigin?: Point } | undefined>(undefined);
  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    const update = () => setSize({ width: Math.max(1, host.clientWidth), height: Math.max(1, host.clientHeight) }); update();
    const observer = new ResizeObserver(update); observer.observe(host); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const nodes = [...document.graph.nodes.values()]; if (!nodes.length) return;
    const minX = Math.min(...nodes.map((node) => node.position.x)); const minY = Math.min(...nodes.map((node) => node.position.y));
    const maxX = Math.max(...nodes.map((node) => node.position.x + nodeSize(node).width)); const maxY = Math.max(...nodes.map((node) => node.position.y + nodeSize(node).height));
    const scale = Math.min(1.2, Math.max(.3, Math.min((size.width - 96) / Math.max(1, maxX - minX), (size.height - 96) / Math.max(1, maxY - minY))));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView({ x: (size.width - (maxX - minX) * scale) / 2 - minX * scale, y: (size.height - (maxY - minY) * scale) / 2 - minY * scale, scale });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.presetKey, resetViewToken, size.width, size.height]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return; const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * ratio); canvas.height = Math.round(size.height * ratio); canvas.style.width = `${size.width}px`; canvas.style.height = `${size.height}px`;
    const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, size.width, size.height); ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, size.width, size.height);
    const scaledGrid = GRID * view.scale;
    if (scaledGrid >= 8) { ctx.strokeStyle = 'rgba(148,163,184,.075)'; ctx.lineWidth = 1; ctx.beginPath(); const ox = ((view.x % scaledGrid) + scaledGrid) % scaledGrid; const oy = ((view.y % scaledGrid) + scaledGrid) % scaledGrid; for (let x = ox; x < size.width; x += scaledGrid) { ctx.moveTo(x, 0); ctx.lineTo(x, size.height); } for (let y = oy; y < size.height; y += scaledGrid) { ctx.moveTo(0, y); ctx.lineTo(size.width, y); } ctx.stroke(); }
    const screen = (point: Point): Point => ({ x: view.x + point.x * view.scale, y: view.y + point.y * view.scale });
    document.graph.edges.forEach((edge) => {
      const points = edgePoints(document, edge); if (!points) return; const [start, end] = points.map(screen) as [Point, Point]; const selected = selectionEquals(selection, 'edge', edge.id);
      ctx.strokeStyle = selected ? '#a8b8c8' : '#5d6b7d'; ctx.lineWidth = selected ? 3 : 1.5; ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
      const angle = Math.atan2(end.y - start.y, end.x - start.x); ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(end.x, end.y); ctx.lineTo(end.x - Math.cos(angle - .45) * 8, end.y - Math.sin(angle - .45) * 8); ctx.lineTo(end.x - Math.cos(angle + .45) * 8, end.y - Math.sin(angle + .45) * 8); ctx.closePath(); ctx.fill();
      if (edge.label) { ctx.fillStyle = '#9aa8b8'; ctx.font = `${Math.max(8, 10 * view.scale)}px "Segoe UI"`; ctx.textAlign = 'center'; ctx.fillText(shortText(edge.label, 22), (start.x + end.x) / 2, (start.y + end.y) / 2 - 5); ctx.textAlign = 'left'; }
    });
    document.graph.nodes.forEach((node) => {
      const position = screen(node.position); const rawSize = nodeSize(node); const width = rawSize.width * view.scale; const height = rawSize.height * view.scale;
      const colors = COLOR_TOKENS[node.display.colorToken] ?? COLOR_TOKENS['gray-muted']; const selectedNode = selectionEquals(selection, 'node', node.id);
      nodePath(ctx, node, position.x, position.y, width, height); ctx.fillStyle = colors.body; ctx.fill(); ctx.strokeStyle = selectedNode ? '#a8b8c8' : '#465369'; ctx.lineWidth = selectedNode ? 2.5 : 1.2; ctx.stroke();
      ctx.save(); nodePath(ctx, node, position.x, position.y, width, height); ctx.clip(); ctx.fillStyle = node.display.headerColorToken ? HEADER_TOKENS[node.display.headerColorToken] ?? colors.header : colors.header; ctx.fillRect(position.x, position.y, width, 1.65 * GRID * view.scale); ctx.restore();
      const pad = GRID * .65 * view.scale; ctx.fillStyle = '#e5eaf1'; ctx.font = `600 ${Math.max(9, 12 * view.scale)}px "Segoe UI","Microsoft YaHei"`; ctx.fillText(`${node.display.icon ? `${node.display.icon} ` : ''}${shortText(node.title || node.id, 24)}`, position.x + pad, position.y + GRID * view.scale);
      if (document.graph.startNodeId === node.id) { ctx.fillStyle = '#8bb79b'; ctx.font = `700 ${Math.max(8, 9 * view.scale)}px "Segoe UI"`; ctx.textAlign = 'right'; ctx.fillText('START', position.x + width - pad, position.y + GRID * view.scale); ctx.textAlign = 'left'; }
      if (!node.display.collapsed) {
        node.lineOrder.forEach((lineId, index) => { const line = node.lines.get(lineId); if (!line) return; const rowY = position.y + (2 + index * 2) * GRID * view.scale; const isSelected = selectionEquals(selection, 'line', lineId); if (isSelected) { ctx.fillStyle = 'rgba(168,184,200,.14)'; ctx.fillRect(position.x + pad * .55, rowY, width - pad * 1.1, GRID * 1.65 * view.scale); } ctx.fillStyle = '#aeb9c7'; ctx.font = `${Math.max(8, 10 * view.scale)}px "Segoe UI","Microsoft YaHei"`; if (node.display.showSpeakerList !== false) ctx.fillText(shortText(line.speaker || '无说话者', 20), position.x + pad, rowY + GRID * .55 * view.scale); if (node.display.showPreviewText !== false) { ctx.fillStyle = '#d3dae3'; ctx.fillText(shortText(line.text || '（空对白）', 30), position.x + pad, rowY + GRID * 1.25 * view.scale); } });
        node.optionOrder.forEach((optionId, index) => { const option = node.options.get(optionId); if (!option) return; const rowY = position.y + (optionStartUnits(node) + index) * GRID * view.scale; if (selectionEquals(selection, 'option', optionId)) { ctx.fillStyle = 'rgba(168,184,200,.16)'; ctx.fillRect(position.x + pad * .55, rowY, width - pad * 1.1, GRID * view.scale); } ctx.fillStyle = '#b8c3d0'; ctx.font = `${Math.max(8, 10 * view.scale)}px "Segoe UI","Microsoft YaHei"`; ctx.fillText(`› ${shortText(option.text || option.id, 27)}`, position.x + pad, rowY + GRID * .68 * view.scale); });
      }
      node.ports.forEach((port) => { const point = screen(portPosition(node, port.id)); const selected = selectionEquals(selection, 'port', port.id); ctx.beginPath(); ctx.arc(point.x, point.y, (selected ? 7 : 5) * Math.max(.7, view.scale), 0, Math.PI * 2); ctx.fillStyle = port.direction === 'input' ? '#718197' : '#8998aa'; ctx.fill(); ctx.strokeStyle = selected ? '#d4dde7' : '#202a3a'; ctx.lineWidth = selected ? 2 : 1; ctx.stroke(); });
    });
  }, [document, selection, size, view]);

  const eventPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => { const rect = event.currentTarget.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
  const worldPoint = (point: Point): Point => ({ x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale });
  const hitTest = (screenPoint: Point): DialogueEditorSelection | undefined => {
    const world = worldPoint(screenPoint); const nodes = [...document.graph.nodes.values()].reverse();
    for (const node of nodes) {
      for (const port of node.ports.values()) { const p = portPosition(node, port.id); if (Math.hypot(world.x - p.x, world.y - p.y) <= 10 / view.scale) return { kind: 'port', nodeId: node.id, portId: port.id }; }
      const size = nodeSize(node); const inside = world.x >= node.position.x && world.x <= node.position.x + size.width && world.y >= node.position.y && world.y <= node.position.y + size.height; if (!inside) continue;
      if (!node.display.collapsed) {
        for (let index = 0; index < node.optionOrder.length; index += 1) { const y = node.position.y + (optionStartUnits(node) + index) * GRID; if (world.y >= y && world.y <= y + GRID) return { kind: 'option', nodeId: node.id, optionId: node.optionOrder[index] }; }
        for (let index = 0; index < node.lineOrder.length; index += 1) { const y = node.position.y + (2 + index * 2) * GRID; if (world.y >= y && world.y <= y + GRID * 1.7) return { kind: 'line', nodeId: node.id, lineId: node.lineOrder[index] }; }
      }
      return { kind: 'node', nodeId: node.id };
    }
    for (const edge of [...document.graph.edges.values()].reverse()) { const points = edgePoints(document, edge); if (points && distanceToSegment(world, points[0], points[1]) <= 9 / view.scale) return { kind: 'edge', edgeId: edge.id }; }
    return undefined;
  };
  return <div className="dialogue-canvas" ref={hostRef}><canvas ref={canvasRef}
    onPointerDown={(event) => { const point = eventPoint(event); const hit = hitTest(point); event.currentTarget.setPointerCapture(event.pointerId); if (hit) { onSelectionChange(hit); if (hit.kind === 'node') { const node = document.graph.nodes.get(hit.nodeId)!; gesture.current = { mode: 'node', nodeId: node.id, start: point, origin: { x: view.x, y: view.y }, nodeOrigin: { ...node.position } }; } } else gesture.current = { mode: 'pan', start: point, origin: { x: view.x, y: view.y } }; }}
    onPointerMove={(event) => { const active = gesture.current; if (!active) return; const point = eventPoint(event); if (active.mode === 'pan') setView((current) => ({ ...current, x: active.origin.x + point.x - active.start.x, y: active.origin.y + point.y - active.start.y })); else if (active.nodeId && active.nodeOrigin) onMoveNode(active.nodeId, { x: snap(active.nodeOrigin.x + (point.x - active.start.x) / view.scale), y: snap(active.nodeOrigin.y + (point.y - active.start.y) / view.scale) }); }}
    onPointerUp={() => { gesture.current = undefined; }} onPointerCancel={() => { gesture.current = undefined; }}
    onWheel={(event) => { event.preventDefault(); const point = { x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY }; setView((current) => { const scale = Math.min(2.2, Math.max(.3, current.scale * (event.deltaY > 0 ? .9 : 1.1))); const wx = (point.x - current.x) / current.scale; const wy = (point.y - current.y) / current.scale; return { x: point.x - wx * scale, y: point.y - wy * scale, scale }; }); }} />
    <div className="dialogue-canvas__hint">24px 基础网格 · 节点自动吸附 · 点击对白、选项、端口或直线可单独选择</div><div className="dialogue-canvas__zoom">{Math.round(view.scale * 100)}%</div></div>;
};

export const DialogueMapCanvasLab: React.FC = () => {
  const [library, setLibrary] = useState<DialogueEditorDocumentLibrary>({}); const [activeKey, setActiveKey] = useState('');
  const [selection, setSelection] = useState<DialogueEditorSelection>({ kind: 'node', nodeId: '' }); const [savedFingerprint, setSavedFingerprint] = useState('');
  const [message, setMessage] = useState('正在连接预设服务…'); const [isError, setIsError] = useState(false); const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState('dialogue_map'); const [newName, setNewName] = useState('新对话预设'); const [resetViewToken, setResetViewToken] = useState(0);
  const document = library[activeKey]; const target = document ? resolveDialogueEditorSelection(document, selection) : undefined;
  const fingerprint = useMemo(() => JSON.stringify(encodeDialogueEditorDocumentLibrary(library)), [library]); const dirty = Boolean(savedFingerprint && fingerprint !== savedFingerprint);
  const issues = useMemo(() => document ? validateDialogueEditorDocument(document) : [], [document]);
  const load = useCallback(async () => {
    try { setMessage('正在加载对话预设…'); setIsError(false); const next = await loadDialogueEditorDocumentLibrary(); const key = Object.keys(next)[0] ?? ''; setLibrary(next); setSavedFingerprint(JSON.stringify(encodeDialogueEditorDocumentLibrary(next))); setActiveKey(key); setSelection({ kind: 'node', nodeId: next[key]?.graph.startNodeId ?? '' }); setMessage(`已载入 ${Object.keys(next).length} 个对话预设。`); }
    catch (error) { setIsError(true); setMessage(error instanceof Error ? error.message : String(error)); }
  }, []);
  useEffect(() => {
    // 初次挂载连接数据源；状态更新发生在异步请求完成后。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  const updateDocument = useCallback((mutate: (draft: DialogueEditorDocument) => void) => { setLibrary((current) => { const source = current[activeKey]; if (!source) return current; const draft = cloneDialogueEditorDocument(source); mutate(draft); return { ...current, [activeKey]: draft }; }); }, [activeKey]);
  const updateNode = (nodeId: string, mutate: (node: DialogueEditorNode, draft: DialogueEditorDocument) => void) => updateDocument((draft) => { const node = draft.graph.nodes.get(nodeId); if (node) mutate(node, draft); });
  const selectPreset = (key: string) => { setActiveKey(key); setSelection({ kind: 'node', nodeId: library[key].graph.startNodeId }); setResetViewToken((value) => value + 1); };
  const createPreset = () => { const key = newKey.trim(); if (!/^[A-Za-z0-9_-]+$/.test(key) || library[key]) { setIsError(true); setMessage(library[key] ? '这个预设 Key 已存在。' : '预设 Key 只能包含字母、数字、下划线和连字符。'); return; } const next = createDialogueEditorDocument(key, newName.trim() || key); setLibrary((current) => ({ ...current, [key]: next })); setActiveKey(key); setSelection({ kind: 'node', nodeId: next.graph.startNodeId }); setResetViewToken((value) => value + 1); setIsError(false); setMessage(`已创建“${next.name}”。`); };
  const addNode = (kind: DialogueNodeKind) => { if (!document) return; const id = makeId(kind, new Set(document.graph.nodes.keys())); updateDocument((draft) => draft.graph.nodes.set(id, createDialogueEditorNode(id, kind, { x: GRID * (4 + draft.graph.nodes.size * 2), y: GRID * (4 + draft.graph.nodes.size) }))); setSelection({ kind: 'node', nodeId: id }); };
  const deleteNode = (nodeId: string) => { if (!document || document.graph.nodes.size <= 1) return; const remaining = [...document.graph.nodes.keys()].filter((id) => id !== nodeId); updateDocument((draft) => { draft.graph.nodes.delete(nodeId); [...draft.graph.edges].forEach(([id, edge]) => { if (edge.from.nodeId === nodeId || edge.to.nodeId === nodeId) draft.graph.edges.delete(id); }); if (draft.graph.startNodeId === nodeId) draft.graph.startNodeId = remaining[0]; }); setSelection({ kind: 'node', nodeId: remaining[0] }); };
  const addLine = (node: DialogueEditorNode) => { let index = node.lines.size + 1; let id = dialogueLineId(node.id, String(index)); while (node.lines.has(id)) id = dialogueLineId(node.id, String(++index)); updateNode(node.id, (draftNode) => { draftNode.lines.set(id, { id, speaker: '', text: '' }); draftNode.lineOrder.push(id); draftNode.display.heightUnits = Math.max(draftNode.display.heightUnits, requiredHeightUnits(draftNode)); }); setSelection({ kind: 'line', nodeId: node.id, lineId: id }); };
  const addOption = (node: DialogueEditorNode) => { const optionId = makeId('option', new Set(node.options.keys())); const portId = dialogueOptionOutputPortId(node.id, optionId); updateNode(node.id, (draftNode) => { draftNode.options.set(optionId, { id: optionId, text: '新选项', outputPortId: portId }); draftNode.optionOrder.push(optionId); draftNode.ports.set(portId, { id: portId, direction: 'output', role: 'option', optionId }); draftNode.display.heightUnits = Math.max(draftNode.display.heightUnits, requiredHeightUnits(draftNode)); }); setSelection({ kind: 'option', nodeId: node.id, optionId }); };
  const setOptionTarget = (nodeId: string, optionId: string, targetNodeId: string) => updateDocument((draft) => { const node = draft.graph.nodes.get(nodeId); const option = node?.options.get(optionId); if (!node || !option) return; [...draft.graph.edges].forEach(([edgeId, edge]) => { if (edge.from.nodeId === nodeId && edge.from.portId === option.outputPortId) draft.graph.edges.delete(edgeId); }); if (targetNodeId) { const id = dialogueEdgeId(nodeId, optionId); draft.graph.edges.set(id, { id, from: { nodeId, portId: option.outputPortId }, to: { nodeId: targetNodeId, portId: dialogueNodeInputPortId(targetNodeId) } }); } });
  const optionTarget = (nodeId: string, portId: string): string => [...(document?.graph.edges.values() ?? [])].find((edge) => edge.from.nodeId === nodeId && edge.from.portId === portId)?.to.nodeId ?? '';
  const deleteOption = (nodeId: string, optionId: string) => updateNode(nodeId, (node, draft) => { const option = node.options.get(optionId); if (!option) return; node.options.delete(optionId); node.optionOrder = node.optionOrder.filter((id) => id !== optionId); node.ports.delete(option.outputPortId); [...draft.graph.edges].forEach(([id, edge]) => { if (edge.from.nodeId === nodeId && edge.from.portId === option.outputPortId) draft.graph.edges.delete(id); }); });
  const changeKind = (node: DialogueEditorNode, kind: DialogueNodeKind) => updateNode(node.id, (draftNode, draft) => { draftNode.kind = kind; draftNode.display = createDefaultDialogueNodeDisplay(kind); if (kind === 'end') { const outputIds = new Set([...draftNode.ports.values()].filter((port) => port.direction === 'output').map((port) => port.id)); draftNode.options.clear(); draftNode.optionOrder = []; outputIds.forEach((id) => draftNode.ports.delete(id)); [...draft.graph.edges].forEach(([id, edge]) => { if (edge.from.nodeId === node.id) draft.graph.edges.delete(id); }); } else draftNode.display.heightUnits = Math.max(draftNode.display.heightUnits, requiredHeightUnits(draftNode)); });
  const save = async () => { const blocking = Object.values(library).flatMap(validateDialogueEditorDocument).filter((issue) => issue.code !== 'unreachable-node'); if (blocking.length) { setIsError(true); setMessage(`保存前请修复：${blocking[0].message}`); return; } setSaving(true); try { await saveDialogueEditorDocumentLibrary(library); setSavedFingerprint(JSON.stringify(encodeDialogueEditorDocumentLibrary(library))); setIsError(false); setMessage(`已保存 ${Object.keys(library).length} 个对话预设。`); } catch (error) { setIsError(true); setMessage(error instanceof Error ? error.message : String(error)); } finally { setSaving(false); } };
  if (!document) return <main className="dialogue-empty"><h1>Dialogue Map Canvas Lab</h1><p className={isError ? 'is-error' : ''}>{message}</p><button type="button" onClick={() => void load()}>重新加载</button></main>;
  const selectedNode = target && 'node' in target ? target.node : undefined;
  const inputPorts = [...document.graph.nodes.values()].flatMap((node) => [...node.ports.values()].filter((port) => port.direction === 'input').map((port) => ({ node, port })));
  const outputPorts = [...document.graph.nodes.values()].flatMap((node) => [...node.ports.values()].filter((port) => port.direction === 'output').map((port) => ({ node, port })));
  const selectionTitle = target?.kind === 'node' ? target.node.title : target?.kind === 'line' ? '对白' : target?.kind === 'option' ? '选项' : target?.kind === 'edge' ? '连线' : target?.kind === 'port' ? '端口' : '未选择';
  const selectedIssues = issues.filter((issue) => target?.kind === 'edge' ? issue.edgeId === target.edge.id : selectedNode ? issue.nodeId === selectedNode.id : false);

  return <div className="dialogue-lab">
    <header className="dialogue-lab__header"><div><span className="eyebrow">DIALOGUE DATA WORKBENCH</span><h1>Dialogue Map Canvas Lab</h1></div><div className={`server-status${isError ? ' is-error' : ''}`}><i />{message}</div></header>
    <aside className="dialogue-lab__sidebar"><section className="panel-card"><div className="panel-card__heading"><div><span>预设库</span><strong>{Object.keys(library).length}</strong></div><button type="button" onClick={() => void load()}>重新加载</button></div><label className="field"><span>当前预设</span><select value={activeKey} onChange={(event) => selectPreset(event.target.value)}>{Object.values(library).map((item) => <option key={item.presetKey} value={item.presetKey}>{item.name}</option>)}</select></label><label className="field"><span>显示名称</span><input value={document.name} onChange={(event) => updateDocument((draft) => { draft.name = event.target.value; })} /></label><div className="create-preset"><strong>新建预设</strong><input aria-label="新预设 Key" value={newKey} onChange={(event) => setNewKey(event.target.value)} /><input aria-label="新预设名称" value={newName} onChange={(event) => setNewName(event.target.value)} /><button type="button" onClick={createPreset}>＋ 创建</button></div></section>
      <section className="panel-card node-list-card"><div className="panel-card__heading"><div><span>节点</span><strong>{document.graph.nodes.size}</strong></div></div><div className="node-create-row"><button type="button" onClick={() => addNode('dialogue')}>＋ 对话</button><button type="button" onClick={() => addNode('choice')}>＋ 选择</button><button type="button" onClick={() => addNode('end')}>＋ 结束</button></div><div className="node-list">{[...document.graph.nodes.values()].map((node) => <button type="button" key={node.id} className={selection.kind === 'node' && selection.nodeId === node.id ? 'is-active' : ''} onClick={() => setSelection({ kind: 'node', nodeId: node.id })}><i style={{ background: (COLOR_TOKENS[node.display.colorToken] ?? COLOR_TOKENS['gray-muted']).header }} /><span><strong>{node.title || node.id}</strong><small>{KIND_LABEL[node.kind]} · {node.id}</small></span>{document.graph.startNodeId === node.id ? <em>起点</em> : null}</button>)}</div></section>
      <section className="panel-card edge-list-card"><div className="panel-card__heading"><div><span>连线</span><strong>{document.graph.edges.size}</strong></div></div><div className="edge-list">{[...document.graph.edges.values()].map((edge) => <button type="button" key={edge.id} className={selection.kind === 'edge' && selection.edgeId === edge.id ? 'is-active' : ''} onClick={() => setSelection({ kind: 'edge', edgeId: edge.id })}><strong>{edge.from.nodeId}</strong><span>→</span><strong>{edge.to.nodeId}</strong><small>{edge.id}</small></button>)}</div></section>
    </aside>
    <main className="dialogue-lab__stage"><div className="stage-toolbar"><div><strong>{document.name}</strong><span>{document.presetKey}</span>{dirty ? <em>● 未保存</em> : <em className="is-saved">✓ 已保存</em>}</div><div className="stage-toolbar__actions"><span className={issues.length ? 'has-issues' : ''}>{issues.length ? `${issues.length} 项提示` : '✓ 校验通过'}</span><button type="button" onClick={() => setResetViewToken((value) => value + 1)}>适配全部</button><button type="button" className="save-button" disabled={saving} onClick={() => void save()}>{saving ? '保存中…' : '保存全部'}</button></div></div><DialogueCanvas document={document} selection={selection} resetViewToken={resetViewToken} onSelectionChange={setSelection} onMoveNode={(nodeId, position) => updateNode(nodeId, (node) => { node.position = position; })} /><div className="stage-status"><span>{document.graph.nodes.size} 个节点</span><span>{document.graph.edges.size} 条独立连线</span><span>{issues[0]?.message ?? '所有引用有效'}</span></div></main>
    <aside className="dialogue-lab__inspector"><div className="inspector-title"><div><span>{target?.kind?.toUpperCase() ?? 'INSPECTOR'}</span><strong>{selectionTitle}</strong></div>{target?.kind === 'node' ? <button type="button" className="danger-button" disabled={document.graph.nodes.size <= 1} onClick={() => deleteNode(target.node.id)}>删除节点</button> : target?.kind === 'edge' ? <button type="button" className="danger-button" onClick={() => { updateDocument((draft) => draft.graph.edges.delete(target.edge.id)); setSelection({ kind: 'node', nodeId: document.graph.startNodeId }); }}>删除连线</button> : null}</div><div className="inspector-scroll">
      {target?.kind === 'node' ? <><section className="panel-card"><div className="kind-row">{(['dialogue', 'choice', 'end'] as const).map((kind) => <button type="button" key={kind} className={target.node.kind === kind ? 'is-active' : ''} onClick={() => changeKind(target.node, kind)}>{KIND_LABEL[kind]}</button>)}</div><label className="field"><span>节点 ID</span><input value={target.node.id} disabled /></label><label className="field"><span>标题</span><input value={target.node.title} onChange={(event) => updateNode(target.node.id, (node) => { node.title = event.target.value; })} /></label><label className="field"><span>标签（逗号分隔）</span><input value={(target.node.tags ?? []).join(', ')} onChange={(event) => updateNode(target.node.id, (node) => { node.tags = event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean); })} /></label><button type="button" className="start-button" disabled={document.graph.startNodeId === target.node.id} onClick={() => updateDocument((draft) => { draft.graph.startNodeId = target.node.id; })}>{document.graph.startNodeId === target.node.id ? '✓ 当前起始节点' : '设为起始节点'}</button></section>
        <section className="panel-card"><div className="panel-card__heading"><div><span>显示数据</span><strong>网格单位</strong></div></div><label className="field"><span>形状</span><select value={target.node.display.shape} onChange={(event) => updateNode(target.node.id, (node) => { node.display.shape = event.target.value as DialogueNodeDisplay['shape']; })}>{(['rectangle', 'rounded', 'diamond', 'hexagon', 'pill', 'document'] as const).map((shape) => <option key={shape} value={shape}>{SHAPE_LABEL[shape]}</option>)}</select></label><label className="field"><span>颜色 Token</span><select value={target.node.display.colorToken} onChange={(event) => updateNode(target.node.id, (node) => { node.display.colorToken = event.target.value; })}>{Object.keys(COLOR_TOKENS).map((token) => <option key={token}>{token}</option>)}</select></label><div className="field-grid"><label className="field"><span>宽度单位</span><input type="number" min="4" max="40" value={target.node.display.widthUnits} onChange={(event) => updateNode(target.node.id, (node) => { node.display.widthUnits = Number(event.target.value); })} /></label><label className="field"><span>高度单位</span><input type="number" min="3" max="40" value={target.node.display.heightUnits} onChange={(event) => updateNode(target.node.id, (node) => { node.display.heightUnits = Number(event.target.value); })} /></label></div><label className="checkbox-field"><input type="checkbox" checked={target.node.display.collapsed ?? false} onChange={(event) => updateNode(target.node.id, (node) => { node.display.collapsed = event.target.checked; })} />折叠内容</label><label className="checkbox-field"><input type="checkbox" checked={target.node.display.showPreviewText !== false} onChange={(event) => updateNode(target.node.id, (node) => { node.display.showPreviewText = event.target.checked; })} />显示对白预览</label></section>
        <section className="panel-card"><div className="panel-card__heading"><div><span>内容</span><strong>{target.node.lines.size + target.node.options.size}</strong></div><div className="inline-actions"><button type="button" onClick={() => addLine(target.node)}>＋对白</button>{target.node.kind !== 'end' ? <button type="button" onClick={() => addOption(target.node)}>＋选项</button> : null}</div></div>{target.node.lineOrder.map((id) => <button type="button" className="content-row" key={id} onClick={() => setSelection({ kind: 'line', nodeId: target.node.id, lineId: id })}>对白 · {target.node.lines.get(id)?.speaker || id}</button>)}{target.node.optionOrder.map((id) => <button type="button" className="content-row" key={id} onClick={() => setSelection({ kind: 'option', nodeId: target.node.id, optionId: id })}>选项 · {target.node.options.get(id)?.text || id}</button>)}</section></> : null}
      {target?.kind === 'line' ? <section className="panel-card"><label className="field"><span>稳定对白 ID</span><input value={target.line.id} disabled /></label><label className="field"><span>说话者</span><input value={target.line.speaker} onChange={(event) => updateNode(target.node.id, (node) => { const line = node.lines.get(target.line.id); if (line) line.speaker = event.target.value; })} /></label><label className="field"><span>对白内容</span><textarea rows={7} value={target.line.text} onChange={(event) => updateNode(target.node.id, (node) => { const line = node.lines.get(target.line.id); if (line) line.text = event.target.value; })} /></label><button type="button" className="danger-wide" disabled={target.node.lines.size <= 1} onClick={() => { updateNode(target.node.id, (node) => { node.lines.delete(target.line.id); node.lineOrder = node.lineOrder.filter((id) => id !== target.line.id); }); setSelection({ kind: 'node', nodeId: target.node.id }); }}>删除对白</button></section> : null}
      {target?.kind === 'option' ? <section className="panel-card"><label className="field"><span>稳定选项 ID</span><input value={target.option.id} disabled /></label><label className="field"><span>显示文本</span><input value={target.option.text} onChange={(event) => updateNode(target.node.id, (node) => { const option = node.options.get(target.option.id); if (option) option.text = event.target.value; })} /></label><label className="field"><span>输出端口</span><button type="button" className="reference-button" onClick={() => setSelection({ kind: 'port', nodeId: target.node.id, portId: target.option.outputPortId })}>{target.option.outputPortId}</button></label><label className="field"><span>目标节点</span><select value={optionTarget(target.node.id, target.option.outputPortId)} onChange={(event) => setOptionTarget(target.node.id, target.option.id, event.target.value)}><option value="">不连接</option>{[...document.graph.nodes.values()].filter((node) => node.id !== target.node.id).map((node) => <option key={node.id} value={node.id}>{node.title} · {node.id}</option>)}</select></label><label className="field"><span>条件</span><input value={target.option.condition ?? ''} onChange={(event) => updateNode(target.node.id, (node) => { const option = node.options.get(target.option.id); if (option) option.condition = event.target.value || undefined; })} /></label><label className="field"><span>事件</span><input value={target.option.event ?? ''} onChange={(event) => updateNode(target.node.id, (node) => { const option = node.options.get(target.option.id); if (option) option.event = event.target.value || undefined; })} /></label><button type="button" className="danger-wide" onClick={() => { deleteOption(target.node.id, target.option.id); setSelection({ kind: 'node', nodeId: target.node.id }); }}>删除选项及关联连线</button></section> : null}
      {target?.kind === 'edge' ? <section className="panel-card"><label className="field"><span>稳定连线 ID</span><input value={target.edge.id} disabled /></label><label className="field"><span>起点端口</span><select value={`${target.edge.from.nodeId}|${target.edge.from.portId}`} onChange={(event) => { const [nodeId, portId] = event.target.value.split('|'); updateDocument((draft) => { const edge = draft.graph.edges.get(target.edge.id); if (edge) edge.from = { nodeId, portId }; }); }}>{outputPorts.map(({ node, port }) => <option key={`${node.id}|${port.id}`} value={`${node.id}|${port.id}`}>{node.title} · {port.id}</option>)}</select></label><label className="field"><span>终点端口</span><select value={`${target.edge.to.nodeId}|${target.edge.to.portId}`} onChange={(event) => { const [nodeId, portId] = event.target.value.split('|'); updateDocument((draft) => { const edge = draft.graph.edges.get(target.edge.id); if (edge) edge.to = { nodeId, portId }; }); }}>{inputPorts.map(({ node, port }) => <option key={`${node.id}|${port.id}`} value={`${node.id}|${port.id}`}>{node.title} · {port.id}</option>)}</select></label><label className="field"><span>连线标签</span><input value={target.edge.label ?? ''} onChange={(event) => updateDocument((draft) => { const edge = draft.graph.edges.get(target.edge.id); if (edge) edge.label = event.target.value || undefined; })} /></label></section> : null}
      {target?.kind === 'port' ? <section className="panel-card"><label className="field"><span>稳定端口 ID</span><input value={target.port.id} disabled /></label><dl className="port-summary"><dt>节点</dt><dd>{target.node.id}</dd><dt>方向</dt><dd>{target.port.direction}</dd><dt>角色</dt><dd>{target.port.role}</dd><dt>选项</dt><dd>{target.port.optionId ?? '—'}</dd></dl></section> : null}
      {selectedIssues.length ? <section className="panel-card issue-card"><strong>选择项提示</strong>{selectedIssues.map((issue) => <p key={`${issue.code}:${issue.edgeId ?? issue.portId ?? issue.optionId ?? issue.lineId ?? ''}`}>{issue.message}</p>)}</section> : null}
    </div></aside>
  </div>;
};
