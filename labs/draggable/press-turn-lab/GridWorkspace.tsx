import { GridWorkbench, type GridDefinition } from '../../kit/draggable/GridWorkbench.tsx';
import { PreparationPanel } from './PreparationPanel.tsx';
import { defaultGrid, GRID_KEY, parseGrid, TITLES, type GridData } from './layouts.ts';
import { Navigation } from './Navigation.tsx';
import { placeBattlefieldTop } from './gridPlacement.ts';
import { BattlefieldPanel, CommandPanel, BattleLog, FieldEditorPanel, PlayerPanel, RulesPanel, RuntimePanel, SessionButtons } from './widgets.tsx';
const definition: GridDefinition<GridData> = {
  id: 'pt', title: 'Press Turn Lab', storageKey: GRID_KEY, titles: TITLES, defaults: defaultGrid, parse: parseGrid,
  settings: data => data.settings, withSettings: (data, settings) => ({ ...data, settings }),
  grid: { cols: 12, pitch: 23, margin: 5, minW: 3, minH: 5, maxH: 100, step: 0.25 },
  classes: { app: 'pt-app', toolbar: 'pt-toolbar', options: 'pt-options', grid: 'pt-grid', window: 'pt-window pt-grid-window', title: 'pt-window-title', drag: 'pt-drag', body: 'pt-window-body' },
  navigation: <Navigation current="Grid 工作台" />,
  actions: api => <><SessionButtons /><button onClick={() => api.reveal('preparation')}>整备面板</button></>,
  settingsActions: api => <button disabled={api.narrow || api.data.locked} onClick={() => api.commit(placeBattlefieldTop(api.data))}>战场置顶</button>,
  renderPanel: id => id === 'left' || id === 'right' ? <FieldEditorPanel side={id} /> : id === 'preparation' ? <PreparationPanel /> : id === 'player' ? <PlayerPanel /> : id === 'battlefield' ? <BattlefieldPanel /> : id === 'console' ? <CommandPanel /> : id === 'logs' ? <BattleLog /> : id === 'rules' ? <RulesPanel /> : <RuntimePanel />,
};
export function GridWorkspace() { return <GridWorkbench definition={definition} />; }
