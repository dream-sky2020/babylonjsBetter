import {
  defineRuntimeData,
  type RuntimeDataStore,
  type RuntimeModuleScopeAccess,
  type RuntimeScopeToken,
} from '../runtime';
import type { GameTimeController, PlayTimeSecondsData } from './gameTime.types';

export const GAME_TIME_RUNTIME_MODULE_ID = 'game-time';
export const PLAY_TIME_SECONDS_DATA_KEY = 'playTimeSeconds';

export const playTimeSecondsData = defineRuntimeData<PlayTimeSecondsData>({
  key: PLAY_TIME_SECONDS_DATA_KEY,
  moduleId: GAME_TIME_RUNTIME_MODULE_ID,
  scope: 'game',
  visibility: 'public',
  persistence: 'full',
  version: 1,
  createDefault: () => ({ playTimeSeconds: 0 }),
  validate: (value): value is PlayTimeSecondsData => {
    if (value === null || typeof value !== 'object') return false;
    const seconds = (value as Partial<PlayTimeSecondsData>).playTimeSeconds;
    return typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0;
  },
});

const requireDeltaSeconds = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) throw new RangeError('时间增量必须是非负有限数字。');
  return value;
};

class RegisteredGameTimeController implements GameTimeController {
  private readonly data: RuntimeModuleScopeAccess;
  private isRunning = false;

  constructor(data: RuntimeModuleScopeAccess) {
    this.data = data;
    data.ensure(playTimeSecondsData);
  }

  get running(): boolean {
    return this.isRunning;
  }

  readPlayTime(): PlayTimeSecondsData {
    return this.data.read(playTimeSecondsData) ?? { playTimeSeconds: 0 };
  }

  start(): void {
    this.isRunning = true;
  }

  pause(): void {
    this.isRunning = false;
  }

  reset(): void {
    this.data.write(playTimeSecondsData, { playTimeSeconds: 0 });
  }

  update(deltaSeconds: number): void {
    const delta = requireDeltaSeconds(deltaSeconds);
    if (!this.isRunning || delta === 0) return;
    this.data.update(playTimeSecondsData, (current) => ({
      playTimeSeconds: (current?.playTimeSeconds ?? 0) + delta,
    }));
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
  return new RegisteredGameTimeController(module.openScope(gameScope));
};

export const formatPlayTime = (seconds: number): string => {
  const value = Math.floor(requireDeltaSeconds(seconds));
  return [Math.floor(value / 3600), Math.floor((value % 3600) / 60), value % 60]
    .map((part) => String(part).padStart(2, '0')).join(':');
};