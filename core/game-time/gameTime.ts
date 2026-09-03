import {
  defineRuntimeData,
  isRuntimeFlatRecord,
  type RuntimeDataStore,
  type RuntimeModuleScopeAccess,
  type RuntimeScopeToken,
} from '../runtime';
import type {
  GameTimeController,
  GameTimeRunning,
  PlayTimeSeconds,
  RealTime,
  RecentBattleTimeRecord,
  RecentBattleTimes,
} from './gameTime.types';

export const GAME_TIME_RUNTIME_MODULE_ID = 'game-time';
export const PLAY_TIME_SECONDS_DATA_KEY = 'playTimeSeconds';
export const GAME_TIME_RUNNING_DATA_KEY = 'isRunning';
export const REAL_TIME_DATA_KEY = 'realTime';
export const RECENT_BATTLE_TIMES_DATA_KEY = 'recentBattleTimes';
export const RECENT_BATTLE_TIMES_LIMIT = 20;

export const playTimeSecondsData = defineRuntimeData<PlayTimeSeconds>({
  key: PLAY_TIME_SECONDS_DATA_KEY,
  moduleId: GAME_TIME_RUNTIME_MODULE_ID,
  scope: 'game',
  visibility: 'public',
  persistence: 'full',
  version: 1,
  createDefault: () => 0,
  validate: (value): value is PlayTimeSeconds => (
    typeof value === 'number' && Number.isFinite(value) && value >= 0
  ),
});

export const gameTimeRunningData = defineRuntimeData<GameTimeRunning>({
  key: GAME_TIME_RUNNING_DATA_KEY,
  moduleId: GAME_TIME_RUNTIME_MODULE_ID,
  scope: 'game',
  visibility: 'public',
  persistence: 'none',
  version: 1,
  createDefault: () => false,
  validate: (value): value is GameTimeRunning => typeof value === 'boolean',
});

export const realTimeData = defineRuntimeData<RealTime>({
  key: REAL_TIME_DATA_KEY,
  moduleId: GAME_TIME_RUNTIME_MODULE_ID,
  scope: 'game',
  visibility: 'public',
  persistence: 'none',
  version: 1,
  createDefault: () => formatRealTime(new Date()),
  validate: (value): value is RealTime => typeof value === 'string' && !Number.isNaN(Date.parse(value)),
});

const isRecentBattleTimeRecord = (value: unknown): value is RecentBattleTimeRecord => {
  if (!isRuntimeFlatRecord(value)) return false;
  return typeof value.startedAt === 'string'
    && !Number.isNaN(Date.parse(value.startedAt))
    && typeof value.endedAt === 'string'
    && !Number.isNaN(Date.parse(value.endedAt))
    && typeof value.durationSeconds === 'number'
    && Number.isFinite(value.durationSeconds)
    && value.durationSeconds >= 0
    && typeof value.battleDataSequence === 'number'
    && Number.isSafeInteger(value.battleDataSequence)
    && value.battleDataSequence >= 0;
};

export const recentBattleTimesData = defineRuntimeData<RecentBattleTimes>({
  key: RECENT_BATTLE_TIMES_DATA_KEY,
  moduleId: GAME_TIME_RUNTIME_MODULE_ID,
  scope: 'game',
  visibility: 'public',
  persistence: 'full',
  version: 1,
  createDefault: () => [],
  validate: (value): value is RecentBattleTimes => (
    Array.isArray(value)
    && value.length <= RECENT_BATTLE_TIMES_LIMIT
    && value.every(isRecentBattleTimeRecord)
  ),
});

const requireDeltaSeconds = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) throw new RangeError('时间增量必须是非负有限数字。');
  return value;
};

const requireBattleDataSequence = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('战斗数据序号必须是非负安全整数。');
  return value;
};

const formatRealTime = (date: Date): string => {
  if (Number.isNaN(date.getTime())) throw new RangeError('现实时间无效。');
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
};

type ActiveBattle = {
  readonly battleDataSequence: number;
  readonly startedAt: string;
  readonly startedAtMilliseconds: number;
};

class RegisteredGameTimeController implements GameTimeController {
  private readonly data: RuntimeModuleScopeAccess;
  private activeBattle: ActiveBattle | null = null;

  constructor(data: RuntimeModuleScopeAccess) {
    this.data = data;
    data.ensure(playTimeSecondsData);
    data.ensure(gameTimeRunningData);
    data.ensure(realTimeData);
    data.ensure(recentBattleTimesData);
  }

  get running(): boolean {
    return this.data.read(gameTimeRunningData) ?? false;
  }

  get activeBattleDataSequence(): number | null {
    return this.activeBattle?.battleDataSequence ?? null;
  }

  readPlayTime(): PlayTimeSeconds {
    return this.data.read(playTimeSecondsData) ?? 0;
  }

  readRealTime(): RealTime {
    return this.data.read(realTimeData) ?? formatRealTime(new Date());
  }

  readRecentBattleTimes(): RecentBattleTimes {
    return this.data.read(recentBattleTimesData) ?? [];
  }

  start(): void {
    this.data.write(gameTimeRunningData, true);
  }

  pause(): void {
    this.data.write(gameTimeRunningData, false);
  }

  reset(): void {
    this.data.write(playTimeSecondsData, 0);
  }

  update(deltaSeconds: number, now = new Date()): void {
    const delta = requireDeltaSeconds(deltaSeconds);
    const realTime = formatRealTime(now);
    if (this.readRealTime() !== realTime) this.data.write(realTimeData, realTime);
    if (!this.running || delta === 0) return;
    this.data.update(playTimeSecondsData, (current) => (current ?? 0) + delta);
  }

  startBattle(battleDataSequence: number, now = new Date()): void {
    if (this.activeBattle) throw new Error(`战斗数据 #${this.activeBattle.battleDataSequence} 尚未结束。`);
    const sequence = requireBattleDataSequence(battleDataSequence);
    const startedAt = formatRealTime(now);
    this.activeBattle = {
      battleDataSequence: sequence,
      startedAt,
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
    this.data.update(recentBattleTimesData, (current) => (
      [...(current ?? []), record].slice(-RECENT_BATTLE_TIMES_LIMIT) as RecentBattleTimes
    ));
    this.activeBattle = null;
    return record;
  }

  subscribe(listener: Parameters<GameTimeController['subscribe']>[0]): () => void {
    return this.data.subscribe(playTimeSecondsData, listener);
  }
}

export const registerGameTime = (
  runtime: RuntimeDataStore,
  gameScope: RuntimeScopeToken,
): GameTimeController => {
  if (gameScope.address.kind !== 'game') throw new Error('GameTime 必须注册到 game Scope。');
  const module = runtime.registerModule(GAME_TIME_RUNTIME_MODULE_ID);
  module.registerData(playTimeSecondsData);
  module.registerData(gameTimeRunningData);
  module.registerData(realTimeData);
  module.registerData(recentBattleTimesData);
  return new RegisteredGameTimeController(module.openScope(gameScope));
};

export const formatPlayTime = (seconds: number): string => {
  const value = Math.floor(requireDeltaSeconds(seconds));
  return [Math.floor(value / 3600), Math.floor((value % 3600) / 60), value % 60]
    .map((part) => String(part).padStart(2, '0')).join(':');
};