import type { WorldRuntime } from '@/core/world-runtime';
import { WORLD_LAB_SERVICES } from '@/tools/lab-modules/world/worldLab.types';
import { createLabField, createLabJson, createLabStatus, type LabModule } from '@/tools/lab-kit';
import {
  DUNGEON_LAB_SERVICES,
  type DungeonLabLibraries,
  type DungeonLabSessionController,
  type DungeonSessionChangedEvent,
} from './dungeonLab.types';

export const dungeonRuntimeSaveSwitchLabModule: LabModule = {
  id: 'dungeon-runtime-save-switch',
  dependencies: ['game-runtime', 'dungeon-obstacle', 'player-movement'],
  setup(context) {
    const panel = context.ui.addPanel('dungeon-runtime-save-switch', '地牢运行时存档切换');
    const select = document.createElement('select');
    const load = document.createElement('button');
    load.type = 'button';
    load.textContent = '原子切换到所选地牢';
    const json = createLabJson('{}');
    const status = createLabStatus('等待 DungeonSessionController……');
    panel.content.append(createLabField('目标地牢', select), load, createLabField('已保存 dungeonSaveStates', json), status);
    const refresh = () => {
      const world = context.services.find<WorldRuntime>(WORLD_LAB_SERVICES.runtime);
      json.textContent = JSON.stringify(world?.dungeonSaveStates ?? {}, null, 2);
    };
    const offReady = context.events.on('lab:ready', () => {
      const libraries = context.services.get<DungeonLabLibraries>(DUNGEON_LAB_SERVICES.libraries);
      select.replaceChildren(...Object.values(libraries.maps).map((preset) => {
        const option = document.createElement('option');
        option.value = preset.presetKey;
        option.textContent = `${preset.name} · ${preset.presetKey}`;
        return option;
      }));
      status.textContent = '修改当前运行态后切换；返回时恢复玩家与阻碍的动态存档。';
      refresh();
    });
    load.addEventListener('click', async () => {
      const libraries = context.services.get<DungeonLabLibraries>(DUNGEON_LAB_SERVICES.libraries);
      const preset = libraries.maps[select.value];
      if (!preset) return;
      const controller = context.services.get<DungeonLabSessionController>(DUNGEON_LAB_SERVICES.sessionController);
      load.disabled = true;
      status.textContent = `正在构建“${preset.name}”的完整 Session……`;
      try {
        const session = await controller.switchDungeon(preset.presetKey);
        status.textContent = session
          ? `Session #${session.sessionId} 已整体切换到“${preset.name}”。`
          : '本次切换已被更新请求取代。';
        refresh();
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : String(error);
      } finally {
        load.disabled = false;
      }
    });
    const offChanged = context.events.on('dungeon:runtime-changed', refresh);
    const offSession = context.events.on<DungeonSessionChangedEvent>('dungeon:session-changed', refresh);
    return () => { offReady(); offChanged(); offSession(); };
  },
};
