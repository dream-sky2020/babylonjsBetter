import type { Config } from '@puckeditor/core';
import type { Blocks } from './layouts.ts';
import { FieldEditorPanel, PlayerPanel, TurnPanel, CommandPanel, SessionButtons, RulesPanel, BattleLog, RuntimePanel } from './widgets.tsx';
export const puckConfig: Config<Blocks> = {
  categories: { layout: { title: '布局', components: ['Columns', 'Window'] }, combat: { title: '行动点战斗', components: ['FieldEditor', 'Player', 'Turn', 'Command', 'Session', 'Rules', 'Log', 'State'] } },
  root: { fields: {}, render: ({ children }) => <main className="pt-canvas">{children}</main> },
  components: {
    Columns: { label: '多列布局', fields: { columns: { type: 'number', label: '列数', min: 1, max: 4 }, content: { type: 'slot' } }, defaultProps: { columns: 3, content: [] }, render: ({ columns, content: Content }) => <Content className="pt-columns" style={{ display: 'grid', gridTemplateColumns: `repeat(${columns},minmax(0,1fr))`, gap: 5 }} /> },
    Window: { label: 'XP 窗口', fields: { title: { type: 'text', label: '标题' }, content: { type: 'slot' } }, defaultProps: { title: '测试窗口', content: [] }, render: ({ title, content: Content }) => <section className="pt-window"><header className="pt-window-title">{title}</header><Content className="pt-window-body" /></section> },
    FieldEditor: { label: '队伍角色数据编辑', fields: { side: { type: 'select', label: '队伍', options: [{ value: 'left', label: '我方' }, { value: 'right', label: '敌方' }] } }, defaultProps: { side: 'left' }, render: ({ side, puck }) => <FieldEditorPanel side={side} editing={puck.isEditing} /> },
    Player: { label: '操控面板', fields: {}, defaultProps: {}, render: ({ puck }) => <PlayerPanel editing={puck.isEditing} /> },
    Turn: { label: '行动点与阶段', fields: {}, defaultProps: {}, render: () => <TurnPanel /> },
    Command: { label: '行动指令', fields: {}, defaultProps: {}, render: ({ puck }) => <CommandPanel editing={puck.isEditing} /> },
    Session: { label: '重开与日志控制', fields: {}, defaultProps: {}, render: ({ puck }) => <SessionButtons editing={puck.isEditing} /> },
    Rules: { label: '行动点规则表', fields: {}, defaultProps: {}, render: () => <RulesPanel /> },
    Log: { label: '结算日志', fields: {}, defaultProps: {}, render: () => <BattleLog /> },
    State: { label: '运行数据 JSON', fields: {}, defaultProps: {}, render: () => <RuntimePanel /> },
  },
};
