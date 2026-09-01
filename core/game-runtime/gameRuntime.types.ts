import type { DungeonDelta } from '../dungeon-delta';
import type { WorldRuntime } from '../world-runtime';

export type GameRuntime = {
  activeWorld: WorldRuntime;
};

export type GameRuntimeSnapshot = {
  version: 1;
  worldPresetKey: string;
  /** @deprecated 旧快照兼容字段；新时间权威数据是 Runtime Store 的 playTimeSeconds。 */
  playTimeSeconds: number;
  activeDungeonPresetKey: string | null;
  dungeonDeltas: Record<string, DungeonDelta>;
};
