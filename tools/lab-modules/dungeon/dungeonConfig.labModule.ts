import { loadConfig } from '@/core/config';
import type { DungeonMapPreset, DungeonMapPresetLibrary } from '@/core/map';
import { parseSceneEnvironmentPresetLibrary, parseShadowQualityPresetLibrary } from '@/core/scene';
import { createLabField, createLabStatus, type LabModule } from '@/tools/lab-kit';
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
  return result;
};

const selectDevData = (payload: unknown) => (payload as Record<string, unknown>).data;

export const dungeonConfigLabModule: LabModule = {
  id: 'dungeon-config',
  setup(context) {
    const panel = context.ui.addPanel('dungeon-config', '地图与场景');
    const select = document.createElement('select');
    const loadButton = document.createElement('button');
    loadButton.type = 'button';
    loadButton.textContent = '加载地图与场景';
    const status = createLabStatus('正在读取配置……');
    panel.content.append(createLabField('地图预设', select), loadButton, status);
    let libraries: DungeonLabLibraries | null = null;
    let generation = 0;
    const loadSelected = async () => {
      const preset = libraries?.maps[select.value];
      if (!preset || !libraries) return;
      const currentGeneration = ++generation;
      loadButton.disabled = true;
      status.textContent = `正在加载“${preset.name}”……`;
      context.services.set(DUNGEON_LAB_SERVICES.preset, preset);
      try {
        await context.events.emit('dungeon:map-requested', { preset, libraries });
        if (generation === currentGeneration) status.textContent = `地图“${preset.name}”已完成模块化加载。`;
      } catch (error) {
        if (generation === currentGeneration) {
          const message = error instanceof Error ? error.message : String(error);
          status.textContent = message;
          context.ui.setStatus(message, true);
        }
      } finally {
        if (generation === currentGeneration) loadButton.disabled = false;
      }
    };
    loadButton.addEventListener('click', () => { void loadSelected(); });
    select.addEventListener('change', () => { void loadSelected(); });
    const offReady = context.events.on('lab:ready', async () => {
      const [maps, environments, shadows] = await Promise.all([
        loadConfig<unknown>('dungeonMapPresets.json', { devApiPath: '/api/dungeon-map-presets', selectDevPayload: selectDevData }),
        loadConfig<unknown>('sceneEnvironmentPresets.json', { devApiPath: '/api/scene-environment-presets', selectDevPayload: selectDevData }),
        loadConfig<unknown>('shadowQualityPresets.json', { devApiPath: '/api/shadow-quality-presets', selectDevPayload: selectDevData }),
      ]);
      libraries = {
        maps: parseMapLibrary(maps),
        environments: parseSceneEnvironmentPresetLibrary(environments),
        shadows: parseShadowQualityPresetLibrary(shadows),
      };
      context.services.set(DUNGEON_LAB_SERVICES.libraries, libraries);
      select.replaceChildren(...Object.values(libraries.maps).map((preset) => {
        const option = document.createElement('option');
        option.value = preset.presetKey;
        option.textContent = `${preset.name} · ${preset.presetKey}`;
        return option;
      }));
      if (!select.options.length) throw new Error('配置中没有可用地图预设。');
      await loadSelected();
    });
    return offReady;
  },
};
