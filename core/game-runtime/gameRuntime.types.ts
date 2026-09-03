import type { DungeonRuntimeSaveState } from '../dungeon-runtime-save';
import type { WorldRuntime } from '../world-runtime';

export type GameRuntime = {
  activeWorld: WorldRuntime;
};

export type GameRuntimeSnapshot = {
  version: 2;
  worldPresetKey: string;
  /** @deprecated 旧快照兼容字段；新时间权威数据是 Runtime Store 的 playTimeSeconds。 */
  playTimeSeconds: number;
  activeDungeonPresetKey: string | null;
  dungeonSaveStates: Record<string, DungeonRuntimeSaveState>;
};
