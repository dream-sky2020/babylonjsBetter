import type { DialogueRuleCatalog } from '../../core/dialogue-map/dialogueMap.types.ts';

/** Editor metadata only; opening the editor does not allocate a Dungeon session. */
export const dialogueRuleCatalog: DialogueRuleCatalog = {
  memories: [{
    key: 'dungeon.player-state', label: '玩家运行状态', fields: [
      { path: ['loadId'], label: '地图会话 ID', valueType: 'number' },
      { path: ['presetKey'], label: '地图预设', valueType: 'string' },
      { path: ['playerPosition', 'tileX'], label: '玩家横坐标', valueType: 'number' },
      { path: ['playerPosition', 'tileY'], label: '玩家纵坐标', valueType: 'number' },
      { path: ['playerFacing'], label: '玩家朝向', valueType: 'string' },
    ],
  }, {
    key: 'dungeon.grid', label: '格子与世界布局', fields: [
      { path: ['loadId'], label: '地图会话 ID', valueType: 'number' },
      { path: ['presetKey'], label: '地图预设', valueType: 'string' },
      { path: ['mapId'], label: '地图 ID', valueType: 'string' },
      { path: ['width'], label: '地图宽度', valueType: 'number' },
      { path: ['height'], label: '地图高度', valueType: 'number' },
    ],
  }, {
    key: 'dungeon.session', label: '地图会话', fields: [
      { path: ['status'], label: '加载状态', valueType: 'string' },
    ],
  }],
  events: [
    { eventType: 'dungeon.map.changed', version: 1, label: '地图切换完成', fields: [
      { name: 'loadId', valueType: 'number', required: true },
      { name: 'revision', valueType: 'number', required: true },
      { name: 'presetKey', valueType: 'string', required: true },
      { name: 'mapId', valueType: 'string', required: true },
      { name: 'width', valueType: 'number', required: true },
      { name: 'height', valueType: 'number', required: true },
      { name: 'previousPresetKey', valueType: 'string', nullable: true, required: true },
    ] },
    { eventType: 'dungeon.runtime.changed', version: 1, label: '运行状态变化', fields: [
      { name: 'loadId', valueType: 'number', required: true },
      { name: 'revision', valueType: 'number', required: true },
      { name: 'presetKey', valueType: 'string', required: true },
      { name: 'reason', valueType: 'string', required: true },
    ] },
    { eventType: 'dungeon.agents.loaded', version: 1, label: 'Agent 装载完成', fields: [
      { name: 'loadId', valueType: 'number', required: true },
      { name: 'agentCount', valueType: 'number', required: true },
    ] },
  ],
};
