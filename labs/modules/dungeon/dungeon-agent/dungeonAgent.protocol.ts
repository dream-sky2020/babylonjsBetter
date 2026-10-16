import { createLabEvent } from '@/labs/kit';

export const dungeonAgentsLoadedEvent = createLabEvent<Readonly<{
  loadId: number;
  agentCount: number;
}>>('dungeon.agents.loaded', 1, {
  label: 'Agent 装载完成', description: 'Agent 领域内存已发布，可读取当前地图的 Agent 数据。', trigger: '有效地图切换后完成 Agent 初始化',
  fields: [{ name: 'loadId', type: 'number', description: '当前地图会话标识' }, { name: 'agentCount', type: 'number', description: 'Agent 数量' }],
});

export const dungeonAgentsChangedEvent = createLabEvent<Readonly<{
  loadId: number;
  entityIds: readonly string[];
  reason: 'manual-move-started' | 'manual-turn-started' | 'controller-move-started' | 'movement-completed';
}>>('dungeon.agents.changed', 1, {
  label: 'Agent 动作变化', description: '通知相关模块读取共享内存中的最新 Agent 状态。', trigger: '手动或 Controller 开始动作，以及动作完成',
  fields: [{ name: 'loadId', type: 'number' }, { name: 'entityIds', type: 'string[]', description: '受影响 Agent ID' },
    { name: 'reason', type: 'manual-move-started | manual-turn-started | controller-move-started | movement-completed' }],
});
