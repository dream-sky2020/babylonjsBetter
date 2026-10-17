import { parsePanelSettings, type PanelSettings } from '../../kit/draggable/panelSettings.ts';
import { commandDirections, equipmentDirections, equipmentPanelSettings, type PanelDirection } from './panelSettings.ts';
import { parsePanelTabs, type PanelTabs } from '../../kit/draggable/tabs.ts';
import type { Data } from '@puckeditor/core';
import type { PanelId } from './panels.tsx';
import { parseGridSettings, type GridSettings } from '../../kit/draggable/settings.ts';
export const panelIds: PanelId[] = ['information', 'character', 'commands', 'equipment', 'skills', 'inventory'];
export type Geometry = { i: PanelId; x: number; y: number; w: number; h: number };
export type GridData = { lab: 'equipment'; version: 1; items: Geometry[]; hidden: PanelId[]; locked: boolean; free: boolean; precision: number; threshold: number; settings?: GridSettings; tabs?: PanelTabs; panelSettings?: PanelSettings };
export const GRID_KEY = 'equipment-lab.grid.v1'; export const PUCK_KEY = 'equipment-lab.puck.v1';
export function defaultGrid(): GridData { return { lab: 'equipment', version: 1, hidden: [], locked: false, free: true, precision: 48, threshold: 4, items: [
  { i: 'information', x: 0, y: 0, w: 48, h: 11 }, { i: 'character', x: 0, y: 11, w: 14, h: 31 }, { i: 'commands', x: 14, y: 11, w: 34, h: 6 },
  { i: 'equipment', x: 14, y: 17, w: 17, h: 16 }, { i: 'skills', x: 31, y: 17, w: 17, h: 25 }, { i: 'inventory', x: 14, y: 33, w: 17, h: 20 },
] }; }
export function parseGrid(input: unknown): GridData {
  const value = input as GridData;
  if (!value || value.lab !== 'equipment' || value.version !== 1 || !Array.isArray(value.items) || value.items.length !== 6 || new Set(value.items.map(item => item.i)).size !== 6 || !Array.isArray(value.hidden) || value.hidden.some(id => !panelIds.includes(id)) || typeof value.locked !== 'boolean' || typeof value.free !== 'boolean' || ![24, 48, 96].includes(value.precision) || !Number.isInteger(value.threshold) || value.threshold < 0 || value.threshold > 24) throw new Error('不是有效的整备 Lab 布局。');
  for (const item of value.items) if (!panelIds.includes(item.i) || ![item.x, item.y, item.w, item.h].every(Number.isFinite) || item.x < 0 || item.y < 0 || item.w < 4 || item.h < 3 || item.x + item.w > 48 || item.y + item.h > 1000 || ![item.x, item.y, item.w, item.h].every(n => Number.isInteger(n * 2))) throw new Error('窗口位置或大小无效。');
  if (value.settings !== undefined) { const settings = parseGridSettings(value.settings); if (settings.precision * 48 !== value.precision || settings.threshold !== value.threshold || (settings.collision === 'overlap') !== value.free) throw new Error('拖拽设置与布局不一致。'); }
  if (value.tabs !== undefined) parsePanelTabs(value.tabs, panelIds);
  if (value.panelSettings !== undefined) parsePanelSettings(value.panelSettings, panelIds, equipmentPanelSettings);
  return structuredClone(value);
}
export type Blocks = { Panel: { panel: PanelId; title: string; height: number; columns?: number; direction?: PanelDirection; statsColumns?: number }; Columns: { columns: number; content: Data<Blocks>['content'] } };
export type PuckData = Data<Blocks>;
export function defaultPuck(): PuckData {
  const panel = (id: PanelId, title: string, height: number) => ({ type: 'Panel' as const, props: { id: `equipment-${id}`, panel: id, title, height } });
  return { root: { props: {} }, content: [panel('information', '信息面板', 164), { type: 'Columns', props: { id: 'equipment-top', columns: 3, content: [panel('character', '人物面板', 350), panel('equipment', '装备面板', 350), panel('skills', '技能面板', 440)] } }, panel('commands', '按钮列表', 90), panel('inventory', '仓库', 330)] };
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
      if (block.type === 'Panel' && block.props.direction !== undefined && ![...commandDirections, ...equipmentDirections].some(option => option.value === block.props.direction)) throw new Error('面板排列方式无效。');
      if (block.type === 'Panel' && block.props.statsColumns !== undefined && (!Number.isInteger(block.props.statsColumns) || block.props.statsColumns < 1 || block.props.statsColumns > 4)) throw new Error('属性列数无效。');
    }
  }
  if (!value || !value.root) throw new Error('不是整备 Puck 布局。'); check(value.content, 0); return structuredClone(value);
}
export function download(data: unknown, filename: string) { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function read<T>(key: string, parse: (value: unknown) => T, fallback: () => T): T { const stored = localStorage.getItem(key); return stored ? parse(JSON.parse(stored)) : fallback(); }
