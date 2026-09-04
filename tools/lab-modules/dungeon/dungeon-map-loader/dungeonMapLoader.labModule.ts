import { scanDungeonObstacles } from '@/core/dungeon-obstacle';
import { resolveDungeonPlayerSpawn } from '@/core/dungeon-player-spawn';
import { createDungeonRuntime } from '@/core/dungeon-runtime';
import {
  applyDungeonRuntimeSaveState,
  createDungeonRuntimeSaveState,
  type DungeonRuntimeSaveState,
} from '@/core/dungeon-runtime-save';
import type { DungeonPlayerSpawnBinding } from '@/core/dungeon-player-spawn';
import type { DungeonRuntime } from '@/core/dungeon-runtime';
import {
  createDungeonMapSceneEnvironmentAsync,
  resolveDungeonMapSceneEnvironment,
  resolveDungeonMapTileWorldLayout,
  type DungeonMapSceneEnvironmentInstance,
} from '@/core/scene';
import { createLabField, createLabJson, createLabStatus, type LabModule } from '@/tools/lab-kit';
import {
  DUNGEON_LIBRARIES_SERVICE_KEY,
  type DungeonLabLibraries,
} from '../dungeon-libraries/dungeonLibraries.protocol';
import {
  dungeonMapChangedEvent,
  dungeonRuntimeChangedEvent,
  dungeonRuntimeCommitRequest,
  dungeonRuntimeSaveStatesRequest,
  dungeonMapSwitchRequest,
  type DungeonLabMapLoader,
} from './dungeonMapLoader.protocol';
import {
  createDungeonMapLoaderReferences,
  DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY,
} from './dungeonMapLoader.references';

export const dungeonMapLoaderLabModule: LabModule = {
  id: 'dungeon-map-loader',
  dependencies: ['dungeon-libraries'],
  setup(context) {
    const libraries = context.services.get<DungeonLabLibraries>(DUNGEON_LIBRARIES_SERVICE_KEY);
    const referenceController = createDungeonMapLoaderReferences();
    context.services.set(DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY, referenceController.references);
    const panel = context.ui.addPanel('dungeon-map-loader', '当前地图');
    const mapKey = document.createElement('input');
    mapKey.readOnly = true;
    const sceneKey = document.createElement('input');
    sceneKey.readOnly = true;
    const json = createLabJson('尚未加载地图。');
    const status = createLabStatus('等待地图装载……');
    panel.content.append(createLabField('地图预设', mapKey), createLabField('场景预设', sceneKey), json, status);

    let generation = 0;
    let activeLoadId = 0;
    let runtimeRevision = 0;
    let activePresetKey: string | null = null;
    let activeRuntime: DungeonRuntime | null = null;
    let activeSpawn: DungeonPlayerSpawnBinding | null = null;
    const dungeonSaveStates: Record<string, DungeonRuntimeSaveState> = {};
    let activeInstance: DungeonMapSceneEnvironmentInstance | null = null;
    const saveActiveRuntime = () => {
      if (!activePresetKey || !activeRuntime || !activeSpawn) return;
      const saveState = createDungeonRuntimeSaveState(activePresetKey, activeRuntime, activeSpawn);
      if (saveState) dungeonSaveStates[activePresetKey] = saveState;
      else delete dungeonSaveStates[activePresetKey];
    };

    const loader: DungeonLabMapLoader = {
      async switchDungeon(presetKey) {
        const preset = libraries.maps[presetKey];
        if (!preset) throw new Error(`找不到地牢预设“${presetKey}”。`);
        saveActiveRuntime();
        const loadId = ++generation;
        const binding = resolveDungeonMapSceneEnvironment(preset.map, libraries.environments);
        const instance = await createDungeonMapSceneEnvironmentAsync(
          context.scene, preset.map, libraries.environments, { shadowQualityPresets: libraries.shadows },
        );
        if (loadId !== generation) { instance.dispose(); return false; }
        try {
          const spawn = resolveDungeonPlayerSpawn(preset.map, libraries.environments);
          const runtime = createDungeonRuntime(preset.map, spawn);
          const saved = dungeonSaveStates[presetKey];
          const warnings = saved
            ? applyDungeonRuntimeSaveState(runtime, saved, (position) => resolveDungeonMapTileWorldLayout(
              spawn.sceneEnvironmentComponent, preset.map.width, preset.map.height,
              position.tileX, position.tileY,
            ).center).warnings
            : [];
          const obstacles = scanDungeonObstacles(preset.map);
          const previousPresetKey = activePresetKey;
          const previousInstance = activeInstance;
          activeInstance = instance;
          activePresetKey = presetKey;
          activeRuntime = runtime;
          activeSpawn = spawn;
          activeLoadId = loadId;
          runtimeRevision = 0;
          referenceController.commit({
            loadId,
            presetKey,
            map: preset.map,
            sceneBinding: binding,
            spawn,
            runtime,
            obstacles,
          });
          mapKey.value = presetKey;
          sceneKey.value = binding.component.presetKey;
          json.textContent = JSON.stringify({ loadId, presetKey, mapId: preset.map.id,
            mapSize: [preset.map.width, preset.map.height],
            obstacleIds: obstacles.map(({ entity }) => entity.id), runtimeSaveWarnings: warnings }, null, 2);
          status.textContent = warnings.length ? warnings.join(' ') : `地图已切换到“${preset.name}”。`;
          await context.communication.publish(
            dungeonMapChangedEvent,
            { loadId, revision: runtimeRevision, previousPresetKey, presetKey,
              mapId: preset.map.id, width: preset.map.width, height: preset.map.height },
          );
          previousInstance?.dispose();
          return true;
        } catch (error) { instance.dispose(); throw error; }
      },
      dispose() {
        generation += 1;
        saveActiveRuntime();
        activeInstance?.dispose();
        activeInstance = null;
        activePresetKey = null;
        activeRuntime = null;
        activeSpawn = null;
        referenceController.clear();
      },
    };
    context.communication.handle(dungeonMapSwitchRequest, async ({ presetKey }) => ({
      loaded: await loader.switchDungeon(presetKey),
      presetKey,
    }));
    context.communication.handle(dungeonRuntimeCommitRequest, async ({ reason }) => {
      const presetKey = activePresetKey;
      if (!presetKey || !activeRuntime) {
        return { committed: false, loadId: activeLoadId, revision: runtimeRevision, presetKey };
      }
      const revision = ++runtimeRevision;
      await context.communication.publish(dungeonRuntimeChangedEvent, {
        reason, loadId: activeLoadId, revision, presetKey,
      });
      return { committed: true, loadId: activeLoadId, revision, presetKey };
    });
    context.communication.handle(dungeonRuntimeSaveStatesRequest, () => structuredClone(dungeonSaveStates));
    return {
      dispose() { loader.dispose(); },
    };
  },
};
