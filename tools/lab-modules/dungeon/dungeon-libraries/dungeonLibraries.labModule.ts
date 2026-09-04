import { loadConfig } from '@/core/config';
import { loadDungeonMapPresetLibrary } from '@/core/map';
import { parseSceneEnvironmentPresetLibrary, parseShadowQualityPresetLibrary } from '@/core/scene';
import type { LabModule } from '@/tools/lab-kit';
import {
  DUNGEON_LIBRARIES_SERVICE_KEY,
  dungeonMapCatalogRequest,
  type DungeonLabLibraries,
} from './dungeonLibraries.protocol';

const selectDevData = (payload: unknown) => (payload as Record<string, unknown>).data;

export const dungeonLibrariesLabModule: LabModule = {
  id: 'dungeon-libraries',
  setup(context) {
    let libraries: DungeonLabLibraries | null = null;
    context.communication.handle(dungeonMapCatalogRequest, () => {
      if (!libraries) throw new Error('地牢预设目录尚未加载。');
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
        libraries = {
          maps,
          environments: parseSceneEnvironmentPresetLibrary(environments),
          shadows: parseShadowQualityPresetLibrary(shadows),
        };
        context.services.set(DUNGEON_LIBRARIES_SERVICE_KEY, libraries);
      },
    };
  },
};
