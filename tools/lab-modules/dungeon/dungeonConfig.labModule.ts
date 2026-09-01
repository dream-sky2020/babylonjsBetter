import { createLabField, createLabStatus, type LabModule } from '@/tools/lab-kit';
import {
  DUNGEON_LAB_SERVICES,
  type DungeonLabLibraries,
  type DungeonLabSessionController,
} from './dungeonLab.types';

export const dungeonConfigLabModule: LabModule = {
  id: 'dungeon-config',
  dependencies: ['dungeon-session'],
  setup(context) {
    const panel = context.ui.addPanel('dungeon-config', '地图与场景');
    const select = document.createElement('select');
    const loadButton = document.createElement('button');
    loadButton.type = 'button';
    loadButton.textContent = '切换地图 Session';
    const status = createLabStatus('正在读取配置……');
    panel.content.append(createLabField('地图预设', select), loadButton, status);

    const loadSelected = async () => {
      const libraries = context.services.get<DungeonLabLibraries>(DUNGEON_LAB_SERVICES.libraries);
      const preset = libraries.maps[select.value];
      if (!preset) return;
      const controller = context.services.get<DungeonLabSessionController>(DUNGEON_LAB_SERVICES.sessionController);
      loadButton.disabled = true;
      status.textContent = `正在构建“${preset.name}”的完整 Session……`;
      try {
        const session = await controller.switchDungeon(preset.presetKey);
        status.textContent = session
          ? `地图“${preset.name}”的 Session 已提交。`
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
    return context.events.on('lab:ready', async () => {
      const libraries = context.services.get<DungeonLabLibraries>(DUNGEON_LAB_SERVICES.libraries);
      select.replaceChildren(...Object.values(libraries.maps).map((preset) => {
        const option = document.createElement('option');
        option.value = preset.presetKey;
        option.textContent = `${preset.name} · ${preset.presetKey}`;
        return option;
      }));
      if (!select.options.length) throw new Error('配置中没有可用地图预设。');
      await loadSelected();
    });
  },
};
