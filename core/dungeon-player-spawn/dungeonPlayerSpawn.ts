import {
  getComponents,
  isEntityContainer,
  type IActorSpawnComponent,
  type IEntity,
  type ISceneEnvironmentComponent,
} from '../entity';
import { isDungeonMapPositionInside, type DungeonMapData } from '../map';
import {
  resolveDungeonMapSceneEnvironment,
  resolveDungeonMapTileWorldLayout,
  type DungeonMapTileWorldLayout,
  type SceneEnvironmentPresetLibrary,
} from '../scene';

export type DungeonPlayerSpawnBinding = {
  mapEntity: IEntity;
  sceneEnvironmentComponent: ISceneEnvironmentComponent;
  spawnPointEntity: IEntity;
  actorSpawnComponent: IActorSpawnComponent;
  tilePosition: Readonly<{ x: number; y: number }>;
  tileWorldLayout: DungeonMapTileWorldLayout;
  worldPosition: readonly [number, number, number];
};

/**
 * 从地图容器解析唯一启用的玩家出生点，并使用地图 Entity 的场景布局组件
 * 将出生格坐标转换成大场景世界坐标。
 *
 * 当前 actor-spawn 尚无角色分类字段，因此启用的出生点必须唯一。
 */
export const resolveDungeonPlayerSpawn = (
  map: DungeonMapData,
  scenePresets: SceneEnvironmentPresetLibrary,
): DungeonPlayerSpawnBinding => {
  if (!isEntityContainer(map.data)) throw new Error(`地图“${map.id}”没有 Entity 数据容器。`);

  const sceneBinding = resolveDungeonMapSceneEnvironment(map, scenePresets);
  const candidates = map.data.entities
    .filter((entity) => entity.entityType === 'spawn-point' && entity.enabled !== false)
    .flatMap((spawnPointEntity) => getComponents<IActorSpawnComponent>(spawnPointEntity, 'actor-spawn')
      .filter((component) => component.enabled !== false)
      .map((actorSpawnComponent) => ({ spawnPointEntity, actorSpawnComponent })));

  if (candidates.length === 0) {
    throw new Error(`地图“${map.id}”的地图数据容器中没有可用的 spawn-point / actor-spawn。`);
  }
  if (candidates.length > 1) {
    throw new Error(`地图“${map.id}”存在多个启用的 actor-spawn，当前无法确定唯一玩家出生点。`);
  }

  const [{ spawnPointEntity, actorSpawnComponent }] = candidates;
  const { tileX, tileY } = actorSpawnComponent;
  if (!Number.isInteger(tileX) || !Number.isInteger(tileY)
    || !isDungeonMapPositionInside(map, tileX, tileY)) {
    throw new Error(`玩家出生格 (${tileX}, ${tileY}) 超出地图“${map.id}”的有效范围。`);
  }

  const tileWorldLayout = resolveDungeonMapTileWorldLayout(
    sceneBinding.component,
    map.width,
    map.height,
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
