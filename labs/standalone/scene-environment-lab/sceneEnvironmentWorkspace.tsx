import { DockWorkspace } from '../../../core/ui/editor-kit/DockWorkspace';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { defaultDockTree, dockLeaves, panels, validateDockTree, type DockNode, type PanelId } from './sceneEnvironmentDockLayout.ts';
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
  const visible = panels.filter(panel => layout[panel]);
  useEffect(() => {
    const element = document.querySelector<HTMLElement>('.scene-workbench')!;
    const apply = () => { element.style.setProperty('--environment-list-width', `${visible.length ? Math.min(layout.width, Math.max(180, element.clientWidth - 560)) : 0}px`); window.dispatchEvent(new Event('resize')); };
    apply(); const observer = new ResizeObserver(apply); observer.observe(element); return () => observer.disconnect();
  }, [layout.width, visible.length]);
  return <div className="environment-workspace" hidden={!visible.length}>
    <DockWorkspace panels={panels} labels={labels} tree={layout.tree} visible={visible} collapsed={layout.collapsed}
      contents={{ objects, materials, textures }} classPrefix="environment"
      onTreeChange={tree => preferences.change({ tree })}
      onCollapse={panel => preferences.change({ collapsed: { ...layout.collapsed, [panel]: !layout.collapsed[panel] } })}
      onHide={panel => preferences.change({ [panel]: false })} />
    <div className="environment-workspace-splitter" role="separator" aria-label="调整左侧工作区宽度" aria-orientation="vertical" tabIndex={0}
      onPointerDown={event => { if (event.button === 0) event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) preferences.change({ width: Math.max(visible.length > 1 ? 300 : 180, Math.min(document.querySelector<HTMLElement>('.scene-workbench')!.clientWidth - 560, event.clientX - event.currentTarget.parentElement!.getBoundingClientRect().left)) }); }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onDoubleClick={() => preferences.change({ width: 560 })} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); preferences.change({ width: layout.width + (event.key === 'ArrowLeft' ? -20 : 20) }); } }} />
  </div>;
}
