import { createDungeonObstacleStates } from '../dungeon-obstacle';
import type { DungeonPlayerSpawnBinding } from '../dungeon-player-spawn';
import { setDungeonRuntimePlayerPosition, type DungeonRuntime } from '../dungeon-runtime';
import { isDungeonMapPositionInside, type DungeonMapDirection } from '../map';
import type {
  ApplyDungeonRuntimeSaveStateResult,
  DungeonRuntimeSaveState,
} from './dungeonRuntimeSave.types';

const DEFAULT_PLAYER_FACING: DungeonMapDirection = 'south';

export const createDungeonRuntimeSaveState = (
  dungeonPresetKey: string,
  runtime: DungeonRuntime,
  spawn: DungeonPlayerSpawnBinding,
): DungeonRuntimeSaveState | null => {
  const saveState: DungeonRuntimeSaveState = { version: 1, dungeonPresetKey };
  if (runtime.playerPosition.tileX !== spawn.tilePosition.x || runtime.playerPosition.tileY !== spawn.tilePosition.y) {
    saveState.playerPosition = { ...runtime.playerPosition };
  }
  if (runtime.playerFacing !== DEFAULT_PLAYER_FACING) saveState.playerFacing = runtime.playerFacing;
  const defaults = createDungeonObstacleStates(runtime.map);
  const changed: Record<string, boolean> = {};
  runtime.obstacleStates.forEach((active, id) => {
    if (defaults.get(id) !== active) changed[id] = active;
  });
  if (Object.keys(changed).length) saveState.obstacleStates = changed;
  return saveState.playerPosition || saveState.playerFacing || saveState.obstacleStates ? saveState : null;
};

export const applyDungeonRuntimeSaveState = (
  runtime: DungeonRuntime,
  saveState: DungeonRuntimeSaveState,
  resolveWorldPosition: (position: Readonly<{ tileX: number; tileY: number }>) => readonly [number, number, number],
): ApplyDungeonRuntimeSaveStateResult => {
  if (saveState.version !== 1) {
    throw new Error(`不支持 DungeonRuntimeSaveState 版本 ${String(saveState.version)}。`);
  }
  const warnings: string[] = [];
  if (saveState.playerPosition) {
    if (isDungeonMapPositionInside(runtime.map, saveState.playerPosition.tileX, saveState.playerPosition.tileY)) {
      setDungeonRuntimePlayerPosition(runtime, saveState.playerPosition);
      runtime.playerWorldPosition = [...resolveWorldPosition(saveState.playerPosition)];
    } else {
      warnings.push(
        `玩家存档位置 (${saveState.playerPosition.tileX}, ${saveState.playerPosition.tileY}) 已超出当前地图，已使用出生点。`,
      );
    }
  }
  if (saveState.playerFacing) {
    runtime.playerFacing = saveState.playerFacing;
    runtime.playerWorldRotationY = saveState.playerFacing === 'north' ? Math.PI
      : saveState.playerFacing === 'east' ? Math.PI / 2
        : saveState.playerFacing === 'west' ? -Math.PI / 2 : 0;
  }
  Object.entries(saveState.obstacleStates ?? {}).forEach(([id, active]) => {
    if (!runtime.obstacleStates.has(id)) {
      warnings.push(`地牢运行时存档中的阻碍“${id}”在当前预设中不存在，已忽略。`);
      return;
    }
    runtime.obstacleStates.set(id, active);
  });
  runtime.playerMovement = null;
  return { warnings };
};
