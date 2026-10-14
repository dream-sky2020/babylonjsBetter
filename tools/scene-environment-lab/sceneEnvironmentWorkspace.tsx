import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { defaultDockTree, dockLeaves, dockRects, moveDockPanel, panels, setDockRatio, validateDockTree, type DockNode, type PanelId } from './sceneEnvironmentDockLayout.ts';
type WorkspaceLayout = { objects: boolean; materials: boolean; textures: boolean; collapsed: Partial<Record<PanelId, boolean>>; tree: DockNode; width: number; edges: boolean };
const defaults: WorkspaceLayout = { objects: true, materials: true, textures: true, collapsed: {}, tree: defaultDockTree, width: 560, edges: true };
const labels = { objects: '对象列表', materials: '材质列表', textures: '纹理列表' };
function normalize(value: Partial<WorkspaceLayout> | null): WorkspaceLayout {
  const result = { ...defaults, tree: validateDockTree(value?.tree), collapsed: {} as Partial<Record<PanelId, boolean>> };
  for (const key of [...panels, 'edges'] as const) if (typeof value?.[key] === 'boolean') result[key] = value[key];
  for (const panel of panels) result.collapsed[panel] = value?.collapsed?.[panel] === true;
  if (typeof value?.width === 'number' && Number.isFinite(value.width)) result.width = Math.max(180, Math.min(1200, value.width));
  return result;
}
export function createWorkspacePreferences() {
  const key = 'scene-environment-lab:workspace:v2'; let value = defaults;
  try {
    const saved = localStorage.getItem(key);
    if (saved) value = normalize(JSON.parse(saved));
    else { const old = JSON.parse(localStorage.getItem('scene-environment-lab:workspace:v1') ?? '{}'); value = normalize({ ...old, width: Math.max(560, old.width ?? 560), collapsed: { objects: old.objectsCollapsed, materials: old.materialsCollapsed } }); }
  } catch { /* Use defaults when storage is unavailable. */ }
  const listeners = new Set<() => void>();
  return { getSnapshot: () => value, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, change(patch: Partial<WorkspaceLayout>) {
    value = normalize({ ...value, ...patch }); try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Session preferences still work. */ } listeners.forEach(listener => listener());
  } };
}
export type WorkspacePreferences = ReturnType<typeof createWorkspacePreferences>;
export function WorkspaceButtons({ preferences }: { preferences: WorkspacePreferences }) {
  const layout = useSyncExternalStore(preferences.subscribe, preferences.getSnapshot);
  const arrange = (axis: 'x' | 'y') => { const [a, b, c] = dockLeaves(layout.tree); preferences.change({ tree: { id: 'main', axis, ratio: 1 / 3, first: a, second: { id: 'resources', axis, ratio: 0.5, first: b, second: c } }, width: axis === 'x' ? Math.max(660, layout.width) : layout.width }); };
  return <>{panels.map(panel => <button key={panel} aria-pressed={layout[panel]} onClick={() => preferences.change({ [panel]: !layout[panel] })}>{labels[panel]}</button>)}
    <button onClick={() => arrange('y')}>上下排列</button><button onClick={() => arrange('x')}>左右排列</button>
    <button onClick={() => preferences.change(defaults)}>恢复默认布局</button>
    <button aria-pressed={layout.edges} onClick={() => preferences.change({ edges: !layout.edges })}>选中边框</button></>;
}
export function EnvironmentWorkspace({ preferences, objects, materials, textures }: { preferences: WorkspacePreferences; objects: ReactNode; materials: ReactNode; textures: ReactNode }) {
  const layout = useSyncExternalStore(preferences.subscribe, preferences.getSnapshot);
  const visible = panels.filter(panel => layout[panel]), positions = dockRects(layout.tree, visible);
  const dragged = useRef<{ panel: PanelId; x: number; y: number; moved: boolean } | null>(null);
  const skipClick = useRef(false);
  const [drop, setDrop] = useState<{ target: PanelId; edge: 'left' | 'right' | 'top' | 'bottom' } | null>(null);
  useEffect(() => {
    const element = document.querySelector<HTMLElement>('.scene-workbench')!;
    const apply = () => { element.style.setProperty('--environment-list-width', `${visible.length ? Math.min(layout.width, Math.max(180, element.clientWidth - 560)) : 0}px`); window.dispatchEvent(new Event('resize')); };
    apply(); const observer = new ResizeObserver(apply); observer.observe(element); return () => observer.disconnect();
  }, [layout.width, visible.length]);
  const targetAt = (clientX: number, clientY: number) => {
    const target = Array.from(document.querySelectorAll<HTMLElement>('.environment-dock-panel:not([hidden])')).find(element => {
      const rect = element.getBoundingClientRect(); return element.dataset.panel !== dragged.current?.panel && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    });
    if (!target) return null;
    const rect = target.getBoundingClientRect(), x = (clientX - rect.left) / rect.width, y = (clientY - rect.top) / rect.height;
    const distances = { left: x, right: 1 - x, top: y, bottom: 1 - y };
    return { target: target.dataset.panel as PanelId, edge: (Object.keys(distances) as (keyof typeof distances)[]).sort((a, b) => distances[a] - distances[b])[0] };
  };
  return <div className="environment-workspace" hidden={!visible.length}>
    <div className="environment-dock-area">
      {panels.map(panel => { const rect = positions.leaves.get(panel), collapsed = layout.collapsed[panel]; return <section key={panel} className="environment-list-panel environment-dock-panel" data-panel={panel} hidden={!rect} style={rect ? { left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` } : undefined}>
        <header data-dock-drag aria-label={`拖动${labels[panel]}`} title="拖动标题栏到其他面板边缘，调整排列位置"
          onPointerDown={event => { skipClick.current = false; if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button'))) return; dragged.current = { panel, x: event.clientX, y: event.clientY, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerMove={event => { const drag = dragged.current; if (!drag || drag.panel !== panel || !event.currentTarget.hasPointerCapture(event.pointerId)) return; if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 6) drag.moved = true; if (drag.moved) { event.preventDefault(); setDrop(targetAt(event.clientX, event.clientY)); } }}
          onPointerUp={event => { const drag = dragged.current; if (drag?.moved) { skipClick.current = true; const target = targetAt(event.clientX, event.clientY); if (target) preferences.change({ tree: moveDockPanel(layout.tree, panel, target.target, target.edge) }); } dragged.current = null; setDrop(null); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
          onPointerCancel={() => { dragged.current = null; setDrop(null); }} onClickCapture={event => { if (skipClick.current) { event.stopPropagation(); skipClick.current = false; } }}>
          <span className="environment-dock-grip" title="拖动面板">⠿</span><button aria-expanded={!collapsed} onClick={() => preferences.change({ collapsed: { ...layout.collapsed, [panel]: !collapsed } })}>{collapsed ? '▸' : '▾'} {labels[panel]}</button><button aria-label={`隐藏${labels[panel]}`} onClick={() => preferences.change({ [panel]: false })}>×</button>
        </header><div className="environment-list-panel-body" hidden={collapsed}>{({ objects, materials, textures })[panel]}</div>
        {drop?.target === panel && <div className={`environment-panel-drop-preview ${drop.edge}`}>放到{({ left: '左侧', right: '右侧', top: '上方', bottom: '下方' })[drop.edge]}</div>}
      </section>; })}
      {positions.splits.map(split => <div key={split.id} className={`environment-dock-splitter ${split.axis}`} role="separator" aria-label={`调整面板分区 ${split.id}`} aria-orientation={split.axis === 'x' ? 'vertical' : 'horizontal'} aria-valuenow={Math.round(split.ratio * 100)} tabIndex={0}
        style={split.axis === 'x' ? { left: `calc(${(split.rect.x + split.rect.w * split.ratio) * 100}% - 3px)`, top: `${split.rect.y * 100}%`, height: `${split.rect.h * 100}%`, width: 6 } : { top: `calc(${(split.rect.y + split.rect.h * split.ratio) * 100}% - 3px)`, left: `${split.rect.x * 100}%`, width: `${split.rect.w * 100}%`, height: 6 }}
        onPointerDown={event => { if (event.button === 0) event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; const rect = event.currentTarget.parentElement!.getBoundingClientRect();
          const extent = split.axis === 'x' ? rect.width * split.rect.w : rect.height * split.rect.h;
          const relative = split.axis === 'x' ? (event.clientX - rect.left) / rect.width - split.rect.x : (event.clientY - rect.top) / rect.height - split.rect.y;
          const minimum = Math.min(0.45, (split.axis === 'x' ? 100 : 70) / extent), ratio = relative / (split.axis === 'x' ? split.rect.w : split.rect.h);
          preferences.change({ tree: setDockRatio(layout.tree, split.id, Math.max(minimum, Math.min(1 - minimum, ratio))) });
        }} onPointerUp={event => event.currentTarget.releasePointerCapture(event.pointerId)} onDoubleClick={() => preferences.change({ tree: setDockRatio(layout.tree, split.id, 0.5) })} onKeyDown={event => { if (event.key.startsWith('Arrow')) { event.preventDefault(); preferences.change({ tree: setDockRatio(layout.tree, split.id, split.ratio + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -0.05 : 0.05)) }); } }} />)}
    </div>
    <div className="environment-workspace-splitter" role="separator" aria-label="调整左侧工作区宽度" aria-orientation="vertical" tabIndex={0}
      onPointerDown={event => { if (event.button === 0) event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) preferences.change({ width: Math.max(visible.length > 1 ? 300 : 180, Math.min(document.querySelector<HTMLElement>('.scene-workbench')!.clientWidth - 560, event.clientX - event.currentTarget.parentElement!.getBoundingClientRect().left)) }); }} onPointerUp={event => event.currentTarget.releasePointerCapture(event.pointerId)} onDoubleClick={() => preferences.change({ width: 560 })} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); preferences.change({ width: layout.width + (event.key === 'ArrowLeft' ? -20 : 20) }); } }} />
  </div>;
}
