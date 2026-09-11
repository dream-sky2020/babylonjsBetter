import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { AnimationEventMarker } from '../../core/animation/preset/animationScenePreset.ts';
import { deleteAnimationEvent, eventsCrossed, moveAnimationEvent, snapEventTime } from './eventTrackModel.ts';

type Props = Readonly<{
  events: readonly AnimationEventMarker[];
  time: number;
  duration: number;
  playing: boolean;
  onTimeChange(time: number): void;
  onEventsChange(events: readonly AnimationEventMarker[]): void;
  onBeginEdit(): void;
  onEndEdit(): void;
}>;

const makeId = () => globalThis.crypto?.randomUUID?.() ?? `event_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const EVENT_TYPES = ['animation.marker', 'combat.attack-window.start', 'combat.attack-window.end', 'weapon.fire', 'item.activate', 'audio.play'];

const EventIcon = ({ name }: { name: 'add' | 'copy' | 'paste' | 'delete' }) => <svg viewBox="0 0 20 20" aria-hidden="true">
  {name === 'add' && <path d="M10 3v14M3 10h14" />}
  {name === 'copy' && <><rect x="7" y="7" width="9" height="9" /><path d="M13 7V4H4v9h3" /></>}
  {name === 'paste' && <><path d="M7 5V3h6v2M5 5h10v12H5z" /><path d="M8 9h4m-4 3h4" /></>}
  {name === 'delete' && <><path d="M4 6h12M8 6V3h4v3m3 0v8H6V6m3 3v5m2-5v5" /></>}
</svg>;

function EventInspector({ marker, duration, onChange }: Readonly<{ marker: AnimationEventMarker; duration: number; onChange(marker: AnimationEventMarker): void }>) {
  const [configText, setConfigText] = useState(() => JSON.stringify(marker.config, null, 2));
  const [configError, setConfigError] = useState('');
  const label = typeof marker.config.label === 'string' ? marker.config.label : '';
  const commitConfig = () => {
    try {
      const parsed: unknown = JSON.parse(configText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('配置必须是 JSON 对象');
      setConfigError(''); onChange({ ...marker, config: parsed as Record<string, unknown> });
    } catch (error) { setConfigError(error instanceof Error ? error.message : 'JSON 无效'); }
  };
  return <aside className="awb-event-inspector">
    <header><strong>EVENT</strong><small>{marker.id}</small></header>
    <label><span>TIME</span><input type="number" min="0" max={duration} step="0.001" value={marker.time} onChange={event => onChange({ ...marker, time: Math.min(duration, Math.max(0, Number(event.target.value) || 0)) })} /></label>
    <label><span>TYPE ID</span><input list="awb-event-types" value={marker.typeId} onChange={event => onChange({ ...marker, typeId: event.target.value })} /><datalist id="awb-event-types">{EVENT_TYPES.map(typeId => <option key={typeId} value={typeId} />)}</datalist></label>
    <label><span>LABEL</span><input value={label} placeholder="可选的人类可读名称" onChange={event => { const config = { ...marker.config, label: event.target.value }; setConfigText(JSON.stringify(config, null, 2)); onChange({ ...marker, config }); }} /></label>
    <label className="awb-event-config"><span>CONFIG · OPEN JSON</span><textarea spellCheck={false} value={configText} onChange={event => { setConfigText(event.target.value); setConfigError(''); }} onBlur={commitConfig} /></label>
    {configError && <output className="awb-event-error">{configError}</output>}
  </aside>;
}

export function EventTrack({ events, time, duration, playing, onTimeChange, onEventsChange, onBeginEdit, onEndEdit }: Props) {
  const sortedEvents = [...events].sort((left, right) => left.time - right.time);
  const [selectedId, setSelectedId] = useState<string | null>(sortedEvents[0]?.id ?? null);
  const [clipboard, setClipboard] = useState<AnimationEventMarker | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [framesPerSecond, setFramesPerSecond] = useState(60);
  const [triggeredId, setTriggeredId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const eventsRef = useRef(events); const selectionRef = useRef(selectedId); const previousTimeRef = useRef(time);
  const triggerTimerRef = useRef<number | null>(null);
  const dragRef = useRef<{ id: string; startX: number; startTime: number; events: readonly AnimationEventMarker[] } | null>(null);
  useEffect(() => { eventsRef.current = events; }, [events]);
  useEffect(() => { selectionRef.current = selectedId; }, [selectedId]);
  useEffect(() => {
    const previous = previousTimeRef.current; previousTimeRef.current = time;
    if (!playing) return;
    const crossed = eventsCrossed(events, previous, time, time < previous);
    const marker = crossed.at(-1); if (!marker) return;
    const showTimer = window.setTimeout(() => {
      setTriggeredId(marker.id);
      if (triggerTimerRef.current !== null) window.clearTimeout(triggerTimerRef.current);
      triggerTimerRef.current = window.setTimeout(() => setTriggeredId(current => current === marker.id ? null : current), 420);
    }, 0);
    return () => window.clearTimeout(showTimer);
  }, [events, playing, time]);
  useEffect(() => () => { if (triggerTimerRef.current !== null) window.clearTimeout(triggerTimerRef.current); }, []);

  const selected = sortedEvents.find(marker => marker.id === selectedId) ?? null;
  const updateMarker = (next: AnimationEventMarker) => onEventsChange(events.map(marker => marker.id === next.id ? next : marker).sort((left, right) => left.time - right.time));
  const addMarker = () => {
    const marker: AnimationEventMarker = { id: makeId(), time: snapEventTime(time, snapEnabled ? framesPerSecond : null), typeId: 'animation.marker', config: { label: `Event ${events.length + 1}` } };
    onEventsChange([...events, marker].sort((left, right) => left.time - right.time)); setSelectedId(marker.id);
  };
  const deleteSelected = () => {
    const id = selectionRef.current; if (!id) return;
    const next = deleteAnimationEvent(eventsRef.current, id); onEventsChange(next); setSelectedId(next[0]?.id ?? null);
  };
  const copySelected = () => { const marker = eventsRef.current.find(item => item.id === selectionRef.current); if (marker) setClipboard(marker); };
  const paste = () => {
    if (!clipboard) return;
    const marker: AnimationEventMarker = { ...clipboard, id: makeId(), time: snapEventTime(time, snapEnabled ? framesPerSecond : null), config: { ...clipboard.config } };
    onEventsChange([...events, marker].sort((left, right) => left.time - right.time)); setSelectedId(marker.id);
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && selectionRef.current) { event.preventDefault(); copySelected(); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v' && clipboard) { event.preventDefault(); paste(); }
      else if (event.key === 'Delete' && selectionRef.current) { event.preventDefault(); deleteSelected(); }
    };
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown);
  });
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current; const rect = timelineRef.current?.getBoundingClientRect(); if (!drag || !rect) return;
      const delta = (event.clientX - drag.startX) / Math.max(1, rect.width) * duration;
      onEventsChange(moveAnimationEvent(drag.events, drag.id, drag.startTime + delta, duration, snapEnabled ? framesPerSecond : null));
    };
    const end = () => { if (!dragRef.current) return; dragRef.current = null; onEndEdit(); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); };
  }, [duration, framesPerSecond, onEndEdit, onEventsChange, snapEnabled]);
  const startDrag = (event: ReactPointerEvent, marker: AnimationEventMarker) => {
    if (event.button !== 0) return; event.stopPropagation(); setSelectedId(marker.id); onTimeChange(marker.time);
    onBeginEdit(); dragRef.current = { id: marker.id, startX: event.clientX, startTime: marker.time, events: eventsRef.current };
  };

  return <div className="awb-event-page">
    <header className="awb-event-toolbar"><div><b>EVENT TRACK</b><span>{events.length} markers · open typeId/config</span></div><button onClick={addMarker} title="在当前时间添加事件"><EventIcon name="add" /></button><button onClick={copySelected} disabled={!selected} title="复制事件 Ctrl+C"><EventIcon name="copy" /></button><button onClick={paste} disabled={!clipboard} title="粘贴到当前时间 Ctrl+V"><EventIcon name="paste" /></button><button onClick={deleteSelected} disabled={!selected} title="删除事件 Delete"><EventIcon name="delete" /></button><span className="awb-event-spacer" /><label><input type="checkbox" checked={snapEnabled} onChange={event => setSnapEnabled(event.target.checked)} />SNAP</label><label>FPS<input type="number" min="1" max="240" value={framesPerSecond} onChange={event => setFramesPerSecond(Math.min(240, Math.max(1, Number(event.target.value) || 60)))} /></label></header>
    <div className="awb-event-layout"><section><div className="awb-event-ruler"><span>0.00</span><span>{(duration / 4).toFixed(2)}</span><span>{(duration / 2).toFixed(2)}</span><span>{(duration * .75).toFixed(2)}</span><span>{duration.toFixed(2)}</span></div><div ref={timelineRef} className="awb-event-timeline" onPointerDown={event => { if (event.target !== event.currentTarget) return; const rect = event.currentTarget.getBoundingClientRect(); onTimeChange(Math.min(duration, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width) * duration))); }}><div className="awb-event-lane-label">EVENTS</div>{sortedEvents.map(marker => <button key={marker.id} className={`${selectedId === marker.id ? 'selected' : ''} ${triggeredId === marker.id ? 'triggered' : ''}`} style={{ left: `${marker.time / duration * 100}%` }} title={`${marker.typeId} · ${marker.time.toFixed(3)}s`} onPointerDown={event => startDrag(event, marker)}><i /><span>{typeof marker.config.label === 'string' && marker.config.label || marker.typeId}</span></button>)}<i className="awb-event-playhead" style={{ left: `${time / duration * 100}%` }} /></div>{!events.length && <div className="awb-event-empty">在当前时间添加事件；事件可参与播放触发，但不限制用途。</div>}</section>
      {selected ? <EventInspector key={selected.id} marker={selected} duration={duration} onChange={updateMarker} /> : <aside className="awb-event-inspector"><div className="awb-empty">选择一个事件查看开放配置</div></aside>}
    </div>
    <output className={`awb-event-trigger ${triggeredId ? 'active' : ''}`}>{triggeredId ? `TRIGGER · ${events.find(marker => marker.id === triggeredId)?.typeId ?? ''}` : '等待播放事件'}</output>
  </div>;
}
