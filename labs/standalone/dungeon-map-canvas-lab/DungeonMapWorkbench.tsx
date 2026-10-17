import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DockWorkspace } from '@/core/ui/editor-kit/DockWorkspace';
import { arrangeDockPanels, dockLeaves } from '@/core/ui/editor-kit/dockLayout';
import { defaultMapWorkspace, mapBrowserLabels, mapBrowserPanels, mapWorkspaceKey, readMapWorkspace, type MapBrowserPanel } from './dungeonMapWorkspace';

export function DungeonMapWorkbench({ documentBar, toolbar, outline, entities, components, inspector, status, settings, settingsMode, onSettingsMode,
  issues, issuesCount, children }: {
  documentBar: ReactNode; toolbar: ReactNode; outline: ReactNode; entities: ReactNode; components: ReactNode; inspector: ReactNode; status: ReactNode;
  settings: ReactNode; settingsMode: 'project' | 'inspector' | 'appearance';
  onSettingsMode(mode: 'project' | 'inspector' | 'appearance'): void;
  issues: ReactNode; issuesCount: number; children: ReactNode;
}) {
  const [preferences, setPreferences] = useState(() => {
    try { return readMapWorkspace(localStorage, window.innerWidth); } catch { return defaultMapWorkspace(window.innerWidth); }
  }), [issuesOpen, setIssuesOpen] = useState(false);
  const visible = mapBrowserPanels.filter(panel => preferences.visible[panel]);
  const leftOpen = preferences.leftOpen && visible.length > 0;
  const showPanel = (panel: MapBrowserPanel) => setPreferences(value => ({ ...value, leftOpen: true,
    visible: { ...value.visible, [panel]: !value.leftOpen || !value.visible[panel] } }));
  const arrange = (axis: 'x' | 'y') => setPreferences(value => ({ ...value, leftOpen: true,
    tree: arrangeDockPanels(dockLeaves(value.tree), axis), left: axis === 'x' ? Math.max(660, value.left) : value.left }));
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ x: number; width: number } | null>(null);
  useEffect(() => { try { localStorage.setItem(mapWorkspaceKey, JSON.stringify(preferences)); } catch { /* Session layout still works. */ } }, [preferences]);
  useEffect(() => {
    const element = dialog.current;if (!element) return;
    if (settingsMode !== 'inspector' && !element.open) element.showModal();
    else if (settingsMode === 'inspector' && element.open) element.close();
  }, [settingsMode]);
  const setWidth = (side: 'left' | 'right', width: number) => setPreferences(value => ({ ...value,
    [side]: Math.max(side === 'left' ? 210 : 280, Math.min(side === 'left' ? 1000 : 480, width)) }));
  const splitter = (side: 'left' | 'right') => <div className={`map-workbench-splitter ${side}`} role="separator" tabIndex={0}
    aria-label={side === 'left' ? '调整内容列表宽度' : '调整属性面板宽度'} aria-orientation="vertical"
    aria-valuemin={side === 'left' ? 210 : 280} aria-valuemax={side === 'left' ? 1000 : 480} aria-valuenow={preferences[side]}
    onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();setWidth(side, preferences[side] + (event.key === 'ArrowRight' ? 16 : -16) * (side === 'left' ? 1 : -1));
      }
    }}
    onPointerDown={event => { drag.current = { x: event.clientX, width: preferences[side] };event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerMove={event => { if (drag.current && event.currentTarget.hasPointerCapture(event.pointerId)) setWidth(side, drag.current.width + (event.clientX - drag.current.x) * (side === 'left' ? 1 : -1)); }}
    onPointerUp={event => { drag.current = null;event.currentTarget.releasePointerCapture(event.pointerId); }}
    onPointerCancel={() => { drag.current = null; }} />;
  return <div className="dungeon-lab dungeon-map-workbench scene-workbench" data-left-open={leftOpen} data-right-open={preferences.rightOpen}
    style={{ '--map-left-width': `${preferences.left}px`, '--map-right-width': `${preferences.right}px` } as CSSProperties}>
    <header className="map-workbench-document-bar">
      <span className="map-workbench-brand">地图编辑器</span>{documentBar}
      <nav aria-label="工作台面板" className="map-workbench-panel-buttons">
        {mapBrowserPanels.map(panel => <button key={panel} aria-pressed={preferences.leftOpen && preferences.visible[panel]} onClick={() => showPanel(panel)}>{mapBrowserLabels[panel]}</button>)}
        <button title="浏览面板上下排列" onClick={() => arrange('y')}>上下排列</button>
        <button title="浏览面板左右排列" onClick={() => arrange('x')}>左右排列</button>
        <button aria-pressed={preferences.rightOpen} onClick={() => setPreferences(value => ({ ...value, rightOpen: !value.rightOpen }))}>属性</button>
        <button onClick={() => onSettingsMode('project')}>地图设置</button>
        <button onClick={() => onSettingsMode('appearance')}>视图设置</button>
        <button title="恢复默认面板位置、宽度和显示状态" onClick={() => setPreferences(defaultMapWorkspace(window.innerWidth))}>重置布局</button>
      </nav>
    </header>
    <div className="map-workbench-body">
      <aside className="map-workbench-outline" aria-label="地图浏览面板">
        <DockWorkspace panels={mapBrowserPanels} labels={mapBrowserLabels} tree={preferences.tree} visible={visible} collapsed={preferences.collapsed}
          contents={{ contents: outline, entities, components }} classPrefix="map"
          onTreeChange={tree => setPreferences(value => ({ ...value, tree }))}
          onCollapse={panel => setPreferences(value => ({ ...value, collapsed: { ...value.collapsed, [panel]: !value.collapsed[panel] } }))}
          onHide={panel => setPreferences(value => ({ ...value, visible: { ...value.visible, [panel]: false } }))} />
      </aside>{splitter('left')}
      <main className="dungeon-lab__stage"><div className="map-frame"><div className="map-workbench-viewport-toolbar">{toolbar}</div>{children}</div></main>
      {splitter('right')}<div className="map-workbench-inspector" aria-label="对象属性">{inspector}</div>
    </div>
    {issuesOpen && <section className="map-workbench-issues" aria-label="地图校验问题"><header><strong>地图校验 · {issuesCount} 项</strong><button onClick={() => setIssuesOpen(false)}>关闭</button></header>{issues}</section>}
    <footer className="map-workbench-status">{status}<button className={issuesCount ? 'has-errors' : ''} onClick={() => setIssuesOpen(value => !value)} aria-expanded={issuesOpen}>{issuesCount ? `⚠ ${issuesCount} 项问题` : '✓ 校验通过'}</button></footer>
    <dialog ref={dialog} className="map-workbench-settings" onCancel={() => onSettingsMode('inspector')} onClose={() => onSettingsMode('inspector')}>
      <header><strong>编辑器设置</strong><nav aria-label="设置分类"><button aria-pressed={settingsMode === 'project'} onClick={() => onSettingsMode('project')}>地图与结构</button><button aria-pressed={settingsMode === 'appearance'} onClick={() => onSettingsMode('appearance')}>视图与外观</button></nav><button aria-label="关闭设置" onClick={() => onSettingsMode('inspector')}>×</button></header>
      <div className="map-workbench-settings-body">{settings}</div>
    </dialog>
  </div>;
}
