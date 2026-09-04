import type {
  GameTimeController,
  GameTimeListener,
  GameTimeState,
  PlayTimeSeconds,
  RealTime,
  RecentBattleTimeRecord,
  RecentBattleTimes,
} from './gameTime.types';

export const GAME_TIME_MODULE_ID = 'game-time';
export const RECENT_BATTLE_TIMES_LIMIT = 20;

const requireDeltaSeconds = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) throw new RangeError('时间增量必须是非负有限数字。');
  return value;
};

const requireBattleDataSequence = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('战斗数据序号必须是非负安全整数。');
  return value;
};

export const formatRealTime = (date: Date): string => {
  if (Number.isNaN(date.getTime())) throw new RangeError('现实时间无效。');
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
};

const isValidRealTime = (value: unknown): value is RealTime => (
  typeof value === 'string' && !Number.isNaN(Date.parse(value))
);

export const isRecentBattleTimeRecord = (value: unknown): value is RecentBattleTimeRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<RecentBattleTimeRecord>;
  return isValidRealTime(record.startedAt)
    && isValidRealTime(record.endedAt)
    && typeof record.durationSeconds === 'number'
    && Number.isFinite(record.durationSeconds)
    && record.durationSeconds >= 0
    && typeof record.battleDataSequence === 'number'
    && Number.isSafeInteger(record.battleDataSequence)
    && record.battleDataSequence >= 0;
};

export const createGameTimeState = (initial: Partial<GameTimeState> = {}): GameTimeState => {
  const playTimeSeconds = initial.playTimeSeconds ?? 0;
  if (!Number.isFinite(playTimeSeconds) || playTimeSeconds < 0) {
    throw new RangeError('游戏时间必须是非负有限数字。');
  }
  if (initial.isRunning !== undefined && typeof initial.isRunning !== 'boolean') {
    throw new TypeError('游戏时间运行状态必须是布尔值。');
  }
  const realTime = initial.realTime ?? formatRealTime(new Date());
  if (!isValidRealTime(realTime)) throw new RangeError('现实时间无效。');
  const recentBattleTimes = initial.recentBattleTimes ?? [];
  if (recentBattleTimes.length > RECENT_BATTLE_TIMES_LIMIT || !recentBattleTimes.every(isRecentBattleTimeRecord)) {
    throw new TypeError(`最近战斗时间必须是最多 ${RECENT_BATTLE_TIMES_LIMIT} 条的有效记录。`);
  }
  return {
    playTimeSeconds,
    isRunning: initial.isRunning ?? false,
    realTime,
    recentBattleTimes: recentBattleTimes.map((record) => ({ ...record })),
  };
};

type ActiveBattle = {
  readonly battleDataSequence: number;
  readonly startedAt: string;
  readonly startedAtMilliseconds: number;
};

class DirectGameTimeController implements GameTimeController {
  readonly state: GameTimeState;
  private activeBattle: ActiveBattle | null = null;
  private readonly listeners = new Set<GameTimeListener>();

  constructor(initial?: Partial<GameTimeState>) {
    this.state = createGameTimeState(initial);
  }

  get running(): boolean {
    return this.state.isRunning;
  }

  get activeBattleDataSequence(): number | null {
    return this.activeBattle?.battleDataSequence ?? null;
  }

  readPlayTime(): PlayTimeSeconds {
    return this.state.playTimeSeconds;
  }

  readRealTime(): RealTime {
    return this.state.realTime;
  }

  readRecentBattleTimes(): RecentBattleTimes {
    return this.state.recentBattleTimes;
  }

  start(): void {
    this.state.isRunning = true;
  }

  pause(): void {
    this.state.isRunning = false;
  }

  reset(): void {
    this.setPlayTime(0);
  }

  update(deltaSeconds: number, now = new Date()): void {
    const delta = requireDeltaSeconds(deltaSeconds);
    this.state.realTime = formatRealTime(now);
    if (!this.running || delta === 0) return;
    this.setPlayTime(this.state.playTimeSeconds + delta);
  }

  startBattle(battleDataSequence: number, now = new Date()): void {
    if (this.activeBattle) throw new Error(`战斗数据 #${this.activeBattle.battleDataSequence} 尚未结束。`);
    const sequence = requireBattleDataSequence(battleDataSequence);
    this.activeBattle = {
      battleDataSequence: sequence,
      startedAt: formatRealTime(now),
      startedAtMilliseconds: now.getTime(),
    };
  }

  finishBattle(now = new Date()): RecentBattleTimeRecord {
    const active = this.activeBattle;
    if (!active) throw new Error('当前没有正在记录的战斗。');
    const endedAt = formatRealTime(now);
    const durationSeconds = Math.max(0, now.getTime() - active.startedAtMilliseconds) / 1000;
    const record: RecentBattleTimeRecord = {
      startedAt: active.startedAt,
      endedAt,
      durationSeconds: Math.round(durationSeconds * 1000) / 1000,
      battleDataSequence: active.battleDataSequence,
    };
    this.state.recentBattleTimes.push(record);
    if (this.state.recentBattleTimes.length > RECENT_BATTLE_TIMES_LIMIT) {
      this.state.recentBattleTimes.splice(0, this.state.recentBattleTimes.length - RECENT_BATTLE_TIMES_LIMIT);
    }
    this.activeBattle = null;
    return record;
  }

  subscribe(listener: GameTimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setPlayTime(current: number): void {
    const previous = this.state.playTimeSeconds;
    if (previous === current) return;
    this.state.playTimeSeconds = current;
    this.listeners.forEach((listener) => listener({ previous, current }));
  }
}

export const createGameTime = (initial?: Partial<GameTimeState>): GameTimeController => (
  new DirectGameTimeController(initial)
);

export const formatPlayTime = (seconds: number): string => {
  const value = Math.floor(requireDeltaSeconds(seconds));
  return [Math.floor(value / 3600), Math.floor((value % 3600) / 60), value % 60]
    .map((part) => String(part).padStart(2, '0')).join(':');
};
