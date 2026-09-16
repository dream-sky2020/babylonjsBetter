import { loadConfig } from '@/core/config';
import { validateDungeonTransitionDocumentLibrary } from '@/core/dungeon-transition';
import { loadDungeonMapDocumentLibraryV2 } from '@/core/map';
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
      return Object.values(libraries.maps).map(({ identity, grid }) => ({
        presetKey: identity.presetKey,
        name: identity.name,
        mapId: identity.id,
        width: grid.width,
        height: grid.height,
      }));
    });
    return {
      async start() {
        const [maps, environments, shadows] = await Promise.all([
          loadDungeonMapDocumentLibraryV2(),
          loadConfig<unknown>('sceneEnvironmentPresets.json', { devApiPath: '/api/scene-environment-presets', selectDevPayload: selectDevData }),
          loadConfig<unknown>('shadowQualityPresets.json', { devApiPath: '/api/shadow-quality-presets', selectDevPayload: selectDevData }),
        ]);
        const transitionIssues = validateDungeonTransitionDocumentLibrary(maps);
        if (transitionIssues.length) {
          throw new Error(`地牢入口/出口配置无效：\n${transitionIssues.map(({ message }) => `- ${message}`).join('\n')}`);
        }
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
