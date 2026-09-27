import type { IActorSpawnComponent } from '../entity/components/actor-spawn.component.ts';
import type { IEntity } from '../entity/entity.types.ts';
import type { ISceneEnvironmentComponent } from '../entity/components/scene-environment.component.ts';
import type { DungeonMapData } from '../map/dungeonMap.types.ts';
import type { DungeonMapTileWorldLayout } from '../scene/dungeonMapSceneLayout.ts';
import type { SceneEnvironmentPresetLibrary } from '../scene/sceneEnvironment.types.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { resolveDungeonDocumentPlayerSpawn } from './dungeonPlayerSpawn.document.ts';

/** 玩家和调试表现的统一输入；位置已由出生实体的 tile 挂载解析。 */
export type DungeonPlayerSpawnBinding = {
  mapEntity: IEntity;
  sceneEnvironmentComponent: ISceneEnvironmentComponent;
  spawnPointEntity: IEntity;
  actorSpawnComponent: IActorSpawnComponent;
  tilePosition: Readonly<{ x: number; y: number }>;
  tileWorldLayout: DungeonMapTileWorldLayout;
  worldPosition: readonly [number, number, number];
};

/** 旧 V1 输入先在迁移边界规范化，再复用唯一的空间挂载解析器。 */
export const resolveDungeonPlayerSpawn = (
  map: DungeonMapData,
  scenePresets: SceneEnvironmentPresetLibrary,
): DungeonPlayerSpawnBinding => resolveDungeonDocumentPlayerSpawn(
  migrateDungeonMapToDocumentV2({ presetKey: map.id, name: map.id, map }).document,
  scenePresets,
);
