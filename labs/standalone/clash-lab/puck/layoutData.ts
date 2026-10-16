import type { Data, Slot } from '@puckeditor/core';

import type { Side } from '../shared/CombatWidgets.tsx';
export type { Side } from '../shared/CombatWidgets.tsx';
export type ClashBlocks = {
  Heading: { title: string; description: string };
  Grid: { columns: number; gap: number; content: Slot };
  Panel: { title: string; content: Slot };
  UnitSummary: { side: Side };
  UnitControls: { side: Side };
  SkillInspector: { side: Side };
  ActionButton: { label: string; action: 'clash' | 'endTurn' | 'clearLogs' };
  BattleLog: { height: number };
};
export type ClashLayout = Data<ClashBlocks>;
export const LAYOUT_KEY = 'clash-lab.puck-layout.v1';

export function createDefaultLayout(): ClashLayout {
  return {
    root: { props: {} },
    content: [
      { type: 'Heading', props: { id: 'heading', title: 'Clash / 战斗试验台', description: '配置双方单位，观察每一次拼点与结算。点击「编辑界面」开始拖拽。' } },
      { type: 'Grid', props: { id: 'teams', columns: 2, gap: 20, content: [
        ...(['left', 'right'] as const).map(side => ({ type: 'Panel', props: { id: `panel-${side}`, title: side === 'left' ? '01 / 左侧阵营' : '02 / 右侧阵营', content: [
          { type: 'UnitSummary', props: { id: `summary-${side}`, side } },
          { type: 'UnitControls', props: { id: `controls-${side}`, side } },
        ] } })),
      ] } },
      { type: 'Grid', props: { id: 'actions', columns: 3, gap: 12, content: [
        { type: 'ActionButton', props: { id: 'clash', label: '开启拼点', action: 'clash' } },
        { type: 'ActionButton', props: { id: 'turn', label: '回合结束', action: 'endTurn' } },
        { type: 'ActionButton', props: { id: 'clear', label: '清空日志', action: 'clearLogs' } },
      ] } },
      { type: 'Panel', props: { id: 'log-panel', title: '03 / 战斗日志', content: [
        { type: 'BattleLog', props: { id: 'log', height: 280 } },
      ] } },
    ],
  } as ClashLayout;
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

// Validate imported/local data before handing it to Puck's renderer. No JSX or code is stored.
export function parseLayout(value: unknown): ClashLayout {
  if (!record(value) || !Array.isArray(value.content) || !record(value.root)) throw new Error('布局需要 root 和 content。');
  const ids = new Set<string>();
  let count = 0;
  function check(nodes: unknown[], depth: number) {
    if (depth > 16) throw new Error('布局嵌套不能超过 16 层。');
    for (const node of nodes) {
      if (++count > 500) throw new Error('布局组件不能超过 500 个。');
      if (!record(node) || !record(node.props)) throw new Error('组件结构不正确。');
      const p = node.props;
      if (typeof p.id !== 'string' || !p.id || ids.has(p.id)) throw new Error('组件 ID 缺失或重复。');
      ids.add(p.id);
      const number = (key: string, min: number, max: number) => typeof p[key] === 'number' && Number.isFinite(p[key]) && (p[key] as number) >= min && (p[key] as number) <= max;
      let valid = false;
      switch (node.type) {
        case 'Heading': valid = typeof p.title === 'string' && typeof p.description === 'string'; break;
        case 'Grid': valid = number('columns', 1, 4) && Number.isInteger(p.columns) && number('gap', 0, 64); break;
        case 'Panel': valid = typeof p.title === 'string'; break;
        case 'UnitSummary': case 'UnitControls': case 'SkillInspector': valid = p.side === 'left' || p.side === 'right'; break;
        case 'ActionButton': valid = typeof p.label === 'string' && ['clash', 'endTurn', 'clearLogs'].includes(p.action as string); break;
        case 'BattleLog': valid = number('height', 120, 800); break;
        default: throw new Error(`未注册的组件：${String(node.type)}`);
      }
      if (!valid) throw new Error(`组件 ${String(node.type)} 的属性不正确。`);
      if (node.type === 'Grid' || node.type === 'Panel') {
        if (!Array.isArray(p.content)) throw new Error('容器需要 content 数组。');
        check(p.content, depth + 1);
      }
    }
  }
  check(value.content, 0);
  return value as unknown as ClashLayout;
}

export function loadLayout(storage: Pick<Storage, 'getItem'>): ClashLayout {
  const saved = storage.getItem(LAYOUT_KEY);
  return saved ? parseLayout(JSON.parse(saved)) : createDefaultLayout();
}

export function saveLayout(storage: Pick<Storage, 'setItem'>, data: ClashLayout) {
  storage.setItem(LAYOUT_KEY, JSON.stringify(parseLayout(data)));
}
