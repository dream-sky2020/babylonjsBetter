import type { DungeonPlayerSpawnBinding } from '../dungeon-player-spawn';
import { isDungeonMapPositionInside, type DungeonMapData } from '../map';
import type { DungeonRuntime, DungeonRuntimePlayerPosition } from './dungeonRuntime.types';

/** 使用已经解析并校验过的玩家出生点创建地图运行时。 */
export const createDungeonRuntime = (
  map: DungeonMapData,
  playerSpawn: DungeonPlayerSpawnBinding,
): DungeonRuntime => ({
  map,
  playerPosition: {
    tileX: playerSpawn.tilePosition.x,
    tileY: playerSpawn.tilePosition.y,
  },
  obstacleStates: new Map<string, boolean>(),
});

/**
 * 更新玩家权威格子位置。该操作只修改小型运行时对象，不写回地图预设，
 * 也不会复制 DungeonMapData，适合格步移动时频繁调用。
 */
export const setDungeonRuntimePlayerPosition = (
  runtime: DungeonRuntime,
  nextPosition: DungeonRuntimePlayerPosition,
): void => {
  if (!Number.isInteger(nextPosition.tileX) || !Number.isInteger(nextPosition.tileY)
    || !isDungeonMapPositionInside(runtime.map, nextPosition.tileX, nextPosition.tileY)) {
    throw new RangeError(
      `玩家位置 (${nextPosition.tileX}, ${nextPosition.tileY}) 超出地图“${runtime.map.id}”的有效范围。`,
    );
  }
  runtime.playerPosition = { ...nextPosition };
};
