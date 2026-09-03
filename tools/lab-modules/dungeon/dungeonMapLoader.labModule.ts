import { scanDungeonObstacles } from '@/core/dungeon-obstacle';
import { resolveDungeonPlayerSpawn } from '@/core/dungeon-player-spawn';
import { createDungeonRuntime } from '@/core/dungeon-runtime';
import { applyDungeonRuntimeSaveState, createDungeonRuntimeSaveState } from '@/core/dungeon-runtime-save';
import {
  createDungeonMapSceneEnvironmentAsync,
  resolveDungeonMapSceneEnvironment,
  resolveDungeonMapTileWorldLayout,
  type DungeonMapSceneEnvironmentInstance,
} from '@/core/scene';
import { createWorldRuntime, setWorldRuntimeDungeonSaveState, type WorldRuntime } from '@/core/world-runtime';
import { WORLD_LAB_SERVICES, gameRuntimeReadyEvent } from '@/tools/lab-modules/world/worldLab.types';
import { createLabField, createLabJson, createLabStatus, type LabModule } from '@/tools/lab-kit';
import {
  DUNGEON_LAB_SERVICES,
  dungeonMapChangedEvent,
  dungeonRuntimeChangedEvent,
  dungeonRuntimeCommitRequest,
  dungeonMapSwitchRequest,
  type DungeonLabLibraries,
  type DungeonLabMapLoader,
} from './dungeonLab.types';

export const dungeonMapLoaderLabModule: LabModule = {
  id: 'dungeon-map-loader',
  dependencies: ['dungeon-libraries'],
  setup(context) {
    const panel = context.ui.addPanel('dungeon-map-loader', '当前地图');
    const mapKey = document.createElement('input');
    mapKey.readOnly = true;
    const sceneKey = document.createElement('input');
    sceneKey.readOnly = true;
    const json = createLabJson('尚未加载地图。');
    const status = createLabStatus('等待 WorldRuntime 与地图装载……');
    panel.content.append(createLabField('地图预设', mapKey), createLabField('场景预设', sceneKey), json, status);

    let generation = 0;
    let activeLoadId = 0;
    let runtimeRevision = 0;
    let worldRuntime: WorldRuntime | null = null;
    let activeInstance: DungeonMapSceneEnvironmentInstance | null = null;
    const saveActiveRuntime = () => {
      if (!worldRuntime?.activeDungeonPresetKey || !worldRuntime.activeDungeonRuntime || !worldRuntime.activeDungeonSpawn) return;
      const key = worldRuntime.activeDungeonPresetKey;
      setWorldRuntimeDungeonSaveState(
        worldRuntime,
        key,
        createDungeonRuntimeSaveState(key, worldRuntime.activeDungeonRuntime, worldRuntime.activeDungeonSpawn),
      );
    };

    const loader: DungeonLabMapLoader = {
      async switchDungeon(presetKey) {
        if (!worldRuntime) throw new Error('WorldRuntime 尚未就绪。');
        const libraries = context.services.get<DungeonLabLibraries>(DUNGEON_LAB_SERVICES.libraries);
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
          const saved = worldRuntime.dungeonSaveStates[presetKey];
          const warnings = saved
            ? applyDungeonRuntimeSaveState(runtime, saved, (position) => resolveDungeonMapTileWorldLayout(
              spawn.sceneEnvironmentComponent, preset.map.width, preset.map.height,
              position.tileX, position.tileY,
            ).center).warnings
            : [];
          const obstacles = scanDungeonObstacles(preset.map);
          const previousPresetKey = worldRuntime.activeDungeonPresetKey;
          const previousInstance = activeInstance;
          activeInstance = instance;
          worldRuntime.activeDungeonPresetKey = presetKey;
          worldRuntime.activeDungeonMap = preset.map;
          worldRuntime.activeDungeonRuntime = runtime;
          worldRuntime.activeDungeonSpawn = spawn;
          activeLoadId = loadId;
          runtimeRevision = 0;
          context.services.set(DUNGEON_LAB_SERVICES.sceneBinding, binding);
          context.services.set(DUNGEON_LAB_SERVICES.spawn, spawn);
          context.services.set(DUNGEON_LAB_SERVICES.runtime, runtime);
          context.services.set(DUNGEON_LAB_SERVICES.obstacles, obstacles);
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
        if (worldRuntime) {
          worldRuntime.activeDungeonPresetKey = null;
          worldRuntime.activeDungeonMap = null;
          worldRuntime.activeDungeonRuntime = null;
          worldRuntime.activeDungeonSpawn = null;
        }
      },
    };
    context.communication.handle(dungeonMapSwitchRequest, async ({ presetKey }) => ({
      loaded: await loader.switchDungeon(presetKey),
      presetKey,
    }));
    context.communication.handle(dungeonRuntimeCommitRequest, async ({ reason }) => {
      const presetKey = worldRuntime?.activeDungeonPresetKey ?? null;
      if (!presetKey || !worldRuntime?.activeDungeonRuntime) {
        return { committed: false, loadId: activeLoadId, revision: runtimeRevision, presetKey };
      }
      const revision = ++runtimeRevision;
      await context.communication.publish(dungeonRuntimeChangedEvent, {
        reason, loadId: activeLoadId, revision, presetKey,
      });
      return { committed: true, loadId: activeLoadId, revision, presetKey };
    });
    const install = (runtime: WorldRuntime) => {
      if (worldRuntime && worldRuntime !== runtime) loader.dispose();
      worldRuntime = runtime;
    };
    const offGame = context.communication.on(gameRuntimeReadyEvent, () => {
      install(context.services.get<WorldRuntime>(WORLD_LAB_SERVICES.runtime));
    });
    const start = () => {
      if (worldRuntime) return;
      const standalone = createWorldRuntime('lab:standalone');
      context.services.set(WORLD_LAB_SERVICES.runtime, standalone);
      install(standalone);
    };
    return {
      start,
      dispose() { offGame(); loader.dispose(); },
    };
  },
};
