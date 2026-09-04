import { createLabField, createLabJson, createLabStatus, type LabModule } from '@/tools/lab-kit';
import {
  dungeonMapCatalogRequest,
  dungeonMapChangedEvent,
  dungeonRuntimeChangedEvent,
  dungeonRuntimeSaveStatesRequest,
  dungeonMapSwitchRequest,
} from './dungeonLab.types';

export const dungeonRuntimeSaveSwitchLabModule: LabModule = {
  id: 'dungeon-runtime-save-switch',
  dependencies: ['dungeon-obstacle', 'player-movement'],
  setup(context) {
    const panel = context.ui.addPanel('dungeon-runtime-save-switch', '地牢运行时存档切换');
    const select = document.createElement('select');
    const load = document.createElement('button');
    load.type = 'button';
    load.textContent = '原子切换到所选地牢';
    const json = createLabJson('{}');
    const status = createLabStatus('等待地图加载器……');
    panel.content.append(createLabField('目标地牢', select), load, createLabField('已保存 dungeonSaveStates', json), status);
    const refresh = async () => {
      const saveStates = await context.communication.request(dungeonRuntimeSaveStatesRequest, undefined);
      json.textContent = JSON.stringify(saveStates, null, 2);
    };
    let catalog: readonly { presetKey: string; name: string }[] = [];
    const start = async () => {
      catalog = await context.communication.request(dungeonMapCatalogRequest, undefined);
      select.replaceChildren(...catalog.map((preset) => {
        const option = document.createElement('option');
        option.value = preset.presetKey;
        option.textContent = `${preset.name} · ${preset.presetKey}`;
        return option;
      }));
      status.textContent = '修改当前运行态后切换；返回时恢复玩家与阻碍的动态存档。';
      await refresh();
    };
    load.addEventListener('click', async () => {
      const preset = catalog.find(({ presetKey }) => presetKey === select.value);
      if (!preset) return;
      load.disabled = true;
      status.textContent = `正在加载“${preset.name}”……`;
      try {
        const result = await context.communication.request(dungeonMapSwitchRequest, {
          presetKey: preset.presetKey,
        });
        status.textContent = result.loaded
          ? `地图已切换到“${preset.name}”。`
          : '本次切换已被更新请求取代。';
        await refresh();
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : String(error);
      } finally {
        load.disabled = false;
      }
    });
    const offChanged = context.communication.on(dungeonRuntimeChangedEvent, () => { void refresh(); });
    const offMap = context.communication.on(dungeonMapChangedEvent, () => { void refresh(); });
    return {
      start,
      dispose() { offChanged(); offMap(); },
    };
  },
};
