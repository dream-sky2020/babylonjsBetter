import { applyDungeonRuntimeSaveState } from '../dungeon-runtime-save';
import { scanDungeonObstacles } from '../dungeon-obstacle';
import { resolveDungeonPlayerSpawn } from '../dungeon-player-spawn';
import { createDungeonRuntime } from '../dungeon-runtime';
import {
  createDungeonMapSceneEnvironmentAsync,
  resolveDungeonMapSceneEnvironment,
  resolveDungeonMapTileWorldLayout,
} from '../scene';
import type { DungeonSession, DungeonSessionControllerOptions } from './dungeonSession.types';

export const createDungeonSession = async (
  options: DungeonSessionControllerOptions,
  dungeonPresetKey: string,
  sessionId: number,
): Promise<DungeonSession> => {
  const preset = options.libraries.maps[dungeonPresetKey];
  if (!preset) throw new Error(`找不到地牢预设“${dungeonPresetKey}”。`);
  const binding = resolveDungeonMapSceneEnvironment(preset.map, options.libraries.environments);
  const instance = await createDungeonMapSceneEnvironmentAsync(
    options.scene,
    preset.map,
    options.libraries.environments,
    { shadowQualityPresets: options.libraries.shadows },
  );
  try {
    const spawn = resolveDungeonPlayerSpawn(preset.map, options.libraries.environments);
    const runtime = createDungeonRuntime(preset.map, spawn);
    const saveState = options.worldRuntime.dungeonSaveStates[dungeonPresetKey];
    const runtimeSaveWarnings = saveState
      ? applyDungeonRuntimeSaveState(runtime, saveState, (position) => resolveDungeonMapTileWorldLayout(
        spawn.sceneEnvironmentComponent,
        preset.map.width,
        preset.map.height,
        position.tileX,
        position.tileY,
      ).center).warnings
      : [];
    const obstacles = scanDungeonObstacles(preset.map);
    return {
      sessionId,
      dungeonPresetKey,
      preset,
      binding,
      instance,
      spawn,
      runtime,
      obstacles,
      runtimeSaveWarnings,
    };
  } catch (error) {
    instance.dispose();
    throw error;
  }
};

export const disposeDungeonSession = (session: DungeonSession): void => {
  session.instance.dispose();
};
