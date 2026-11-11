import type { DialogueEventCatalogEntry, DialogueRuleCatalog } from '../../../core/dialogue-map/dialogueMap.types.ts';
import type { LabEventDefinition } from '../../kit/labCommunication.types.ts';
import { dungeonMapChangedEvent, dungeonRuntimeChangedEvent } from '../../modules/dungeon/dungeon-map-loader/dungeonMapLoader.protocol.ts';
import { dungeonVariableChangedEvent } from '../../modules/dungeon/dungeon-map-action-executor/dungeonMapActionExecutor.protocol.ts';
import { dungeonAgentsLoadedEvent } from '../../modules/dungeon/dungeon-agent/dungeonAgent.protocol.ts';
import { dialogueQuestAcceptedEvent } from '../../modules/shared/dialogue/dialogue.protocol.ts';

function entry<T>(event: LabEventDefinition<T>, publish = false): DialogueEventCatalogEntry {
  const fields = (event.metadata?.fields ?? []).map<DialogueEventCatalogEntry['fields'][number]>(field => {
    const [type, nullable] = field.type.split(' | ');
    const valueType = type === 'number' || type === 'string' || type === 'boolean' || type === 'null' ? type : 'scalar';
    return { name: field.name, valueType, nullable: nullable === 'null', required: field.required };
  });
  return { eventType: event.type, version: event.version, label: event.metadata?.label ?? event.type, publish, fields };
}
export type DialogueLabTarget = 'all' | 'dialogue-test-lab' | 'dungeon-interaction-lab';
const dialogueEvents = [entry(dialogueQuestAcceptedEvent, true)];
const dungeonEvents = [entry(dungeonVariableChangedEvent), entry(dungeonMapChangedEvent), entry(dungeonRuntimeChangedEvent), entry(dungeonAgentsLoadedEvent)];
export const dialogueEventsForTarget = (target: DialogueLabTarget) =>
  target === 'dialogue-test-lab' ? dialogueEvents : dialogueRuleCatalog.events;

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
  events: [...dialogueEvents, ...dungeonEvents],
};
