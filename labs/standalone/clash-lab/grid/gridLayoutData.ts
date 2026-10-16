import type { Layout, LayoutItem } from 'react-grid-layout';

export const GRID_LAYOUT_KEY = 'clash-lab.grid-layout.v1';
export const PANEL_TITLES = {
  'left-unit': '左侧单位与状态',
  'right-unit': '右侧单位与状态',
  logs: '战斗日志',
  state: '运行数据',
} as const;
export type PanelId = keyof typeof PANEL_TITLES;
export type GridWorkspaceLayout = { version: 1; items: LayoutItem[]; hidden: PanelId[]; locked: boolean };

export function defaultGridLayout(): GridWorkspaceLayout {
  return {
    version: 1, locked: false, hidden: [],
    items: [
      { i: 'left-unit', x: 0, y: 0, w: 4, h: 28, minW: 3, minH: 6 },
      { i: 'right-unit', x: 4, y: 0, w: 4, h: 28, minW: 3, minH: 6 },
      { i: 'logs', x: 8, y: 0, w: 4, h: 14, minW: 3, minH: 6 },
      { i: 'state', x: 8, y: 14, w: 4, h: 14, minW: 3, minH: 6 },
    ],
  };
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const panelId = (value: unknown): value is PanelId => typeof value === 'string' && Object.hasOwn(PANEL_TITLES, value);

export function parseGridLayout(value: unknown): GridWorkspaceLayout {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.items) || !Array.isArray(value.hidden) || typeof value.locked !== 'boolean') throw new Error('布局格式或版本不正确。');
  const legacy = value.items.length === 6;
  const validId = (id: unknown): id is string => panelId(id) || (legacy && (id === 'left-skill' || id === 'right-skill'));
  if (value.items.length !== (legacy ? 6 : Object.keys(PANEL_TITLES).length)) throw new Error('布局的面板数量不正确。');
  const ids = new Set<string>();
  const items = value.items.map(item => {
    if (!record(item) || !validId(item.i) || ids.has(item.i)) throw new Error('面板名称无效或重复。');
    ids.add(item.i);
    for (const key of ['x', 'y', 'w', 'h']) if (!Number.isSafeInteger(item[key])) throw new Error('面板位置和尺寸必须为整数。');
    const { x, y, w, h } = item as { x: number; y: number; w: number; h: number };
    if (x < 0 || y < 0 || y > 1000 || w < 3 || w > 12 || x + w > 12 || h < 6 || h > 100) throw new Error('面板位置或尺寸超出范围。');
    return { i: item.i, x, y, w, h, minW: 3, minH: 6, maxH: 100 };
  });
  if (!value.hidden.every(validId) || new Set(value.hidden).size !== value.hidden.length) throw new Error('隐藏面板列表不正确。');
  const merged = items.filter(item => panelId(item.i)).map(item => {
    if (!legacy || (item.i !== 'left-unit' && item.i !== 'right-unit')) return item;
    const skill = items.find(other => other.i === item.i.replace('-unit', '-skill'))!;
    return { ...item, h: Math.min(100, item.h + skill.h) };
  });
  return { version: 1, items: merged, hidden: value.hidden.filter(panelId), locked: value.locked };
}

export function mergeVisibleLayout(current: GridWorkspaceLayout, visible: Layout): GridWorkspaceLayout {
  const changes = new Map(visible.map(item => [item.i, item]));
  return parseGridLayout({ ...current, items: current.items.map(item => current.hidden.includes(item.i as PanelId) ? item : changes.get(item.i) ?? item) });
}

// Mobile stacking is a display transformation; it must not overwrite the desktop arrangement.
export function mobileGridItems(data: GridWorkspaceLayout): LayoutItem[] {
  let y = 0;
  return [...data.items].filter(item => !data.hidden.includes(item.i as PanelId)).sort((a, b) => a.y - b.y || a.x - b.x).map(item => {
    const result = { ...item, x: 0, y, w: 1, minW: 1 };
    y += item.h;
    return result;
  });
}

export function readGridLayout(storage: Pick<Storage, 'getItem'>): GridWorkspaceLayout {
  const saved = storage.getItem(GRID_LAYOUT_KEY);
  return saved ? parseGridLayout(JSON.parse(saved)) : defaultGridLayout();
}
export function writeGridLayout(storage: Pick<Storage, 'setItem'>, data: GridWorkspaceLayout) {
  storage.setItem(GRID_LAYOUT_KEY, JSON.stringify(parseGridLayout(data)));
}
