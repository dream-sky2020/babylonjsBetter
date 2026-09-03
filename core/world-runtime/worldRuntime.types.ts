import type { DungeonRuntimeSaveState } from '../dungeon-runtime-save';
import type { DungeonPlayerSpawnBinding } from '../dungeon-player-spawn';
import type { DungeonRuntime } from '../dungeon-runtime';
import type { DungeonMapData } from '../map';

export type WorldRuntime = {
  readonly worldPresetKey: string;
  /** @deprecated 时间权威数据已迁移到 core/game-time 的 playTimeSecondsData。 */
  playTimeSeconds: number;
  /** @deprecated 计时运行状态由 GameTimeController 管理。 */
  playTimeRunning: boolean;
  activeDungeonPresetKey: string | null;
  activeDungeonMap: DungeonMapData | null;
  activeDungeonRuntime: DungeonRuntime | null;
  activeDungeonSpawn: DungeonPlayerSpawnBinding | null;
  /** 按地图预设保存的动态运行时状态；它不是地图数据差分。 */
  dungeonSaveStates: Record<string, DungeonRuntimeSaveState>;
};
