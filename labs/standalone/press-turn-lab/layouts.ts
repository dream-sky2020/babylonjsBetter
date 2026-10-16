import type { Data, Slot } from '@puckeditor/core';
import type { LayoutItem } from 'react-grid-layout';
import type { Side } from './types.ts';
export const GRID_KEY = 'press-turn-lab.grid.v1';
export const PUCK_KEY = 'press-turn-lab.puck.v1';
export const TITLES = { left: '我方角色数据', right: '敌方角色数据', player: '操控面板', console: '行动点与指令', logs: '结算日志', rules: '行动点规则', state: '运行数据' } as const;
export type Panel = keyof typeof TITLES;
export type GridData = { format: 'press-turn-grid-v3'; items: LayoutItem[]; hidden: Panel[]; locked: boolean };
export function defaultGrid(): GridData { return { format: 'press-turn-grid-v3', locked: false, hidden: [], items: [
  { i: 'left', x: 0, y: 0, w: 3, h: 28 }, { i: 'right', x: 3, y: 0, w: 3, h: 28 }, { i: 'player', x: 6, y: 0, w: 3, h: 28 },
  { i: 'console', x: 9, y: 0, w: 3, h: 12 }, { i: 'logs', x: 9, y: 12, w: 3, h: 16 },
  { i: 'rules', x: 0, y: 28, w: 8, h: 10 }, { i: 'state', x: 8, y: 28, w: 4, h: 10 },
].map(item => ({ ...item, minW: 3, minH: 5, maxH: 100 })) }; }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const panel = (id: unknown): id is Panel => typeof id === 'string' && Object.hasOwn(TITLES, id);
export function parseGrid(value: unknown): GridData {
  if (!record(value) || !['press-turn-grid-v1', 'press-turn-grid-v2', 'press-turn-grid-v3'].includes(String(value.format)) || !Array.isArray(value.items) || value.items.length !== (value.format === 'press-turn-grid-v3' ? 7 : 6) || !Array.isArray(value.hidden) || typeof value.locked !== 'boolean') throw new Error('需要 Press Turn Grid 布局。');
  const v1 = value.format === 'press-turn-grid-v1', v2 = value.format === 'press-turn-grid-v2';
  const oldPanels = v1 ? ['left', 'right', 'console', 'logs', 'rules', 'state'] : ['field', 'player', 'console', 'logs', 'rules', 'state'];
  const validId = (id: unknown) => typeof id === 'string' && (v1 || v2 ? oldPanels.includes(id) : panel(id));
  const migrateId = (id: string): Panel => (id === 'field' ? 'left' : id) as Panel;
  const ids = new Set();
  const items = value.items.map(item => {
    if (!record(item) || !validId(item.i) || ids.has(item.i)) throw new Error('面板名称无效或重复。'); ids.add(item.i);
    for (const key of ['x', 'y', 'w', 'h']) if (!Number.isSafeInteger(item[key])) throw new Error('位置和尺寸必须为整数。');
    const { x, y, w, h } = item as { x: number; y: number; w: number; h: number };
    if (x < 0 || y < 0 || y > 1000 || w < 3 || x + w > 12 || h < 5 || h > 100) throw new Error('面板位置或尺寸超出范围。');
    return { i: migrateId(item.i as string), x, y, w, h, minW: 3, minH: 5, maxH: 100 };
  });
  if (!value.hidden.every(validId) || new Set(value.hidden).size !== value.hidden.length) throw new Error('隐藏列表不正确。');
  const hidden = (value.hidden as string[]).map(migrateId);
  if (v1) items.push({ i: 'player', x: 0, y: Math.min(1000, Math.max(...items.map(item => item.y + item.h))), w: 4, h: 28, minW: 3, minH: 5, maxH: 100 });
  if (v2) {
    const left = items.find(item => item.i === 'left')!;
    items.push({ ...left, i: 'right', y: Math.min(1000, left.y + left.h) });
    if (hidden.includes('left')) hidden.push('right');
  }
  return { format: 'press-turn-grid-v3', items, hidden, locked: value.locked };
}
export type Blocks = { FieldEditor: { side: Side }; Player: Record<string, never>; Turn: Record<string, never>; Command: Record<string, never>; Session: Record<string, never>; Rules: Record<string, never>; Log: Record<string, never>; State: Record<string, never>; Columns: { columns: number; content: Slot }; Window: { title: string; content: Slot } };
export type PuckData = Data<Blocks>;
export function defaultPuck(): PuckData {
  return { root: { props: {} }, content: [
    { type: 'Session', props: { id: 'session' } },
    { type: 'Columns', props: { id: 'columns', columns: 4, content: [
      { type: 'Window', props: { id: 'left-window', title: TITLES.left, content: [{ type: 'FieldEditor', props: { id: 'left-editor', side: 'left' } }] } },
      { type: 'Window', props: { id: 'right-window', title: TITLES.right, content: [{ type: 'FieldEditor', props: { id: 'right-editor', side: 'right' } }] } },
      { type: 'Window', props: { id: 'player-window', title: TITLES.player, content: [{ type: 'Player', props: { id: 'player' } }] } },
      { type: 'Columns', props: { id: 'right-column', columns: 1, content: [
        { type: 'Window', props: { id: 'console-window', title: TITLES.console, content: [{ type: 'Turn', props: { id: 'turn' } }, { type: 'Command', props: { id: 'command' } }] } },
        { type: 'Window', props: { id: 'log-window', title: TITLES.logs, content: [{ type: 'Log', props: { id: 'log' } }] } },
      ] } },
    ] } },
    { type: 'Window', props: { id: 'rules-window', title: TITLES.rules, content: [{ type: 'Rules', props: { id: 'rules' } }] } },
  ] } as PuckData;
}
export function parsePuck(value: unknown): PuckData {
  if (!record(value) || !record(value.root) || !Array.isArray(value.content)) throw new Error('布局需要 root 和 content。');
  const ids = new Set<string>(); let count = 0; let legacy = false; let hasPlayer = false;
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
      } else if (!['FieldEditor', 'Player', 'Turn', 'Command', 'Session', 'Rules', 'Log', 'State'].includes(String(node.type))) throw new Error('未注册的组件类型。');
      if (node.type === 'Player') hasPlayer = true;
    }
  };
  walk(value.content, 0);
  if (!legacy) return value as unknown as PuckData;
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
        const split = node.type === 'Window' && children.length === 1 && children[0].type === 'FieldEditor' && children[0].props.side === undefined;
        if (split) {
          children[0].props.side = 'left';
          nodes.splice(index + 1, 0, { type: 'Window', props: { id: unique('right-window'), title: TITLES.right, content: [{ type: 'FieldEditor', props: { id: unique('right-editor'), side: 'right' } }] } });
        }
        const length = children.length;
        convert(children);
        if (node.type === 'Columns' && children.length > length) node.props.columns = Math.min(4, Number(node.props.columns) + 1);
        if (node.type === 'Window' && children.length === 1 && children[0].type === 'FieldEditor') node.props.title = children[0].props.side === 'right' ? TITLES.right : TITLES.left;
        if (node.type === 'Window' && node.props.title === '玩家操控界面') node.props.title = TITLES.player;
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
