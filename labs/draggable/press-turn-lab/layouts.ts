import { parsePanelSettings, type PanelSettings } from '../../kit/draggable/panelSettings.ts';
import { parsePanelTabs, type PanelTabs } from '../../kit/draggable/tabs.ts';
import type { Data, Slot } from '@puckeditor/core';
import type { LayoutItem } from 'react-grid-layout';
import type { Side } from './types.ts';
import { defaultGridSettings, parseGridSettings, type GridSettings } from './gridSettings.ts';
export const GRID_KEY = 'press-turn-lab.grid.v1';
export const PUCK_KEY = 'press-turn-lab.puck.v1';
export const TITLES = { battlefield: '战场总览', player: '操控面板', left: '我方角色数据', right: '敌方角色数据', console: '行动指令', logs: '结算日志', rules: '行动点规则', state: '运行数据', preparation: '整备面板' } as const;
export type Panel = keyof typeof TITLES;
export type GridData = { format: 'press-turn-grid-v7'; items: LayoutItem[]; hidden: Panel[]; locked: boolean; settings: GridSettings; tabs?: PanelTabs; panelSettings?: PanelSettings };
export function defaultGrid(): GridData { return { format: 'press-turn-grid-v7', settings: defaultGridSettings(), locked: false, hidden: [], items: [
  { i: 'battlefield', x: 0, y: 0, w: 8, h: 19 },
  { i: 'player', x: 0, y: 19, w: 4, h: 28 }, { i: 'preparation', x: 4, y: 19, w: 4, h: 37 },
  { i: 'left', x: 8, y: 0, w: 4, h: 28 }, { i: 'right', x: 8, y: 28, w: 4, h: 28 },
  { i: 'console', x: 0, y: 47, w: 4, h: 9 },
  { i: 'rules', x: 0, y: 56, w: 8, h: 10 }, { i: 'state', x: 8, y: 56, w: 4, h: 10 },
  { i: 'logs', x: 0, y: 66, w: 12, h: 14 },
].map(item => ({ ...item, minW: 3, minH: 5, maxH: 100 })) }; }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function parseGrid(value: unknown): GridData {
  const formats = ['press-turn-grid-v1', 'press-turn-grid-v2', 'press-turn-grid-v3', 'press-turn-grid-v4', 'press-turn-grid-v5', 'press-turn-grid-v6', 'press-turn-grid-v7'];
  if (!record(value) || !formats.includes(String(value.format)) || !Array.isArray(value.items) || !Array.isArray(value.hidden) || typeof value.locked !== 'boolean') throw new Error('需要 Press Turn Grid 布局。');
  const version = formats.indexOf(String(value.format)) + 1;
  const expected = version === 1 ? ['left', 'right', 'console', 'logs', 'rules', 'state'] : version === 2 ? ['field', 'player', 'console', 'logs', 'rules', 'state'] : version === 3 ? ['left', 'right', 'player', 'console', 'logs', 'rules', 'state'] : version === 5 ? Object.keys(TITLES).filter(id => id !== 'player' && id !== 'preparation') : version < 7 ? Object.keys(TITLES).filter(id => id !== 'preparation') : Object.keys(TITLES);
  if (value.items.length !== expected.length) throw new Error('面板数量不正确。');
  const ids = new Set<string>();
  let items = value.items.map(item => {
    if (!record(item) || typeof item.i !== 'string' || !expected.includes(item.i) || ids.has(item.i)) throw new Error('面板名称无效或重复。'); ids.add(item.i);
    for (const key of ['x', 'y', 'w', 'h']) if (typeof item[key] !== 'number' || !Number.isSafeInteger(Number(item[key]) * 4)) throw new Error('位置和尺寸必须为 0.25 的倍数。');
    const { x, y, w, h } = item as { x: number; y: number; w: number; h: number };
    if (x < 0 || y < 0 || y > 1000 || w < 3 || x + w > 12 || h < 5 || h > 100) throw new Error('面板位置或尺寸超出范围。');
    return { i: item.i === 'field' ? 'left' : item.i, x, y, w, h, minW: 3, minH: 5, maxH: 100 };
  });
  if (!value.hidden.every(id => typeof id === 'string' && expected.includes(id)) || new Set(value.hidden).size !== value.hidden.length) throw new Error('隐藏列表不正确。');
  let hidden = (value.hidden as string[]).map(id => id === 'field' ? 'left' : id);
  if (version === 2) {
    const left = items.find(item => item.i === 'left')!;
    items.push({ ...left, i: 'right', y: Math.min(1000, left.y + left.h) });
    if (hidden.includes('left')) hidden.push('right');
  }
  if (version < 6) {
    const needsOverview = !items.some(item => item.i === 'battlefield');
    const needsPlayer = !items.some(item => item.i === 'player');
    if (needsOverview) items.unshift({ i: 'battlefield', x: 0, y: 0, w: 8, h: 19, minW: 3, minH: 5, maxH: 100 });
    const battlefield = items.find(item => item.i === 'battlefield')!;
    if (needsPlayer) {
      if (version === 5) battlefield.h = Math.min(19, battlefield.h);
      items.push({ i: 'player', x: battlefield.x, y: Math.min(1000, battlefield.y + battlefield.h), w: Math.min(4, battlefield.w), h: 28, minW: 3, minH: 5, maxH: 100 });
      if (hidden.includes('battlefield')) hidden.push('player');
    }
    if (needsPlayer || needsOverview) {
      const pinned = items.filter(item => (item.i === 'battlefield' || item.i === 'player') && !hidden.includes(item.i));
      const placed = [...pinned];
      for (const item of items.filter(item => !pinned.includes(item) && !hidden.includes(item.i)).sort((a, b) => a.y - b.y || a.x - b.x)) {
        let conflicts = placed.filter(other => item.x < other.x + other.w && item.x + item.w > other.x && item.y < other.y + other.h && item.y + item.h > other.y);
        while (conflicts.length) {
          item.y = Math.max(...conflicts.map(other => other.y + other.h));
          conflicts = placed.filter(other => item.x < other.x + other.w && item.x + item.w > other.x && item.y < other.y + other.h && item.y + item.h > other.y);
        }
        placed.push(item);
      }
    }
    return parseGrid({ ...value, format: 'press-turn-grid-v6', items, hidden });
  }
  if (version < 7) {
    const y = Math.max(...items.map(item => item.y + item.h));
    const top = y <= 1000 ? y : Array.from({ length: 964 }, (_, index) => index).find(top => items.every(item => top + 37 <= item.y || top >= item.y + item.h));
    if (top === undefined) throw new Error('布局没有足够空间添加整备面板。');
    items.push({ i: 'preparation', x: 0, y: top, w: 6, h: 37, minW: 3, minH: 5, maxH: 100 });
  }
  return { format: 'press-turn-grid-v7', items, hidden: hidden as Panel[], locked: value.locked, settings: parseGridSettings(value.settings), ...(value.tabs === undefined ? {} : { tabs: parsePanelTabs(value.tabs, Object.keys(TITLES)) }), ...(value.panelSettings === undefined ? {} : { panelSettings: parsePanelSettings(value.panelSettings, Object.keys(TITLES)) }) };
}
export type Blocks = { Preparation: Record<string, never>; Overview: Record<string, never>; FieldEditor: { side: Side }; Player: Record<string, never>; Turn: Record<string, never>; Command: Record<string, never>; Session: Record<string, never>; Rules: Record<string, never>; Log: Record<string, never>; State: Record<string, never>; Columns: { columns: number; content: Slot }; Window: { title: string; content: Slot } };
export type PuckData = Data<Blocks>;
export function defaultPuck(): PuckData {
  return { root: { props: {} }, content: [
    { type: 'Session', props: { id: 'session' } },
    { type: 'Window', props: { id: 'preparation-window', title: TITLES.preparation, content: [{ type: 'Preparation', props: { id: 'preparation' } }] } },
    { type: 'Window', props: { id: 'overview-window', title: TITLES.battlefield, content: [{ type: 'Overview', props: { id: 'overview' } }] } },
    { type: 'Columns', props: { id: 'columns', columns: 4, content: [
      { type: 'Window', props: { id: 'left-window', title: TITLES.left, content: [{ type: 'FieldEditor', props: { id: 'left-editor', side: 'left' } }] } },
      { type: 'Window', props: { id: 'right-window', title: TITLES.right, content: [{ type: 'FieldEditor', props: { id: 'right-editor', side: 'right' } }] } },
      { type: 'Window', props: { id: 'player-window', title: TITLES.player, content: [{ type: 'Player', props: { id: 'player' } }] } },
      { type: 'Columns', props: { id: 'right-column', columns: 1, content: [
        { type: 'Window', props: { id: 'console-window', title: TITLES.console, content: [{ type: 'Command', props: { id: 'command' } }] } },
        { type: 'Window', props: { id: 'log-window', title: TITLES.logs, content: [{ type: 'Log', props: { id: 'log' } }] } },
      ] } },
    ] } },
    { type: 'Window', props: { id: 'rules-window', title: TITLES.rules, content: [{ type: 'Rules', props: { id: 'rules' } }] } },
  ] } as PuckData;
}
export function parsePuck(value: unknown): PuckData {
  if (!record(value) || !record(value.root) || !Array.isArray(value.content)) throw new Error('布局需要 root 和 content。');
  const ids = new Set<string>(); let count = 0; let legacy = false; let hasPlayer = false; let hasOverview = false; let hasPreparation = false;
  const walk = (nodes: unknown[], depth: number) => {
    if (depth > 12) throw new Error('布局嵌套过深。');
    for (const node of nodes) {
      if (++count > 300 || !record(node) || !record(node.props)) throw new Error('布局组件无效或过多。');
      const p = node.props;
      if (typeof p.id !== 'string' || !p.id || ids.has(p.id)) throw new Error('组件 ID 缺失或重复。'); ids.add(p.id);
      if (node.type === 'Team') { if (p.side !== 'left' && p.side !== 'right') throw new Error('队伍绑定无效。'); legacy = true; }
      else if (node.type === 'FieldEditor') { if (p.side === undefined) legacy = true; else if (p.side !== 'left' && p.side !== 'right') throw new Error('队伍绑定无效。'); }
      else if (node.type === 'Columns' || node.type === 'Window') {
        if (node.type === 'Columns' && (!Number.isInteger(p.columns) || Number(p.columns) < 1 || Number(p.columns) > 4)) throw new Error('列数无效。');
        if (node.type === 'Window' && typeof p.title !== 'string') throw new Error('标题无效。');
        if (node.type === 'Window' && p.title === '玩家操控界面') legacy = true;
        if (!Array.isArray(p.content)) throw new Error('容器内容无效。'); walk(p.content, depth + 1);
      } else if (!['Preparation', 'Overview', 'FieldEditor', 'Player', 'Turn', 'Command', 'Session', 'Rules', 'Log', 'State'].includes(String(node.type))) throw new Error('未注册的组件类型。');
      if (node.type === 'Player') hasPlayer = true;
      if (node.type === 'Overview') hasOverview = true;
      if (node.type === 'Preparation') hasPreparation = true;
    }
  };
  walk(value.content, 0);
  if (!legacy && hasOverview && hasPreparation) return value as unknown as PuckData;
  type Node = { type: string; props: Record<string, unknown> };
  const migrated = structuredClone(value) as { root: unknown; content: Node[] };
  const detached: Node[] = [];
  const unique = (prefix: string) => { let id = prefix; let i = 1; while (ids.has(id)) id = `${prefix}-${i++}`; ids.add(id); return id; };
  const convert = (nodes: Node[]) => {
    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index];
      if (node.type === 'Team') node.type = 'FieldEditor';
      if (node.type === 'FieldEditor' && node.props.side === undefined) {
        node.props.side = 'left';
        detached.push({ type: 'Window', props: { id: unique('right-window'), title: TITLES.right, content: [{ type: 'FieldEditor', props: { id: unique('right-editor'), side: 'right' } }] } });
      }
      if (node.type === 'Columns' || node.type === 'Window') {
        const children = node.props.content as Node[];
        if (node.type === 'Window' && children.some(child => child.type === 'Command')) {
          for (let i = children.length - 1; i >= 0; i--) if (children[i].type === 'Turn') children.splice(i, 1);
        }
        const split = node.type === 'Window' && children.length === 1 && children[0].type === 'FieldEditor' && children[0].props.side === undefined;
        if (split) {
          children[0].props.side = 'left';
          nodes.splice(index + 1, 0, { type: 'Window', props: { id: unique('right-window'), title: TITLES.right, content: [{ type: 'FieldEditor', props: { id: unique('right-editor'), side: 'right' } }] } });
        }
        const length = children.length;
        convert(children);
        if (node.type === 'Columns' && children.length > length) node.props.columns = Math.min(4, Number(node.props.columns) + 1);
        if (node.type === 'Window' && children.length === 1 && children[0].type === 'FieldEditor') node.props.title = children[0].props.side === 'right' ? TITLES.right : TITLES.left;
        if (node.type === 'Window' && node.props.title === '战场' && children.some(child => child.type === 'Player')) node.props.title = TITLES.player;
        if (node.type === 'Window' && (node.props.title === '玩家操控界面' || node.props.title === '操控面板')) node.props.title = TITLES.player;
        if (node.type === 'Window' && children.some(child => child.type === 'Command' || child.type === 'Turn')) {
          const logs = children.filter(child => child.type === 'Log');
          if (logs.length) {
            const commandWindow: Node = { type: 'Window', props: { ...node.props, content: children.filter(child => child.type !== 'Log') } };
            node.type = 'Columns'; node.props = { id: unique('command-log-stack'), columns: 1, content: [commandWindow, { type: 'Window', props: { id: unique('detached-log-window'), title: TITLES.logs, content: logs } }] };
          }
        }
      }
    }
  };
  convert(migrated.content);
  if (!hasPlayer) {
    const control: Node = { type: 'Window', props: { id: unique('player-window'), title: TITLES.player, content: [{ type: 'Player', props: { id: unique('player') } }] } };
    const columns = migrated.content.find(node => node.type === 'Columns');
    if (columns) { (columns.props.content as Node[]).splice(2, 0, control); columns.props.columns = Math.min(4, Number(columns.props.columns) + 1); }
    else detached.unshift(control);
  }
  if (!hasOverview) detached.push({ type: 'Window', props: { id: unique('overview-window'), title: TITLES.battlefield, content: [{ type: 'Overview', props: { id: unique('overview') } }] } });
  if (!hasPreparation) detached.push({ type: 'Window', props: { id: unique('preparation-window'), title: TITLES.preparation, content: [{ type: 'Preparation', props: { id: unique('preparation') } }] } });
  migrated.content.push(...detached);
  return parsePuck(migrated);
}
export function readLayout<T>(storage: Pick<Storage, 'getItem'>, key: string, parse: (value: unknown) => T, fallback: () => T): T {
  const saved = storage.getItem(key); return saved ? parse(JSON.parse(saved)) : fallback();
}
export function downloadLayout(data: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
