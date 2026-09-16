import { getComponents } from '../entity/entity.utils.ts';
import type { IActorSpawnComponent } from '../entity/components/actor-spawn.component.ts';
import type { DungeonMapDocumentV2 } from '../map-document/dungeonMapDocument.types.ts';
import { DungeonMapDocumentQuery } from '../map-document/dungeonMapDocument.query.ts';
import {
  resolveDungeonDocumentSceneEnvironment,
} from '../scene/dungeonDocumentSceneEnvironment.ts';
import { resolveDungeonMapTileWorldLayout } from '../scene/dungeonMapSceneLayout.ts';
import type { SceneEnvironmentPresetLibrary } from '../scene/sceneEnvironment.types.ts';
import type { DungeonPlayerSpawnBinding } from './dungeonPlayerSpawn.ts';

/** 从 V2 map 空间挂载直接解析唯一玩家出生点。 */
export const resolveDungeonDocumentPlayerSpawn = (
  document: DungeonMapDocumentV2,
  scenePresets: SceneEnvironmentPresetLibrary,
): DungeonPlayerSpawnBinding => {
  const query = new DungeonMapDocumentQuery(document);
  const sceneBinding = resolveDungeonDocumentSceneEnvironment(document, scenePresets);
  const candidates = query.getEntitiesAt({ kind: 'map' }).flatMap(({ id }) => {
    const spawnPointEntity = query.getEntitySnapshot(id);
    if (!spawnPointEntity || spawnPointEntity.entityType !== 'spawn-point'
      || spawnPointEntity.enabled === false) return [];
    return getComponents<IActorSpawnComponent>(spawnPointEntity, 'actor-spawn')
      .filter((component) => component.enabled !== false)
      .map((actorSpawnComponent) => ({ spawnPointEntity, actorSpawnComponent }));
  });
  if (candidates.length === 0) {
    throw new Error(`地图“${document.identity.id}”的 map 空间挂载中没有可用的 spawn-point / actor-spawn。`);
  }
  if (candidates.length > 1) {
    throw new Error(`地图“${document.identity.id}”存在多个启用的 actor-spawn，当前无法确定唯一玩家出生点。`);
  }
  const [{ spawnPointEntity, actorSpawnComponent }] = candidates;
  const { tileX, tileY } = actorSpawnComponent;
  if (!Number.isInteger(tileX) || !Number.isInteger(tileY)
    || tileX < 0 || tileY < 0 || tileX >= document.grid.width || tileY >= document.grid.height) {
    throw new Error(`玩家出生格 (${tileX}, ${tileY}) 超出地图“${document.identity.id}”的有效范围。`);
  }
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
