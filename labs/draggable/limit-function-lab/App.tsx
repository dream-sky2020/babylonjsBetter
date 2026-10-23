import type { Config } from '@puckeditor/core';
import { GridWorkbench, type GridDefinition } from '../../kit/draggable/GridWorkbench.tsx';
import { PuckWorkbench } from '../../kit/draggable/PuckWorkbench.tsx';
import { defaultGrid, defaultPuck, GRID_KEY, panelIds, parseGrid, parsePuck, PUCK_KEY, titles, type Blocks, type GridData } from './layouts.ts';
import { CalculatorFooter, CalculatorNavigation, CalculatorPanel, CalculatorProvider } from './session.tsx';

const config: Config<Blocks> = {
  root: { render: ({ children }) => <>{children}</> },
  components: {
    Panel: { label: '计算功能面板', fields: { panel: { type: 'select', label: '面板内容', options: panelIds.map(id => ({ label: titles[id], value: id })) } }, defaultProps: { panel: 'parameters' },
      render: ({ panel, puck }) => <CalculatorPanel id={panel} editing={puck.isEditing} /> },
    Workspace: { label: '默认侧栏与主区域', fields: { sidebar: { type: 'slot', label: '侧栏' }, main: { type: 'slot', label: '主区域' } }, defaultProps: { sidebar: [], main: [] },
      render: ({ sidebar: Sidebar, main: Main }) => <div className="lf-workspace"><Sidebar className="lf-sidebar" /><Main className="lf-main" /></div> },
    Bottom: { label: '下方双列布局', fields: { content: { type: 'slot' } }, defaultProps: { content: [] },
      render: ({ content: Content }) => <Content className="lf-bottom" /> },
  },
};
function Workbench({ entry }: { entry: string }) {
  // Subscribe inside the panels/navigation only. Re-rendering Puck's slot tree on
  // every X change would remount the chart and discard its pointer capture.
  const navigation = <CalculatorNavigation />;
  const footer = <CalculatorFooter />;
  const definition: GridDefinition<GridData> = {
    id: 'limit-function', title: '极限函数计算台', storageKey: GRID_KEY, titles, defaults: defaultGrid, parse: parseGrid, navigation, footer,
    settings: data => data.settings, withSettings: (data, settings) => ({ ...data, settings }),
    grid: { cols: 48, pitch: 16, margin: 4, minW: 4, minH: 3, maxH: 1000, step: 0.5, precisions: [0.5, 1, 2] },
    classes: { app: 'lf-app lf-grid-app', toolbar: 'lf-toolbar', options: 'lf-toolbar', grid: 'lf-grid', window: 'lf-window', title: 'lf-grid-title', drag: 'lf-grid-drag', body: 'lf-body' },
    renderPanel: id => <CalculatorPanel id={id as typeof panelIds[number]} framed={false} />,
  };
  return entry === 'grid' ? <GridWorkbench definition={definition} /> : <>
    <PuckWorkbench editor={entry === 'editor'} definition={{ id: 'limit-function', title: '极限函数计算台', storageKey: PUCK_KEY, config, defaults: defaultPuck, parse: parsePuck, navigation, appClass: 'lf-app', toolbarClass: 'lf-toolbar' }} />
    {footer}
  </>;
}
export function App({ entry }: { entry: string }) { return <CalculatorProvider><Workbench entry={entry} /></CalculatorProvider>; }
