import type { RuntimeDataListener, RuntimeFlatRecordArray } from '../runtime';

export type PlayTimeSeconds = number;
export type GameTimeRunning = boolean;
export type RealTime = string;

export type RecentBattleTimeRecord = {
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationSeconds: number;
  readonly battleDataSequence: number;
};

export type RecentBattleTimes = readonly RecentBattleTimeRecord[] & RuntimeFlatRecordArray;

export type GameTimeController = {
  readonly running: boolean;
  readonly activeBattleDataSequence: number | null;
  readPlayTime(): PlayTimeSeconds;
  readRealTime(): RealTime;
  readRecentBattleTimes(): RecentBattleTimes;
  start(): void;
  pause(): void;
  reset(): void;
  update(deltaSeconds: number, now?: Date): void;
  startBattle(battleDataSequence: number, now?: Date): void;
  finishBattle(now?: Date): RecentBattleTimeRecord;
  subscribe(listener: RuntimeDataListener<PlayTimeSeconds>): () => void;
};