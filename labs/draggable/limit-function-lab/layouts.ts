import type { Data } from '@puckeditor/core';
import { parsePanelTabs, type PanelTabs } from '../../kit/draggable/tabs.ts';
import { parsePanelSettings, type PanelSettings } from '../../kit/draggable/panelSettings.ts';
import { defaultGridSettings, parseGridSettings, type GridSettings } from '../../kit/draggable/settings.ts';

export const panelIds = ['parameters', 'presets', 'explanation', 'formula', 'metrics', 'curve', 'milestones', 'details'] as const;
export type PanelId = typeof panelIds[number];
export const titles: Record<PanelId, string> = {
  parameters: '01 / 选择函数与目标极限', presets: '02 / 常用数据示例', explanation: '这个极限是什么意思？',
  formula: '03 / 已生成的 F(X)', metrics: '当前计算结果', curve: '04 / 曲线与 X 调节',
  milestones: '05 / 到底要多大的 X？', details: '06 / 当前计算说明',
};
export const GRID_KEY = 'limit-function-lab.grid.v1';
export const PUCK_KEY = 'limit-function-lab.puck.v1';
export type GridData = {
  lab: 'limit-function'; version: 1;
  items: { i: PanelId; x: number; y: number; w: number; h: number }[];
  hidden: PanelId[]; locked: boolean; settings: GridSettings; tabs?: PanelTabs; panelSettings?: PanelSettings;
};
export function defaultGrid(): GridData {
  return { lab: 'limit-function', version: 1, hidden: [], locked: false,
    settings: { ...defaultGridSettings(), precision: 1, referenceFrame: { visible: false, width: 1920, height: 1080, layer: 'back' } },
    items: [
      { i: 'parameters', x: 0, y: 0, w: 12, h: 29 },
      { i: 'presets', x: 0, y: 29, w: 12, h: 11 },
      { i: 'explanation', x: 0, y: 40, w: 12, h: 14 },
      { i: 'formula', x: 12, y: 0, w: 36, h: 8 },
      { i: 'metrics', x: 12, y: 8, w: 36, h: 7 },
      { i: 'curve', x: 12, y: 15, w: 36, h: 37 },
      { i: 'milestones', x: 12, y: 52, w: 21, h: 18 },
      { i: 'details', x: 33, y: 52, w: 15, h: 18 },
    ] };
}
export function parseGrid(input: unknown): GridData {
  const value = input as GridData;
  if (!value || value.lab !== 'limit-function' || value.version !== 1 || !Array.isArray(value.items) || value.items.length !== panelIds.length ||
    new Set(value.items.map(item => item?.i)).size !== panelIds.length || !Array.isArray(value.hidden) || value.hidden.some(id => !panelIds.includes(id)) || typeof value.locked !== 'boolean') throw new Error('不是有效的极限函数 Grid 布局。');
  for (const item of value.items) {
    if (!item || !panelIds.includes(item.i) || ![item.x, item.y, item.w, item.h].every(Number.isFinite) || item.x < 0 || item.y < 0 || item.w < 4 || item.h < 3 || item.x + item.w > 48 || item.y + item.h > 1000 || ![item.x, item.y, item.w, item.h].every(n => Number.isInteger(n * 2))) throw new Error('窗口位置或大小无效。');
  }
  const tabs = parsePanelTabs(value.tabs, [...panelIds]);
  const panelSettings = parsePanelSettings(value.panelSettings, panelIds, {});
  return structuredClone({ ...value, settings: parseGridSettings(value.settings), ...(tabs ? { tabs } : {}), ...(panelSettings ? { panelSettings } : {}) });
}
export type Blocks = {
  Panel: { panel: PanelId };
  Workspace: { sidebar: Data<Blocks>['content']; main: Data<Blocks>['content'] };
  Bottom: { content: Data<Blocks>['content'] };
};
export type PuckData = Data<Blocks>;
export function defaultPuck(): PuckData {
  const panel = (id: PanelId) => ({ type: 'Panel' as const, props: { id: `limit-${id}`, panel: id } });
  return { root: { props: {} }, content: [{ type: 'Workspace', props: { id: 'limit-workspace',
    sidebar: [panel('parameters'), panel('presets'), panel('explanation')],
    main: [panel('formula'), panel('metrics'), panel('curve'), { type: 'Bottom', props: { id: 'limit-bottom', content: [panel('milestones'), panel('details')] } }],
  } }] };
}
export function parsePuck(input: unknown): PuckData {
  const value = input as PuckData; const ids = new Set<string>(); let count = 0;
  function check(content: PuckData['content'], depth: number) {
    if (!Array.isArray(content) || depth > 8) throw new Error('布局层级无效。');
    for (const block of content) {
      if (++count > 100 || !block?.props || typeof block.props.id !== 'string' || !block.props.id || ids.has(block.props.id)) throw new Error('组件编号无效或重复。');
      ids.add(block.props.id);
      if (block.type === 'Workspace') { check(block.props.sidebar, depth + 1); check(block.props.main, depth + 1); }
      else if (block.type === 'Bottom') check(block.props.content, depth + 1);
      else if (block.type !== 'Panel' || !panelIds.includes(block.props.panel)) throw new Error('未知面板。');
    }
  }
  if (!value || !value.root || typeof value.root !== 'object') throw new Error('不是极限函数 Puck 布局。');
  check(value.content, 0); return structuredClone(value);
}
