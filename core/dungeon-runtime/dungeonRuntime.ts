import type { DungeonPlayerSpawnBinding } from '../dungeon-player-spawn';
import { createDungeonObstacleStatesFromBindings, scanDungeonDocumentObstacles } from '../dungeon-obstacle';
import type { DungeonMapDocumentV2 } from '../map-document/index.ts';
import type { DungeonRuntime, DungeonRuntimePlayerPosition } from './dungeonRuntime.types';
import { createDungeonRuntimeMap, isDungeonRuntimePositionInside } from './dungeonRuntimeMap.ts';
import {
  createDungeonTraversalWorld,
  DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID,
} from '../dungeon-traversal/index.ts';
import { createDungeonMovementResolver } from '../dungeon-movement/index.ts';

export type DungeonRuntimeCreationOptions = Readonly<{
  playerMovementProfileId?: string;
}>;

/** 使用已经解析并校验过的玩家出生点创建地图运行时。 */
export const createDungeonRuntime = (
  document: DungeonMapDocumentV2,
  playerSpawn: DungeonPlayerSpawnBinding,
  playerFacing: DungeonRuntime['playerFacing'] = 'south',
  options: DungeonRuntimeCreationOptions = {},
): DungeonRuntime => {
  const map = createDungeonRuntimeMap(document);
  const obstacles = scanDungeonDocumentObstacles(document);
  const obstacleStates = createDungeonObstacleStatesFromBindings(obstacles);
  const traversal = createDungeonTraversalWorld(map, obstacles, obstacleStates);
  const movementResolver = createDungeonMovementResolver(traversal);
  const playerTileIndex = playerSpawn.tilePosition.y * map.width + playerSpawn.tilePosition.x;
  traversal.registerActor({
    id: DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID,
    kind: 'player',
    tileIndex: playerTileIndex,
    enabled: true,
    blocksMovement: true,
    spatialFootprint: 'center',
    movementProfileId: options.playerMovementProfileId ?? 'ground',
  });
  return {
    map,
    traversal,
    movementResolver,
    obstacles,
    playerPosition: {
      tileX: playerSpawn.tilePosition.x,
      tileY: playerSpawn.tilePosition.y,
    },
    playerFacing,
    playerWorldPosition: [...playerSpawn.worldPosition],
    playerWorldRotationY: playerFacing === 'north' ? Math.PI
      : playerFacing === 'east' ? Math.PI / 2
        : playerFacing === 'west' ? -Math.PI / 2 : 0,
    playerMovement: null,
    obstacleStates,
  };
};

/** 只改变本次运行的玩家移动能力，不写回地图或存档。 */
export const setDungeonRuntimePlayerMovementProfile = (
  runtime: DungeonRuntime,
  movementProfileId: string,
): void => {
  const actor = runtime.traversal.actors.get(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID);
  if (!actor) throw new Error('DungeonRuntime 中不存在玩家通行 Actor。');
  actor.movementProfileId = movementProfileId;
};

/**
 * 更新玩家权威格子位置。该操作只修改小型运行时对象，不写回地图预设，
 * 也不会复制 DungeonMapDocumentV2，适合格步移动时频繁调用。
 */
export const setDungeonRuntimePlayerPosition = (
  runtime: DungeonRuntime,
  nextPosition: DungeonRuntimePlayerPosition,
): void => {
  if (!Number.isInteger(nextPosition.tileX) || !Number.isInteger(nextPosition.tileY)
    || !isDungeonRuntimePositionInside(runtime.map, nextPosition.tileX, nextPosition.tileY)) {
    throw new RangeError(
      `玩家位置 (${nextPosition.tileX}, ${nextPosition.tileY}) 超出地图“${runtime.map.id}”的有效范围。`,
    );
  }
  runtime.movementResolver.cancelActor(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID);
  runtime.traversal.moveActor(
    DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID,
    nextPosition.tileY * runtime.map.width + nextPosition.tileX,
  );
  runtime.playerPosition = { ...nextPosition };
  runtime.playerMovement = null;
};
