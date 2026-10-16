import React, {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DIALOGUE_MAP_GRID_SIZE,
  DIALOGUE_NODE_WHITESPACE_DEFAULTS,
  type DialogueNodeWhitespace,
  cloneDialogueEditorDocument,
  createDialogueEditorDocument,
  createDialogueEditorNode,
  DIALOGUE_NODE_LAYOUT_METRICS,
  dialogueGridRectContains,
  dialogueLayoutPointToWorld,
  compileDialogueEditorDocument,
  connectDialogueNodes,
  DIALOGUE_NODE_KIND_LABEL,
  dialogueLineId,
  dialogueOutputPortId,
  encodeDialogueEditorDocumentLibrary,
  loadDialogueEditorDocumentLibrary,
  resolveDialogueEditorSelection,
  saveDialogueEditorDocumentLibrary,
  validateDialogueEditorDocument,
  type DialogueCompileResult,
  type DialogueNodeKind,
  type DialogueEditorDocument,
  type DialogueEditorDocumentLibrary,
  type DialogueEditorEdge,
  type DialogueEditorNode,
  type DialogueEditorSelection,
  type DialogueNodeDisplay,
} from '@/core/dialogue-map';
import './dialogue-map-canvas-lab.css';
import { closeCommandMenu, openCommandMenuAtPoint, type CommandMenuEntry } from '@/core/ui/menu';
import { copyDialogueGraph, pasteDialogueGraph, deleteDialogueNodes, normalizedSelectionRect, dialogueRectsIntersect, applyDialogueSelection, dialogueSelectionMode, type DialogueSelectionMode, arrangeDialogueNodes, type DialogueGraphClipboard, type DialogueArrange } from './dialogueGraphEditing';
import { captureDialogueProperties, applyDialogueProperties, dialoguePropertyPasteReason, type DialoguePropertySnapshot } from './dialoguePropertyEditing';
import { DialogueMultiSelectionInspector } from './DialogueMultiSelectionInspector';
import { DialoguePropertyClipboardContext } from './dialoguePropertyClipboardContext';
import { DialogueFlowPreview } from './DialogueFlowPreviewModal.tsx';
import { InspectorGroup } from './InspectorGroup';
import { ComparisonEditor, EventNodeEditor } from './DialogueRuleEditor';
import { dialogueRuleCatalog } from './dialogueRuleCatalog';
import { createDialogueHistory, commitDialogueHistory, undoDialogueHistory, redoDialogueHistory } from './dialogueHistory';
import { fitGraphView, graphWorldPoint, graphScreenPoint, zoomGraphViewWithWheel } from '@/core/ui/node-graph/graphViewport';
import { getDialogueCanvasLayout as computeDialogueNodeLayout, measureDialogueCanvasText } from './dialogueCanvasLayout';
import { getDialogueNodeDisplayLines, DIALOGUE_NODE_TEXT_STYLE, dialogueNodeTextFont } from '@/core/dialogue-map/dialogueNodeLayout';
import { layoutCanvasText, type CanvasTextLayout } from '@/core/ui/canvas-text/canvasTextLayout';
import { drawDialogueCanvasText, getDialogueCanvasFontSize, getDialogueCanvasTextDetail, getDialogueCanvasTextWidthInset } from './dialogueCanvasText';

const WHITESPACE_LABELS: Record<keyof DialogueNodeWhitespace, string> = {
  header: '保留标题留白', content: '保留内容行留白', outputs: '保留出口行留白',
  top: '保留内容顶部留白', sections: '保留内容与出口间距', bottom: '保留底部留白', height: '保留设定高度的额外留白',
};
const GRID = DIALOGUE_MAP_GRID_SIZE;
const WORKSPACE_KEY = 'dialogue-map-canvas-lab:v5:preview-entries';
const SHAPE_LABEL: Record<DialogueNodeDisplay['shape'], string> = {
  rectangle: '长方形',
  rounded: '圆角长方形',
  diamond: '菱形',
  hexagon: '六边形',
  pill: '胶囊形',
  document: '文档形',
};
const COLORS: Record<string, { body: string; header: string }> = {
  'blue-muted': { body: '#17243a', header: '#385675' },
  'violet-muted': { body: '#241f38', header: '#5c4d78' },
  'red-muted': { body: '#302027', header: '#76505a' },
  'green-muted': { body: '#192c29', header: '#456a62' },
  'gray-muted': { body: '#202735', header: '#4b596b' },
};
const makeId = (prefix: string, ids: ReadonlySet<string>) => {
  let id = prefix;
  let index = 1;
  while (ids.has(id)) id = `${prefix}_${index++}`;
  return id;
};
const snap = (value: number) => Math.round(value / GRID) * GRID;
const nodeSize = (node: DialogueEditorNode) => {
  const layout = computeDialogueNodeLayout(node);
  return {
    width: layout.widthUnits * GRID,
    height: layout.actualHeightUnits * GRID,
  };
};
const requiredHeight = (node: DialogueEditorNode) =>
  computeDialogueNodeLayout(node).minimumHeightUnits;
const selected = (
  selection: DialogueEditorSelection,
  kind: DialogueEditorSelection['kind'],
  id: string,
) =>
  selection.kind === kind &&
  (kind === 'edge'
    ? 'edgeId' in selection && selection.edgeId === id
    : kind === 'line'
      ? 'lineId' in selection && selection.lineId === id
      : kind === 'node'
        ? 'nodeId' in selection && selection.nodeId === id
        : 'portId' in selection && selection.portId === id);
type Point = { x: number; y: number };

const portPosition = (node: DialogueEditorNode, portId: string): Point => {
  const layout = computeDialogueNodeLayout(node);
  const anchor =
    layout.inputAnchors.get(portId) ?? layout.outputAnchors.get(portId);
  return anchor
    ? dialogueLayoutPointToWorld(node, anchor)
    : { ...node.position };
};
const edgePoints = (
  document: DialogueEditorDocument,
  edge: DialogueEditorEdge,
): [Point, Point] | undefined => {
  const from = document.graph.nodes.get(edge.from.nodeId);
  const to = document.graph.nodes.get(edge.to.nodeId);
  return from && to
    ? [portPosition(from, edge.from.portId), portPosition(to, edge.to.portId)]
    : undefined;
};
const distanceToSegment = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (!dx && !dy) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};

type DialogueCanvasApi = { center(): Point; focus(ids: readonly string[]): void; isBusy(): boolean };
type CanvasProps = {
  document: DialogueEditorDocument;
  selection: DialogueEditorSelection;
  previewEntry?: string;
  resetViewToken: number;
  onSelection: (value: DialogueEditorSelection) => void;
  selectedIds: string[];
  onSelectedIds(ids: string[]): void;
  onMoveMany(positions: Map<string, Point>): void;
  apiRef: React.MutableRefObject<DialogueCanvasApi | undefined>;
  onContextMenu(x: number, y: number, at: Point, hit?: DialogueEditorSelection): void;
  onDisconnectOutput: (nodeId: string, portId: string) => void;
  onConnect: (
    fromNodeId: string,
    outputId: string,
    toNodeId: string,
    inputId: string,
  ) => void;
};
const DialogueCanvas: React.FC<CanvasProps> = ({
  document: sourceDocument,
  selection,
  previewEntry,
  resetViewToken,
  onSelection,
  selectedIds, onSelectedIds, onMoveMany, apiRef, onContextMenu,
  onConnect,
  onDisconnectOutput,
}) => {
  const [moving, setMoving] = useState(new Map<string, Point>());
  const document = useMemo(() => {
    if (!moving.size) return sourceDocument;
    const nodes = new Map(sourceDocument.graph.nodes);
    moving.forEach((position, id) => { const node = nodes.get(id); if (node) nodes.set(id, { ...node, position }); });
    return { ...sourceDocument, graph: { ...sourceDocument.graph, nodes } };
  }, [sourceDocument, moving]);
  const [marquee, setMarquee] = useState<{ start: Point; end: Point; mode: DialogueSelectionMode }>();
  const spaceHeld = useRef(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [view, setView] = useState({ x: 48, y: 48, scale: 1 });
  const [connectPointer, setConnectPointer] = useState<Point>();
  const gesture = useRef<{
    mode: 'pan' | 'node' | 'connect' | 'marquee';
    start: Point;
    origin: Point;
    nodeId?: string;
    portId?: string;
    nodeOrigin?: Point;
    nodeOrigins?: Map<string, Point>;
    selectionBefore?: string[];
    selectionMode?: DialogueSelectionMode;
    positions?: Map<string, Point>;
  } | undefined>(undefined);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () =>
      setSize({
        width: Math.max(1, host.clientWidth),
        height: Math.max(1, host.clientHeight),
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (gesture.current) return;
      const rect = canvas.getBoundingClientRect();
      const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      setView(current => zoomGraphViewWithWheel(current, anchor, event, rect.height));
    };
    // React wheel handlers may be passive; this listener reliably keeps scrolling on the canvas.
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);
  useEffect(() => {
    const nodes = [...document.graph.nodes.values()];
    if (!nodes.length) return;
    // 预设切换和“适配全部”需要重置视图，而不是派生持久状态。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView(fitGraphView(nodes.map(n => ({ ...n.position, ...nodeSize(n) })), size));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.presetKey, resetViewToken, size.width, size.height]);
  useEffect(() => {
    const cancel = () => {
      const active = gesture.current;
      if (!active) return;
      if (active.mode === 'pan') setView(current => ({ ...current, ...active.origin }));
      if (active.mode === 'marquee' && active.selectionBefore) onSelectedIds(active.selectionBefore);
      gesture.current = undefined; setMoving(new Map()); setMarquee(undefined); setConnectPointer(undefined);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], .command-menu-layer')) return;
      if (event.code === 'Space') { spaceHeld.current = true; event.preventDefault(); }
      if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopImmediatePropagation(); cancel(); }
    };
    const keyup = (event: KeyboardEvent) => { if (event.code === 'Space') spaceHeld.current = false; };
    const blur = () => { spaceHeld.current = false; cancel(); };
    window.addEventListener('keydown', keydown, true); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', keydown, true); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); };
  }, [onSelectedIds]);
  useEffect(() => {
    apiRef.current = {
      center: () => graphWorldPoint({ x: size.width / 2, y: size.height / 2 }, view),
      focus: ids => { const nodes = ids.flatMap(id => { const node = document.graph.nodes.get(id); return node ? [{ ...node.position, ...nodeSize(node) }] : []; }); if (nodes.length) setView(fitGraphView(nodes, size)); },
      isBusy: () => !!gesture.current,
    };
  });
  const world = (point: Point) => graphWorldPoint(point, view);
  const screen = (point: Point) => graphScreenPoint(point, view);
  const isPortAnchor = (point: Point, nodeId: string, portId: string) => {
    const node = document.graph.nodes.get(nodeId);
    if (!node) return false;
    const anchor = screen(portPosition(node, portId));
    return Math.hypot(point.x - anchor.x, point.y - anchor.y) <= 12;
  };
  const hitTest = (point: Point): DialogueEditorSelection | undefined => {
    const p = world(point);
    for (const node of [...document.graph.nodes.values()].reverse()) {
      const layout = computeDialogueNodeLayout(node);
      const portHitRadius =
        DIALOGUE_NODE_LAYOUT_METRICS.portRadiusUnits * GRID + 5 / view.scale;
      for (const id of node.inputOrder) {
        const q = portPosition(node, id);
        if (Math.hypot(p.x - q.x, p.y - q.y) <= portHitRadius)
          return { kind: 'input', nodeId: node.id, portId: id };
      }
      for (const id of node.outputOrder) {
        const q = portPosition(node, id);
        if (Math.hypot(p.x - q.x, p.y - q.y) <= portHitRadius)
          return { kind: 'output', nodeId: node.id, portId: id };
      }
      const local = {
        x: (p.x - node.position.x) / GRID,
        y: (p.y - node.position.y) / GRID,
      };
      if (
        !dialogueGridRectContains(
          {
            x: 0,
            y: 0,
            width: layout.widthUnits,
            height: layout.actualHeightUnits,
          },
          local,
        )
      )
        continue;
      if (layout.whitespaceRegions.some(rect => dialogueGridRectContains(rect, local))) return { kind: 'spacing', nodeId: node.id };
      for (const [id, value] of layout.outputRows)
        if (dialogueGridRectContains(value.rect, local))
          return { kind: 'output', nodeId: node.id, portId: id };
      for (const [id, value] of layout.lineRows)
        if (dialogueGridRectContains(value.rect, local))
          return node.kind === 'choice' ? { kind: 'line', nodeId: node.id, lineId: id } : node.kind === 'condition' ? (id.startsWith('condition:') ? { kind: 'condition', nodeId: node.id, conditionIndex: Number(id.split(':').at(-1)) } : { kind: 'condition-mode', nodeId: node.id }) : id.startsWith('event:') ? { kind: 'event', nodeId: node.id, eventIndex: Number(id.split(':').at(-1)) } : { kind: 'event-mode', nodeId: node.id };
      return { kind: 'node', nodeId: node.id };
    }
    for (const edge of document.graph.edges.values()) {
      const points = edgePoints(document, edge);
      if (points && distanceToSegment(p, points[0], points[1]) < 9 / view.scale)
        return { kind: 'edge', edgeId: edge.id };
    }
    return undefined;
  };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = size.width * ratio;
    canvas.height = size.height * ratio;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, size.width, size.height);
    const spacing = GRID * view.scale;
    if (spacing > 8) {
      ctx.strokeStyle = 'rgba(148,163,184,.075)';
      ctx.beginPath();
      for (
        let x = ((view.x % spacing) + spacing) % spacing;
        x < size.width;
        x += spacing
      ) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, size.height);
      }
      for (
        let y = ((view.y % spacing) + spacing) % spacing;
        y < size.height;
        y += spacing
      ) {
        ctx.moveTo(0, y);
        ctx.lineTo(size.width, y);
      }
      ctx.stroke();
    }
    document.graph.edges.forEach((edge) => {
      const points = edgePoints(document, edge);
      if (!points) return;
      const a = screen(points[0]);
      const b = screen(points[1]);
      ctx.strokeStyle = selected(selection, 'edge', edge.id)
        ? '#cbd5e1'
        : '#64748b';
      ctx.lineWidth = selected(selection, 'edge', edge.id) ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
    document.graph.nodes.forEach((node) => {
      const layout = computeDialogueNodeLayout(node);
      const p = screen(node.position);
      const unit = GRID * view.scale;
      const width = layout.widthUnits * unit;
      const height = layout.actualHeightUnits * unit;
      const color = COLORS[node.display.colorToken] ?? COLORS['gray-muted'];
      const detail = getDialogueCanvasTextDetail(view.scale);
      const fullDetail = detail === 'full';
      const compactDetail = detail !== 'overview';
      const contentX = p.x + layout.contentInsetUnits * unit;
      const contentWidth = layout.content.width * unit;
      const singleLine = (text: string, screenWidth: number, fontSize: number = DIALOGUE_NODE_TEXT_STYLE.bodySize, weight = 400): CanvasTextLayout => layoutCanvasText(text, {
        maxWidth: Math.max(0, screenWidth - getDialogueCanvasTextWidthInset(view.scale, ratio)), maxLines: 1, wrap: false,
        measure: value => measureDialogueCanvasText(value, dialogueNodeTextFont(getDialogueCanvasFontSize(fontSize, view.scale, ratio), weight)),
      });
      const textPaints: Array<() => void> = [];
      const paintText = (text: CanvasTextLayout, box: Parameters<typeof drawDialogueCanvasText>[2]) => {
        textPaints.push(() => drawDialogueCanvasText(ctx, text, { ...box, pixelRatio: ratio }));
      };
      ctx.fillStyle = color.body;
      ctx.strokeStyle = selectedIds.includes(node.id)
        ? '#cbd5e1'
        : '#465369';
      ctx.lineWidth = selectedIds.includes(node.id) ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.roundRect(
        p.x,
        p.y,
        width,
        height,
        node.display.shape === 'rectangle' ? 0 : 8,
      );
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color.header;
      ctx.fillRect(p.x, p.y, width, layout.header.height * unit);
      const previewWidth = previewEntry === node.id && compactDetail
        ? Math.min(contentWidth, measureDialogueCanvasText('PREVIEW', dialogueNodeTextFont(getDialogueCanvasFontSize(DIALOGUE_NODE_TEXT_STYLE.titleSize, view.scale, ratio), 600)) + getDialogueCanvasTextWidthInset(view.scale, ratio)) : 0;
      const titleWidth = Math.max(0, contentWidth - previewWidth - (previewWidth ? 8 * view.scale : 0));
      paintText(singleLine(`${DIALOGUE_NODE_KIND_LABEL[node.kind]} · ${node.title || node.id}`, titleWidth, DIALOGUE_NODE_TEXT_STYLE.titleSize, 600), {
        x: contentX, y: p.y, width: titleWidth, height: layout.header.height * unit, scale: view.scale,
        color: '#e5eaf1', fontSize: DIALOGUE_NODE_TEXT_STYLE.titleSize, weight: 600, center: true,
      });
      if (previewWidth) paintText(singleLine('PREVIEW', previewWidth, DIALOGUE_NODE_TEXT_STYLE.titleSize, 600), {
        x: contentX + contentWidth - previewWidth, y: p.y, width: previewWidth, height: layout.header.height * unit,
        scale: view.scale, color: '#93c5a5', fontSize: DIALOGUE_NODE_TEXT_STYLE.titleSize, weight: 600, center: true,
      });
      if (selection.kind === 'spacing' && selection.nodeId === node.id) {
        ctx.fillStyle = 'rgba(230,187,100,.22)';
        layout.whitespaceRegions.forEach(rect => ctx.fillRect(p.x + rect.x * unit, p.y + rect.y * unit, rect.width * unit, rect.height * unit));
      }
      layout.separators.forEach((gridY) => {
        const y = p.y + gridY * unit;
        ctx.strokeStyle = 'rgba(148,163,184,.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, y);
        ctx.lineTo(p.x + width, y);
        ctx.stroke();
      });
      if (compactDetail && !node.display.collapsed) {
        layout.lineRows.forEach((rowLayout, id) => {
          const line = getDialogueNodeDisplayLines(node).get(id);
          if (!line) return;
          const x = p.x + rowLayout.rect.x * unit;
          const y = p.y + rowLayout.rect.y * unit;
          const rowWidth = rowLayout.rect.width * unit;
          if ((selection.kind === 'event-mode' && selection.nodeId === node.id && id === `summary:${node.id}`) || (selection.kind === 'event' && selection.nodeId === node.id && id === `event:${node.id}:${selection.eventIndex ?? 0}`) || selected(selection, 'line', id) || (selection.kind === 'condition-mode' && selection.nodeId === node.id && id === `summary:${node.id}`) || (selection.kind === 'condition' && selection.nodeId === node.id && id === `condition:${node.id}:${selection.conditionIndex}`)) {
            ctx.fillStyle = 'rgba(168,184,200,.14)';
            ctx.fillRect(x, y, rowWidth, rowLayout.rect.height * unit);
          }
          if (fullDetail) {
            rowLayout.textBlocks?.forEach(block => paintText(block, {
              x, y: y + block.offsetY * view.scale, width: rowWidth,
              height: block.lines.length * DIALOGUE_NODE_TEXT_STYLE.lineHeight * view.scale,
              scale: view.scale, color: block.role === 'speaker' ? '#aeb9c7' : '#d3dae3',
            }));
          } else {
            const text = (node.display.showSpeakerList !== false ? line.speaker : '') || (node.display.showPreviewText !== false ? line.text || '空对白' : '');
            paintText(singleLine(text, rowWidth), {
              x, y, width: rowWidth, height: rowLayout.rect.height * unit, scale: view.scale, color: '#d3dae3', center: true,
            });
          }
        });
        layout.outputRows.forEach((rowLayout, id) => {
          const output = node.outputs.get(id);
          if (!output) return;
          const x = p.x + rowLayout.rect.x * unit;
          const y = p.y + rowLayout.rect.y * unit;
          const rowWidth = rowLayout.rect.width * unit;
          if (selected(selection, 'output', id)) {
            ctx.fillStyle = 'rgba(167,139,250,.14)';
            ctx.fillRect(x, y, rowWidth, rowLayout.rect.height * unit);
          }
          const icon = output.branch === 'true' ? '✓' : output.branch === 'false' ? '✕' : '›';
          if (fullDetail) {
            rowLayout.textBlocks?.forEach(block => paintText(block, {
              x, y: y + block.offsetY * view.scale, width: rowWidth,
              height: block.lines.length * DIALOGUE_NODE_TEXT_STYLE.lineHeight * view.scale,
              scale: view.scale, color: block.role === 'label' ? '#d8d0ef' : '#8f9db1',
            }));
          } else paintText(singleLine(`${icon} ${output.label || output.id}`, rowWidth), {
            x, y, width: rowWidth, height: rowLayout.rect.height * unit, scale: view.scale, color: '#d8d0ef', center: true,
          });
        });
      }
      const baseRadius = DIALOGUE_NODE_LAYOUT_METRICS.portRadiusUnits * unit;
      node.inputOrder.forEach((id) => {
        const q = screen(portPosition(node, id));
        ctx.beginPath();
        ctx.arc(
          q.x,
          q.y,
          selected(selection, 'input', id) ? baseRadius * 1.35 : baseRadius,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = '#718197';
        ctx.fill();
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      node.outputOrder.forEach((id) => {
        const q = screen(portPosition(node, id));
        ctx.beginPath();
        ctx.arc(
          q.x,
          q.y,
          selected(selection, 'output', id) ? baseRadius * 1.35 : baseRadius,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = '#a78bfa';
        ctx.fill();
        ctx.strokeStyle = '#21193b';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      // Text is the final paint within this node; decorations cannot cover its ink.
      textPaints.forEach(paint => paint());
    });
    const active = gesture.current;
    if (active?.mode === 'connect' && active.nodeId && active.portId && connectPointer) {
      const source = document.graph.nodes.get(active.nodeId);
      if (source) {
        const start = screen(portPosition(source, active.portId));
        ctx.save();
        ctx.strokeStyle = '#c4b5fd';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(connectPointer.x, connectPointer.y);
        ctx.stroke();
        ctx.restore();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, previewEntry, selection, selectedIds, size, view, connectPointer]);
  const point = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const hoveredInput = connectPointer ? hitTest(connectPointer) : undefined;
  const selfConnection = selection.kind === 'output' && hoveredInput?.kind === 'input'
    && hoveredInput.nodeId === selection.nodeId;
  const occupiedOutput = (nodeId: string, portId: string) => [...document.graph.edges.values()]
    .some(edge => edge.from.nodeId === nodeId && edge.from.portId === portId);
  const selectedOutputOccupied = selection.kind === 'output' && occupiedOutput(selection.nodeId, selection.portId);
  return (
    <div className="dialogue-canvas" ref={hostRef}>
      <canvas
        ref={canvasRef}
        style={{ cursor: marquee ? 'crosshair' : moving.size ? 'grabbing' : undefined }}
        tabIndex={0}
        aria-label="对话流程画布"
        onContextMenu={(event) => {
          event.preventDefault();
          onContextMenu(event.clientX, event.clientY, world(point(event)), hitTest(point(event)));
        }}
        onPointerDown={(event) => {
          if (event.button === 2) return;
          event.currentTarget.focus();
          const p = point(event), hit = hitTest(p), mode = dialogueSelectionMode(event);
          event.currentTarget.setPointerCapture(event.pointerId);
          if (event.button === 1 || spaceHeld.current) {
            event.preventDefault(); gesture.current = { mode: 'pan', start: p, origin: { x: view.x, y: view.y } }; return;
          }
          if (hit) {
            if (mode !== 'replace') { if (hit.kind !== 'edge') onSelectedIds(applyDialogueSelection(selectedIds, [hit.nodeId], mode)); return; }
            onSelection(hit);
            if (hit.kind === 'output' && isPortAnchor(p, hit.nodeId, hit.portId)) {
              if (occupiedOutput(hit.nodeId, hit.portId)) onDisconnectOutput(hit.nodeId, hit.portId);
              gesture.current = { mode: 'connect', start: p, origin: { x: view.x, y: view.y }, nodeId: hit.nodeId, portId: hit.portId };
              setConnectPointer(p);
            } else if (hit.kind === 'node' || hit.kind === 'spacing') {
              const ids = selectedIds.includes(hit.nodeId) ? selectedIds : [hit.nodeId];
              gesture.current = { mode: 'node', start: p, origin: { x: view.x, y: view.y }, nodeOrigins: new Map(ids.map(id => [id, { ...sourceDocument.graph.nodes.get(id)!.position }])) };
            }
          } else {
            gesture.current = { mode: 'marquee', start: p, origin: { x: view.x, y: view.y }, selectionBefore: [...selectedIds], selectionMode: mode };
            setMarquee({ start: world(p), end: world(p), mode });
            if (mode === 'replace') onSelectedIds([]);
          }
        }}
        onPointerMove={(event) => {
          const active = gesture.current;
          if (!active) return;
          const p = point(event);
          if (active.mode === 'connect') setConnectPointer(p);
          if (active.mode === 'pan') setView(v => ({ ...v, x: active.origin.x + p.x - active.start.x, y: active.origin.y + p.y - active.start.y }));
          if (active.mode === 'node' && active.nodeOrigins) {
            const dx = snap((p.x - active.start.x) / view.scale), dy = snap((p.y - active.start.y) / view.scale);
            active.positions = new Map([...active.nodeOrigins].map(([id, origin]) => [id, { x: origin.x + dx, y: origin.y + dy }]));
            setMoving(active.positions);
          }
          if (active.mode === 'marquee') {
            const start = world(active.start), end = world(p), rect = normalizedSelectionRect(start, end);
            const mode = active.selectionMode ?? 'replace';
            setMarquee({ start, end, mode });
            const hits = [...sourceDocument.graph.nodes.values()].filter(node => dialogueRectsIntersect(rect, { ...node.position, ...nodeSize(node) })).map(node => node.id);
            onSelectedIds(applyDialogueSelection(active.selectionBefore ?? [], hits, mode));
          }
        }}
        onPointerUp={(event) => {
          const active = gesture.current;
          if (active?.mode === 'connect' && active.nodeId && active.portId) {
            const releasedAt = point(event), hit = hitTest(releasedAt);
            if (hit?.kind === 'input' && hit.nodeId !== active.nodeId && isPortAnchor(releasedAt, hit.nodeId, hit.portId)) onConnect(active.nodeId, active.portId, hit.nodeId, hit.portId);
          }
          if (active?.mode === 'node' && active.positions && [...active.positions].some(([id, pos]) => pos.x !== active.nodeOrigins?.get(id)?.x || pos.y !== active.nodeOrigins?.get(id)?.y)) onMoveMany(active.positions);
          gesture.current = undefined; setMoving(new Map()); setMarquee(undefined); setConnectPointer(undefined);
        }}
        onPointerCancel={() => {
          const active = gesture.current;
          if (active?.mode === 'marquee') onSelectedIds(active.selectionBefore ?? []);
          if (active?.mode === 'pan') setView(current => ({ ...current, ...active.origin }));
          gesture.current = undefined; setMoving(new Map()); setMarquee(undefined); setConnectPointer(undefined);
        }}
        onLostPointerCapture={() => {
          const active = gesture.current;
          if (!active) return;
          if (active.mode === 'marquee') onSelectedIds(active.selectionBefore ?? []);
          if (active.mode === 'pan') setView(current => ({ ...current, ...active.origin }));
          gesture.current = undefined; setMoving(new Map()); setMarquee(undefined); setConnectPointer(undefined);
        }}
      />
      {marquee ? (() => { const rect = normalizedSelectionRect(screen(marquee.start), screen(marquee.end)); return <div className={`dialogue-marquee dialogue-marquee--${marquee.mode}`} style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}><span>{{ replace: '框选', add: '追加', subtract: '减选', toggle: '反选' }[marquee.mode]} · {selectedIds.length} 个节点</span></div>; })() : null}
      <div className="dialogue-canvas__hint">
        {selfConnection
          ? '不能连接到当前节点的入口'
          : selectedOutputOccupied
            ? '从此出口拖线会立即取消原连线'
            : '空白拖动框选 · Ctrl 追加 · Alt 减选 · Shift 反选 · 中键或空格平移 · 右键操作'}
      </div>
      <div className="dialogue-canvas__zoom">
        {Math.round(view.scale * 100)}%
      </div>
    </div>
  );
};

const DIALOGUE_OPERATION_HELP = [
  ['选择与属性', '点击卡片内容编辑对应属性，面板自动展开置顶。Ctrl（或 ⌘）点击卡片或左侧条目追加选择，Alt 点击仅取消命中的已选节点，Shift 点击反选；普通点击左侧条目只选该节点；点击空白处或 Esc 取消选择。'],
  ['框选与多选', '在画布空白处按左键拖出选择框，与框相交的卡片都会选中。Ctrl（或 ⌘）框选追加未选节点，Alt 框选仅取消命中的已选节点，Shift 框选反选命中节点；操作方式以开始拖动时按住的键为准，框选时显示方式和选中数量。右键已选节点保留整个选区，右键未选节点切换选区。'],
  ['移动与取消', '拖动已选卡片的标题或留白区域，整组选区一起移动并保持相对位置，位移吸附网格。松手提交一次撤销记录；拖动或框选中按 Esc 取消。'],
  ['画布导航', '中键拖动，或按住空格再用左键拖动平移；滚轮围绕鼠标缩放。F 聚焦选区，“适配画布”显示全部节点。'],
  ['右键菜单', '右键节点可复制、剪切、生成副本、删除、聚焦、整理布局、设为检查入口或预览。右键空白处可在点击位置新建选项／判断／事件节点，或在此粘贴。'],
  ['节点剪贴板', 'Ctrl+C 复制选区，Ctrl+X 复制后立即删除，Ctrl+V 在画布中心粘贴，连续粘贴错开。仅复制选区内部连线，自动生成新 ID；支持当前页面跨预设粘贴。节点与属性剪贴板互不影响。'],
  ['副本与删除', 'Ctrl+D 生成向右下错开一格的副本；Delete 删除选区及关联连线；Ctrl+A 全选。允许删除最后一个节点，空图可右键新建。删除检查入口后会切换到剩余节点并提示。'],
  ['属性复制粘贴', '各可编辑面板提供“复制属性／粘贴属性”，仅作用于对应面板，保留节点 ID、位置和连线。不兼容时禁用并说明原因；集合可明确替换或追加。'],
  ['选项集合', '“替换现有选项文本”要求数量相同，只改标签，保留端口和连线；“追加为新选项”保留旧选项并生成新端口。判断出口为固定只读属性。'],
  ['批量编辑与整理', '多选后在右侧点击“批量编辑属性”，可统一颜色、尺寸和留白；不同值显示“混合”，只修改操作的字段。对齐至少选择 2 个节点，等间距分布至少选择 3 个，按卡片实际边界计算。'],
  ['连接节点', '从紫色出口圆点拖到其他卡片的灰色入口圆点。一个出口至多一条线，入口可汇入多条线；从已连接出口拖动立即断开旧线，取消后可撤销恢复。'],
  ['留白与检查入口', '点击留白区域或“留白设置”标题，独立调整 7 项留白并随草稿保存。检查入口在右键菜单、节点属性或左侧下拉框中明确设置，右键本身不再更改入口。'],
  ['流程预览', '“预览选中节点”从当前属性所属节点开始；右键也可指定起点。事件仅模拟，判断手动选择，Esc 关闭预览。'],
  ['撤销与保存', 'Ctrl+Z 撤销；Ctrl+Shift+Z 或 Ctrl+Y 重做。一次批量删除、粘贴、属性粘贴或整组移动只需撤销一次。输入框保留原生文字快捷键，菜单及弹窗不触发画布快捷键。'],
  ['检查与导出', '“检查／编译”验证当前入口，成功后可“导出数据”；“保存草稿”保存全部预设。节点和属性剪贴板保留在当前页面，刷新后清空。'],
];

const DialogueOperationHelp: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = window.document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previous?.focus();
  }, []);
  return <div className="dialogue-help-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="dialogue-help" role="dialog" aria-modal="true" aria-labelledby="dialogue-help-title" onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'Tab') { event.preventDefault(); closeRef.current?.focus(); }
    }}>
      <header><div><h2 id="dialogue-help-title">操作说明</h2><p>画布操作、属性编辑与流程预览</p></div>
        <button ref={closeRef} aria-label="关闭操作说明" onClick={onClose}>×</button>
      </header>
      <dl>{DIALOGUE_OPERATION_HELP.map(([action, description]) => <div key={action}><dt>{action}</dt><dd>{description}</dd></div>)}</dl>
    </section>
  </div>;
};

const loadPreviewEntries = (): Record<string, string | undefined> => {
  try {
    return JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? '{}') as Record<
      string,
      string | undefined
    >;
  } catch {
    return {};
  }
};
export const DialogueMapCanvasLab: React.FC = () => {
  const [history, setHistory] = useState(createDialogueHistory);
  const library = history.present;
  const setLibrary = useCallback((update: (current: DialogueEditorDocumentLibrary) => DialogueEditorDocumentLibrary) => {
    setHistory(current => commitDialogueHistory(current, update(current.present)));
  }, []);
  const [helpOpen, setHelpOpen] = useState(false);
  const [flowPreview, setFlowPreview] = useState<{ document: DialogueEditorDocument; nodeId: string }>();
  const [selectedKey, setActiveKey] = useState('');
  const activeKey = library[selectedKey] ? selectedKey : Object.keys(library)[0] ?? '';
  const [selection, setInspectorSelection] = useState<DialogueEditorSelection>({
    kind: 'node',
    nodeId: '',
  });
  const [nodeSelection, setNodeSelection] = useState<{ key: string; ids: string[] }>({ key: '', ids: [] });
  const [nodeClipboard, setNodeClipboard] = useState<DialogueGraphClipboard>();
  const [propertyClipboard, setPropertyClipboard] = useState<DialoguePropertySnapshot>();
  const pasteCount = useRef(0);
  const canvasApi = useRef<DialogueCanvasApi | undefined>(undefined);
  const inspectorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (inspectorRef.current) inspectorRef.current.scrollTop = 0; }, [selection]);
  const [previewEntries, setPreviewEntries] = useState(loadPreviewEntries);
  const [savedFingerprint, setSavedFingerprint] = useState('');
  const [message, setMessage] = useState('正在连接数据源…');
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState('dialogue_map');
  const [newName, setNewName] = useState('新对话预设');
  const [resetViewToken, setResetViewToken] = useState(0);
  const [checked, setChecked] = useState<{ fingerprint: string; entry?: string; result: DialogueCompileResult }>();
  const document = library[activeKey];
  const selectedIds = nodeSelection.key === activeKey ? nodeSelection.ids.filter(id => document?.graph.nodes.has(id)) : [];
  const setSelection = (next: DialogueEditorSelection) => {
    setInspectorSelection(next);
    if (next.kind === 'edge') setNodeSelection({ key: activeKey, ids: [] });
    else setNodeSelection(current => current.key === activeKey && current.ids.includes(next.nodeId) ? current : { key: activeKey, ids: [next.nodeId] });
  };
  const selectNodes = (ids: string[]) => {
    setNodeSelection({ key: activeKey, ids });
    setInspectorSelection({ kind: 'node', nodeId: ids.includes('nodeId' in selection ? selection.nodeId : '') ? ('nodeId' in selection ? selection.nodeId : '') : ids[0] ?? '' });
  };
  const target = document
    ? resolveDialogueEditorSelection(document, selection) ?? ('nodeId' in selection && document.graph.nodes.has(selection.nodeId) ? { kind: 'node' as const, node: document.graph.nodes.get(selection.nodeId)! } : undefined)
    : undefined;
  const previewEntry =
    document && document.graph.nodes.has(previewEntries[activeKey] ?? '')
      ? previewEntries[activeKey]
      : document?.graph.nodes.keys().next().value;
  const setPreviewEntry = (nodeId: string) =>
    setPreviewEntries((current) => {
      const next = { ...current, [activeKey]: nodeId };
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(next));
      return next;
    });
  const fingerprint = useMemo(
    () => JSON.stringify(encodeDialogueEditorDocumentLibrary(library)),
    [library],
  );
  const dirty = Boolean(savedFingerprint && fingerprint !== savedFingerprint);
  const currentCheck = checked?.fingerprint === fingerprint && checked.entry === previewEntry ? checked.result : undefined;
  const issues = currentCheck?.issues ?? [];
  const load = useCallback(async () => {
    try {
      const next = await loadDialogueEditorDocumentLibrary();
      const key = Object.keys(next)[0] ?? '';
      const first = next[key]?.graph.nodes.keys().next().value ?? '';
      setHistory(createDialogueHistory(next));
      setSavedFingerprint(
        JSON.stringify(encodeDialogueEditorDocumentLibrary(next)),
      );
      setActiveKey(key);
      setInspectorSelection({ kind: 'node', nodeId: first });
      setNodeSelection({ key, ids: first ? [first] : [] });
      setMessage(`已载入 ${Object.keys(next).length} 个 V5 对话预设。`);
      setIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      setIsError(true);
    }
  }, []);
  useEffect(() => {
    // 初次挂载连接数据源；状态更新发生在异步请求完成后。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  const updateDocument = useCallback(
    (mutate: (draft: DialogueEditorDocument) => void) =>
      setLibrary((current) => {
        const source = current[activeKey];
        if (!source) return current;
        const draft = cloneDialogueEditorDocument(source);
        mutate(draft);
        return { ...current, [activeKey]: draft };
      }),
    [activeKey, setLibrary],
  );
  const updateNode = (
    nodeId: string,
    mutate: (node: DialogueEditorNode, draft: DialogueEditorDocument) => void,
  ) =>
    updateDocument((draft) => {
      const node = draft.graph.nodes.get(nodeId);
      if (node) mutate(node, draft);
    });
  const selectPreset = (key: string) => {
    closeCommandMenu();
    setActiveKey(key);
    setNodeSelection({ key, ids: library[key].graph.nodes.size ? [library[key].graph.nodes.keys().next().value!] : [] });
    setInspectorSelection({
      kind: 'node',
      nodeId: library[key].graph.nodes.keys().next().value ?? '',
    });
    setResetViewToken((v) => v + 1);
  };
  const createPreset = () => {
    const key = newKey.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(key) || library[key]) {
      setMessage(
        library[key] ? '这个预设 Key 已存在。' : '预设 Key 格式无效。',
      );
      setIsError(true);
      return;
    }
    const next = createDialogueEditorDocument(key, newName.trim() || key);
    setLibrary((current) => ({ ...current, [key]: next }));
    setActiveKey(key);
    setInspectorSelection({ kind: 'node', nodeId: 'start' });
    setNodeSelection({ key, ids: ['start'] });
    setPreviewEntries((current) => {
      const entries = { ...current, [key]: 'start' };
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(entries));
      return entries;
    });
  };
  const addNode = (kind: DialogueNodeKind, at?: Point) => {
    const id = makeId(kind, new Set(document.graph.nodes.keys()));
    updateDocument((draft) =>
      draft.graph.nodes.set(
        id,
        createDialogueEditorNode(id, at ? { x: snap(at.x), y: snap(at.y) } : {
          x: GRID * (4 + draft.graph.nodes.size * 2),
          y: GRID * (4 + draft.graph.nodes.size),
        }, kind),
      ),
    );
    setSelection({ kind: 'node', nodeId: id });
  };
  const removeNodes = (ids: string[]) => {
    if (!ids.length) return;
    updateDocument(draft => deleteDialogueNodes(draft, ids));
    const remaining = [...document.graph.nodes.keys()].filter(id => !ids.includes(id));
    selectNodes(remaining.length ? [remaining[0]] : []);
    if (previewEntry && ids.includes(previewEntry)) { setPreviewEntry(remaining[0] ?? ''); setMessage(remaining.length ? '原检查入口已删除，已切换到剩余节点。' : '当前图为空，可右键空白处新建节点。'); }
  };
  const deleteNode = (nodeId: string) => removeNodes([nodeId]);
  const addLine = (node: DialogueEditorNode) => {
    const id = makeId(
      dialogueLineId(node.id, 'line'),
      new Set(node.lines.keys()),
    );
    updateNode(node.id, (draft) => {
      draft.lines.set(id, { id, speaker: '', text: '' });
      draft.lineOrder.push(id);
    });
    setSelection({ kind: 'line', nodeId: node.id, lineId: id });
  };
  const addOutput = (node: DialogueEditorNode) => {
    const suffix = makeId(
      'choice',
      new Set(node.outputOrder.map((id) => id.split(':').at(-1) ?? id)),
    );
    const id = dialogueOutputPortId(node.id, suffix);
    updateNode(node.id, (draft) => {
      draft.outputs.set(id, {
        id,
        label: '新选择',
        branch: 'choice',
      });
      draft.outputOrder.push(id);
    });
    setSelection({ kind: 'output', nodeId: node.id, portId: id });
  };
  const setTarget = (nodeId: string, outputId: string, targetNodeId: string, inputId?: string) =>
    updateDocument(draft => {
      if (nodeId === targetNodeId) return;
      const toPort = inputId ?? draft.graph.nodes.get(targetNodeId)?.inputOrder[0];
      if (!toPort) return;
      if ([...draft.graph.edges.values()].some(edge =>
        edge.from.nodeId === nodeId && edge.from.portId === outputId)) return;
      connectDialogueNodes(draft, { nodeId, portId: outputId }, { nodeId: targetNodeId, portId: toPort });
    });
  const runCheck = () => {
    const result = compileDialogueEditorDocument(document, previewEntry ?? '', dialogueRuleCatalog);
    setChecked({ fingerprint, entry: previewEntry, result });
    setMessage(result.program ? `编译成功，${result.issues.filter(item => item.severity === 'warning').length} 项警告。` : '编译未通过，请查看检查结果。');
    setIsError(!result.program);
  };
  const exportCompiled = () => {
    if (!currentCheck?.program) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(currentCheck.program, null, 2)], { type: 'application/json' }));
    const link = window.document.createElement('a'); link.href = url; link.download = `${document.presetKey}.compiled.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const save = async () => {
    const errors = Object.values(library).flatMap(validateDialogueEditorDocument).filter(item => item.severity === 'error');
    if (errors.length) {
      setMessage(`数据无法保存：${errors[0].message}`);
      setIsError(true);
      return;
    }
    setSaving(true);
    try {
      await saveDialogueEditorDocumentLibrary(library);
      setSavedFingerprint(
        JSON.stringify(encodeDialogueEditorDocumentLibrary(library)),
      );
      setMessage(`已保存 ${Object.keys(library).length} 个 V5 对话预设。`);
      setIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      setIsError(true);
    } finally {
      setSaving(false);
    }
  };
  const reportError = (error: unknown) => { setMessage(error instanceof Error ? error.message : String(error)); setIsError(true); };
  const copyNodes = (ids: string[], cut = false) => {
    try {
      const snapshot = copyDialogueGraph(document, ids);
      setNodeClipboard(snapshot); pasteCount.current = 0;
      if (cut) removeNodes(ids);
      setMessage(`已${cut ? '剪切' : '复制'} ${snapshot.nodes.length} 个节点及选区内部连线。`); setIsError(false);
    } catch (error) { reportError(error); }
  };
  const pasteNodes = (at?: Point, snapshot = nodeClipboard) => {
    if (!snapshot) { setMessage('请先复制节点。'); return; }
    try {
      const center = at ?? canvasApi.current?.center() ?? { x: 96, y: 96 };
      const offset = at ? 0 : pasteCount.current * GRID;
      const result = pasteDialogueGraph(document, snapshot, { x: center.x + offset, y: center.y + offset });
      const errors = validateDialogueEditorDocument(result.document).filter(issue => issue.severity === 'error');
      if (errors.length) throw new Error(errors[0].message);
      setLibrary(current => ({ ...current, [activeKey]: result.document }));
      selectNodes(result.ids); if (!at) pasteCount.current++;
      setMessage(`已粘贴 ${result.ids.length} 个节点。`); setIsError(false);
    } catch (error) { reportError(error); }
  };
  const duplicateNodes = (ids: string[]) => {
    try { const snapshot = copyDialogueGraph(document, ids); pasteNodes({ x: Math.min(...snapshot.nodes.map(node => node.position.x)) + GRID, y: Math.min(...snapshot.nodes.map(node => node.position.y)) + GRID }, snapshot); } catch (error) { reportError(error); }
  };
  const arrange = (mode: DialogueArrange, ids = selectedIds) => updateDocument(draft => arrangeDialogueNodes(draft, ids, mode, nodeSize));
  const openGraphMenu = (x: number, y: number, at: Point, hit?: DialogueEditorSelection) => {
    if (canvasApi.current?.isBusy()) return;
    if (hit?.kind === 'edge') {
      setSelection(hit);
      openCommandMenuAtPoint(x, y, [{ id: 'delete-edge', label: '删除连线', danger: true, action: () => updateDocument(draft => { draft.graph.edges.delete(hit.edgeId); }) }], '连线操作'); return;
    }
    const id = hit?.nodeId;
    const ids = id ? selectedIds.includes(id) ? selectedIds : [id] : selectedIds;
    if (id) { setNodeSelection({ key: activeKey, ids }); setInspectorSelection(hit!); }
    const items: CommandMenuEntry[] = id ? [
      { id: 'selection', label: `已选 ${ids.length} 个节点`, disabled: true },
      { id: 'copy', label: '复制节点', icon: 'copy', shortcut: 'Ctrl+C', action: () => copyNodes(ids) },
      { id: 'cut', label: '剪切节点', shortcut: 'Ctrl+X', action: () => copyNodes(ids, true) },
      { id: 'duplicate', label: '生成副本（错开一格）', shortcut: 'Ctrl+D', action: () => duplicateNodes(ids) },
      { id: 'delete', label: '删除选中节点及关联连线', danger: true, shortcut: 'Delete', action: () => removeNodes(ids) },
      { type: 'separator' },
      { id: 'focus', label: '聚焦选区', icon: 'focus', shortcut: 'F', action: () => canvasApi.current?.focus(ids) },
      { id: 'arrange', label: '整理布局', icon: 'layout', children: ([['left', '左对齐'], ['right', '右对齐'], ['top', '顶对齐'], ['bottom', '底对齐'], ['horizontal', '水平等间距'], ['vertical', '垂直等间距']] as const).map(([mode, label]) => ({ id: mode, label: ids.length < (mode === 'horizontal' || mode === 'vertical' ? 3 : 2) ? `${label}（选中更多节点）` : label, disabled: ids.length < (mode === 'horizontal' || mode === 'vertical' ? 3 : 2), action: () => arrange(mode, ids) })) },
      { type: 'separator' },
      { id: 'entry', label: '设为检查入口', checked: previewEntry === id, action: () => setPreviewEntry(id) },
      { id: 'preview', label: '从此节点预览流程', action: () => setFlowPreview({ document: cloneDialogueEditorDocument(document), nodeId: id }) },
    ] : [
      ...(Object.keys(DIALOGUE_NODE_KIND_LABEL) as DialogueNodeKind[]).map(kind => ({ id: `create-${kind}`, label: `新建${DIALOGUE_NODE_KIND_LABEL[kind]}节点`, action: () => addNode(kind, at) })),
      { type: 'separator' },
      { id: 'paste', label: nodeClipboard ? `在此粘贴 ${nodeClipboard.nodes.length} 个节点` : '在此粘贴（请先复制节点）', shortcut: 'Ctrl+V', disabled: !nodeClipboard, action: () => pasteNodes(at) },
      { id: 'all', label: document.graph.nodes.size ? '选择全部节点' : '选择全部节点（当前图为空）', disabled: !document.graph.nodes.size, shortcut: 'Ctrl+A', action: () => selectNodes([...document.graph.nodes.keys()]) },
    ];
    openCommandMenuAtPoint(x, y, items, id ? '节点操作' : '画布操作');
  };
  const handleGraphKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!document) return;
    if (event.defaultPrevented || event.altKey || canvasApi.current?.isBusy()) return;
    if (helpOpen || flowPreview || window.document.querySelector('.command-menu-layer')) return;
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
    const modifier = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
    if (modifier && ['c', 'x', 'v', 'a', 'd', 'z', 'y'].includes(key)) {
      event.preventDefault();
      if (key === 'c') copyNodes(selectedIds);
      if (key === 'x') copyNodes(selectedIds, true);
      if (key === 'v') pasteNodes();
      if (key === 'a') selectNodes([...document.graph.nodes.keys()]);
      if (key === 'd') duplicateNodes(selectedIds);
      if (key === 'z') setHistory(event.shiftKey ? redoDialogueHistory : undoDialogueHistory);
      if (key === 'y') setHistory(redoDialogueHistory);
    } else if (!modifier && event.key === 'Delete') {
      event.preventDefault();
      if (selection.kind === 'edge') updateDocument(draft => { draft.graph.edges.delete(selection.edgeId); });
      else removeNodes(selectedIds);
    } else if (!modifier && key === 'f') { event.preventDefault(); canvasApi.current?.focus(selectedIds); }
    else if (event.key === 'Escape') selectNodes([]);
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handleGraphKeyDown(event);
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); closeCommandMenu(); };
  }, []);
  if (!document)
    return (
      <main className="dialogue-empty">
        <h1>Dialogue Map Canvas Lab</h1>
        <p className={isError ? 'is-error' : ''}>{message}</p>
        <button onClick={() => void load()}>重新加载</button>
        <button disabled={!history.future.length} onClick={() => setHistory(redoDialogueHistory)}>重做</button>
      </main>
    );
  const selectedNode = target && 'node' in target ? target.node : undefined;
  const selectedLayout = selectedNode
    ? computeDialogueNodeLayout(selectedNode)
    : undefined;
  const selectedIssues = issues.filter((item) =>
    target?.kind === 'edge'
      ? item.edgeId === target.edge.id
      : selectedNode
        ? item.nodeId === selectedNode.id
        : false,
  );
  return (
    <DialoguePropertyClipboardContext.Provider value={{ clipboard: propertyClipboard,
      copy: target => { try { setPropertyClipboard(captureDialogueProperties(document, target)); setMessage('已复制属性，可到同类面板粘贴。'); setIsError(false); } catch (error) { reportError(error); } },
      paste: (target, append) => { if (!propertyClipboard) return; try { const draft = cloneDialogueEditorDocument(document); applyDialogueProperties(draft, target, propertyClipboard, append); setLibrary(current => ({ ...current, [activeKey]: draft })); setMessage('已粘贴属性，位置、节点 ID 和连线保持不变。'); setIsError(false); } catch (error) { reportError(error); } },
      reason: (target, append) => dialoguePropertyPasteReason(document, target, propertyClipboard, append),
    }}>
    <div className="dialogue-lab">
      {helpOpen ? <DialogueOperationHelp onClose={() => setHelpOpen(false)} /> : null}
      {flowPreview ? <DialogueFlowPreview document={flowPreview.document} startNodeId={flowPreview.nodeId} onClose={() => setFlowPreview(undefined)} /> : null}
      <header className="dialogue-lab__header">
        <div>
          <span className="eyebrow">DIALOGUE DATA WORKBENCH · V5</span>
          <h1>Dialogue Map Canvas Lab</h1>
        </div>
        <div className={`server-status${isError ? ' is-error' : ''}`}>
          <i />
          {message}
        </div>
      </header>
      <aside className="dialogue-lab__sidebar">
        <section className="panel-card">
          <div className="panel-card__heading">
            <div>
              <span>预设库</span>
              <strong>{Object.keys(library).length}</strong>
            </div>
            <button onClick={() => void load()}>重新加载</button>
          </div>
          <label className="field">
            <span>当前预设</span>
            <select
              value={activeKey}
              onChange={(event) => selectPreset(event.target.value)}
            >
              {Object.values(library).map((item) => (
                <option key={item.presetKey} value={item.presetKey}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>当前检查入口</span>
            <select
              value={previewEntry ?? ''}
              onChange={(event) => setPreviewEntry(event.target.value)}
            >
              {[...document.graph.nodes.values()].map((node) => (
                <option key={node.id} value={node.id}>
                  {node.title} · {node.id}
                </option>
              ))}
            </select>
          </label>
          <details className="create-preset">
            <summary>新建预设</summary>
            <div className="create-preset__body">
              <input aria-label="预设 Key" placeholder="预设 Key" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
              <input
                aria-label="预设名称"
                placeholder="预设名称"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button onClick={createPreset}>＋ 创建</button>
            </div>
          </details>
        </section>
        <section className="panel-card node-list-card">
          <div className="panel-card__heading">
            <div>
              <span>流程卡片</span>
              <strong>{document.graph.nodes.size}</strong>
            </div>
            <span>三种节点</span>
          </div>
          <div className="node-create-actions">{(Object.keys(DIALOGUE_NODE_KIND_LABEL) as DialogueNodeKind[]).map(kind => <button key={kind} onClick={() => addNode(kind)}>＋{DIALOGUE_NODE_KIND_LABEL[kind]}</button>)}</div>
          <div className="node-list">
            {[...document.graph.nodes.values()].map((node) => (
              <button
                key={node.id}
                className={
                  selectedIds.includes(node.id)
                    ? 'is-active'
                    : ''
                }
                onClick={event => { const mode = dialogueSelectionMode(event); if (mode !== 'replace') selectNodes(applyDialogueSelection(selectedIds, [node.id], mode)); else { selectNodes([node.id]); setInspectorSelection({ kind: 'node', nodeId: node.id }); } }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  openGraphMenu(event.clientX, event.clientY, node.position, { kind: 'node', nodeId: node.id });
                }}
              >
                <i
                  style={{
                    background: (
                      COLORS[node.display.colorToken] ?? COLORS['gray-muted']
                    ).header,
                  }}
                />
                <span>
                  <strong>{node.title || node.id}</strong>
                  <small>
                    {DIALOGUE_NODE_KIND_LABEL[node.kind]} · {node.outputs.size} 输出
                  </small>
                </span>
                {previewEntry === node.id ? <em>入口</em> : null}
              </button>
            ))}
          </div>
        </section>
      </aside>
      <main className="dialogue-lab__stage">
        <div className="stage-toolbar">
          <div className="stage-toolbar__meta">
            <strong>{document.name}</strong>
            <span>{document.presetKey}</span>
            {dirty ? <em>未保存</em> : <em className="is-saved">已保存</em>}
          </div>
          <div className="stage-toolbar__actions">
            <div className="stage-toolbar__group">
              <button disabled={!selectedNode} onClick={() => { if (selectedNode) setFlowPreview({ document: cloneDialogueEditorDocument(document), nodeId: selectedNode.id }); }}>预览选中节点</button>
              <button aria-haspopup="dialog" onClick={() => setHelpOpen(true)}>操作说明</button>
              <button disabled={!history.past.length} onClick={() => setHistory(undoDialogueHistory)} title="撤销 Ctrl+Z">撤销</button>
              <button disabled={!history.future.length} onClick={() => setHistory(redoDialogueHistory)} title="重做 Ctrl+Shift+Z">重做</button>
            </div>
            <span
              className={`stage-toolbar__check-status${currentCheck ? (issues.length ? ' has-issues' : ' is-passed') : ''}`}
              title={currentCheck ? (issues.length ? `${issues.length} 项诊断` : '编译通过') : '尚未检查当前草稿'}
            >
              {currentCheck ? (issues.length ? `${issues.length} 项诊断` : '已通过') : '待检查'}
            </span>
            <div className="stage-toolbar__group">
              <button onClick={runCheck} title="检查并编译当前草稿">检查／编译</button>
              <button disabled={!currentCheck?.program} onClick={exportCompiled} title="导出编译数据">导出数据</button>
            </div>
            <div className="stage-toolbar__group">
              <button onClick={() => setResetViewToken((v) => v + 1)} title="适配全部节点到画布">适配画布</button>
            </div>
            <button
              className="save-button"
              disabled={saving}
              onClick={() => void save()}
              title="保存全部草稿"
            >
              {saving ? '保存中…' : '保存草稿'}
            </button>
          </div>
        </div>
        <DialogueCanvas key={activeKey}
          document={document}
          selection={selection}
          previewEntry={previewEntry}
          resetViewToken={resetViewToken}
          onSelection={setSelection}
          selectedIds={selectedIds} onSelectedIds={selectNodes} apiRef={canvasApi}
          onMoveMany={positions => updateDocument(draft => { positions.forEach((position, id) => { const node = draft.graph.nodes.get(id); if (node) node.position = position; }); })}
          onContextMenu={openGraphMenu}
          onDisconnectOutput={(nodeId, portId) => updateDocument(draft => {
            for (const [id, edge] of draft.graph.edges) {
              if (edge.from.nodeId === nodeId && edge.from.portId === portId) draft.graph.edges.delete(id);
            }
          })}
          onConnect={setTarget}
        />
        <div className="stage-status">
          <span>{document.graph.nodes.size} 个节点 · 已选 {selectedIds.length} 个</span>
          <span>{document.graph.edges.size} 条连线</span>
          <span>{currentCheck ? (currentCheck.program ? '编译成功' : '编译未通过') : '草稿可自由编辑，点击检查／编译验证流程'}</span>
        </div>
      </main>
      <aside className="dialogue-lab__inspector">
        <div className="inspector-title">
          <div>
            <span>{target?.kind.toUpperCase() ?? 'INSPECTOR'}</span>
            <strong>
              {selectedNode
                ? selectedNode.title
                : target?.kind === 'line'
                  ? '对白'
                  : target?.kind === 'output'
                    ? '输出端口'
                    : target?.kind === 'input'
                      ? '输入端口'
                      : '连线'}
            </strong>
          </div>
          {selectedNode ? (
            <button
              className="danger-button"
              onClick={() => deleteNode(selectedNode.id)}
            >
              删除节点
            </button>
          ) : target?.kind === 'edge' ? (
            <button
              className="danger-button"
              onClick={() =>
                updateDocument((draft) =>
                  draft.graph.edges.delete(target.edge.id),
                )
              }
            >
              删除连线
            </button>
          ) : null}
        </div>
        <div ref={inspectorRef} className="inspector-scroll" key={selectedNode?.id ?? 'edge'}>
          {selectedIds.length > 1 ? <DialogueMultiSelectionInspector nodes={selectedIds.map(id => document.graph.nodes.get(id)!)}
            onPatch={patch => updateDocument(draft => { selectedIds.forEach(id => { const node = draft.graph.nodes.get(id)!; node.display = { ...node.display, ...patch, ...(patch.whitespace ? { whitespace: { ...node.display.whitespace, ...patch.whitespace } } : {}) }; }); })}
            onArrange={arrange} onFocus={() => canvasApi.current?.focus(selectedIds)} onCopy={() => copyNodes(selectedIds)} onDelete={() => removeNodes(selectedIds)} /> : null}
          <InspectorGroup title="检查／编译结果" count={issues.length} className="compile-results">
            <p>{currentCheck ? (currentCheck.program ? '编译成功，可导出独立流程数据。' : '有错误需要处理；草稿仍可保存。') : '当前草稿尚未检查，或检查后已有修改。'}</p>
            {issues.map((item, index) => <button className={`diagnostic diagnostic--${item.severity}`} key={index} onClick={() => {
              if (item.edgeId) setSelection({ kind: 'edge', edgeId: item.edgeId });
              else if (item.nodeId) setSelection(item.portId && document.graph.nodes.get(item.nodeId)?.outputs.has(item.portId) ? { kind: 'output', nodeId: item.nodeId, portId: item.portId } : { kind: 'node', nodeId: item.nodeId });
            }}>{item.severity === 'error' ? '错误' : item.severity === 'warning' ? '警告' : '提示'} · {item.message}</button>)}
          </InspectorGroup>
          {selectedNode ? (
            <>
              <InspectorGroup property={{ nodeId: selectedNode.id, scope: 'spacing' }} title="留白设置" defaultOpen={false} focused={selection.kind === 'spacing'} focusToken={selection}
                onSelect={() => { if (selection.kind !== 'spacing') setSelection({ kind: 'spacing', nodeId: selectedNode.id }); }}>
                <p>仅作用于当前节点，随草稿保存。点击卡片留白区域也可选中此面板。</p>
                <div className="inline-actions">
                  <button onClick={() => updateNode(selectedNode.id, node => { node.display.whitespace = { ...DIALOGUE_NODE_WHITESPACE_DEFAULTS }; })}>全部保留</button>
                  <button onClick={() => updateNode(selectedNode.id, node => { node.display.whitespace = Object.fromEntries(Object.keys(DIALOGUE_NODE_WHITESPACE_DEFAULTS).map(key => [key, false])); })}>全部收紧</button>
                </div>
                {(Object.entries(WHITESPACE_LABELS) as Array<[keyof DialogueNodeWhitespace, string]>).map(([key, label]) =>
                  <label key={key} className="checkbox-field">
                    <input type="checkbox" aria-label={label} checked={selectedNode.display.whitespace?.[key] ?? true}
                      onChange={event => { const checked = event.target.checked; updateNode(selectedNode.id, node => { node.display.whitespace = { ...node.display.whitespace, [key]: checked }; }); }} />
                    {label}
                  </label>)}
              </InspectorGroup>
              <InspectorGroup property={{ nodeId: selectedNode.id, scope: 'node' }} title="节点属性" focused={selection.kind === 'node'} focusToken={selection}>
                <label className="field">
                  <span>节点 ID</span>
                  <input value={selectedNode.id} disabled />
                </label>
                <label className="field">
                  <span>标题</span>
                  <input
                    value={selectedNode.title}
                    onChange={(e) =>
                      updateNode(selectedNode.id, (node) => {
                        node.title = e.target.value;
                      })
                    }
                  />
                </label>
                <button onClick={() => setSelection({ kind: 'spacing', nodeId: selectedNode.id })}>选择留白设置</button>
                <label className="field"><span>节点类型</span><input value={DIALOGUE_NODE_KIND_LABEL[selectedNode.kind]} disabled /></label>

                <button
                  className="start-button"
                  disabled={previewEntry === selectedNode.id}
                  onClick={() => setPreviewEntry(selectedNode.id)}
                >
                  {previewEntry === selectedNode.id
                    ? '✓ 当前检查入口'
                    : '设为检查入口'}
                </button>
              </InspectorGroup>
              {selectedNode.kind === 'event' ? <EventNodeEditor node={selectedNode} selection={selection} onSelection={setSelection} onChange={next => updateDocument(draft => { draft.graph.nodes.set(next.id, next); })} /> : null}
              <InspectorGroup property={{ nodeId: selectedNode.id, scope: 'appearance' }} title="外观与尺寸" defaultOpen={false}>
                <label className="field">
                  <span>形状</span>
                  <select
                    value={selectedNode.display.shape}
                    onChange={(e) =>
                      updateNode(selectedNode.id, (node) => {
                        node.display.shape = e.target
                          .value as DialogueNodeDisplay['shape'];
                      })
                    }
                  >
                    {Object.entries(SHAPE_LABEL).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>颜色 Token</span>
                  <select
                    value={selectedNode.display.colorToken}
                    onChange={(e) =>
                      updateNode(selectedNode.id, (node) => {
                        node.display.colorToken = e.target.value;
                      })
                    }
                  >
                    {Object.keys(COLORS).map((id) => (
                      <option key={id}>{id}</option>
                    ))}
                  </select>
                </label>
                <div className="field-grid">
                  <label className="field">
                    <span>宽度（格）</span>
                    <input
                      type="number"
                      min="4"
                      max="40"
                      value={selectedNode.display.widthUnits}
                      onChange={(e) =>
                        updateNode(selectedNode.id, (node) => {
                          node.display.widthUnits = Number(e.target.value);
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>设定高度（格）</span>
                    <input
                      type="number"
                      min="3"
                      max="40"
                      value={selectedNode.display.heightUnits}
                      onChange={(e) =>
                        updateNode(selectedNode.id, (node) => {
                          node.display.heightUnits = Number(e.target.value);
                        })
                      }
                    />
                  </label>
                </div>
                <dl className="layout-summary">
                  <dt>内容最小高度</dt>
                  <dd>{selectedLayout?.minimumHeightUnits} 格</dd>
                  <dt>实际渲染高度</dt>
                  <dd>{selectedLayout?.actualHeightUnits} 格</dd>
                </dl>
                <button
                  className="fit-content-button"
                  disabled={
                    selectedNode.display.heightUnits ===
                    selectedLayout?.minimumHeightUnits
                  }
                  onClick={() =>
                    updateNode(selectedNode.id, (node) => {
                      node.display.heightUnits = requiredHeight(node);
                    })
                  }
                >
                  适应内容高度
                </button>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={selectedNode.display.collapsed ?? false}
                    onChange={(e) =>
                      updateNode(selectedNode.id, (node) => {
                        node.display.collapsed = e.target.checked;
                      })
                    }
                  />
                  折叠内容布局
                </label>
              </InspectorGroup>

            </>
          ) : null}
          {selectedNode?.kind === 'choice' ? <InspectorGroup property={{ nodeId: selectedNode.id, scope: 'lines' }} title="对白" count={selectedNode.lines.size} focused={selection.kind === 'line'} focusToken={selection}>
            <div className="collection-actions">
              <button onClick={() => addLine(selectedNode)}>＋对白</button>
              <select aria-label="选择对白" value={selection.kind === 'line' ? selection.lineId : ''} onChange={e => { if (e.target.value) setSelection({ kind: 'line', nodeId: selectedNode.id, lineId: e.target.value }); }}>
                <option value="">选择对白</option>
                {selectedNode.lineOrder.map((id, index) => <option key={id} value={id}>对白 {index + 1} · {selectedNode.lines.get(id)?.speaker || '无说话者'}</option>)}
              </select>
              <button disabled={selection.kind !== 'line'} onClick={() => {
                if (selection.kind !== 'line') return;
                updateNode(selectedNode.id, node => { node.lines.delete(selection.lineId); node.lineOrder = node.lineOrder.filter(id => id !== selection.lineId); });
                setSelection({ kind: 'node', nodeId: selectedNode.id });
              }}>删除选中对白</button>
            </div>
            <div className="inspector-collection">
          {selectedNode.lineOrder.map((id, index) => {
            const target = { node: selectedNode, line: selectedNode.lines.get(id)! };
            return (
            <InspectorGroup property={{ nodeId: selectedNode.id, scope: 'line', id }} key={id} title={`对白 ${index + 1}`} focused={selection.kind === 'line' && selection.lineId === id} focusToken={selection}>
              <label className="field">
                <span>对白 ID</span>
                <input value={target.line.id} disabled />
              </label>
              <label className="field">
                <span>说话者</span>
                <input
                  value={target.line.speaker}
                  onChange={(e) =>
                    updateNode(target.node.id, (node) => {
                      const line = node.lines.get(target.line.id);
                      if (line) line.speaker = e.target.value;
                    })
                  }
                />
              </label>
              <label className="field">
                <span>对白内容</span>
                <textarea
                  rows={7}
                  value={target.line.text}
                  onChange={(e) =>
                    updateNode(target.node.id, (node) => {
                      const line = node.lines.get(target.line.id);
                      if (line) line.text = e.target.value;
                    })
                  }
                />
              </label>
            </InspectorGroup>
            );
          })}
            </div>
            {!selectedNode.lines.size ? <p>暂无对白，点击“＋对白”添加。</p> : null}
          </InspectorGroup> : null}
          {selectedNode ? <InspectorGroup property={selectedNode.kind === 'condition' ? undefined : { nodeId: selectedNode.id, scope: 'outputs' }} title={selectedNode.kind === 'choice' ? '选项' : '输出端口'} count={selectedNode.outputs.size} focused={selection.kind === 'output'} focusToken={selection}>
            {selectedNode.kind === 'choice' ? <div className="collection-actions">
              <button onClick={() => addOutput(selectedNode)}>＋选项</button>
              <select aria-label="选择选项" value={selection.kind === 'output' ? selection.portId : ''} onChange={e => { if (e.target.value) setSelection({ kind: 'output', nodeId: selectedNode.id, portId: e.target.value }); }}>
                <option value="">选择选项</option>
                {selectedNode.outputOrder.map((id, index) => <option key={id} value={id}>选项 {index + 1} · {selectedNode.outputs.get(id)?.label}</option>)}
              </select>
              <button disabled={selection.kind !== 'output'} onClick={() => {
                if (selection.kind !== 'output') return;
                updateNode(selectedNode.id, (node, draft) => {
                  node.outputs.delete(selection.portId); node.outputOrder = node.outputOrder.filter(id => id !== selection.portId);
                  for (const [id, edge] of draft.graph.edges) if (edge.from.nodeId === node.id && edge.from.portId === selection.portId) draft.graph.edges.delete(id);
                });
                setSelection({ kind: 'node', nodeId: selectedNode.id });
              }}>删除选中选项及连线</button>
            </div> : null}
            <div className="inspector-collection">
          {selectedNode?.outputOrder.map((id, index) => {
            const target = { node: selectedNode, port: selectedNode.outputs.get(id)! };
            return (
            <InspectorGroup property={selectedNode.kind === 'condition' ? undefined : { nodeId: selectedNode.id, scope: 'output', id }} key={id} title={selectedNode.kind === 'choice' ? `选项 ${index + 1}` : `输出端口 ${index + 1}`} focused={selection.kind === 'output' && selection.portId === id} focusToken={selection}>
              <label className="field">
                <span>输出端口 ID</span>
                <input value={target.port.id} disabled />
              </label>
              {target.node.kind === 'condition' ? <p>固定出口：{target.port.branch === 'true' ? '成立' : '不成立'}</p> :
                <label className="field"><span>{target.node.kind === 'choice' ? '选项文本' : '出口标签'}</span><input
                  value={target.port.label ?? ''}
                  onChange={e => updateNode(target.node.id, node => {
                    const port = node.outputs.get(target.port.id); if (port) port.label = e.target.value || undefined;
                  })}
                /></label>}
              <p>从画布上的紫色出口圆点拖到目标节点的灰色入口圆点，即可添加连线。</p>
              <div className="connection-list">{[...document.graph.edges.values()].filter(edge => edge.from.nodeId === target.node.id && edge.from.portId === target.port.id).map(edge =>
                <div key={edge.id}><button onClick={() => setSelection({ kind: 'edge', edgeId: edge.id })}>→ {document.graph.nodes.get(edge.to.nodeId)?.title ?? edge.to.nodeId}</button>
                  <button aria-label={`删除连线 ${edge.id}`} onClick={() => updateDocument(draft => { draft.graph.edges.delete(edge.id); })}>删除</button></div>)}</div>

            </InspectorGroup>
            );
          })}
            </div>
            {!selectedNode.outputs.size ? <p>运行到此将正常结束对话。</p> : null}
          </InspectorGroup> : null}
          {selectedNode?.inputOrder.map((id, index) => {
            const target = { node: selectedNode, port: selectedNode.inputs.get(id)! };
            return (
            <InspectorGroup property={{ nodeId: selectedNode.id, scope: 'input', id }} key={id} title={`输入端口 ${index + 1}`} focused={selection.kind === 'input' && selection.portId === id} focusToken={selection}>
              <label className="field">
                <span>输入端口 ID</span>
                <input value={target.port.id} disabled />
              </label>
              <label className="field">
                <span>标签</span>
                <input
                  value={target.port.label ?? ''}
                  onChange={(e) =>
                    updateNode(target.node.id, (node) => {
                      const port = node.inputs.get(target.port.id);
                      if (port) port.label = e.target.value || undefined;
                    })
                  }
                />
              </label>
              <p>每张卡片固定一个输入，可接收多条连线。</p>
            </InspectorGroup>
            );
          })}
          {selectedNode?.kind === 'condition' ? (() => {
            const rule = selectedNode.condition;
            const conditions = rule ? rule.type === 'compare' ? [rule] : rule.conditions : [];
            const mode = rule?.type === 'any' ? 'any' : 'all';
            const change = (next: typeof conditions) => updateNode(selectedNode.id, node => { if (node.kind === 'condition') node.condition = { type: mode, conditions: next }; });
            return <InspectorGroup property={{ nodeId: selectedNode.id, scope: 'conditions' }} title="判断条件" count={conditions.length} focused={selection.kind === 'condition-mode' || selection.kind === 'condition'} focusToken={selection}>
              <label className="field"><span>满足方式</span>
                <select aria-label="满足方式" value={mode} onChange={e => updateNode(selectedNode.id, node => { if (node.kind === 'condition') node.condition = { type: e.target.value as 'all' | 'any', conditions }; })}>
                  <option value="all">全部满足</option><option value="any">任一满足</option>
                </select>
              </label>
              <div className="collection-actions">
                <button onClick={() => { change([...conditions, { type: 'compare', left: { type: 'memory', key: '', path: [] }, operator: 'eq', right: { type: 'literal', value: 0 } }]); setSelection({ kind: 'condition', nodeId: selectedNode.id, conditionIndex: conditions.length }); }}>添加条件</button>
                <select aria-label="选择条件" value={selection.kind === 'condition' ? String(selection.conditionIndex) : ''} onChange={e => { if (e.target.value !== '') setSelection({ kind: 'condition', nodeId: selectedNode.id, conditionIndex: Number(e.target.value) }); }}>
                  <option value="">选择条件</option>
                  {conditions.map((_, index) => <option key={index} value={index}>条件 {index + 1}</option>)}
                </select>
                <button disabled={selection.kind !== 'condition'} onClick={() => {
                  if (selection.kind !== 'condition') return;
                  change(conditions.filter((_, index) => index !== selection.conditionIndex));
                  setSelection({ kind: 'condition-mode', nodeId: selectedNode.id });
                }}>删除选中条件</button>
              </div>
              <div className="inspector-collection">
                {conditions.map((condition, index) => <InspectorGroup property={{ nodeId: selectedNode.id, scope: 'condition', index }} key={`condition:${selectedNode.id}:${index}`} title={`条件 ${index + 1}`} focused={selection.kind === 'condition' && selection.conditionIndex === index} focusToken={selection}>
                  <ComparisonEditor value={condition} onChange={next => change(conditions.map((item, i) => i === index ? next : item))} />
                </InspectorGroup>)}
              </div>
              {!conditions.length ? <p>暂无条件，点击“添加条件”添加。</p> : null}
              <p>复杂组合通过成立／不成立出口连接其他判断卡片。</p>
            </InspectorGroup>;
          })() : null}
          {target?.kind === 'edge' ? (
            <InspectorGroup title="连线">
              <label className="field">
                <span>连线 ID</span>
                <input value={target.edge.id} disabled />
              </label>
              <p>
                {target.edge.from.nodeId} / {target.edge.from.portId}
              </p>
              <p>
                → {target.edge.to.nodeId} / {target.edge.to.portId}
              </p>
            </InspectorGroup>
          ) : null}
          {selectedIssues.length ? (
            <InspectorGroup title="选中项诊断" className="issue-card">
              {selectedIssues.map((item, index) => (
                <p key={`${item.code}:${index}`}>{item.message}</p>
              ))}
            </InspectorGroup>
          ) : null}
        </div>
      </aside>
    </div>
    </DialoguePropertyClipboardContext.Provider>
  );
};
