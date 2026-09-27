import { getComponents } from '../entity/entity.utils.ts';
import type { IActorSpawnComponent } from '../entity/components/actor-spawn.component.ts';
import type { DungeonMapSpatialAttachmentComponent, DungeonMapDocumentV2 } from '../map-document/dungeonMapDocument.types.ts';
import { DungeonMapDocumentQuery } from '../map-document/dungeonMapDocument.query.ts';
import {
  resolveDungeonDocumentSceneEnvironment,
} from '../scene/dungeonDocumentSceneEnvironment.ts';
import { resolveDungeonMapTileWorldLayout } from '../scene/dungeonMapSceneLayout.ts';
import type { SceneEnvironmentPresetLibrary } from '../scene/sceneEnvironment.types.ts';
import type { DungeonPlayerSpawnBinding } from './dungeonPlayerSpawn.ts';

/** 从 V2 tile 空间挂载直接解析唯一玩家出生点。 */
export const resolveDungeonDocumentPlayerSpawn = (
  document: DungeonMapDocumentV2,
  scenePresets: SceneEnvironmentPresetLibrary,
): DungeonPlayerSpawnBinding => {
  const query = new DungeonMapDocumentQuery(document);
  const sceneBinding = resolveDungeonDocumentSceneEnvironment(document, scenePresets);
  const candidates = document.entities.filter((entity) => (
    entity.entityType === 'spawn-point' && entity.enabled !== false
  )).flatMap(({ id }) => {
    const spawnPointEntity = query.getEntitySnapshot(id);
    if (!spawnPointEntity || spawnPointEntity.entityType !== 'spawn-point'
      || spawnPointEntity.enabled === false) return [];
    return getComponents<IActorSpawnComponent>(spawnPointEntity, 'actor-spawn')
      .filter((component) => component.enabled !== false)
      .map((actorSpawnComponent) => ({ spawnPointEntity, actorSpawnComponent }));
  });
  if (candidates.length === 0) {
    throw new Error(`地图“${document.identity.id}”中没有可用的 spawn-point / actor-spawn。`);
  }
  if (candidates.length > 1) {
    throw new Error(`地图“${document.identity.id}”存在多个启用的 actor-spawn，当前无法确定唯一玩家出生点。`);
  }
  const [{ spawnPointEntity, actorSpawnComponent }] = candidates;
  const attachments = (document.components['spatial-attachment'] ?? []) as DungeonMapSpatialAttachmentComponent[];
  const owned = attachments.filter(({ entityId }) => entityId === spawnPointEntity.id);
  const targets = owned.flatMap(({ targets }) => targets);
  const target = targets[0];
  if (owned.length !== 1 || owned[0].enabled === false || targets.length !== 1 || target?.kind !== 'tile') {
    throw new Error(`出生点“${spawnPointEntity.id}”必须具有唯一启用的 tile 空间挂载。`);
  }
  const tileIndex = document.grid.tileIds.indexOf(target.tileId);
  if (!Number.isInteger(document.grid.width) || document.grid.width <= 0
    || !Number.isInteger(document.grid.height) || document.grid.height <= 0
    || !target.tileId || tileIndex < 0 || tileIndex >= document.grid.width * document.grid.height
    || document.grid.tileIds.lastIndexOf(target.tileId) !== tileIndex) {
    throw new Error(`出生点“${spawnPointEntity.id}”的格子挂载失效：${target.tileId}。`);
  }
  const tileX = tileIndex % document.grid.width;
  const tileY = Math.floor(tileIndex / document.grid.width);
  const tileWorldLayout = resolveDungeonMapTileWorldLayout(
    sceneBinding.component,
    document.grid.width,
    document.grid.height,
    tileX,
    tileY,
  );
  return {
    mapEntity: sceneBinding.mapEntity,
    sceneEnvironmentComponent: sceneBinding.component,
    spawnPointEntity,
    actorSpawnComponent,
    tilePosition: { x: tileX, y: tileY },
    tileWorldLayout,
    worldPosition: tileWorldLayout.center,
  };
};
