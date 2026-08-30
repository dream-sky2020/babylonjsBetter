import { createLabField, createLabJson, type LabModule } from '@/tools/lab-kit';
import {
  createDungeonMapSceneEnvironmentAsync,
  resolveDungeonMapSceneEnvironment,
  type DungeonMapSceneEnvironmentInstance,
} from '@/core/scene';
import {
  DUNGEON_LAB_SERVICES,
  type DungeonMapRequestedEvent,
  type DungeonSceneReadyEvent,
} from './dungeonLab.types';

export const dungeonSceneLabModule: LabModule = {
  id: 'dungeon-scene',
  dependencies: ['dungeon-config'],
  setup(context) {
    const panel = context.ui.addPanel('dungeon-scene', '场景环境组件');
    const keyRow = document.createElement('div');
    keyRow.className = 'lab-key-row';
    const keyInput = document.createElement('input');
    keyInput.readOnly = true;
    keyInput.spellcheck = false;
    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.textContent = '复制';
    keyRow.append(keyInput, copyButton);
    const bindingJson = createLabJson();
    const presetJson = createLabJson();
    panel.content.append(
      createLabField('解析出的场景 Key', keyRow),
      createLabField('地图实体与环境组件', bindingJson),
      createLabField('加载的场景预设', presetJson),
    );
    copyButton.addEventListener('click', () => {
      if (keyInput.value) void navigator.clipboard.writeText(keyInput.value);
    });
    let instance: DungeonMapSceneEnvironmentInstance | null = null;
    let generation = 0;
    const off = context.events.on<DungeonMapRequestedEvent>('dungeon:map-requested', async ({ preset, libraries }) => {
      const currentGeneration = ++generation;
      const binding = resolveDungeonMapSceneEnvironment(preset.map, libraries.environments);
      keyInput.value = binding.component.presetKey;
      bindingJson.textContent = JSON.stringify({
        sceneKey: binding.component.presetKey,
        mapEntity: binding.mapEntity,
        sceneEnvironmentComponent: binding.component,
      }, null, 2);
      presetJson.textContent = JSON.stringify(binding.preset, null, 2);
      const next = await createDungeonMapSceneEnvironmentAsync(context.scene, preset.map, libraries.environments, {
        shadowQualityPresets: libraries.shadows,
      });
      if (currentGeneration !== generation) {
        next.dispose();
        return;
      }
      instance?.dispose();
      instance = next;
      context.services.set(DUNGEON_LAB_SERVICES.sceneBinding, binding);
      context.services.set(DUNGEON_LAB_SERVICES.sceneInstance, next);
      const payload: DungeonSceneReadyEvent = { preset, libraries, binding, instance: next };
      await context.events.emit('dungeon:scene-ready', payload);
    });
    return () => {
      off();
      instance?.dispose();
    };
  },
};
