import { GridWorkbench, type GridDefinition } from '../../../kit/draggable/GridWorkbench.tsx';
import { Navigation } from '../../../kit/draggable/Navigation.tsx';
import { defaultGridSettings } from '../../../kit/draggable/settings.ts';
import { useCombatStore } from '../store.ts';
import { BattleLog, useUnit } from '../shared/CombatWidgets.tsx';
import { UnitParameters } from './UnitParameters.tsx';
import { defaultGridLayout, parseGridLayout, GRID_LAYOUT_KEY, PANEL_TITLES, type GridWorkspaceLayout } from './gridLayoutData.ts';
function RuntimePanel() {
  const leftUnits = useCombatStore(state => state.leftUnits); const rightUnits = useCombatStore(state => state.rightUnits);
  const selectedLeftUnitId = useCombatStore(state => state.selectedLeftUnitId); const selectedRightUnitId = useCombatStore(state => state.selectedRightUnitId);
  return <pre className="clash-grid-state">{JSON.stringify({ selectedLeftUnitId, selectedRightUnitId, leftUnits, rightUnits }, null, 2)}</pre>;
}
function SystemStatus() {
  const left = useUnit('left'); const right = useUnit('right'); const count = useCombatStore(state => state.logs.length);
  return <footer className="xp-system-status"><span><i />本地战斗会话</span><span>左侧: {left?.name ?? '未选择'} / HP {left?.hp ?? '—'}</span><span>右侧: {right?.name ?? '未选择'} / HP {right?.hp ?? '—'}</span><span>日志记录: {count}</span><span>CLASH CONTROL SYSTEM</span></footer>;
}
const definition: GridDefinition<GridWorkspaceLayout> = {
  id: 'clash', title: 'Clash Lab', storageKey: GRID_LAYOUT_KEY, titles: PANEL_TITLES, defaults: defaultGridLayout, parse: parseGridLayout,
  settings: data => data.settings ?? { ...defaultGridSettings(), precision: 1, autoCompact: true }, withSettings: (data, settings) => ({ ...data, settings }),
  grid: { cols: 12, pitch: 23, margin: 5, minW: 3, minH: 6, maxH: 100, step: 0.25 },
  classes: { app: 'clash-grid-workspace', toolbar: 'clash-toolbar', options: 'clash-grid-options', grid: 'clash-grid-container', window: 'clash-grid-panel', title: 'clash-grid-panel-header', drag: 'clash-grid-drag', body: 'clash-grid-panel-body' },
  navigation: <><div className="xp-system-title"><span className="xp-app-icon" aria-hidden="true">C</span><strong>Clash 战斗试验台 — 工业控制终端</strong></div><Navigation title="控制台" className="clash-toolbar"><a href="./index.html?legacy=1">完整战斗参数</a></Navigation></>,
  actions: () => <><button onClick={() => window.startClash()}>开启拼点</button><button onClick={() => window.endTurn()}>回合结束</button><button onClick={() => useCombatStore.getState().clearLogs()}>清空日志</button></>,
  footer: <SystemStatus />,
  renderPanel: id => id === 'left-unit' || id === 'right-unit' ? <UnitParameters side={id === 'left-unit' ? 'left' : 'right'} /> : id === 'logs' ? <BattleLog height={300} /> : <RuntimePanel />,
};
export function GridWorkspace() { return <GridWorkbench definition={definition} />; }
