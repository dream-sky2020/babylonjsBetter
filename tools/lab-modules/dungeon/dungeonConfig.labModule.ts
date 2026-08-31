import { createLabField, createLabStatus, type LabModule } from '@/tools/lab-kit';
import { DUNGEON_LAB_SERVICES, type DungeonLabLibraries } from './dungeonLab.types';

export const dungeonConfigLabModule: LabModule = {
  id: 'dungeon-config',
  dependencies: ['dungeon-libraries'],
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
      libraries = context.services.get<DungeonLabLibraries>(DUNGEON_LAB_SERVICES.libraries);
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
