import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { automaticNumberCurveTangent, readNumberCurveKeys, sampleNumberCurve, type NumberCurveInterpolation, type NumberCurveKey, type NumberCurveTangentMode, type SignalGraphDocument } from '@/core/animation/signal';
import type { AnimationObjectRecord, PreviewSignalBinding } from './animationWorkspace.ts';
import { curveSelectionId, moveCurveKeys, panCurveView, pasteCurveKeys, selectCurveKeysInRect, zoomCurveView, type CurveClipboardKey, type CurveKeySelection } from './curveEditorModel.ts';

type Props = Readonly<{
  graph: SignalGraphDocument;
  bindings: readonly PreviewSignalBinding[];
  objects: readonly AnimationObjectRecord[];
  selectedObjectId: string | null;
  selectedNodeId: string | null;
  time: number;
  duration: number;
  onTimeChange(time: number): void;
  onSelectedNodeIdChange(id: string): void;
  onGraphChange(graph: SignalGraphDocument): void;
  onCreateCurve(): void;
  onBeginEdit(): void;
  onEndEdit(): void;
}>;

const WIDTH = 1000;
const HEIGHT = 400;
const COLORS = ['#78b4d2', '#d79c61', '#82bd89', '#c08fc9', '#d2c369', '#d97c83'];
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `key_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function CurveEditor({ graph, bindings, objects, selectedObjectId, selectedNodeId, time, duration, onTimeChange, onSelectedNodeIdChange, onGraphChange, onCreateCurve, onBeginEdit, onEndEdit }: Props) {
  const curves = graph.nodes.filter(node => node.typeId === 'core.curve.number');
  const activeCurve = curves.find(node => node.id === selectedNodeId) ?? curves[0];
  const selectedObject = objects.find(object => object.id === selectedObjectId);
  const propertyTracks = bindings.flatMap(binding => {
    if (binding.objectId !== selectedObjectId || binding.adapterTypeId !== 'babylon.transform-component.number') return [];
    const output = graph.outputs.find(item => item.id === binding.outputId);
    const curve = output ? curves.find(node => node.id === output.source.nodeId) : undefined;
    return curve ? [{ binding, curve, path: String(binding.config.path ?? '') }] : [];
  });
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [selection, setSelection] = useState<CurveKeySelection[]>([]);
  const [clipboard, setClipboard] = useState<CurveClipboardKey[]>([]);
  const [marquee, setMarquee] = useState<null | { left: number; top: number; width: number; height: number }>(null);
  const [snap, setSnap] = useState(true);
  const [fps, setFps] = useState(60);
  const [valueStep, setValueStep] = useState(.01);
  const [view, setView] = useState({ timeMin: 0, timeMax: duration, valueMin: -1, valueMax: 1 });
  const plotRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef(graph);
  const dragRef = useRef<null | { startX: number; startY: number; curves: Map<string, readonly NumberCurveKey[]>; selection: CurveKeySelection[] }>(null);
  const tangentDragRef = useRef<null | { curveId: string; keyId: string; side: 'in' | 'out'; keyX: number; keyY: number }>(null);
  const panRef = useRef<null | { startX: number; startY: number; view: typeof view }>(null);
  const marqueeRef = useRef<null | { startX: number; startY: number; currentX: number; currentY: number; additive: boolean; base: CurveKeySelection[]; points: Array<CurveKeySelection & { x: number; y: number }> }>(null);
  useEffect(() => { graphRef.current = graph; }, [graph]);
  const keysByCurve = new Map(curves.map(curve => [curve.id, readNumberCurveKeys(curve.config.keys)]));
  const selectedSet = new Set(selection.map(curveSelectionId));
  const activeSelection = [...selection].reverse().find(item => item.curveId === activeCurve?.id) ?? selection.at(-1);
  const activeKey = activeSelection ? keysByCurve.get(activeSelection.curveId)?.find(key => key.id === activeSelection.keyId) : undefined;
  const toX = (value: number) => (value - view.timeMin) / Math.max(.000001, view.timeMax - view.timeMin) * WIDTH;
  const toY = (value: number) => HEIGHT - (value - view.valueMin) / Math.max(.000001, view.valueMax - view.valueMin) * HEIGHT;
  const updateCurveKeys = (curveId: string, keys: readonly NumberCurveKey[]) => onGraphChange({ ...graph, nodes: graph.nodes.map(node => node.id === curveId ? { ...node, config: { ...node.config, keys: [...keys].sort((a, b) => a.time - b.time) } } : node) });
  const updateKey = (curveId: string, keyId: string, patch: Partial<NumberCurveKey>) => updateCurveKeys(curveId, (keysByCurve.get(curveId) ?? []).map(key => key.id === keyId ? { ...key, ...patch } : key));
  const updateSelectedKey = (patch: Partial<NumberCurveKey>) => activeSelection && updateKey(activeSelection.curveId, activeSelection.keyId, patch);
  const fitAll = () => {
    const visibleKeys = [...keysByCurve].filter(([id]) => !hiddenIds.has(id)).flatMap(([, keys]) => keys);
    const min = visibleKeys.length ? Math.min(...visibleKeys.map(key => key.value)) : -1;
    const max = visibleKeys.length ? Math.max(...visibleKeys.map(key => key.value)) : 1;
    const padding = Math.max(.1, (max - min) * .12);
    setView({ timeMin: 0, timeMax: duration, valueMin: min - padding, valueMax: max + padding });
  };
  const fitSelection = () => {
    const selectedKeys = selection.flatMap(item => keysByCurve.get(item.curveId)?.filter(key => key.id === item.keyId) ?? []);
    if (!selectedKeys.length) return fitAll();
    const tMin = Math.min(...selectedKeys.map(key => key.time)); const tMax = Math.max(...selectedKeys.map(key => key.time));
    const vMin = Math.min(...selectedKeys.map(key => key.value)); const vMax = Math.max(...selectedKeys.map(key => key.value));
    setView({ timeMin: Math.max(0, tMin - Math.max(.05, (tMax - tMin) * .2)), timeMax: Math.min(duration, tMax + Math.max(.05, (tMax - tMin) * .2)), valueMin: vMin - Math.max(.1, (vMax - vMin) * .2), valueMax: vMax + Math.max(.1, (vMax - vMin) * .2) });
  };
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const rect = plotRef.current?.getBoundingClientRect(); if (!rect) return;
      const tangent = tangentDragRef.current;
      if (tangent) {
        const pointerX = (event.clientX - rect.left) / rect.width * WIDTH;
        const pointerY = (event.clientY - rect.top) / rect.height * HEIGHT;
        const deltaTime = (pointerX - tangent.keyX) / WIDTH * (view.timeMax - view.timeMin);
        if (Math.abs(deltaTime) < 1e-5) return;
        const deltaValue = -(pointerY - tangent.keyY) / HEIGHT * (view.valueMax - view.valueMin);
        const slope = Number((deltaValue / deltaTime).toPrecision(8));
        const currentGraph = graphRef.current;
        const curveNode = currentGraph.nodes.find(node => node.id === tangent.curveId);
        const currentKeys = readNumberCurveKeys(curveNode?.config.keys);
        const key = currentKeys.find(item => item.id === tangent.keyId);
        if (!key) return;
        const patch = key.tangentMode === 'free' ? { inTangent: slope, outTangent: slope } : tangent.side === 'in' ? { inTangent: slope } : { outTangent: slope };
        onGraphChange({ ...currentGraph, nodes: currentGraph.nodes.map(node => node.id === tangent.curveId ? { ...node, config: { ...node.config, keys: currentKeys.map(item => item.id === tangent.keyId ? { ...item, ...patch } : item) } } : node) }); return;
      }
      const drag = dragRef.current;
      if (drag) {
        const deltaTime = (event.clientX - drag.startX) / rect.width * (view.timeMax - view.timeMin);
        const deltaValue = -(event.clientY - drag.startY) / rect.height * (view.valueMax - view.valueMin);
        const moved = moveCurveKeys(drag.curves, drag.selection, deltaTime, deltaValue, duration, snap ? fps : null, snap ? valueStep : null);
        onGraphChange({ ...graph, nodes: graph.nodes.map(node => moved.has(node.id) ? { ...node, config: { ...node.config, keys: moved.get(node.id) } } : node) }); return;
      }
      const pan = panRef.current;
      if (pan) {
        const deltaTime = -(event.clientX - pan.startX) / rect.width * (pan.view.timeMax - pan.view.timeMin);
        const deltaValue = (event.clientY - pan.startY) / rect.height * (pan.view.valueMax - pan.view.valueMin);
        setView(panCurveView(pan.view, deltaTime, deltaValue, duration)); return;
      }
      const box = marqueeRef.current;
      if (box) {
        box.currentX = event.clientX - rect.left; box.currentY = event.clientY - rect.top;
        setMarquee({ left: Math.min(box.startX, box.currentX), top: Math.min(box.startY, box.currentY), width: Math.abs(box.currentX - box.startX), height: Math.abs(box.currentY - box.startY) });
      }
    };
    const end = () => {
      if (dragRef.current || tangentDragRef.current) { dragRef.current = null; tangentDragRef.current = null; onEndEdit(); return; }
      if (panRef.current) { panRef.current = null; return; }
      const box = marqueeRef.current; if (!box) return;
      const hits = selectCurveKeysInRect(box.points, { left: Math.min(box.startX, box.currentX), top: Math.min(box.startY, box.currentY), right: Math.max(box.startX, box.currentX), bottom: Math.max(box.startY, box.currentY) });
      const combined = box.additive ? [...box.base, ...hits] : hits;
      setSelection([...new Map(combined.map(item => [curveSelectionId(item), item])).values()]);
      marqueeRef.current = null; setMarquee(null);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); };
  }, [duration, fps, graph, onEndEdit, onGraphChange, snap, valueStep, view]);
  const startKeyDrag = (event: ReactPointerEvent, item: CurveKeySelection, key: NumberCurveKey) => {
    if (event.button !== 0) return; event.stopPropagation();
    const id = curveSelectionId(item); const nextSelection = event.shiftKey ? (selectedSet.has(id) ? selection.filter(current => curveSelectionId(current) !== id) : [...selection, item]) : selectedSet.has(id) ? selection : [item];
    setSelection(nextSelection); onSelectedNodeIdChange(item.curveId); onTimeChange(key.time); onBeginEdit();
    dragRef.current = { startX: event.clientX, startY: event.clientY, curves: keysByCurve, selection: nextSelection };
  };
  const addKey = () => {
    if (!activeCurve) return;
    const keys = keysByCurve.get(activeCurve.id) ?? [];
    const value = sampleNumberCurve(keys, time, String(activeCurve.config.interpolation ?? 'linear') as NumberCurveInterpolation);
    const key: NumberCurveKey = { id: makeId(), time: Number(time.toFixed(3)), value, interpolation: 'bezier', tangentMode: 'auto' };
    updateCurveKeys(activeCurve.id, [...keys, key]); setSelection([{ curveId: activeCurve.id, keyId: key.id }]);
  };
  const deleteSelected = () => {
    if (!selection.length) return;
    const remove = new Set(selection.map(curveSelectionId));
    onGraphChange({ ...graph, nodes: graph.nodes.map(node => keysByCurve.has(node.id) ? { ...node, config: { ...node.config, keys: keysByCurve.get(node.id)?.filter(key => !remove.has(curveSelectionId({ curveId: node.id, keyId: key.id }))) } } : node) }); setSelection([]);
  };
  const copySelected = () => setClipboard(selection.flatMap(item => {
    const key = keysByCurve.get(item.curveId)?.find(current => current.id === item.keyId);
    return key ? [{ curveId: item.curveId, key: structuredClone(key) }] : [];
  }));
  const pasteAtPlayhead = () => {
    const pasted = pasteCurveKeys(keysByCurve, clipboard, time, duration, makeId);
    if (!pasted.selection.length) return;
    onGraphChange({ ...graph, nodes: graph.nodes.map(node => pasted.curves.has(node.id) ? { ...node, config: { ...node.config, keys: pasted.curves.get(node.id) } } : node) });
    setSelection(pasted.selection);
    setHiddenIds(current => { const next = new Set(current); pasted.selection.forEach(item => next.delete(item.curveId)); return next; });
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && selection.length) { event.preventDefault(); copySelected(); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v' && clipboard.length) { event.preventDefault(); pasteAtPlayhead(); }
      else if (event.key === 'Delete' && selection.length) { event.preventDefault(); deleteSelected(); }
    };
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown);
  });
  const startViewportGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget && (event.target as Element).tagName !== 'svg') return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.button === 1 || (event.button === 0 && event.altKey)) {
      event.preventDefault(); panRef.current = { startX: event.clientX, startY: event.clientY, view }; return;
    }
    if (event.button !== 0) return;
    const startX = event.clientX - rect.left; const startY = event.clientY - rect.top;
    const points = curves.flatMap(curve => hiddenIds.has(curve.id) ? [] : (keysByCurve.get(curve.id) ?? []).map(key => ({ curveId: curve.id, keyId: key.id, x: toX(key.time) / WIDTH * rect.width, y: toY(key.value) / HEIGHT * rect.height })));
    marqueeRef.current = { startX, startY, currentX: startX, currentY: startY, additive: event.shiftKey, base: selection, points };
    setMarquee({ left: startX, top: startY, width: 0, height: 0 });
  };
  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.shiftKey) {
      setView(current => panCurveView(current, event.deltaY / rect.width * (current.timeMax - current.timeMin), 0, duration)); return;
    }
    const factor = Math.exp(event.deltaY * .0015);
    if (event.ctrlKey || event.metaKey) {
      const ratio = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      const anchor = view.valueMax - ratio * (view.valueMax - view.valueMin);
      setView(current => zoomCurveView(current, 'value', anchor, factor, duration));
    } else {
      const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const anchor = view.timeMin + ratio * (view.timeMax - view.timeMin);
      setView(current => zoomCurveView(current, 'time', anchor, factor, duration));
    }
  };
  const zoomAtCenter = (axis: 'time' | 'value', factor: number) => setView(current => zoomCurveView(current, axis, axis === 'time' ? clamp(time, current.timeMin, current.timeMax) : (current.valueMin + current.valueMax) / 2, factor, duration));
  const pathFor = (curveId: string) => {
    const curve = curves.find(node => node.id === curveId); const keys = keysByCurve.get(curveId) ?? [];
    if (!curve || !keys.length) return '';
    return Array.from({ length: 121 }, (_, index) => {
      const sampleTime = view.timeMin + index / 120 * (view.timeMax - view.timeMin);
      const value = sampleNumberCurve(keys, sampleTime, String(curve.config.interpolation ?? 'linear') as NumberCurveInterpolation | 'smoothstep');
      return `${index ? 'L' : 'M'}${toX(sampleTime).toFixed(2)} ${toY(value).toFixed(2)}`;
    }).join(' ');
  };
  const setInterpolation = (interpolation: NumberCurveInterpolation) => updateSelectedKey({ interpolation });
  const setTangentMode = (tangentMode: NumberCurveTangentMode) => updateSelectedKey({ tangentMode, ...(tangentMode === 'free' && activeKey ? { inTangent: activeKey.inTangent ?? activeKey.outTangent ?? 0, outTangent: activeKey.inTangent ?? activeKey.outTangent ?? 0 } : {}) });
  const tangentVisual = (() => {
    if (!activeKey || !activeSelection || activeKey.interpolation !== 'bezier') return null;
    const curveKeys = keysByCurve.get(activeSelection.curveId) ?? [];
    const keyIndex = curveKeys.findIndex(key => key.id === activeSelection.keyId);
    if (keyIndex < 0) return null;
    const automatic = automaticNumberCurveTangent(curveKeys, keyIndex);
    const inSlope = activeKey.tangentMode === 'auto' ? automatic : activeKey.inTangent ?? automatic;
    const outSlope = activeKey.tangentMode === 'auto' ? automatic : activeKey.outTangent ?? automatic;
    const keyX = toX(activeKey.time); const keyY = toY(activeKey.value); const handleDistance = 68;
    const point = (side: 'in' | 'out', slope: number) => {
      const dx = side === 'in' ? -handleDistance : handleDistance;
      const timeDelta = dx / WIDTH * (view.timeMax - view.timeMin);
      const valueDelta = slope * timeDelta;
      return { x: keyX + dx, y: keyY - valueDelta / (view.valueMax - view.valueMin) * HEIGHT };
    };
    return { keyX, keyY, inPoint: point('in', inSlope), outPoint: point('out', outSlope), editable: activeKey.tangentMode !== 'auto' };
  })();

  if (!curves.length) return <div className="awb-signal-empty"><strong>还没有 Number Curve</strong><button onClick={onCreateCurve}>创建曲线节点</button></div>;
  return <div className="awb-curve-layout">
    <aside className="awb-curve-list"><header><strong>PROPERTY TRACKS</strong><button onClick={onCreateCurve}>＋</button></header><div className="awb-track-object"><b>{selectedObject?.name ?? '未选择对象'}</b><span>{propertyTracks.length} animated properties</span></div>{propertyTracks.map(track => <button key={track.binding.id} className={activeCurve?.id === track.curve.id ? 'active' : ''} onClick={() => onSelectedNodeIdChange(track.curve.id)}><input type="checkbox" checked={!hiddenIds.has(track.curve.id)} onClick={event => event.stopPropagation()} onChange={event => setHiddenIds(current => { const next = new Set(current); if (event.target.checked) next.delete(track.curve.id); else next.add(track.curve.id); return next; })} /><span>{track.path}</span><small>{readNumberCurveKeys(track.curve.config.keys).length}</small></button>)}{selectedObject && !propertyTracks.length && <div className="awb-track-empty">开启 REC 后修改 Transform，可自动建立属性轨道</div>}<header className="awb-all-curves"><strong>ALL CURVES</strong><span>{curves.length}</span></header>{curves.map(node => <button key={node.id} className={activeCurve?.id === node.id ? 'active' : ''} onClick={() => onSelectedNodeIdChange(node.id)}><input type="checkbox" checked={!hiddenIds.has(node.id)} onClick={event => event.stopPropagation()} onChange={event => setHiddenIds(current => { const next = new Set(current); if (event.target.checked) next.delete(node.id); else next.add(node.id); return next; })} /><span>{node.label}</span><small>{readNumberCurveKeys(node.config.keys).length}</small></button>)}</aside>
    <section className="awb-curve-center"><header className="awb-curve-toolbar"><button onClick={addKey}>＋ Key</button><button onClick={copySelected} disabled={!selection.length} title="复制 Ctrl+C">Copy</button><button onClick={pasteAtPlayhead} disabled={!clipboard.length} title="粘贴到播放头 Ctrl+V">Paste</button><button onClick={deleteSelected} disabled={!selection.length}>Delete</button><button onClick={fitAll}>Fit All</button><button onClick={fitSelection}>Fit Selection</button><button onClick={() => zoomAtCenter('time', .75)} title="放大时间轴">T＋</button><button onClick={() => zoomAtCenter('time', 1.333)} title="缩小时间轴">T−</button><button onClick={() => zoomAtCenter('value', .75)} title="放大数值轴">V＋</button><button onClick={() => zoomAtCenter('value', 1.333)} title="缩小数值轴">V−</button><span /><label><input type="checkbox" checked={snap} onChange={event => setSnap(event.target.checked)} />SNAP</label><label>FPS<input type="number" min="1" max="240" value={fps} onChange={event => setFps(clamp(Number(event.target.value) || 60, 1, 240))} /></label><label>VALUE<input type="number" min="0.0001" step="0.01" value={valueStep} onChange={event => setValueStep(Math.max(.0001, Number(event.target.value) || .01))} /></label></header><div className="awb-curve-ruler"><span>{view.timeMin.toFixed(2)}s</span><small>拖空白框选 · Alt/中键平移 · 滚轮缩放时间 · Ctrl+滚轮缩放数值</small><span>{view.timeMax.toFixed(2)}s</span></div><div ref={plotRef} className="awb-curve-plot" onPointerDown={startViewportGesture} onWheel={handleWheel}><svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">{curves.map((curve, index) => !hiddenIds.has(curve.id) && <path key={curve.id} d={pathFor(curve.id)} style={{ stroke: COLORS[index % COLORS.length], opacity: activeCurve?.id === curve.id ? 1 : .45 }} />)}</svg>{tangentVisual && activeSelection && <svg className="awb-curve-tangents" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none"><line x1={tangentVisual.inPoint.x} y1={tangentVisual.inPoint.y} x2={tangentVisual.outPoint.x} y2={tangentVisual.outPoint.y} /><circle className={tangentVisual.editable ? '' : 'locked'} cx={tangentVisual.inPoint.x} cy={tangentVisual.inPoint.y} r="6" onPointerDown={event => { if (!tangentVisual.editable) return; event.stopPropagation(); onBeginEdit(); tangentDragRef.current = { curveId: activeSelection.curveId, keyId: activeSelection.keyId, side: 'in', keyX: tangentVisual.keyX, keyY: tangentVisual.keyY }; }} /><circle className={tangentVisual.editable ? '' : 'locked'} cx={tangentVisual.outPoint.x} cy={tangentVisual.outPoint.y} r="6" onPointerDown={event => { if (!tangentVisual.editable) return; event.stopPropagation(); onBeginEdit(); tangentDragRef.current = { curveId: activeSelection.curveId, keyId: activeSelection.keyId, side: 'out', keyX: tangentVisual.keyX, keyY: tangentVisual.keyY }; }} /></svg>}{curves.flatMap((curve, curveIndex) => !hiddenIds.has(curve.id) ? (keysByCurve.get(curve.id) ?? []).map(key => { const selected = selectedSet.has(curveSelectionId({ curveId: curve.id, keyId: key.id })); return <button key={`${curve.id}:${key.id}`} className={selected ? 'selected' : ''} style={{ left: `${toX(key.time) / WIDTH * 100}%`, top: `${toY(key.value) / HEIGHT * 100}%`, background: COLORS[curveIndex % COLORS.length] }} onPointerDown={event => startKeyDrag(event, { curveId: curve.id, keyId: key.id }, key)} />; }) : [])}<i style={{ left: `${toX(time) / WIDTH * 100}%` }} />{marquee && <div className="awb-curve-marquee" style={marquee} />}</div></section>
    <aside className="awb-key-inspector"><header><strong>KEY INSPECTOR</strong><small>{selection.length} selected</small></header>{activeKey && activeSelection ? <div className="awb-curve-key-form"><label><span>TIME</span><input type="number" step="0.001" value={activeKey.time} onChange={event => updateSelectedKey({ time: clamp(Number(event.target.value), 0, duration) })} /></label><label><span>VALUE</span><input type="number" step="0.01" value={activeKey.value} onChange={event => updateSelectedKey({ value: Number(event.target.value) })} /></label><label><span>SEGMENT</span><select value={activeKey.interpolation ?? 'linear'} onChange={event => setInterpolation(event.target.value as NumberCurveInterpolation)}><option value="constant">Constant</option><option value="linear">Linear</option><option value="smooth">Smooth</option><option value="bezier">Bezier</option></select></label>{activeKey.interpolation === 'bezier' && <><label><span>TANGENTS</span><select value={activeKey.tangentMode ?? 'auto'} onChange={event => setTangentMode(event.target.value as NumberCurveTangentMode)}><option value="auto">Auto</option><option value="free">Free</option><option value="broken">Broken</option></select></label><label><span>IN SLOPE</span><input disabled={(activeKey.tangentMode ?? 'auto') === 'auto'} type="number" step="0.1" value={activeKey.inTangent ?? 0} onChange={event => { const value = Number(event.target.value); updateSelectedKey(activeKey.tangentMode === 'free' ? { inTangent: value, outTangent: value } : { inTangent: value }); }} /></label><label><span>OUT SLOPE</span><input disabled={(activeKey.tangentMode ?? 'auto') === 'auto'} type="number" step="0.1" value={activeKey.outTangent ?? 0} onChange={event => { const value = Number(event.target.value); updateSelectedKey(activeKey.tangentMode === 'free' ? { inTangent: value, outTangent: value } : { outTangent: value }); }} /></label></>}</div> : <div className="awb-track-empty">选择关键帧后可编辑时间、数值、插值和切线。</div>}</aside>
  </div>;
}
