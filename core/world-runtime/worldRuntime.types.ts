import type { DungeonDelta } from '../dungeon-delta';
import type { DungeonSession } from '../dungeon-session';

export type WorldRuntime = {
  readonly worldPresetKey: string;
  /** @deprecated 时间权威数据已迁移到 core/game-time 的 playTimeSecondsData。 */
  playTimeSeconds: number;
  /** @deprecated 计时运行状态由 GameTimeController 管理。 */
  playTimeRunning: boolean;
  activeDungeonSession: DungeonSession | null;
  dungeonDeltas: Record<string, DungeonDelta>;
};
