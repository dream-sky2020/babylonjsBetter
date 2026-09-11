import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { SignalGraphDocument } from '@/core/animation/signal';
import type { AnimationObjectRecord, PreviewSignalBinding } from './animationWorkspace.ts';
import { collectDopeSheetTracks, deleteDopeSheetKeys, dopeKeyToken, moveDopeSheetKeys, type DopeSheetKeyRef } from './dopeSheetModel.ts';

type ClipboardKey = Readonly<DopeSheetKeyRef & { offset: number; value: number }>;
type Props = Readonly<{
  graph: SignalGraphDocument;
  bindings: readonly PreviewSignalBinding[];
  objects: readonly AnimationObjectRecord[];
  selectedObjectId: string | null;
  time: number;
  duration: number;
  onTimeChange(time: number): void;
  onGraphChange(graph: SignalGraphDocument): void;
  onBeginEdit(): void;
  onEndEdit(): void;
}>;

const makeId = () => globalThis.crypto?.randomUUID?.() ?? `key_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const ROW_HEIGHT = 28;
const RULER_HEIGHT = 25;

const DopeIcon = ({ name }: { name: 'previous' | 'next' | 'copy' | 'paste' | 'delete' }) => <svg viewBox="0 0 20 20" aria-hidden="true">
  {name === 'previous' && <><path d="M6 4v12M15 5l-6 5 6 5z" /></>}
  {name === 'next' && <><path d="M14 4v12M5 5l6 5-6 5z" /></>}
  {name === 'copy' && <><rect x="7" y="7" width="9" height="9" /><path d="M13 7V4H4v9h3" /></>}
  {name === 'paste' && <><path d="M7 5V3h6v2M5 5h10v12H5z" /><path d="M8 9h4m-4 3h4" /></>}
  {name === 'delete' && <><path d="M4 6h12M8 6V3h4v3m3 0-1 11H6L5 6m4 3v5m2-5v5" /></>}
</svg>;

export function DopeSheet({ graph, bindings, objects, selectedObjectId, time, duration, onTimeChange, onGraphChange, onBeginEdit, onEndEdit }: Props) {
  const tracks = useMemo(() => collectDopeSheetTracks(graph, bindings, selectedObjectId), [graph, bindings, selectedObjectId]);
  const selectedObject = objects.find(object => object.id === selectedObjectId);
  const timelineRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef(graph); const selectionRef = useRef<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<ClipboardKey[]>([]);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [framesPerSecond, setFramesPerSecond] = useState(60);
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const dragRef = useRef<{ startX: number; graph: SignalGraphDocument; selected: Set<string> } | null>(null);
  const marqueeRef = useRef<{ startX: number; startY: number; additive: boolean } | null>(null);
  useEffect(() => { graphRef.current = graph; }, [graph]);
  useEffect(() => { selectionRef.current = selected; }, [selected]);

  const allKeyTimes = [...new Set(tracks.flatMap(track => track.keys.map(key => key.time)))].sort((a, b) => a - b);
  const copySelected = () => {
    const chosen = tracks.flatMap(track => track.keys.filter(key => selected.has(dopeKeyToken(track.nodeId, key.id))).map(key => ({ nodeId: track.nodeId, keyId: key.id, time: key.time, value: key.value })));
    if (!chosen.length) return;
    const origin = Math.min(...chosen.map(key => key.time));
    setClipboard(chosen.map(key => ({ nodeId: key.nodeId, keyId: key.keyId, offset: key.time - origin, value: key.value })));
  };
  const deleteSelected = () => {
    if (!selected.size) return;
    onGraphChange(deleteDopeSheetKeys(graph, selected)); setSelected(new Set());
  };
  const paste = () => {
    if (!clipboard.length) return;
    const pasted = new Set<string>();
    const next = { ...graph, nodes: graph.nodes.map(node => {
      const additions = clipboard.filter(item => item.nodeId === node.id);
      if (!additions.length) return node;
      const keys = Array.isArray(node.config.keys) ? [...node.config.keys] : [];
      additions.forEach(item => { const id = makeId(); pasted.add(dopeKeyToken(node.id, id)); keys.push({ id, time: Math.min(duration, time + item.offset), value: item.value }); });
      return { ...node, config: { ...node.config, keys: keys.sort((left, right) => Number((left as { time?: unknown }).time) - Number((right as { time?: unknown }).time)) } };
    }) };
    onGraphChange(next); setSelected(pasted);
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && selectionRef.current.size) { event.preventDefault(); copySelected(); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v' && clipboard.length) { event.preventDefault(); paste(); }
      else if (event.key === 'Delete' && selectionRef.current.size) { event.preventDefault(); deleteSelected(); }
    };
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown);
  });
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const rect = timelineRef.current?.getBoundingClientRect(); if (!rect) return;
      if (dragRef.current) {
        const delta = (event.clientX - dragRef.current.startX) / Math.max(1, rect.width) * duration;
        onGraphChange(moveDopeSheetKeys(dragRef.current.graph, dragRef.current.selected, delta, duration, snapEnabled ? framesPerSecond : null));
      } else if (marqueeRef.current) {
        setMarquee({ x1: marqueeRef.current.startX, y1: marqueeRef.current.startY, x2: event.clientX - rect.left, y2: event.clientY - rect.top });
      }
    };
    const end = (event: PointerEvent) => {
      const rect = timelineRef.current?.getBoundingClientRect();
      if (dragRef.current) { dragRef.current = null; onEndEdit(); return; }
      const start = marqueeRef.current; marqueeRef.current = null;
      if (!start || !rect) return;
      const endX = event.clientX - rect.left; const endY = event.clientY - rect.top;
      if (Math.abs(endX - start.startX) < 3 && Math.abs(endY - start.startY) < 3) {
        onTimeChange(Math.min(duration, Math.max(0, endX / Math.max(1, rect.width) * duration))); setMarquee(null); return;
      }
      const minX = Math.min(start.startX, endX); const maxX = Math.max(start.startX, endX); const minY = Math.min(start.startY, endY); const maxY = Math.max(start.startY, endY);
      const next = start.additive ? new Set(selectionRef.current) : new Set<string>();
      tracks.forEach((track, row) => track.keys.forEach(key => {
        const x = key.time / duration * rect.width; const y = RULER_HEIGHT + row * ROW_HEIGHT + ROW_HEIGHT / 2;
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) next.add(dopeKeyToken(track.nodeId, key.id));
      }));
      setSelected(next); setMarquee(null);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); };
  }, [duration, framesPerSecond, onEndEdit, onGraphChange, onTimeChange, snapEnabled, tracks]);

  const selectKey = (event: ReactPointerEvent, nodeId: string, keyId: string, keyTime: number) => {
    event.stopPropagation(); const token = dopeKeyToken(nodeId, keyId);
    const next = event.shiftKey ? new Set(selected) : selected.has(token) ? new Set(selected) : new Set<string>([token]);
    if (event.shiftKey) { if (next.has(token)) next.delete(token); else next.add(token); }
    setSelected(next); selectionRef.current = next;
    onTimeChange(keyTime);
    onBeginEdit(); dragRef.current = { startX: event.clientX, graph: graphRef.current, selected: next };
  };
  const jump = (direction: -1 | 1) => {
    const destination = direction < 0 ? [...allKeyTimes].reverse().find(value => value < time - .0005) : allKeyTimes.find(value => value > time + .0005);
    if (destination !== undefined) onTimeChange(destination);
  };

  return <div className="awb-dope-sheet">
    <header className="awb-dope-toolbar"><div><b>{selectedObject?.name ?? '未选择对象'}</b><span>{tracks.length} tracks · {tracks.reduce((count, track) => count + track.keys.length, 0)} keys</span></div><button onClick={() => jump(-1)} title="上一个关键帧"><DopeIcon name="previous" /></button><button onClick={() => jump(1)} title="下一个关键帧"><DopeIcon name="next" /></button><span className="awb-dope-separator" /><button onClick={copySelected} disabled={!selected.size} title="复制关键帧 Ctrl+C"><DopeIcon name="copy" /></button><button onClick={paste} disabled={!clipboard.length} title="粘贴到当前时间 Ctrl+V"><DopeIcon name="paste" /></button><button onClick={deleteSelected} disabled={!selected.size} title="删除关键帧 Delete"><DopeIcon name="delete" /></button><span className="awb-dope-spacer" /><label><input type="checkbox" checked={snapEnabled} onChange={event => setSnapEnabled(event.target.checked)} />SNAP</label><label>FPS<input type="number" min="1" max="240" value={framesPerSecond} onChange={event => setFramesPerSecond(Math.min(240, Math.max(1, Number(event.target.value) || 60)))} /></label></header>
    <div className="awb-dope-body"><aside><div className="awb-dope-ruler-label">PROPERTY</div>{tracks.map(track => <div className="awb-dope-label" key={track.bindingId}><i data-group={track.path.split('.')[0]} /><span>{track.path}</span><small>{track.keys.length}</small></div>)}</aside><div ref={timelineRef} className="awb-dope-timeline" onPointerDown={event => { if (event.button !== 0 || event.target !== event.currentTarget && (event.target as HTMLElement).closest('button')) return; const rect = event.currentTarget.getBoundingClientRect(); marqueeRef.current = { startX: event.clientX - rect.left, startY: event.clientY - rect.top, additive: event.shiftKey }; setMarquee({ x1: event.clientX - rect.left, y1: event.clientY - rect.top, x2: event.clientX - rect.left, y2: event.clientY - rect.top }); }}><div className="awb-dope-ruler"><span>0.00</span><span>{(duration / 4).toFixed(2)}</span><span>{(duration / 2).toFixed(2)}</span><span>{(duration * .75).toFixed(2)}</span><span>{duration.toFixed(2)}</span></div>{tracks.map(track => <div className="awb-dope-row" key={track.bindingId}>{track.keys.map(key => <button key={key.id} className={selected.has(dopeKeyToken(track.nodeId, key.id)) ? 'selected' : ''} style={{ left: `${key.time / duration * 100}%` }} title={`${track.path} · ${key.time.toFixed(3)}s · ${key.value.toFixed(3)}`} onPointerDown={event => selectKey(event, track.nodeId, key.id, key.time)} />)}</div>)}<i className="awb-dope-playhead" style={{ left: `${time / duration * 100}%` }} />{marquee && <i className="awb-dope-marquee" style={{ left: Math.min(marquee.x1, marquee.x2), top: Math.min(marquee.y1, marquee.y2), width: Math.abs(marquee.x2 - marquee.x1), height: Math.abs(marquee.y2 - marquee.y1) }} />}</div></div>
    {!tracks.length && <div className="awb-dope-empty">选择一个带动画属性的对象，或开启 REC 后调整 Transform。</div>}
  </div>;
}
