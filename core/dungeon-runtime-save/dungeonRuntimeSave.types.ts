import type { DungeonMapDirection } from '../map';
import type { DungeonRuntimePlayerPosition } from '../dungeon-runtime';

/**
 * 一次已加载地牢的动态存档状态。
 * 它不属于 DungeonMapData，也不能作为地图结构差分使用。
 */
export type DungeonRuntimeSaveState = {
  version: 1;
  dungeonPresetKey: string;
  playerPosition?: DungeonRuntimePlayerPosition;
  playerFacing?: DungeonMapDirection;
  obstacleStates?: Record<string, boolean>;
};

export type ApplyDungeonRuntimeSaveStateResult = { warnings: string[] };
