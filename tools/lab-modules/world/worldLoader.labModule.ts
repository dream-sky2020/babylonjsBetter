import { loadConfig } from '@/core/config';
import { parseWorldPresetLibrary, resolveInitialDungeon, type WorldPreset, type WorldPresetLibrary } from '@/core/world';
import { createLabField, createLabJson, createLabStatus, type LabModule } from '@/tools/lab-kit';
import { dungeonMapCatalogRequest, dungeonMapSwitchRequest } from '@/tools/lab-modules/dungeon';
import { gameRuntimeActivateWorldRequest } from './worldLab.types';

export const worldLoaderLabModule: LabModule = {
  id: 'world-loader',
  dependencies: ['dungeon-map-loader'],
  setup(context) {
    const panel = context.ui.addPanel('world-loader', '世界加载');
    const select = document.createElement('select');
    const initialDungeonKey = document.createElement('input');
    initialDungeonKey.readOnly = true;
    const loadButton = document.createElement('button');
    loadButton.type = 'button';
    loadButton.textContent = '加载世界首次地牢';
    const presetJson = createLabJson();
    const status = createLabStatus('正在读取世界预设……');
    panel.content.append(
      createLabField('世界预设', select),
      createLabField('首次地牢预设 Key', initialDungeonKey),
      loadButton,
      presetJson,
      status,
    );

    let worlds: WorldPresetLibrary | null = null;
    const syncSelectedWorld = () => {
      const preset = worlds?.[select.value];
      try {
        initialDungeonKey.value = preset ? resolveInitialDungeon(preset).dungeonPresetKey : '';
      } catch {
        initialDungeonKey.value = '';
      }
      presetJson.textContent = preset ? JSON.stringify(preset, null, 2) : '尚未选择世界预设。';
    };
    const loadSelectedWorld = async () => {
      const worldPreset = worlds?.[select.value];
      if (!worldPreset) return;
      const initialDungeon = resolveInitialDungeon(worldPreset);
      const catalog = await context.communication.request(dungeonMapCatalogRequest, undefined);
      const dungeonPreset = catalog.find(({ presetKey }) => presetKey === initialDungeon.dungeonPresetKey);
      if (!dungeonPreset) {
        throw new Error(`世界“${worldPreset.presetKey}”引用的首次地牢预设“${initialDungeon.dungeonPresetKey}”不存在。`);
      }
      loadButton.disabled = true;
      status.textContent = `正在加载世界“${worldPreset.name}”的首次地牢……`;
      try {
        if (context.communication.hasHandler(gameRuntimeActivateWorldRequest)) {
          await context.communication.request(gameRuntimeActivateWorldRequest, {
            worldPresetKey: worldPreset.presetKey,
          });
        }
        const result = await context.communication.request(dungeonMapSwitchRequest, {
          presetKey: dungeonPreset.presetKey,
        });
        status.textContent = result.loaded
          ? `世界“${worldPreset.name}”已原子加载首次地牢“${dungeonPreset.name}”。`
          : '首次地牢装载已被更新请求取代。';
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        status.textContent = message;
        context.ui.setStatus(message, true);
      } finally {
        loadButton.disabled = false;
      }
    };
    loadButton.addEventListener('click', () => { void loadSelectedWorld(); });
    select.addEventListener('change', () => {
      syncSelectedWorld();
      void loadSelectedWorld();
    });
    return {
      async start() {
        worlds = parseWorldPresetLibrary(await loadConfig<unknown>('worldPresets.json'));
        select.replaceChildren(...Object.values(worlds).map((preset: WorldPreset) => {
          const option = document.createElement('option');
          option.value = preset.presetKey;
          option.textContent = `${preset.name} · ${preset.presetKey}`;
          return option;
        }));
        syncSelectedWorld();
        await loadSelectedWorld();
      },
    };
  },
};
