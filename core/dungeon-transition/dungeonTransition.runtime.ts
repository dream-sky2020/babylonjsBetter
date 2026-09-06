import type { ISceneEnvironmentComponent } from '../entity/components/scene-environment.component.ts';
import { setDungeonRuntimePlayerPosition } from '../dungeon-runtime/dungeonRuntime.ts';
import type { DungeonRuntime } from '../dungeon-runtime/dungeonRuntime.types.ts';
import type { DungeonMapDirection } from '../map/dungeonMap.types.ts';
import { resolveDungeonMapTileWorldLayout } from '../scene/dungeonMapSceneLayout.ts';
import type { DungeonEntranceBinding } from './dungeonTransition.types.ts';

const DIRECTION_YAWS: Readonly<Record<DungeonMapDirection, number>> = {
  north: Math.PI,
  east: Math.PI / 2,
  south: 0,
  west: -Math.PI / 2,
};

/** 将已解析的目标入口应用到当前地图 Runtime；不负责任何传送表现。 */
export const applyDungeonEntranceToRuntime = (
  runtime: DungeonRuntime,
  entrance: DungeonEntranceBinding,
  sceneEnvironmentComponent: ISceneEnvironmentComponent,
): void => {
  const position = { tileX: entrance.tileX, tileY: entrance.tileY };
  const layout = resolveDungeonMapTileWorldLayout(
    sceneEnvironmentComponent,
    runtime.map.width,
    runtime.map.height,
    position.tileX,
    position.tileY,
  );
  setDungeonRuntimePlayerPosition(runtime, position);
  runtime.playerWorldPosition = [...layout.center];
  runtime.playerFacing = entrance.component.facing;
  runtime.playerWorldRotationY = DIRECTION_YAWS[entrance.component.facing];
};
