import type { Data } from '@puckeditor/core';
import { parsePanelSettings, type PanelSettings } from '../../kit/draggable/panelSettings.ts';
import { parsePanelTabs, type PanelTabs } from '../../kit/draggable/tabs.ts';
import { parseGridSettings, type GridSettings } from '../../kit/draggable/settings.ts';
import { warehousePanelSettings } from './panelSettings.ts';

export const panelIds = ['warehouse', 'commands', 'information'] as const;
export type PanelId = typeof panelIds[number];
export const titles: Record<PanelId, string> = { warehouse: '仓库面板', commands: '按钮列表', information: '信息面板' };
export type GridData = { lab: 'warehouse'; version: 1; items: { i: PanelId; x: number; y: number; w: number; h: number }[]; hidden: PanelId[]; locked: boolean; free: boolean; precision: number; threshold: number; settings?: GridSettings; tabs?: PanelTabs; panelSettings?: PanelSettings };
export const GRID_KEY = 'warehouse-lab.grid.v1';
export const PUCK_KEY = 'warehouse-lab.puck.v1';

export function defaultGrid(): GridData { return { lab: 'warehouse', version: 1, hidden: [], locked: false, free: true, precision: 48, threshold: 4, items: [
  { i: 'warehouse', x: 0, y: 0, w: 30, h: 34 },
  { i: 'commands', x: 30, y: 0, w: 18, h: 18 },
  { i: 'information', x: 30, y: 18, w: 18, h: 20 },
] }; }
export function parseGrid(input: unknown): GridData {
  const value = input as GridData;
  if (!value || value.lab !== 'warehouse' || value.version !== 1 || !Array.isArray(value.items) || value.items.length !== 3 || new Set(value.items.map(item => item.i)).size !== 3 || !Array.isArray(value.hidden) || value.hidden.some(id => !panelIds.includes(id)) || typeof value.locked !== 'boolean' || typeof value.free !== 'boolean' || ![24, 48, 96].includes(value.precision) || !Number.isInteger(value.threshold) || value.threshold < 0 || value.threshold > 24) throw new Error('不是有效的仓库 Lab 布局。');
  for (const item of value.items) if (!panelIds.includes(item.i) || ![item.x, item.y, item.w, item.h].every(Number.isFinite) || item.x < 0 || item.y < 0 || item.w < 4 || item.h < 3 || item.x + item.w > 48 || item.y + item.h > 1000 || ![item.x, item.y, item.w, item.h].every(n => Number.isInteger(n * 2))) throw new Error('窗口位置或大小无效。');
  if (value.settings !== undefined) { const settings = parseGridSettings(value.settings); if (settings.precision * 48 !== value.precision || settings.threshold !== value.threshold || (settings.collision === 'overlap') !== value.free) throw new Error('拖拽设置与布局不一致。'); }
  if (value.tabs !== undefined) parsePanelTabs(value.tabs, [...panelIds]);
  if (value.panelSettings !== undefined) parsePanelSettings(value.panelSettings, panelIds, warehousePanelSettings);
  return structuredClone(value);
}
export type Blocks = { Panel: { panel: PanelId; title: string; height: number; columns?: number }; Columns: { columns: number; content: Data<Blocks>['content'] } };
export type PuckData = Data<Blocks>;
export function defaultPuck(): PuckData {
  const panel = (id: PanelId, title: string, height: number) => ({ type: 'Panel' as const, props: { id: `warehouse-${id}`, panel: id, title, height } });
  return { root: { props: {} }, content: [{ type: 'Columns', props: { id: 'warehouse-columns', columns: 2, content: [panel('warehouse', '仓库面板', 520), { type: 'Columns', props: { id: 'warehouse-side', columns: 1, content: [panel('commands', '按钮列表', 260), panel('information', '信息面板', 350)] } }] } }] };
}
export function parsePuck(input: unknown): PuckData {
  const value = input as PuckData; const ids = new Set<string>(); let count = 0;
  function check(content: PuckData['content'], depth: number) {
    if (!Array.isArray(content) || depth > 8) throw new Error('布局层级无效。');
    for (const block of content) {
      if (++count > 100 || !block.props || typeof block.props.id !== 'string' || !block.props.id || ids.has(block.props.id)) throw new Error('组件编号无效或重复。');
      ids.add(block.props.id);
      if (block.type === 'Columns') { if (!Number.isInteger(block.props.columns) || block.props.columns < 1 || block.props.columns > 4) throw new Error('列数无效。'); check(block.props.content, depth + 1); }
      else if (block.type !== 'Panel' || !panelIds.includes(block.props.panel) || typeof block.props.title !== 'string' || !Number.isFinite(block.props.height) || block.props.height < 60 || block.props.height > 1600 || block.props.columns !== undefined && (!Number.isInteger(block.props.columns) || block.props.columns < 1 || block.props.columns > 4)) throw new Error('面板配置无效。');
    }
  }
  if (!value || !value.root) throw new Error('不是仓库 Puck 布局。'); check(value.content, 0); return structuredClone(value);
}
