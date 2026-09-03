import type { DungeonRuntimeSaveState } from '../dungeon-runtime-save';
import type { WorldRuntime } from './worldRuntime.types';

export const createWorldRuntime = (worldPresetKey: string): WorldRuntime => {
  const key = worldPresetKey.trim();
  if (!key) throw new Error('worldPresetKey 不能为空。');
  return {
    worldPresetKey: key,
    playTimeSeconds: 0,
    playTimeRunning: false,
    activeDungeonPresetKey: null,
    activeDungeonMap: null,
    activeDungeonRuntime: null,
    activeDungeonSpawn: null,
    dungeonSaveStates: {},
  };
};

export const setWorldRuntimeDungeonSaveState = (
  runtime: WorldRuntime,
  dungeonPresetKey: string,
  saveState: DungeonRuntimeSaveState | null,
): void => {
  if (saveState) runtime.dungeonSaveStates[dungeonPresetKey] = saveState;
  else delete runtime.dungeonSaveStates[dungeonPresetKey];
};
