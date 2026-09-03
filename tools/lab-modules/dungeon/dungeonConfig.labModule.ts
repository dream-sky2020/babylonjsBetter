import { createLabField, createLabStatus, type LabModule } from '@/tools/lab-kit';
import {
  dungeonMapCatalogRequest,
  dungeonMapSwitchRequest,
} from './dungeonLab.types';

export const dungeonConfigLabModule: LabModule = {
  id: 'dungeon-config',
  dependencies: ['dungeon-map-loader'],
  setup(context) {
    const panel = context.ui.addPanel('dungeon-config', '地图与场景');
    const select = document.createElement('select');
    const loadButton = document.createElement('button');
    loadButton.type = 'button';
    loadButton.textContent = '切换地图';
    const status = createLabStatus('正在读取配置……');
    panel.content.append(createLabField('地图预设', select), loadButton, status);

    const loadSelected = async () => {
      const catalog = await context.communication.request(dungeonMapCatalogRequest, undefined);
      const preset = catalog.find(({ presetKey }) => presetKey === select.value);
      if (!preset) return;
      loadButton.disabled = true;
      status.textContent = `正在加载“${preset.name}”……`;
      try {
        const result = await context.communication.request(dungeonMapSwitchRequest, {
          presetKey: preset.presetKey,
        });
        status.textContent = result.loaded
          ? `地图“${preset.name}”已加载。`
          : '本次切换已被更新的请求取代。';
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        status.textContent = message;
        context.ui.setStatus(message, true);
      } finally {
        loadButton.disabled = false;
      }
    };
    loadButton.addEventListener('click', () => { void loadSelected(); });
    select.addEventListener('change', () => { void loadSelected(); });
    return {
      async start() {
        const catalog = await context.communication.request(dungeonMapCatalogRequest, undefined);
        select.replaceChildren(...catalog.map((preset) => {
          const option = document.createElement('option');
          option.value = preset.presetKey;
          option.textContent = `${preset.name} · ${preset.presetKey}`;
          return option;
        }));
        if (!select.options.length) throw new Error('配置中没有可用地图预设。');
        await loadSelected();
      },
    };
  },
};
