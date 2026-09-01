import type { DungeonDelta } from '../dungeon-delta';
import type { WorldRuntime } from './worldRuntime.types';

export const createWorldRuntime = (worldPresetKey: string): WorldRuntime => {
  const key = worldPresetKey.trim();
  if (!key) throw new Error('worldPresetKey 不能为空。');
  return {
    worldPresetKey: key,
    playTimeSeconds: 0,
    playTimeRunning: false,
    activeDungeonSession: null,
    dungeonDeltas: {},
  };
};

export const setWorldRuntimeDungeonDelta = (
  runtime: WorldRuntime,
  dungeonPresetKey: string,
  delta: DungeonDelta | null,
): void => {
  if (delta) runtime.dungeonDeltas[dungeonPresetKey] = delta;
  else delete runtime.dungeonDeltas[dungeonPresetKey];
};
