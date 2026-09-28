import type { DungeonRuntimeFactories } from './dungeonRuntimeAssembly';
import type { DungeonPlayerSpawnBinding } from '../dungeon-player-spawn';
import { createDungeonObstacleStatesFromBindings, scanDungeonDocumentObstacles } from '../dungeon-obstacle/dungeonObstacle.ts';
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
  /** Explicit assembly: an empty object installs no traversal or movement capability. */
  systems?: DungeonRuntimeFactories;
  registerPlayer?: boolean;
}>;

/** 使用已经解析并校验过的玩家出生点创建地图运行时。 */
export const createDungeonRuntime = (
  document: DungeonMapDocumentV2,
  playerSpawn: DungeonPlayerSpawnBinding,
  playerFacing: DungeonRuntime['playerFacing'] = 'south',
  options: DungeonRuntimeCreationOptions = {},
): DungeonRuntime => {
  const map = createDungeonRuntimeMap(document);
  const factories = options.systems ?? {
    obstacles: scanDungeonDocumentObstacles, traversal: createDungeonTraversalWorld, movement: createDungeonMovementResolver,
  };
  const obstacles = factories.obstacles?.(document) ?? [];
  const obstacleStates = createDungeonObstacleStatesFromBindings(obstacles);
  if (factories.movement && !factories.traversal) throw new Error('移动系统需要先安装通行系统。');
  const traversal = factories.traversal?.(map, obstacles, obstacleStates);
  const movementResolver = traversal ? factories.movement?.(traversal) : undefined;
  const playerTileIndex = playerSpawn.tilePosition.y * map.width + playerSpawn.tilePosition.x;
  if (options.registerPlayer !== false) traversal?.registerActor({
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
    // Compatibility facade: absent capabilities fail explicitly, never silently create systems.
    get traversal() {
      if (!traversal) throw new Error('当前 Session 未安装 dungeon-traversal 系统。');
      return traversal;
    },
    get movementResolver() {
      if (!movementResolver) throw new Error('当前 Session 未安装 dungeon-movement 系统。');
      return movementResolver;
    },
    installedSystems: Object.freeze({ obstacles: !!factories.obstacles, traversal: !!traversal, movement: !!movementResolver }),
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
  runtime.traversal.setActorMovementProfile(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID, movementProfileId);
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
  if (runtime.installedSystems?.movement !== false) runtime.movementResolver.cancelActor(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID);
  if (runtime.installedSystems?.traversal !== false
    && runtime.traversal.actors.has(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID)) runtime.traversal.moveActor(
    DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID,
    nextPosition.tileY * runtime.map.width + nextPosition.tileX,
  );
  runtime.playerPosition = { ...nextPosition };
  runtime.playerMovement = null;
};
