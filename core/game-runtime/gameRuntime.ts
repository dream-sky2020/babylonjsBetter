import { createDungeonRuntimeSaveState } from '../dungeon-runtime-save';
import { createWorldRuntime } from '../world-runtime';
import type { GameRuntime, GameRuntimeSnapshot } from './gameRuntime.types';

const requireTime = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) throw new RangeError('游玩时间必须是非负有限数字。');
  return value;
};

export const createGameRuntime = (worldPresetKey: string): GameRuntime => ({
  activeWorld: createWorldRuntime(worldPresetKey),
});

/** @deprecated 请使用 core/game-time 的 GameTimeController。 */
export const startGameRuntimePlayTime = (runtime: GameRuntime): void => {
  runtime.activeWorld.playTimeRunning = true;
};

/** @deprecated 请使用 core/game-time 的 GameTimeController。 */
export const pauseGameRuntimePlayTime = (runtime: GameRuntime): void => {
  runtime.activeWorld.playTimeRunning = false;
};

/** @deprecated 请使用 core/game-time 的 GameTimeController。 */
export const resetGameRuntimePlayTime = (runtime: GameRuntime): void => {
  runtime.activeWorld.playTimeSeconds = 0;
};

/** @deprecated 请使用 core/game-time 的 GameTimeController。 */
export const updateGameRuntime = (runtime: GameRuntime, deltaSeconds: number): void => {
  requireTime(deltaSeconds);
  if (runtime.activeWorld.playTimeRunning) runtime.activeWorld.playTimeSeconds += deltaSeconds;
};

export const createGameRuntimeSnapshot = (runtime: GameRuntime): GameRuntimeSnapshot => {
  const world = runtime.activeWorld;
  const dungeonSaveStates = structuredClone(world.dungeonSaveStates);
  const session = world.activeDungeonSession;
  if (session) {
    const saveState = createDungeonRuntimeSaveState(session.dungeonPresetKey, session.runtime, session.spawn);
    if (saveState) dungeonSaveStates[session.dungeonPresetKey] = saveState;
    else delete dungeonSaveStates[session.dungeonPresetKey];
  }
  return {
    version: 2,
    worldPresetKey: world.worldPresetKey,
    playTimeSeconds: Math.round(world.playTimeSeconds * 1000) / 1000,
    activeDungeonPresetKey: session?.dungeonPresetKey ?? null,
    dungeonSaveStates,
  };
};

export const restoreGameRuntime = (snapshot: GameRuntimeSnapshot): GameRuntime => {
  if (snapshot.version !== 2) throw new Error(`不支持 GameRuntime 存档版本 ${String(snapshot.version)}。`);
  const runtime = createGameRuntime(snapshot.worldPresetKey);
  runtime.activeWorld.playTimeSeconds = requireTime(snapshot.playTimeSeconds);
  runtime.activeWorld.dungeonSaveStates = structuredClone(snapshot.dungeonSaveStates);
  return runtime;
};
