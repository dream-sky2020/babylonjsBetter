export type PlayTimeSeconds = number;
export type GameTimeRunning = boolean;
export type RealTime = string;

export type RecentBattleTimeRecord = {
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationSeconds: number;
  readonly battleDataSequence: number;
};

export type RecentBattleTimes = readonly RecentBattleTimeRecord[];

/** 模块直接持有并高频读写；LabState 可同时登记这一个引用。 */
export type GameTimeState = {
  playTimeSeconds: PlayTimeSeconds;
  isRunning: GameTimeRunning;
  realTime: RealTime;
  recentBattleTimes: RecentBattleTimeRecord[];
};

export type GameTimeChange = {
  readonly previous: PlayTimeSeconds;
  readonly current: PlayTimeSeconds;
};

export type GameTimeListener = (change: GameTimeChange) => void;

export type GameTimeController = {
  readonly state: GameTimeState;
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
  subscribe(listener: GameTimeListener): () => void;
};
