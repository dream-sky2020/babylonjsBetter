import type { Config } from '@puckeditor/core';
import { useCombatStore } from '../store.ts';
import type { ClashBlocks } from './layoutData.ts';
import { UnitSummary, UnitControls, BattleLog, SkillInspector } from '../shared/CombatWidgets.tsx';

const sideField = { type: 'select', label: '绑定阵营', options: [{ label: '左侧选中单位', value: 'left' }, { label: '右侧选中单位', value: 'right' }] } as const;

export const clashPuckConfig: Config<ClashBlocks> = {
  categories: {
    layout: { title: '布局与文字', components: ['Heading', 'Grid', 'Panel'] },
    combat: { title: '战斗数据与控制', components: ['UnitSummary', 'UnitControls', 'SkillInspector', 'ActionButton', 'BattleLog'] },
  },
  root: { fields: {}, render: ({ children }) => <main className="clash-canvas">{children}</main> },
  components: {
    Heading: {
      label: '标题与说明', fields: { title: { type: 'text', label: '标题' }, description: { type: 'textarea', label: '说明' } },
      defaultProps: { title: '战斗试验台', description: '在这里写下你的测试目标。' },
      render: ({ title, description }) => <header className="clash-heading"><div className="clash-eyebrow">COMBAT LAB / WORKSPACE</div><h1>{title}</h1><p>{description}</p></header>,
    },
    Grid: {
      label: '网格布局', fields: { columns: { type: 'number', label: '列数', min: 1, max: 4 }, gap: { type: 'number', label: '间距', min: 0, max: 64 }, content: { type: 'slot' } },
      defaultProps: { columns: 2, gap: 20, content: [] },
      render: ({ columns, gap, content: Content }) => <Content className="clash-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap }} />,
    },
    Panel: {
      label: '分组卡片', fields: { title: { type: 'text', label: '卡片标题' }, content: { type: 'slot' } },
      defaultProps: { title: '测试面板', content: [] },
      render: ({ title, content: Content }) => <section className="clash-panel"><h3>{title}</h3><Content className="clash-panel-content" /></section>,
    },
    UnitSummary: { label: '单位状态卡', fields: { side: sideField }, defaultProps: { side: 'left' }, render: ({ side }) => <UnitSummary side={side} /> },
    UnitControls: { label: '单位与技能控制', fields: { side: sideField }, defaultProps: { side: 'left' }, render: ({ side, puck }) => <UnitControls side={side} editing={puck.isEditing} /> },
    SkillInspector: { label: '技能详细编辑器', fields: { side: sideField }, defaultProps: { side: 'left' }, render: ({ side, puck }) => <SkillInspector side={side} editing={puck.isEditing} /> },
    ActionButton: {
      label: '战斗动作按钮',
      fields: { label: { type: 'text', label: '按钮文字' }, action: { type: 'select', label: '点击动作', options: [{ label: '开启拼点', value: 'clash' }, { label: '回合结束', value: 'endTurn' }, { label: '清空日志', value: 'clearLogs' }] } },
      defaultProps: { label: '开启拼点', action: 'clash' },
      render: ({ label, action, puck }) => <button className={`clash-action clash-action--${action}`} disabled={puck.isEditing} onClick={() => { if (action === 'clash') window.startClash(); else if (action === 'endTurn') window.endTurn(); else useCombatStore.getState().clearLogs(); }}>{label}<span>↗</span></button>,
    },
    BattleLog: { label: '战斗日志', fields: { height: { type: 'number', label: '高度', min: 120, max: 800 } }, defaultProps: { height: 280 }, render: ({ height }) => <BattleLog height={height} /> },
  },
};
