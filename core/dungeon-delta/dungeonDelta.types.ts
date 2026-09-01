import type { DungeonMapDirection } from '../map';
import type { DungeonRuntimePlayerPosition } from '../dungeon-runtime';

export type DungeonDelta = {
  version: 1;
  dungeonPresetKey: string;
  playerPosition?: DungeonRuntimePlayerPosition;
  playerFacing?: DungeonMapDirection;
  obstacleStates?: Record<string, boolean>;
};

export type ApplyDungeonDeltaResult = { warnings: string[] };
