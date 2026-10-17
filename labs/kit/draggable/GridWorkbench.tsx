import { moveTab, placeTab } from './tabDrag.ts';
import { useTabDrag } from './useTabDrag.ts';
import { PanelContextMenu } from './PanelContextMenu.tsx';
import { PanelSettingsEditor } from './PanelSettingsEditor.tsx';
import { resetPanelSettings, resolvedPanelSettings, updatePanelSetting, type PanelOptions, type PanelSettingsRegistry, type PanelValue } from './panelSettings.ts';
import { createPortal } from 'react-dom';
import { createHistory, recordHistory, redoHistory, undoHistory } from './history.ts';
import { mergeByDragging, mergeTarget, type MergeZone } from './dragMerge.ts';
import { GridWindowContents } from './GridWindowContents.tsx';
import { PanelTabsSettings } from './PanelTabsSettings.tsx';
import { panelGroup, windowOwner, workspaceWindows } from './tabs.ts';
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import GridLayout, { getCompactor, type EventCallback } from 'react-grid-layout';
import { useContainerWidth } from 'react-grid-layout';
import { displayItems, downloadLayout, mergeItems, overlaps, type WorkspaceLayout } from './layout.ts';
import type { GridSettings } from './settings.ts';
import './workbench.css';
export type WorkbenchApi<T> = { data: T; commit: (data: T) => void; reveal: (id: string) => void; narrow: boolean };
export type GridDefinition<T extends WorkspaceLayout> = {
  id: string; title: string; storageKey: string; titles: Record<string, string>;
  defaults: () => T; parse: (value: unknown) => T;
  settings: (data: T) => GridSettings; withSettings: (data: T, settings: GridSettings) => T;
  renderPanel: (id: string, options: PanelOptions) => ReactNode; panelSettings?: PanelSettingsRegistry; navigation: ReactNode;
  actions?: (api: WorkbenchApi<T>) => ReactNode; settingsActions?: (api: WorkbenchApi<T>) => ReactNode; footer?: ReactNode;
  grid: { cols: number; pitch: number; margin: number; minW: number; minH: number; maxH: number; step: number; precisions?: number[] };
  classes: { app: string; toolbar: string; options: string; grid: string; window: string; title: string; drag: string; body: string };
};
export function GridWorkbench<T extends WorkspaceLayout>({ definition: def }: { definition: GridDefinition<T> }) {
  const [initial] = useState(() => { try { const stored = localStorage.getItem(def.storageKey); return { data: stored ? def.parse(JSON.parse(stored)) : def.defaults(), error: '' }; } catch (error) { return { data: def.defaults(), error: `读取布局失败，显示默认布局：${String(error)}` }; } });
  const history = useRef(createHistory(initial.data));
  const gesture = useRef<{ before: T; source: string; zones: MergeZone[] } | null>(null);
  const [gestureActive, setGestureActive] = useState(false);
  const [dropTarget, setDropTarget] = useState<MergeZone | undefined>();
  const tabDrag = useTabDrag();
  const [tabPreview, setTabPreview] = useState<{ x: number; y: number; width: number; height: number; label: string } | null>(null);
  const [panelMenu, setPanelMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [data, setData] = useState(initial.data); const [message, setMessage] = useState(initial.error || '拖动标题移动窗口，四角缩放。布局自动保存在本机。');
  const [settingsOpen, setSettingsOpen] = useState(false); const [stack, setStack] = useState<string[]>([]); const [selected, setSelected] = useState(Object.keys(def.titles)[0]);
  const file = useRef<HTMLInputElement>(null); const { width, containerRef, mounted } = useContainerWidth(); const narrow = width < 900;
  const settings = def.settings(data); const overlap = settings.collision === 'overlap'; const metric = def.grid;
  const raise = (id: string) => setStack(previous => previous.at(-1) === id ? previous : [...previous.filter(item => item !== id), id]);
  const save = (next: T) => { setData(next); try { localStorage.setItem(def.storageKey, JSON.stringify(next)); setMessage('布局已自动保存。'); } catch (error) { setMessage(`布局已应用，但保存失败：${String(error)}`); } };
  const commit = (value: T, record = true) => { try { const next = def.parse(value); history.current = recordHistory(history.current, next, record); save(next); } catch (error) { setMessage(`未应用：${String(error)}`); } };
  const travel = (direction: 'undo' | 'redo') => { if (gestureActive) return; const next = direction === 'undo' ? undoHistory(history.current) : redoHistory(history.current); if (next === history.current) return; history.current = next; save(structuredClone(next.present)); };
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || (!event.ctrlKey && !event.metaKey) || (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest('input,textarea,select,[role=textbox]')))) return;
      const key = event.key.toLowerCase(); if (key !== 'z' && key !== 'y') return; event.preventDefault(); travel(key === 'y' || event.shiftKey ? 'redo' : 'undo');
    };
    window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut);
  }, [gestureActive, def.storageKey]);
  const toggle = (id: string) => commit({ ...data, hidden: data.hidden.includes(id) ? data.hidden.filter(item => item !== id) : [...data.hidden, id] });
  const api: WorkbenchApi<T> = { data, commit, narrow, reveal: id => { const group = panelGroup(data, id); const owner = windowOwner(data, id); if (data.hidden.includes(id) || group?.active !== id && group) commit({ ...data, hidden: data.hidden.filter(item => item !== id), ...(group ? { tabs: { ...data.tabs!, groups: data.tabs!.groups.map(value => value === group ? { ...value, active: id } : value) } } : {}) }); raise(owner); requestAnimationFrame(() => { const panel = document.getElementById(`${def.id}-panel-${owner}`); panel?.scrollIntoView({ behavior: 'smooth', block: 'start' }); const body = panel?.querySelector<HTMLElement>('.wb-body'); if (body) body.scrollTop = 0; }); } };
  const windows = workspaceWindows(data);
  const visible = displayItems(data, settings.precision, narrow, { w: metric.minW, h: metric.minH, maxH: metric.maxH });
  const item = data.items.find(value => value.i === windowOwner(data, selected))!;
  const disabled = narrow || data.locked || data.hidden.includes(selected);
  const changeSettings = (value: GridSettings) => commit(def.withSettings(data, { ...value, autoCompact: value.collision === 'overlap' ? false : value.autoCompact }));
  const registry = def.panelSettings ?? {};
  const changePanelOption = (id: string, key: string, value: PanelValue) => { if (data.locked) return; try { commit(updatePanelSetting(data, id, key, value, Object.keys(def.titles), registry)); } catch (error) { setMessage(String(error)); } };
  const configure = (id: string, event: ReactMouseEvent<HTMLElement>) => { event.preventDefault(); event.stopPropagation(); const box = event.currentTarget.getBoundingClientRect(); setSelected(id); setPanelMenu({ id, x: event.clientX || box.left + 12, y: event.clientY || box.bottom }); };
  const pointer = (event: Event) => {
    const input = event as MouseEvent & { touches?: TouchList; changedTouches?: TouchList }; const position = input.touches?.[0] ?? input.changedTouches?.[0] ?? input;
    return Number.isFinite(position.clientX) && Number.isFinite(position.clientY) ? { x: position.clientX + window.scrollX, y: position.clientY + window.scrollY } : null;
  };
  const mergeZones = (): MergeZone[] => {
    return [...(containerRef.current?.querySelectorAll<HTMLElement>('.wb-window') ?? [])].map((element, index): MergeZone => {
      const box = element.getBoundingClientRect(); const title = element.querySelector<HTMLElement>('.wb-title')!.getBoundingClientRect(); const tabs = element.querySelector<HTMLElement>('.wb-panel-tabs');
      return { id: element.id.slice(`${def.id}-panel-`.length), x: box.x + window.scrollX, y: box.y + window.scrollY, width: box.width, height: title.height + (tabs?.getBoundingClientRect().height ?? 0), windowHeight: box.height, rank: (Number(getComputedStyle(element).zIndex) || 0) * 100 + index };
    });
  };
  const startDrag: EventCallback = (_layout, _old, item) => {
    setGestureActive(true);
    if (!item || !data.tabs?.enabled || !data.tabs.dragMerge || narrow || data.locked) return;
    const zones = mergeZones();
    gesture.current = { before: structuredClone(history.current.present), source: item.i, zones };
  };
  const previewDrag: EventCallback = (_layout, _old, _item, _placeholder, event) => { const point = pointer(event); const pending = gesture.current; const target = pending && point ? mergeTarget(pending.zones, pending.source, point) : undefined; setDropTarget(previous => previous?.id === target?.id ? previous : target); };
  const finishDrag: EventCallback = (items, _old, _item, _placeholder, event) => {
    const pending = gesture.current; const point = pointer(event); const target = pending && point ? mergeTarget(pending.zones, pending.source, point) : undefined;
    gesture.current = null; setGestureActive(false); setDropTarget(undefined);
    if (pending && target) commit(mergeByDragging(pending.before, pending.source, target.id));
    else commit(mergeItems(data, items, settings.precision, narrow));
  };
  const dragTab = (panel: string, event: ReactPointerEvent<HTMLElement>) => {
    if (!data.tabs?.enabled || !data.tabs.dragMerge || narrow || data.locked || event.button !== 0) return;
    const before = structuredClone(history.current.present); const owner = windowOwner(before, panel);
    const zones = mergeZones(); const source = zones.find(zone => zone.id === owner)!;
    const grid = containerRef.current!.getBoundingClientRect();
    const strip = event.currentTarget.parentElement!.getBoundingClientRect();
    const stripBox = { x: strip.x + window.scrollX, y: strip.y + window.scrollY, width: strip.width, height: strip.height };
    const offset = { x: event.clientX + window.scrollX - source.x, y: event.clientY + window.scrollY - source.y };
    const original = before.items.find(item => item.i === owner)!;
    const resolve = (point: { x: number; y: number }) => {
      const target = mergeTarget(zones, owner, point);
      if (target) return { next: moveTab(before, panel, original, target.id), box: { x: target.x, y: target.y, width: target.width, height: target.windowHeight, label: `松开鼠标移入：${def.titles[target.id]}` } };
      if (point.x >= stripBox.x && point.x <= stripBox.x + stripBox.width && point.y >= stripBox.y && point.y <= stripBox.y + stripBox.height) return { next: before, box: null };
      const snap = (value: number) => Math.round(value * settings.precision) / settings.precision;
      const column = (width + metric.margin) / metric.cols;
      const position = { x: Math.max(0, Math.min(metric.cols - original.w, snap((point.x - offset.x - grid.x - window.scrollX) / column))), y: Math.max(0, Math.min(1000 - original.h, snap((point.y - offset.y - grid.y - window.scrollY) / metric.pitch))) };
      const next = placeTab(before, panel, position, overlap); const placed = next.items.find(item => item.i === panel)!;
      return { next, box: { x: grid.x + window.scrollX + placed.x * column, y: grid.y + window.scrollY + placed.y * metric.pitch, width: placed.w * column - metric.margin, height: placed.h * metric.pitch - metric.margin, label: `松开鼠标拆出：${def.titles[panel]}` } };
    };
    tabDrag.start(event, settings.threshold, point => { setGestureActive(true); setPanelMenu(null); setTabPreview(resolve(point).box); }, point => {
      setGestureActive(false); setTabPreview(null);
      if (!point) return;
      const next = resolve(point).next;
      if (next !== before) { commit(next); setSelected(panel); raise(windowOwner(next, panel)); }
    });
  };
  return <div className={`wb-app ${def.classes.app}`}>{def.navigation}<div className={`wb-toolbar ${def.classes.toolbar}`}>{def.actions?.(api)}<button aria-label="撤销布局" title="撤销布局 Ctrl+Z（本页最多100步）" disabled={gestureActive || !history.current.past.length} onClick={() => travel('undo')}>撤销</button><button aria-label="重做布局" title="重做布局 Ctrl+Y / Ctrl+Shift+Z" disabled={gestureActive || !history.current.future.length} onClick={() => travel('redo')}>重做</button><button onClick={() => commit({ ...data, locked: !data.locked })}>{data.locked ? '解锁布局' : '锁定布局'}</button><button aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}>布局设置</button><button onClick={() => commit(def.defaults())}>恢复默认布局</button><button onClick={() => downloadLayout(data, `${def.id}-grid.json`)}>导出布局</button><button onClick={() => file.current?.click()}>导入布局</button></div>
    <div className={`wb-options ${def.classes.options}`}>{Object.entries(def.titles).map(([id, title]) => <label key={id}><input type="checkbox" checked={!data.hidden.includes(id)} onChange={() => toggle(id)} />{title}</label>)}</div><div className="wb-message" role="status">{message}</div>
    {settingsOpen && <section className="wb-settings" aria-label="布局设置"><div className="wb-preferences"><label>拖动触发距离 <input type="number" min={0} max={24} value={settings.threshold} onChange={e => changeSettings({ ...settings, threshold: Number(e.target.value) })} /> 像素</label><label>网格精度 <select aria-label="网格精度" value={settings.precision} onChange={e => changeSettings({ ...settings, precision: Number(e.target.value) })}>{(metric.precisions ?? [1, 2, 4]).map(n => <option key={n} value={n}>{metric.cols * n} 列</option>)}</select></label><label>自动补位 <select aria-label="自动补位" disabled={overlap} value={String(settings.autoCompact)} onChange={e => changeSettings({ ...settings, autoCompact: e.target.value === 'true' })}><option value="false">关闭 · 保留空位</option><option value="true">开启 · 向上填补空位</option></select></label><label>碰撞处理 <select aria-label="碰撞处理" value={settings.collision} onChange={e => changeSettings({ ...settings, collision: e.target.value as GridSettings['collision'] })}><option value="push">自动让位</option><option value="block">阻止重叠</option><option value="overlap">自由叠放 · 不让位</option></select></label><label>拖动预览 <select aria-label="拖动预览" value={settings.preview} onChange={e => changeSettings({ ...settings, preview: e.target.value as GridSettings['preview'] })}><option value="window">窗口跟随鼠标</option><option value="outline">仅显示落点框</option></select></label><button onClick={() => changeSettings(def.settings(def.defaults()))}>恢复推荐设置</button></div>
      <p>自由叠放允许重叠，点击窗口置顶，拖动不挤动其他窗口。{narrow ? '窄屏仅作单列预览，请加宽后调整布局。' : '微调以本 Lab 的标准网格为单位。'}</p>{def.settingsActions?.(api)}
      <PanelTabsSettings data={data} titles={def.titles} commit={commit} narrow={narrow} />
      <label>选择窗口 <select aria-label="选择窗口" value={selected} onChange={e => setSelected(e.target.value)}>{Object.entries(def.titles).map(([id, title]) => <option key={id} value={id}>{title}{data.hidden.includes(id) ? '（已隐藏）' : ''}</option>)}</select></label>
      <PanelSettingsEditor title={def.titles[selected]} fields={registry[selected] ?? []} options={resolvedPanelSettings(data.panelSettings, selected, registry)} disabled={data.locked} change={(key, value) => changePanelOption(selected, key, value)} reset={() => { if (!data.locked) commit(resetPanelSettings(data, selected)); }} />
      <form key={`${selected}-${item.x}-${item.y}-${item.w}-${item.h}`} onSubmit={e => { e.preventDefault(); if (disabled) return; const fields = new FormData(e.currentTarget); try { const next = def.parse({ ...data, items: data.items.map(value => value.i === item.i ? { ...value, ...Object.fromEntries(['x', 'y', 'w', 'h'].map(key => [key, Number(fields.get(key))])) } : value) }); const changed = next.items.find(value => value.i === item.i)!; if (!overlap && workspaceWindows(next).some(window => overlaps(changed, window.item))) throw new Error('与其他窗口重叠，请调整位置或开启自由叠放。'); commit(next); } catch (error) { setMessage(`未应用：${String(error)}`); } }}><fieldset disabled={disabled}>{(['x', 'y', 'w', 'h'] as const).map((key, index) => <label key={key}>{['横向位置', '纵向位置', '宽度', '高度'][index]}<input name={key} type="number" min={key === 'w' ? metric.minW : key === 'h' ? metric.minH : 0} max={key === 'w' || key === 'x' ? metric.cols : key === 'h' ? metric.maxH : 1000} step={metric.step} defaultValue={item[key]} required /></label>)}<button type="submit">应用位置与尺寸</button></fieldset></form>
    </section>}
    {panelMenu && <PanelContextMenu key={panelMenu.id} title={def.titles[panelMenu.id]} x={panelMenu.x} y={panelMenu.y} fields={registry[panelMenu.id] ?? []} options={resolvedPanelSettings(data.panelSettings, panelMenu.id, registry)} disabled={data.locked} change={(key, value) => changePanelOption(panelMenu.id, key, value)} reset={() => { if (!data.locked) commit(resetPanelSettings(data, panelMenu.id)); }} close={() => setPanelMenu(null)} openSettings={() => { const id = panelMenu.id; setSelected(id); setSettingsOpen(true); setPanelMenu(null); requestAnimationFrame(() => document.querySelector('.wb-panel-settings')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); }} />}
    <input hidden type="file" accept=".json" ref={file} onChange={async e => { const input = e.target.files?.[0]; e.target.value = ''; if (!input) return; try { if (input.size > 1000000) throw new Error('文件不能超过 1MB。'); commit(def.parse(JSON.parse(await input.text()))); } catch (error) { setMessage(`导入失败，当前布局保留：${String(error)}`); } }} />
    <main className={`wb-grid ${def.classes.grid} wb-preview-${settings.preview}`} ref={containerRef}>{mounted && <GridLayout width={width} layout={visible} compactor={getCompactor(!overlap && settings.autoCompact ? 'vertical' : null, overlap, settings.collision === 'block')} gridConfig={{ cols: narrow ? 1 : metric.cols * settings.precision, rowHeight: narrow ? 18 : metric.pitch / settings.precision - metric.margin, margin: [metric.margin, metric.margin], containerPadding: [0, 0] }} dragConfig={{ enabled: !narrow && !data.locked, threshold: settings.threshold, handle: '.wb-drag', cancel: 'button,input,select,textarea' }} resizeConfig={{ enabled: !narrow && !data.locked, handles: ['nw', 'ne', 'sw', 'se'] }} onDragStart={startDrag} onDrag={previewDrag} onDragStop={finishDrag} onResizeStart={() => setGestureActive(true)} onResizeStop={items => { setGestureActive(false); commit(mergeItems(data, items, settings.precision, narrow)); }}>{visible.map(value => <section key={value.i} id={`${def.id}-panel-${value.i}`} data-panel-selected={windowOwner(data, selected) === value.i} onPointerDownCapture={() => { setSelected(windows.find(window => window.item.i === value.i)!.active); if (overlap) raise(value.i); }} onFocusCapture={() => { if (overlap) raise(value.i); }} style={overlap ? { zIndex: stack.indexOf(value.i) + 2 } : undefined} className={`wb-window ${def.classes.window} ${def.id}-window-${value.i} ${def.id}-grid-panel--${value.i}`} aria-label={windows.find(window => window.item.i === value.i)!.panels.map(id => def.titles[id]).join(' / ')}><GridWindowContents id={`${def.id}-${value.i}`} panels={windows.find(window => window.item.i === value.i)!.panels} active={windows.find(window => window.item.i === value.i)!.active} grouped={!!panelGroup(data, value.i)} titles={def.titles} classes={def.classes} renderPanel={id => def.renderPanel(id, resolvedPanelSettings(data.panelSettings, id, registry))} configure={configure} dragTab={dragTab} suppressTabClick={() => tabDrag.suppressClick.current} hide={toggle} activate={id => { setSelected(id); commit({ ...data, tabs: { ...data.tabs!, groups: data.tabs!.groups.map(group => group.panels.includes(id) ? { ...group, active: id } : group) } }, false); }} /></section>)}</GridLayout>}</main>{dropTarget && createPortal(<div className="wb-merge-preview" role="status" style={{ left: dropTarget.x, top: dropTarget.y, width: dropTarget.width, height: dropTarget.windowHeight }}><strong>松开鼠标合并到：{workspaceWindows(gesture.current!.before).find(value => value.item.i === dropTarget.id)!.panels.map(id => def.titles[id]).join(' / ')}</strong></div>, document.body)}{tabPreview && createPortal(<div className="wb-merge-preview wb-tab-drag-preview" role="status" style={{ left: tabPreview.x, top: tabPreview.y, width: tabPreview.width, height: tabPreview.height }}><strong>{tabPreview.label}</strong></div>, document.body)}{def.footer}
  </div>;
}
