import {
  applyDungeonEntranceToRuntime,
  findDungeonDocumentEntrance,
  validateDungeonTransitionDocument,
} from '@/core/dungeon-transition';
import { resolveDungeonDocumentPlayerSpawn } from '@/core/dungeon-player-spawn';
import { createDungeonRuntime } from '@/core/dungeon-runtime';
import {
  applyDungeonRuntimeSaveState,
  createDungeonRuntimeSaveState,
  type DungeonRuntimeSaveState,
} from '@/core/dungeon-runtime-save';
import type { DungeonPlayerSpawnBinding } from '@/core/dungeon-player-spawn';
import type { DungeonRuntime } from '@/core/dungeon-runtime';
import {
  isDungeonMapDefinitionRefsDelta,
} from '@/core/map';
import {
  isDungeonMapDocumentDeltaV1,
  type DungeonMapDocumentV2,
} from '@/core/map-document';
import {
  createDungeonDocumentSceneEnvironmentAsync,
  resolveDungeonDocumentSceneEnvironment,
  resolveDungeonMapTileWorldLayout,
  type DungeonMapSceneEnvironmentInstance,
} from '@/core/scene';
import { createDungeonMapCanvasView } from '@/core/ui';
import {
  createLabField,
  createLabJson,
  createLabStatus,
  type LabModule,
  type LabStateJsonValue,
  type LabStateRegistration,
} from '@/tools/lab-kit';
import {
  DUNGEON_LIBRARIES_SERVICE_KEY,
} from '../dungeon-libraries/dungeonLibraries.protocol';
import type { DungeonLabLibrariesReference } from '../dungeon-libraries/dungeonLibraries.references';
import {
  dungeonMapChangedEvent,
  dungeonMapDeltaCommitRequest,
  dungeonMapDeltasRequest,
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
import {
  createDungeonMapDeltaStore,
  type DungeonMapDeltaStore,
  type DungeonMapSavedDelta,
} from './dungeonMapLoader.deltaStore';

type SavedDungeonMapDeltas = Readonly<Record<string, DungeonMapSavedDelta>> & LabStateJsonValue;
type SavedDungeonRuntimeStates = Readonly<Record<string, DungeonRuntimeSaveState>> & LabStateJsonValue;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const validateSavedDungeonMapDeltas = (value: unknown): SavedDungeonMapDeltas => {
  if (!isRecord(value)) throw new Error('地图 Delta 存档必须是对象。');
  Object.entries(value).forEach(([presetKey, delta]) => {
    if ((!isDungeonMapDocumentDeltaV1(delta) && !isDungeonMapDefinitionRefsDelta(delta))
      || delta.basePresetKey !== presetKey) {
      throw new Error(`地图“${presetKey}”的 Delta 存档无效。`);
    }
  });
  return structuredClone(value) as SavedDungeonMapDeltas;
};

const validateDungeonRuntimeSaveState = (value: unknown, presetKey: string): value is DungeonRuntimeSaveState => {
  if (!isRecord(value) || value.version !== 1 || value.dungeonPresetKey !== presetKey) return false;
  const position = value.playerPosition;
  if (position !== undefined && (!isRecord(position)
    || !Number.isInteger(position.tileX) || !Number.isInteger(position.tileY))) return false;
  if (value.playerFacing !== undefined
    && !['north', 'east', 'south', 'west'].includes(value.playerFacing as string)) return false;
  return value.obstacleStates === undefined || (isRecord(value.obstacleStates)
    && Object.values(value.obstacleStates).every((active) => typeof active === 'boolean'));
};

const validateSavedDungeonRuntimeStates = (value: unknown): SavedDungeonRuntimeStates => {
  if (!isRecord(value)) throw new Error('地牢 Runtime 存档必须是对象。');
  Object.entries(value).forEach(([presetKey, state]) => {
    if (!validateDungeonRuntimeSaveState(state, presetKey)) {
      throw new Error(`地图“${presetKey}”的 Runtime 存档无效。`);
    }
  });
  return structuredClone(value) as SavedDungeonRuntimeStates;
};

export const dungeonMapLoaderLabModule: LabModule = {
  id: 'dungeon-map-loader',
  dependencies: ['dungeon-libraries'],
  setup(context) {
    const librariesReference = context.services.get<DungeonLabLibrariesReference>(DUNGEON_LIBRARIES_SERVICE_KEY);
    const referenceController = createDungeonMapLoaderReferences();
    context.services.set(DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY, referenceController.references);
    const panel = context.ui.addPanel('dungeon-map-loader', '当前地图');
    const mapKey = document.createElement('input');
    mapKey.readOnly = true;
    const sceneKey = document.createElement('input');
    sceneKey.readOnly = true;
    const json = createLabJson('尚未加载地图。');
    const deltaRefreshButton = document.createElement('button');
    deltaRefreshButton.type = 'button';
    deltaRefreshButton.textContent = '结算并刷新当前地图 Delta';
    const deltaJson = createLabJson('尚无地图 Delta。');
    const status = createLabStatus('等待地图装载……');
    panel.content.append(
      createLabField('地图预设', mapKey),
      createLabField('场景预设', sceneKey),
      json,
      createLabField('地图结构差分', deltaRefreshButton),
      deltaJson,
      status,
    );

    let generation = 0;
    let activeLoadId = 0;
    let runtimeRevision = 0;
    let activePresetKey: string | null = null;
    let activeRuntime: DungeonRuntime | null = null;
    let activeSpawn: DungeonPlayerSpawnBinding | null = null;
    let activeBaseDocument: DungeonMapDocumentV2 | null = null;
    let activeLiveDocument: DungeonMapDocumentV2 | null = null;
    let restoringLabState = false;
    const dungeonSaveStates: Record<string, DungeonRuntimeSaveState> = {};
    const dungeonMapDeltaStore = createDungeonMapDeltaStore();
    let deltaStateRegistration: LabStateRegistration<DungeonMapDeltaStore> | null = null;
    let runtimeStatesRegistration: LabStateRegistration<Record<string, DungeonRuntimeSaveState>> | null = null;
    let activeInstance: DungeonMapSceneEnvironmentInstance | null = null;
    const saveActiveRuntime = () => {
      if (!activePresetKey || !activeRuntime || !activeSpawn) return;
      const saveState = createDungeonRuntimeSaveState(activePresetKey, activeRuntime, activeSpawn);
      if (saveState) dungeonSaveStates[activePresetKey] = saveState;
      else delete dungeonSaveStates[activePresetKey];
      runtimeStatesRegistration?.markChanged();
    };
    const readMapDeltaSnapshot = () => ({
      activePresetKey,
      activeDelta: activePresetKey && activeBaseDocument && activeLiveDocument
        ? dungeonMapDeltaStore.preview(activePresetKey, activeBaseDocument, activeLiveDocument)
        : null,
      savedDeltas: dungeonMapDeltaStore.readAll(),
    });
    const refreshDeltaPanel = () => {
      const snapshot = readMapDeltaSnapshot();
      deltaJson.textContent = JSON.stringify({
        activePresetKey: snapshot.activePresetKey,
        activeDelta: snapshot.activeDelta,
        savedDeltaPresetKeys: Object.keys(snapshot.savedDeltas),
        savedDeltas: snapshot.savedDeltas,
      }, null, 2);
    };
    const captureActiveMapDelta = () => {
      if (!activePresetKey || !activeBaseDocument || !activeLiveDocument) return null;
      const delta = dungeonMapDeltaStore.capture(activePresetKey, activeBaseDocument, activeLiveDocument);
      refreshDeltaPanel();
      deltaStateRegistration?.markChanged();
      return delta;
    };

    const loadedStateRegistration = context.labState.registerReference({
      moduleId: 'dungeon-map-loader',
      key: 'loaded-dungeon',
      version: 1,
      value: referenceController.references,
      inspect: (references) => {
        const loaded = references.current;
        return loaded ? {
          loadId: loaded.loadId,
          presetKey: loaded.presetKey,
          mapId: loaded.document.identity.id,
          mapSize: [loaded.map.width, loaded.map.height],
          playerPosition: { ...loaded.runtime.playerPosition },
          playerFacing: loaded.runtime.playerFacing,
          activeObstacleIds: [...loaded.runtime.obstacleStates]
            .filter(([, active]) => active)
            .map(([id]) => id),
        } : null;
      },
    });
    deltaStateRegistration = context.labState.registerReference({
      moduleId: 'dungeon-map-loader',
      key: 'map-deltas',
      version: 1,
      value: dungeonMapDeltaStore,
      inspect: (store) => store.readAll() as SavedDungeonMapDeltas,
      save: {
        serialize: (store) => {
          captureActiveMapDelta();
          return store.readAll() as SavedDungeonMapDeltas;
        },
        validate: (saved, savedVersion) => {
          if (savedVersion !== 1) throw new Error(`地图 Delta 存档版本 ${savedVersion} 不受支持。`);
          return validateSavedDungeonMapDeltas(saved);
        },
        restore: (store, saved) => {
          store.replaceAll(saved);
          refreshDeltaPanel();
        },
        afterRestore: async () => {
          if (!activePresetKey) return;
          restoringLabState = true;
          try { await loader.switchDungeon(activePresetKey); } finally { restoringLabState = false; }
        },
      },
    });
    runtimeStatesRegistration = context.labState.registerReference({
      moduleId: 'dungeon-map-loader',
      key: 'runtime-save-states',
      version: 1,
      value: dungeonSaveStates,
      inspect: (states) => structuredClone(states) as SavedDungeonRuntimeStates,
      save: {
        serialize: (states) => {
          saveActiveRuntime();
          return structuredClone(states) as SavedDungeonRuntimeStates;
        },
        validate: (saved, savedVersion) => {
          if (savedVersion !== 1) throw new Error(`地牢 Runtime 存档版本 ${savedVersion} 不受支持。`);
          return validateSavedDungeonRuntimeStates(saved);
        },
        restore: (states, saved) => {
          Object.keys(states).forEach((key) => delete states[key]);
          Object.entries(saved).forEach(([key, state]) => { states[key] = structuredClone(state); });
        },
      },
    });

    const loader: DungeonLabMapLoader = {
      async switchDungeon(presetKey, options) {
        const libraries = librariesReference.require();
        const preset = libraries.maps[presetKey];
        if (!preset) throw new Error(`找不到地牢预设“${presetKey}”。`);
        if (!restoringLabState) {
          saveActiveRuntime();
          captureActiveMapDelta();
        }
        const loadId = ++generation;
        const baseDocument = preset;
        const liveDocument = dungeonMapDeltaStore.restore(presetKey, baseDocument);
        const transitionIssues = validateDungeonTransitionDocument(liveDocument);
        if (transitionIssues.length) {
          throw new Error(`地图“${presetKey}”的入口/出口配置无效：${transitionIssues.map(({ message }) => message).join(' ')}`);
        }
        const binding = resolveDungeonDocumentSceneEnvironment(liveDocument, libraries.environments);
        const instance = await createDungeonDocumentSceneEnvironmentAsync(
          context.scene, liveDocument, libraries.environments, { shadowQualityPresets: libraries.shadows },
        );
        if (loadId !== generation) { instance.dispose(); return false; }
        try {
          const spawn = resolveDungeonDocumentPlayerSpawn(liveDocument, libraries.environments);
          const runtime = createDungeonRuntime(liveDocument, spawn);
          const saved = dungeonSaveStates[presetKey];
          const warnings = saved
            ? applyDungeonRuntimeSaveState(runtime, saved, (position) => resolveDungeonMapTileWorldLayout(
              spawn.sceneEnvironmentComponent, liveDocument.grid.width, liveDocument.grid.height,
              position.tileX, position.tileY,
            ).center).warnings
            : [];
          if (options?.entranceId) {
            const entrance = findDungeonDocumentEntrance(liveDocument, options.entranceId);
            applyDungeonEntranceToRuntime(runtime, entrance, spawn.sceneEnvironmentComponent);
          }
          const obstacles = runtime.obstacles;
          const previousPresetKey = activePresetKey;
          const previousInstance = activeInstance;
          activeInstance = instance;
          activePresetKey = presetKey;
          activeRuntime = runtime;
          activeSpawn = spawn;
          activeBaseDocument = baseDocument;
          activeLiveDocument = liveDocument;
          activeLoadId = loadId;
          runtimeRevision = 0;
          referenceController.commit({
            loadId,
            presetKey,
            document: liveDocument,
            map: createDungeonMapCanvasView(liveDocument),
            sceneBinding: binding,
            spawn,
            runtime,
            obstacles,
          });
          loadedStateRegistration.markChanged();
          mapKey.value = presetKey;
          sceneKey.value = binding.component.presetKey;
          json.textContent = JSON.stringify({ loadId, presetKey, mapId: liveDocument.identity.id,
            mapSize: [liveDocument.grid.width, liveDocument.grid.height],
            obstacleIds: obstacles.map(({ entity }) => entity.id), runtimeSaveWarnings: warnings }, null, 2);
          refreshDeltaPanel();
          status.textContent = warnings.length ? warnings.join(' ') : `地图已切换到“${preset.identity.name}”。`;
          await context.communication.publish(
            dungeonMapChangedEvent,
            { loadId, revision: runtimeRevision, previousPresetKey, presetKey,
              mapId: liveDocument.identity.id,
              width: liveDocument.grid.width,
              height: liveDocument.grid.height },
          );
          previousInstance?.dispose();
          return true;
        } catch (error) { instance.dispose(); throw error; }
      },
      dispose() {
        generation += 1;
        saveActiveRuntime();
        try { captureActiveMapDelta(); } catch (error) { console.error('无法保存当前地图 Delta。', error); }
        activeInstance?.dispose();
        activeInstance = null;
        activePresetKey = null;
        activeRuntime = null;
        activeSpawn = null;
        activeBaseDocument = null;
        activeLiveDocument = null;
        referenceController.clear();
        loadedStateRegistration.markChanged();
      },
    };
    context.communication.handle(dungeonMapSwitchRequest, async ({ presetKey, entranceId }) => ({
      loaded: await loader.switchDungeon(presetKey, { entranceId }),
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
    context.communication.handle(dungeonMapDeltaCommitRequest, () => {
      if (!activePresetKey || !activeBaseDocument || !activeLiveDocument) {
        return { committed: false, presetKey: activePresetKey, delta: null };
      }
      const delta = captureActiveMapDelta();
      return { committed: true, presetKey: activePresetKey, delta };
    });
    context.communication.handle(dungeonMapDeltasRequest, () => readMapDeltaSnapshot());
    const refreshDelta = () => {
      try {
        const delta = captureActiveMapDelta();
        status.textContent = delta
          ? `已结算地图“${activePresetKey}”的结构 Delta。`
          : activePresetKey ? `地图“${activePresetKey}”与基础预设一致。` : '尚未加载地图。';
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : '地图 Delta 计算失败。';
      }
    };
    deltaRefreshButton.addEventListener('click', refreshDelta);
    return {
      dispose() {
        deltaRefreshButton.removeEventListener('click', refreshDelta);
        loader.dispose();
        runtimeStatesRegistration?.unregister();
        deltaStateRegistration?.unregister();
        loadedStateRegistration.unregister();
        context.services.delete(DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY);
      },
    };
  },
};
