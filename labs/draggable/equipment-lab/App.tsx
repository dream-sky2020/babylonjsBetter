import { commandDirections, equipmentDirections, equipmentPanelSettings, type PanelDirection } from './panelSettings.ts';
import type { Config } from '@puckeditor/core';
import { GridWorkbench, type GridDefinition } from '../../kit/draggable/GridWorkbench.tsx';
import { PuckWorkbench } from '../../kit/draggable/PuckWorkbench.tsx';
import { Navigation } from '../../kit/draggable/Navigation.tsx';
import { defaultGrid, defaultPuck, GRID_KEY, panelIds, parseGrid, parsePuck, PUCK_KEY, type Blocks, type GridData } from './layouts.ts';
import { Panel, titles, type PanelId } from './panels.tsx';
import { useEquipment } from './store.ts';
const navigation = <><header className="pt-title"><b>▣ 整备 · 装备与技能试验台</b><span>EQUIPMENT CONTROL SYSTEM</span></header><Navigation title="整备 Lab" className="pt-toolbar"><button onClick={() => useEquipment.getState().run('reset')}>恢复示例数据</button></Navigation></>;
const config: Config<Blocks> = {
  root: { render: ({ children }) => <main className="eq-canvas pt-canvas">{children}</main> },
  components: {
    Panel: { label: '整备面板', resolveFields: ({ props }, { fields }) => { const result = { ...fields }; if (!equipmentPanelSettings[props.panel]?.some(field => field.key === 'columns')) delete result.columns; if (!['commands', 'equipment', 'skills'].includes(props.panel)) delete result.direction; else result.direction = { type: 'select', label: '排列方式', options: [...(props.panel === 'commands' ? commandDirections : equipmentDirections)] }; if (props.panel !== 'character') delete result.statsColumns; return result; }, fields: { panel: { type: 'select', label: '面板内容', options: panelIds.map(id => ({ label: titles[id], value: id })) }, title: { type: 'text', label: '窗口标题' }, height: { type: 'number', label: '窗口高度', min: 60, max: 1600 }, columns: { type: 'number', label: '内容列数', min: 1, max: 4 }, direction: { type: 'select', label: '排列方式', options: [...commandDirections] }, statsColumns: { type: 'number', label: '属性列数', min: 1, max: 4 } }, defaultProps: { panel: 'inventory', title: '仓库', height: 320, columns: 1 }, render: ({ panel, title, height, columns, direction, statsColumns, puck }) => <section className="eq-window pt-window pt-grid-window" style={{ height }}><header className="eq-title pt-window-title">{title}</header><div className="eq-body pt-window-body"><Panel id={panel} columns={columns ?? 1} direction={direction} statsColumns={statsColumns ?? 1} editing={puck.isEditing} /></div></section> },
    Columns: { label: '多列布局', fields: { columns: { type: 'number', label: '列数', min: 1, max: 4 }, content: { type: 'slot' } }, defaultProps: { columns: 2, content: [] }, render: ({ columns, content: Content }) => <Content className="eq-columns" style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 8 }} /> },
  },
};
const definition: GridDefinition<GridData> = {
  id: 'equipment', title: '整备 Lab', storageKey: GRID_KEY, titles, defaults: defaultGrid, parse: parseGrid, navigation,
  settings: data => ({ precision: data.precision / 48, threshold: data.threshold, autoCompact: false, collision: data.free ? 'overlap' : 'push', preview: 'window', ...data.settings }),
  withSettings: (data, settings) => ({ ...data, precision: settings.precision * 48, threshold: settings.threshold, free: settings.collision === 'overlap', settings }),
  grid: { cols: 48, pitch: 16, margin: 4, minW: 4, minH: 3, maxH: 1000, step: 0.5, precisions: [0.5, 1, 2] },
  classes: { app: 'pt-app eq-app', toolbar: 'pt-toolbar', options: 'pt-options', grid: 'pt-grid eq-grid', window: 'pt-window pt-grid-window eq-window', title: 'pt-window-title', drag: 'pt-drag', body: 'pt-window-body eq-body' },
  panelSettings: equipmentPanelSettings,
  renderPanel: (id, options) => <Panel id={id as PanelId} columns={Number(options.columns ?? 1)} direction={options.direction as PanelDirection | undefined} statsColumns={Number(options.statsColumns ?? 1)} />,
};
export function App({ entry }: { entry: string }) { return entry === 'grid' ? <GridWorkbench definition={definition} /> : <PuckWorkbench editor={entry === 'editor'} definition={{ id: 'equipment', title: '整备 Lab', storageKey: PUCK_KEY, config, defaults: defaultPuck, parse: parsePuck, navigation, appClass: 'pt-app eq-app', toolbarClass: 'pt-toolbar' }} />; }
