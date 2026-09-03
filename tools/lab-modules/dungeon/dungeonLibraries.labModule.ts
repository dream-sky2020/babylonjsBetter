import { loadConfig } from '@/core/config';
import { loadDungeonMapPresetLibrary } from '@/core/map';
import { parseSceneEnvironmentPresetLibrary, parseShadowQualityPresetLibrary } from '@/core/scene';
import type { LabModule } from '@/tools/lab-kit';
import { DUNGEON_LAB_SERVICES, type DungeonLabLibraries } from './dungeonLab.types';

const selectDevData = (payload: unknown) => (payload as Record<string, unknown>).data;

export const dungeonLibrariesLabModule: LabModule = {
  id: 'dungeon-libraries',
  setup(context) {
    return context.events.on('lab:ready', async () => {
      const [maps, environments, shadows] = await Promise.all([
        loadDungeonMapPresetLibrary(),
        loadConfig<unknown>('sceneEnvironmentPresets.json', { devApiPath: '/api/scene-environment-presets', selectDevPayload: selectDevData }),
        loadConfig<unknown>('shadowQualityPresets.json', { devApiPath: '/api/shadow-quality-presets', selectDevPayload: selectDevData }),
      ]);
      const libraries: DungeonLabLibraries = {
        maps,
        environments: parseSceneEnvironmentPresetLibrary(environments),
        shadows: parseShadowQualityPresetLibrary(shadows),
      };
      context.services.set(DUNGEON_LAB_SERVICES.libraries, libraries);
    });
  },
};
