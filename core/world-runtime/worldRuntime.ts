import type { WorldRuntime, WorldRuntimeSnapshot } from './worldRuntime.types';

const requireWorldPresetKey = (value: string): string => {
  const key = value.trim();
  if (!key) throw new Error('worldPresetKey 不能为空。');
  return key;
};

const requirePlayTime = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) throw new RangeError('游玩时间必须是非负有限数字。');
  return value;
};

export const createWorldRuntime = (worldPresetKey: string, initialPlayTimeSeconds = 0): WorldRuntime => ({
  worldPresetKey: requireWorldPresetKey(worldPresetKey),
  playTimeSeconds: requirePlayTime(initialPlayTimeSeconds),
  playTimeRunning: false,
});

export const startWorldRuntimePlayTime = (runtime: WorldRuntime): void => {
  runtime.playTimeRunning = true;
};

export const pauseWorldRuntimePlayTime = (runtime: WorldRuntime): void => {
  runtime.playTimeRunning = false;
};

export const resetWorldRuntimePlayTime = (runtime: WorldRuntime): void => {
  runtime.playTimeSeconds = 0;
};

/** 使用游戏帧 delta 推进，不使用系统时间，因此暂停期间不会误累计。 */
export const updateWorldRuntime = (runtime: WorldRuntime, deltaSeconds: number): void => {
  requirePlayTime(deltaSeconds);
  if (!runtime.playTimeRunning || deltaSeconds === 0) return;
  runtime.playTimeSeconds += deltaSeconds;
};

export const createWorldRuntimeSnapshot = (runtime: WorldRuntime): WorldRuntimeSnapshot => ({
  version: 1,
  worldPresetKey: runtime.worldPresetKey,
  playTimeSeconds: Math.round(runtime.playTimeSeconds * 1000) / 1000,
});

export const restoreWorldRuntime = (snapshot: WorldRuntimeSnapshot): WorldRuntime => {
  if (snapshot.version !== 1) throw new Error(`不支持 WorldRuntime 存档版本 ${snapshot.version}。`);
  return createWorldRuntime(snapshot.worldPresetKey, snapshot.playTimeSeconds);
};
