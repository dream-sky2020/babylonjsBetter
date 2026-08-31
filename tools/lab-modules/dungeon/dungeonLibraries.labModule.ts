import { loadConfig } from '@/core/config';
import type { DungeonMapPreset, DungeonMapPresetLibrary } from '@/core/map';
import { parseSceneEnvironmentPresetLibrary, parseShadowQualityPresetLibrary } from '@/core/scene';
import type { LabModule } from '@/tools/lab-kit';
import { DUNGEON_LAB_SERVICES, type DungeonLabLibraries } from './dungeonLab.types';

const parseMapLibrary = (value: unknown): DungeonMapPresetLibrary => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('地图预设配置必须是对象。');
  const result: DungeonMapPresetLibrary = {};
  Object.entries(value).forEach(([key, candidate]) => {
    if (!candidate || typeof candidate !== 'object') return;
    const preset = candidate as Partial<DungeonMapPreset>;
    if (typeof preset.presetKey !== 'string' || typeof preset.name !== 'string' || !preset.map) return;
    if (preset.presetKey !== key) throw new Error(`地图预设“${key}”的 presetKey 不一致。`);
    result[key] = preset as DungeonMapPreset;
  });
  if (!Object.keys(result).length) throw new Error('配置中没有可用地图预设。');
  return result;
};

const selectDevData = (payload: unknown) => (payload as Record<string, unknown>).data;

export const dungeonLibrariesLabModule: LabModule = {
  id: 'dungeon-libraries',
  setup(context) {
    return context.events.on('lab:ready', async () => {
      const [maps, environments, shadows] = await Promise.all([
        loadConfig<unknown>('dungeonMapPresets.json', { devApiPath: '/api/dungeon-map-presets', selectDevPayload: selectDevData }),
        loadConfig<unknown>('sceneEnvironmentPresets.json', { devApiPath: '/api/scene-environment-presets', selectDevPayload: selectDevData }),
        loadConfig<unknown>('shadowQualityPresets.json', { devApiPath: '/api/shadow-quality-presets', selectDevPayload: selectDevData }),
      ]);
      const libraries: DungeonLabLibraries = {
        maps: parseMapLibrary(maps),
        environments: parseSceneEnvironmentPresetLibrary(environments),
        shadows: parseShadowQualityPresetLibrary(shadows),
      };
      context.services.set(DUNGEON_LAB_SERVICES.libraries, libraries);
    });
  },
};
