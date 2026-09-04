import { loadConfig } from '@/core/config';
import { loadDungeonMapPresetLibrary } from '@/core/map';
import { parseSceneEnvironmentPresetLibrary, parseShadowQualityPresetLibrary } from '@/core/scene';
import type { LabModule } from '@/tools/lab-kit';
import {
  DUNGEON_LIBRARIES_SERVICE_KEY,
  dungeonMapCatalogRequest,
} from './dungeonLibraries.protocol';
import { createDungeonLabLibrariesReference } from './dungeonLibraries.references';

const selectDevData = (payload: unknown) => (payload as Record<string, unknown>).data;

export const dungeonLibrariesLabModule: LabModule = {
  id: 'dungeon-libraries',
  setup(context) {
    const controller = createDungeonLabLibrariesReference();
    context.services.set(DUNGEON_LIBRARIES_SERVICE_KEY, controller.reference);
    const stateRegistration = context.labState.registerReference({
      moduleId: 'dungeon-libraries',
      key: 'loaded-libraries',
      version: 1,
      value: controller.reference,
      inspect: (reference) => {
        const libraries = reference.current;
        return libraries ? {
          loaded: true,
          mapPresetKeys: Object.keys(libraries.maps),
          environmentPresetCount: Object.keys(libraries.environments).length,
          shadowPresetCount: Object.keys(libraries.shadows).length,
        } : { loaded: false };
      },
    });
    context.communication.handle(dungeonMapCatalogRequest, () => {
      const libraries = controller.reference.require();
      return Object.values(libraries.maps).map(({ presetKey, name, map }) => ({
        presetKey, name, mapId: map.id, width: map.width, height: map.height,
      }));
    });
    return {
      async start() {
        const [maps, environments, shadows] = await Promise.all([
          loadDungeonMapPresetLibrary(),
          loadConfig<unknown>('sceneEnvironmentPresets.json', { devApiPath: '/api/scene-environment-presets', selectDevPayload: selectDevData }),
          loadConfig<unknown>('shadowQualityPresets.json', { devApiPath: '/api/shadow-quality-presets', selectDevPayload: selectDevData }),
        ]);
        controller.commit({
          maps,
          environments: parseSceneEnvironmentPresetLibrary(environments),
          shadows: parseShadowQualityPresetLibrary(shadows),
        });
        stateRegistration.markChanged();
      },
      dispose() {
        controller.clear();
        stateRegistration.unregister();
        context.services.delete(DUNGEON_LIBRARIES_SERVICE_KEY);
      },
    };
  },
};
