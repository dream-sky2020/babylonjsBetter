import type { DungeonRuntimeFactories } from './dungeonRuntimeAssembly';
import type { DungeonPlayerSpawnBinding } from '../dungeon-player-spawn';
import { createDungeonObstacleStatesFromBindings, scanDungeonDocumentObstacles } from '../dungeon-obstacle/dungeonObstacle.ts';
import type { DungeonMapDocumentV2 } from '../map-document/index.ts';
import type { DungeonRuntime, DungeonRuntimePlayerPosition, DungeonPlayerStorage } from './dungeonRuntime.types';
import type { DungeonTraversalStorage } from '../dungeon-traversal/dungeonTraversal';
import type { DungeonMovementStorage } from '../dungeon-movement/dungeonMovement.types';
import { createDungeonRuntimeMap, isDungeonRuntimePositionInside } from './dungeonRuntimeMap.ts';
import {
  createDungeonTraversalWorld,
  DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID,
} from '../dungeon-traversal/index.ts';
import { createDungeonMovementResolver } from '../dungeon-movement/index.ts';
import { SpatialEnabledMap } from '../dungeon-spatial/dungeonSpatialViews.ts';
import { resolveDungeonMapTileWorldLayout } from '../scene/dungeonMapSceneLayout.ts';

/** Plain data factories injected by a composed host; no dependency on host infrastructure. */
export type DungeonRuntimeStorageFactories = {
  player(spawn: DungeonPlayerSpawnBinding, facing: DungeonRuntime['playerFacing']): DungeonPlayerStorage;
  obstacles(bindings: DungeonRuntime['obstacles']): { states: Map<string, boolean> };
  traversal(map: DungeonRuntime['map']): DungeonTraversalStorage;
  movement(traversal: DungeonRuntime['traversal']): DungeonMovementStorage;
};

export type DungeonRuntimeCreationOptions = Readonly<{
  playerMovementProfileId?: string;
  /** Explicit assembly: an empty object installs no traversal or movement capability. */
  systems?: DungeonRuntimeFactories;
  registerPlayer?: boolean;
  storage?: DungeonRuntimeStorageFactories;
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
  const obstacles = factories.obstacles?.(map.document) ?? [];
  const obstacleStorage = options.storage?.obstacles(obstacles) ?? { states: createDungeonObstacleStatesFromBindings(obstacles) };
  const obstacleStates = obstacleStorage.states;
  if (factories.movement && !factories.traversal) throw new Error('移动系统需要先安装通行系统。');
  const traversal = factories.traversal?.(map, obstacles, obstacleStates, options.storage?.traversal(map));
  if (traversal) for (const binding of obstacles) {
    const initial = binding.placement;
    if (initial.kind === 'tile') Object.defineProperty(binding,'placement',{enumerable:true,configurable:true,
      get:()=>{const body=traversal.body(binding.entity.id);return body?{kind:'tile',tileX:body.logicalPosition.tileX,tileY:body.logicalPosition.tileY}:initial;}});
  }
  const movementResolver = traversal ? factories.movement?.(traversal, {}, options.storage?.movement(traversal)) : undefined;
  const playerStorage = options.storage?.player(playerSpawn, playerFacing) ?? {
    playerPosition: { tileX: playerSpawn.tilePosition.x, tileY: playerSpawn.tilePosition.y },
    playerFacing, playerWorldPosition: [...playerSpawn.worldPosition],
    playerWorldRotationY: playerFacing === 'north' ? Math.PI
      : playerFacing === 'east' ? Math.PI / 2 : playerFacing === 'west' ? -Math.PI / 2 : 0,
    playerMovement: null,
  } satisfies DungeonPlayerStorage;
  const playerTileIndex = playerSpawn.tilePosition.y * map.width + playerSpawn.tilePosition.x;
  traversal?.registerActor({
    id: DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID,
    kind: 'player',
    tileIndex: playerTileIndex,
    enabled: true,
    blocksMovement: true,
    spatialFootprint: 'center',
    movementProfileId: options.playerMovementProfileId ?? 'ground',
  });
  if (traversal) {
    const body = traversal.body(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID)!;
    body.facing = playerStorage.playerFacing;
    body.worldPosition = playerStorage.playerWorldPosition; body.worldRotationY = playerStorage.playerWorldRotationY;
    Object.defineProperties(playerStorage, {
      playerPosition: { enumerable: true, configurable: true, get: () => body.logicalPosition, set: value => { body.logicalPosition = value; } },
      playerFacing: { enumerable: true, configurable: true, get: () => body.facing, set: value => { body.facing = value; } },
      playerWorldPosition: { enumerable: true, configurable: true, get: () => body.worldPosition, set: value => { body.worldPosition = value; } },
      playerWorldRotationY: { enumerable: true, configurable: true, get: () => body.worldRotationY, set: value => { body.worldRotationY = value; } },
    });
    obstacleStorage.states = new SpatialEnabledMap(traversal);
    traversal.obstacleStates = obstacleStorage.states;
    if (movementResolver) {
      movementResolver.worldPositionFor = playerSpawn.sceneEnvironmentComponent
        ? (x,y) => [...resolveDungeonMapTileWorldLayout(playerSpawn.sceneEnvironmentComponent,map.width,map.height,x,y).center]
        : (x,y) => [x,0,y];
      Object.defineProperty(playerStorage, 'playerMovement', { enumerable: true, configurable: true,
        get: () => movementResolver.storage.tracks!.get(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID) ?? null,
        set: value => { if (value) movementResolver.storage.tracks!.set(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID,value);
          else movementResolver.storage.tracks!.delete(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID); } });
    }
  }
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
    get playerPosition() { return playerStorage.playerPosition; }, set playerPosition(value) { playerStorage.playerPosition = value; },
    get playerFacing() { return playerStorage.playerFacing; }, set playerFacing(value) { playerStorage.playerFacing = value; },
    get playerWorldPosition() { return playerStorage.playerWorldPosition; }, set playerWorldPosition(value) { playerStorage.playerWorldPosition = value; },
    get playerWorldRotationY() { return playerStorage.playerWorldRotationY; }, set playerWorldRotationY(value) { playerStorage.playerWorldRotationY = value; },
    get playerMovement() { return playerStorage.playerMovement; }, set playerMovement(value) { playerStorage.playerMovement = value; },
    get obstacleStates() { return obstacleStorage.states; }, set obstacleStates(value) { obstacleStorage.states = value; },
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
