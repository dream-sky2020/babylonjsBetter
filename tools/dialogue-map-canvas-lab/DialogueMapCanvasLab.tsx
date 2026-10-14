import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DIALOGUE_MAP_GRID_SIZE,
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
import { DialogueRuleEditor } from './DialogueRuleEditor';
import { dialogueRuleCatalog } from './dialogueRuleCatalog';
import { createDialogueHistory, commitDialogueHistory, undoDialogueHistory, redoDialogueHistory } from './dialogueHistory';
import { fitGraphView, graphWorldPoint, graphScreenPoint, zoomGraphViewWithWheel } from '@/core/ui/node-graph/graphViewport';
import { getDialogueCanvasLayout as computeDialogueNodeLayout, measureDialogueCanvasText } from './dialogueCanvasLayout';
import { getDialogueNodeDisplayLines, DIALOGUE_NODE_TEXT_STYLE, dialogueNodeTextFont } from '@/core/dialogue-map/dialogueNodeLayout';
import { layoutCanvasText, type CanvasTextLayout } from '@/core/ui/canvas-text/canvasTextLayout';
import { drawDialogueCanvasText, getDialogueCanvasFontSize, getDialogueCanvasTextDetail, getDialogueCanvasTextWidthInset } from './dialogueCanvasText';

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

type CanvasProps = {
  document: DialogueEditorDocument;
  selection: DialogueEditorSelection;
  previewEntry?: string;
  resetViewToken: number;
  onSelection: (value: DialogueEditorSelection) => void;
  onMove: (nodeId: string, position: Point) => void;
  onConnect: (
    fromNodeId: string,
    outputId: string,
    toNodeId: string,
    inputId: string,
  ) => void;
  onPreview: (nodeId: string) => void;
};
const DialogueCanvas: React.FC<CanvasProps> = ({
  document,
  selection,
  previewEntry,
  resetViewToken,
  onSelection,
  onMove,
  onConnect,
  onPreview,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [view, setView] = useState({ x: 48, y: 48, scale: 1 });
  const [connectPointer, setConnectPointer] = useState<Point>();
  const gesture = useRef<{
    mode: 'pan' | 'node' | 'connect';
    start: Point;
    origin: Point;
    nodeId?: string;
    portId?: string;
    nodeOrigin?: Point;
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
      for (const [id, value] of layout.outputRows)
        if (dialogueGridRectContains(value.rect, local))
          return { kind: 'output', nodeId: node.id, portId: id };
      for (const [id, value] of layout.lineRows)
        if (dialogueGridRectContains(value.rect, local))
          return node.kind === 'choice' ? { kind: 'line', nodeId: node.id, lineId: id } : { kind: 'node', nodeId: node.id };
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
      ctx.strokeStyle = selected(selection, 'node', node.id)
        ? '#cbd5e1'
        : '#465369';
      ctx.lineWidth = selected(selection, 'node', node.id) ? 2.5 : 1.2;
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
          if (selected(selection, 'line', id)) {
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
  }, [document, previewEntry, selection, size, view, connectPointer]);
  const point = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const hoveredInput = connectPointer ? hitTest(connectPointer) : undefined;
  const selfConnection = gesture.current?.mode === 'connect' && hoveredInput?.kind === 'input'
    && hoveredInput.nodeId === gesture.current.nodeId;
  const occupiedOutput = (nodeId: string, portId: string) => [...document.graph.edges.values()]
    .some(edge => edge.from.nodeId === nodeId && edge.from.portId === portId);
  const selectedOutputOccupied = selection.kind === 'output' && occupiedOutput(selection.nodeId, selection.portId);
  return (
    <div className="dialogue-canvas" ref={hostRef}>
      <canvas
        ref={canvasRef}
        onContextMenu={(event) => {
          event.preventDefault();
          const hit = hitTest(point(event));
          if (hit && hit.kind !== 'edge') onPreview(hit.nodeId);
        }}
        onPointerDown={(event) => {
          const p = point(event);
          const hit = hitTest(p);
          event.currentTarget.setPointerCapture(event.pointerId);
          if (hit) {
            onSelection(hit);
            if (hit.kind === 'output' && isPortAnchor(p, hit.nodeId, hit.portId) && !occupiedOutput(hit.nodeId, hit.portId)) {
              gesture.current = {
                mode: 'connect',
                start: p,
                origin: { x: view.x, y: view.y },
                nodeId: hit.nodeId,
                portId: hit.portId,
              };
              setConnectPointer(p);
            } else if (hit.kind === 'node') {
              const node = document.graph.nodes.get(hit.nodeId)!;
              gesture.current = {
                mode: 'node',
                start: p,
                origin: { x: view.x, y: view.y },
                nodeId: hit.nodeId,
                nodeOrigin: { ...node.position },
              };
            }
          } else
            gesture.current = {
              mode: 'pan',
              start: p,
              origin: { x: view.x, y: view.y },
            };
        }}
        onPointerMove={(event) => {
          const active = gesture.current;
          if (!active) return;
          const p = point(event);
          if (active.mode === 'connect') setConnectPointer(p);
          if (active.mode === 'pan')
            setView((v) => ({
              ...v,
              x: active.origin.x + p.x - active.start.x,
              y: active.origin.y + p.y - active.start.y,
            }));
          if (active.mode === 'node' && active.nodeId && active.nodeOrigin)
            onMove(active.nodeId, {
              x: snap(
                active.nodeOrigin.x + (p.x - active.start.x) / view.scale,
              ),
              y: snap(
                active.nodeOrigin.y + (p.y - active.start.y) / view.scale,
              ),
            });
        }}
        onPointerUp={(event) => {
          const active = gesture.current;
          if (active?.mode === 'connect' && active.nodeId && active.portId) {
            const releasedAt = point(event);
            const hit = hitTest(releasedAt);
            if (hit?.kind === 'input' && hit.nodeId !== active.nodeId && isPortAnchor(releasedAt, hit.nodeId, hit.portId))
              onConnect(active.nodeId, active.portId, hit.nodeId, hit.portId);
          }
          gesture.current = undefined;
          setConnectPointer(undefined);
        }}
        onPointerCancel={() => {
          gesture.current = undefined;
          setConnectPointer(undefined);
        }}
      />
      <div className="dialogue-canvas__hint">
        {selfConnection
          ? '不能连接到当前节点的入口'
          : selectedOutputOccupied
            ? '此出口已有连线，请先删除旧连线'
            : '滚轮以鼠标位置缩放 · 从紫色出口圆点拖到其他节点的灰色入口圆点连线 · 右键设置检查入口'}
      </div>
      <div className="dialogue-canvas__zoom">
        {Math.round(view.scale * 100)}%
      </div>
    </div>
  );
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
const InspectorGroup: React.FC<{
  title: string;
  count?: number;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ title, count, defaultOpen = true, className = '', children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return <section className={`inspector-group ${className}`}>
    <button type="button" className="inspector-group__heading" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span className="inspector-group__chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
      <strong>{title}</strong>
      {count !== undefined ? <small>{count}</small> : null}
    </button>
    {open ? <div className="inspector-group__body">{children}</div> : null}
  </section>;
};
export const DialogueMapCanvasLab: React.FC = () => {
  const [history, setHistory] = useState(createDialogueHistory);
  const library = history.present;
  const setLibrary = useCallback((update: (current: DialogueEditorDocumentLibrary) => DialogueEditorDocumentLibrary) => {
    setHistory(current => commitDialogueHistory(current, update(current.present)));
  }, []);
  const [selectedKey, setActiveKey] = useState('');
  const activeKey = library[selectedKey] ? selectedKey : Object.keys(library)[0] ?? '';
  const [selection, setSelection] = useState<DialogueEditorSelection>({
    kind: 'node',
    nodeId: '',
  });
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
  const target = document
    ? resolveDialogueEditorSelection(document, selection)
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
      setSelection({ kind: 'node', nodeId: first });
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
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault(); setHistory(event.shiftKey ? redoDialogueHistory : undoDialogueHistory);
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault(); setHistory(redoDialogueHistory);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
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
  if (!document)
    return (
      <main className="dialogue-empty">
        <h1>Dialogue Map Canvas Lab</h1>
        <p className={isError ? 'is-error' : ''}>{message}</p>
        <button onClick={() => void load()}>重新加载</button>
        <button disabled={!history.future.length} onClick={() => setHistory(redoDialogueHistory)}>重做</button>
      </main>
    );
  const selectPreset = (key: string) => {
    setActiveKey(key);
    setSelection({
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
    setSelection({ kind: 'node', nodeId: 'start' });
    setPreviewEntries((current) => {
      const entries = { ...current, [key]: 'start' };
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(entries));
      return entries;
    });
  };
  const addNode = (kind: DialogueNodeKind) => {
    const id = makeId(kind, new Set(document.graph.nodes.keys()));
    updateDocument((draft) =>
      draft.graph.nodes.set(
        id,
        createDialogueEditorNode(id, {
          x: GRID * (4 + draft.graph.nodes.size * 2),
          y: GRID * (4 + draft.graph.nodes.size),
        }, kind),
      ),
    );
    setSelection({ kind: 'node', nodeId: id });
  };
  const deleteNode = (nodeId: string) => {
    const remaining = [...document.graph.nodes.keys()].filter(
      (id) => id !== nodeId,
    );
    updateDocument((draft) => {
      draft.graph.nodes.delete(nodeId);
      [...draft.graph.edges].forEach(([id, edge]) => {
        if (edge.from.nodeId === nodeId || edge.to.nodeId === nodeId)
          draft.graph.edges.delete(id);
      });
    });
    const next = remaining[0] ?? '';
    setSelection({ kind: 'node', nodeId: next });
    if (previewEntry === nodeId && next) setPreviewEntry(next);
  };
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
    <div className="dialogue-lab">
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
                  selection.kind === 'node' && selection.nodeId === node.id
                    ? 'is-active'
                    : ''
                }
                onClick={() => setSelection({ kind: 'node', nodeId: node.id })}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setPreviewEntry(node.id);
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
        <DialogueCanvas
          document={document}
          selection={selection}
          previewEntry={previewEntry}
          resetViewToken={resetViewToken}
          onSelection={setSelection}
          onMove={(id, position) =>
            updateNode(id, (node) => {
              node.position = position;
            })
          }
          onConnect={setTarget}
          onPreview={setPreviewEntry}
        />
        <div className="stage-status">
          <span>{document.graph.nodes.size} 个节点</span>
          <span>{document.graph.edges.size} 条连线</span>
          <span>{currentCheck ? (currentCheck.program ? '编译成功' : '编译未通过') : '草稿可自由编辑，点击检查／编译验证流程'}</span>
        </div>
      </main>
      <aside className="dialogue-lab__inspector">
        <div className="inspector-title">
          <div>
            <span>{target?.kind.toUpperCase() ?? 'INSPECTOR'}</span>
            <strong>
              {target?.kind === 'node'
                ? target.node.title
                : target?.kind === 'line'
                  ? '对白'
                  : target?.kind === 'output'
                    ? '输出端口'
                    : target?.kind === 'input'
                      ? '输入端口'
                      : '连线'}
            </strong>
          </div>
          {target?.kind === 'node' ? (
            <button
              className="danger-button"
              disabled={document.graph.nodes.size <= 1}
              onClick={() => deleteNode(target.node.id)}
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
        <div className="inspector-scroll">
          <InspectorGroup title="检查／编译结果" count={issues.length} className="compile-results">
            <p>{currentCheck ? (currentCheck.program ? '编译成功，可导出独立流程数据。' : '有错误需要处理；草稿仍可保存。') : '当前草稿尚未检查，或检查后已有修改。'}</p>
            {issues.map((item, index) => <button className={`diagnostic diagnostic--${item.severity}`} key={index} onClick={() => {
              if (item.edgeId) setSelection({ kind: 'edge', edgeId: item.edgeId });
              else if (item.nodeId) setSelection(item.portId && document.graph.nodes.get(item.nodeId)?.outputs.has(item.portId) ? { kind: 'output', nodeId: item.nodeId, portId: item.portId } : { kind: 'node', nodeId: item.nodeId });
            }}>{item.severity === 'error' ? '错误' : item.severity === 'warning' ? '警告' : '提示'} · {item.message}</button>)}
          </InspectorGroup>
          {target?.kind === 'node' ? (
            <>
              <InspectorGroup title="节点属性">
                <label className="field">
                  <span>节点 ID</span>
                  <input value={target.node.id} disabled />
                </label>
                <label className="field">
                  <span>标题</span>
                  <input
                    value={target.node.title}
                    onChange={(e) =>
                      updateNode(target.node.id, (node) => {
                        node.title = e.target.value;
                      })
                    }
                  />
                </label>
                <label className="field"><span>节点类型</span><input value={DIALOGUE_NODE_KIND_LABEL[target.node.kind]} disabled /></label>
                <DialogueRuleEditor key={target.node.id} node={target.node} onChange={next => updateDocument(draft => { draft.graph.nodes.set(next.id, next); })} />
                <button
                  className="start-button"
                  disabled={previewEntry === target.node.id}
                  onClick={() => setPreviewEntry(target.node.id)}
                >
                  {previewEntry === target.node.id
                    ? '✓ 当前检查入口'
                    : '设为检查入口'}
                </button>
              </InspectorGroup>
              <InspectorGroup title="外观与尺寸" defaultOpen={false}>
                <label className="field">
                  <span>形状</span>
                  <select
                    value={target.node.display.shape}
                    onChange={(e) =>
                      updateNode(target.node.id, (node) => {
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
                    value={target.node.display.colorToken}
                    onChange={(e) =>
                      updateNode(target.node.id, (node) => {
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
                      value={target.node.display.widthUnits}
                      onChange={(e) =>
                        updateNode(target.node.id, (node) => {
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
                      value={target.node.display.heightUnits}
                      onChange={(e) =>
                        updateNode(target.node.id, (node) => {
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
                    target.node.display.heightUnits ===
                    selectedLayout?.minimumHeightUnits
                  }
                  onClick={() =>
                    updateNode(target.node.id, (node) => {
                      node.display.heightUnits = requiredHeight(node);
                    })
                  }
                >
                  适应内容高度
                </button>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={target.node.display.collapsed ?? false}
                    onChange={(e) =>
                      updateNode(target.node.id, (node) => {
                        node.display.collapsed = e.target.checked;
                      })
                    }
                  />
                  折叠内容布局
                </label>
              </InspectorGroup>
              <InspectorGroup title="内容与端口" count={target.node.lines.size + target.node.inputs.size + target.node.outputs.size}>
                <div className="inline-actions content-actions">
                    {target.node.kind === 'choice' ? <button onClick={() => addLine(target.node)}>＋对白</button> : null}
                    {target.node.kind === 'choice' ? <button onClick={() => addOutput(target.node)}>＋选项</button> : null}
                </div>
                {target.node.lineOrder.map((id) => (
                  <button
                    className="content-row"
                    key={id}
                    onClick={() =>
                      setSelection({
                        kind: 'line',
                        nodeId: target.node.id,
                        lineId: id,
                      })
                    }
                  >
                    对白 · {target.node.lines.get(id)?.speaker || id}
                  </button>
                ))}
                {target.node.inputOrder.map((id) => (
                  <button
                    className="content-row"
                    key={id}
                    onClick={() =>
                      setSelection({
                        kind: 'input',
                        nodeId: target.node.id,
                        portId: id,
                      })
                    }
                  >
                    输入 · {target.node.inputs.get(id)?.label || id}
                  </button>
                ))}
                {target.node.outputOrder.map((id) => (
                  <button
                    className="content-row"
                    key={id}
                    onClick={() =>
                      setSelection({
                        kind: 'output',
                        nodeId: target.node.id,
                        portId: id,
                      })
                    }
                  >
                    输出 · {target.node.outputs.get(id)?.label || id}
                  </button>
                ))}
                {!target.node.outputs.size ? (
                  <p>运行到此将正常结束对话。</p>
                ) : null}
              </InspectorGroup>
            </>
          ) : null}
          {target?.kind === 'line' ? (
            <InspectorGroup title="对白内容">
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
          ) : null}
          {target?.kind === 'output' ? (
            <InspectorGroup title="输出端口">
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
              {target.node.kind === 'choice' ? <button
                className="danger-wide"
                onClick={() => {
                  updateNode(target.node.id, (node, draft) => {
                    node.outputs.delete(target.port.id);
                    node.outputOrder = node.outputOrder.filter(
                      (id) => id !== target.port.id,
                    );
                    [...draft.graph.edges].forEach(([id, edge]) => {
                      if (
                        edge.from.nodeId === node.id &&
                        edge.from.portId === target.port.id
                      )
                        draft.graph.edges.delete(id);
                    });
                  });
                  setSelection({ kind: 'node', nodeId: target.node.id });
                }}
              >
                删除输出及连线
              </button> : null}
            </InspectorGroup>
          ) : null}
          {target?.kind === 'input' ? (
            <InspectorGroup title="输入端口">
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
          ) : null}
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
  );
};
