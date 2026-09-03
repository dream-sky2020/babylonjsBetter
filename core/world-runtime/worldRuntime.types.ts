import type { DungeonRuntimeSaveState } from '../dungeon-runtime-save';
import type { DungeonSession } from '../dungeon-session';

export type WorldRuntime = {
  readonly worldPresetKey: string;
  /** @deprecated 时间权威数据已迁移到 core/game-time 的 playTimeSecondsData。 */
  playTimeSeconds: number;
  /** @deprecated 计时运行状态由 GameTimeController 管理。 */
  playTimeRunning: boolean;
  activeDungeonSession: DungeonSession | null;
  /** 按地图预设保存的动态运行时状态；它不是地图数据差分。 */
  dungeonSaveStates: Record<string, DungeonRuntimeSaveState>;
};
