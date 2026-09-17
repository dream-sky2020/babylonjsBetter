import type {
  IAgentControllerComponent,
  IFactionComponent,
  IGridAgentComponent,
} from '../entity/index.ts';
import {
  DungeonMapDocumentQuery,
  type DungeonMapDocumentComponent,
  type DungeonMapDocumentV2,
  type DungeonMapSpatialAttachmentComponent,
} from '../map-document/index.ts';
import type { DungeonAgentBinding } from './dungeonAgent.types.ts';

const enabled = <T extends { enabled?: boolean }>(items: readonly T[]): T[] => (
  items.filter((item) => item.enabled !== false)
);

const requireSingle = <T>(items: readonly T[], entityId: string, type: string): T => {
  if (items.length !== 1) {
    throw new Error(`dungeon-agent“${entityId}”必须有且只能有一个启用的 ${type} 组件。`);
  }
  return items[0];
};

const requireNonEmpty = (value: unknown, entityId: string, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`dungeon-agent“${entityId}”的 ${field} 不能为空。`);
  }
  return value;
};

/** 从地图 ECS 表扫描 Agent 静态定义；不会创建 Babylon 对象或修改地图文档。 */
export const scanDungeonDocumentAgents = (
  document: DungeonMapDocumentV2,
): DungeonAgentBinding[] => {
  const query = new DungeonMapDocumentQuery(document);
  return document.entities
    .filter((entity) => entity.entityType === 'dungeon-agent' && entity.enabled !== false)
    .map((entity) => {
      const gridAgent = requireSingle(
        enabled(query.getComponents<IGridAgentComponent & DungeonMapDocumentComponent>(entity.id, 'grid-agent')),
        entity.id,
        'grid-agent',
      );
      const controller = requireSingle(
        enabled(query.getComponents<IAgentControllerComponent & DungeonMapDocumentComponent>(entity.id, 'agent-controller')),
        entity.id,
        'agent-controller',
      );
      const factions = enabled(
        query.getComponents<IFactionComponent & DungeonMapDocumentComponent>(entity.id, 'faction'),
      );
      if (factions.length > 1) throw new Error(`dungeon-agent“${entity.id}”最多只能有一个启用的 faction 组件。`);
      const attachments = enabled(query.getComponents<DungeonMapSpatialAttachmentComponent>(
        entity.id,
        'spatial-attachment',
      ));
      const attachment = requireSingle(attachments, entity.id, 'spatial-attachment');
      if (attachment.targets.length !== 1 || attachment.targets[0].kind !== 'tile') {
        throw new Error(`dungeon-agent“${entity.id}”必须且只能挂载到一个 Tile。`);
      }
      const initialTileId = attachment.targets[0].tileId;
      const initialTileIndex = query.indexes.tileIndexById.get(initialTileId);
      if (initialTileIndex === undefined) throw new Error(`dungeon-agent“${entity.id}”引用了不存在的 Tile。`);
      if (!['north', 'east', 'south', 'west'].includes(gridAgent.initialFacing)) {
        throw new Error(`dungeon-agent“${entity.id}”的 initialFacing 无效。`);
      }
      if (!Number.isInteger(gridAgent.actionPeriod) || gridAgent.actionPeriod < 1) {
        throw new Error(`dungeon-agent“${entity.id}”的 actionPeriod 必须是正整数。`);
      }
      if (!Number.isInteger(gridAgent.priority)) {
        throw new Error(`dungeon-agent“${entity.id}”的 priority 必须是整数。`);
      }
      requireNonEmpty(gridAgent.movementProfileId, entity.id, 'movementProfileId');
      requireNonEmpty(controller.controllerId, entity.id, 'controllerId');
      if (factions[0]) requireNonEmpty(factions[0].factionId, entity.id, 'factionId');
      return {
        entity,
        gridAgent: structuredClone(gridAgent),
        controller: structuredClone(controller),
        ...(factions[0] ? { faction: structuredClone(factions[0]) } : {}),
        initialTileId,
        initialTileIndex,
      };
    });
};
