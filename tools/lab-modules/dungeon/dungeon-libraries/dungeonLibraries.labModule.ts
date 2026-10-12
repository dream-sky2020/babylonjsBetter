import { loadConfig } from '@/core/config';
import { loadSceneEnvironmentDeclarations } from '@/core/scene/sceneEnvironment.loader';
import { validateDungeonTransitionDocumentLibrary } from '@/core/dungeon-transition';
import { loadDungeonMapDocumentLibraryV2 } from '@/core/map';
import { parseSceneEnvironmentPresetLibrary, parseShadowQualityPresetLibrary } from '@/core/scene';
import type { LabModule, LabStateJsonValue } from '@/tools/lab-kit';
import {
  dungeonMapCatalogRequest,
} from './dungeonLibraries.protocol';
import { DUNGEON_LIBRARIES_MEMORY } from './dungeonLibraries.memory';

const selectDevData = (payload: unknown) => (payload as Record<string, unknown>).data;

export const dungeonLibrariesLabModule: LabModule = {
  id: 'dungeon-libraries',
  setup(context) {
    const librariesMemory = context.memory.acquire(DUNGEON_LIBRARIES_MEMORY);
    const stateRegistration = context.labState.registerReference({
      moduleId: 'dungeon-libraries',
      key: 'loaded-libraries',
      version: 1,
      value: librariesMemory,
      inspect: (reference): LabStateJsonValue => {
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
      const libraries = librariesMemory.require();
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
          loadSceneEnvironmentDeclarations(),
          loadConfig<unknown>('shadowQualityPresets.json', { devApiPath: '/api/shadow-quality-presets', selectDevPayload: selectDevData }),
        ]);
        const transitionIssues = validateDungeonTransitionDocumentLibrary(maps);
        if (transitionIssues.length) {
          throw new Error(`地牢入口/出口配置无效：\n${transitionIssues.map(({ message }) => `- ${message}`).join('\n')}`);
        }
        librariesMemory.replace({
          maps,
          environments: parseSceneEnvironmentPresetLibrary(environments),
          shadows: parseShadowQualityPresetLibrary(shadows),
        });
        stateRegistration.markChanged();
      },
      dispose() {
        librariesMemory.replace(null);
        stateRegistration.unregister();
      },
    };
  },
};
