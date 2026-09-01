import { createDungeonObstacleStates } from '../dungeon-obstacle';
import type { DungeonPlayerSpawnBinding } from '../dungeon-player-spawn';
import { setDungeonRuntimePlayerPosition, type DungeonRuntime } from '../dungeon-runtime';
import { isDungeonMapPositionInside, type DungeonMapDirection } from '../map';
import type { ApplyDungeonDeltaResult, DungeonDelta } from './dungeonDelta.types';

const DEFAULT_PLAYER_FACING: DungeonMapDirection = 'south';

export const createDungeonDelta = (
  dungeonPresetKey: string,
  runtime: DungeonRuntime,
  spawn: DungeonPlayerSpawnBinding,
): DungeonDelta | null => {
  const delta: DungeonDelta = { version: 1, dungeonPresetKey };
  if (runtime.playerPosition.tileX !== spawn.tilePosition.x || runtime.playerPosition.tileY !== spawn.tilePosition.y) {
    delta.playerPosition = { ...runtime.playerPosition };
  }
  if (runtime.playerFacing !== DEFAULT_PLAYER_FACING) delta.playerFacing = runtime.playerFacing;
  const defaults = createDungeonObstacleStates(runtime.map);
  const changed: Record<string, boolean> = {};
  runtime.obstacleStates.forEach((active, id) => {
    if (defaults.get(id) !== active) changed[id] = active;
  });
  if (Object.keys(changed).length) delta.obstacleStates = changed;
  return delta.playerPosition || delta.playerFacing || delta.obstacleStates ? delta : null;
};

export const applyDungeonDelta = (
  runtime: DungeonRuntime,
  delta: DungeonDelta,
  resolveWorldPosition: (position: Readonly<{ tileX: number; tileY: number }>) => readonly [number, number, number],
): ApplyDungeonDeltaResult => {
  if (delta.version !== 1) throw new Error(`不支持 DungeonDelta 版本 ${String(delta.version)}。`);
  const warnings: string[] = [];
  if (delta.playerPosition) {
    if (isDungeonMapPositionInside(runtime.map, delta.playerPosition.tileX, delta.playerPosition.tileY)) {
      setDungeonRuntimePlayerPosition(runtime, delta.playerPosition);
      runtime.playerWorldPosition = [...resolveWorldPosition(delta.playerPosition)];
    } else {
      warnings.push(`玩家差分位置 (${delta.playerPosition.tileX}, ${delta.playerPosition.tileY}) 已超出当前地图，已使用出生点。`);
    }
  }
  if (delta.playerFacing) {
    runtime.playerFacing = delta.playerFacing;
    runtime.playerWorldRotationY = delta.playerFacing === 'north' ? Math.PI
      : delta.playerFacing === 'east' ? Math.PI / 2
        : delta.playerFacing === 'west' ? -Math.PI / 2 : 0;
  }
  Object.entries(delta.obstacleStates ?? {}).forEach(([id, active]) => {
    if (!runtime.obstacleStates.has(id)) {
      warnings.push(`地牢差分中的阻碍“${id}”在当前预设中不存在，已忽略。`);
      return;
    }
    runtime.obstacleStates.set(id, active);
  });
  runtime.playerMovement = null;
  return { warnings };
};
