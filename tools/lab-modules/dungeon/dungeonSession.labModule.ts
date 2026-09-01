import { DungeonSessionController } from '@/core/dungeon-session';
import { createWorldRuntime, type WorldRuntime } from '@/core/world-runtime';
import { WORLD_LAB_SERVICES, type GameRuntimeReadyEvent } from '@/tools/lab-modules/world/worldLab.types';
import { createLabField, createLabJson, createLabStatus, type LabModule } from '@/tools/lab-kit';
import { DUNGEON_LAB_SERVICES, type DungeonLabLibraries } from './dungeonLab.types';

export const dungeonSessionLabModule: LabModule = {
  id: 'dungeon-session',
  dependencies: ['dungeon-libraries'],
  setup(context) {
    const panel = context.ui.addPanel('dungeon-session', '地牢 Session');
    const sessionKey = document.createElement('input');
    sessionKey.readOnly = true;
    const sceneKey = document.createElement('input');
    sceneKey.readOnly = true;
    const json = createLabJson('尚未提交 DungeonSession。');
    const status = createLabStatus('等待 WorldRuntime 与地牢装载……');
    panel.content.append(
      createLabField('当前 Session', sessionKey),
      createLabField('场景预设', sceneKey),
      json,
      status,
    );

    let controller: DungeonSessionController | null = null;
    let unsubscribe: (() => void) | null = null;
    const install = (worldRuntime: WorldRuntime) => {
      controller?.dispose();
      unsubscribe?.();
      const libraries = context.services.get<DungeonLabLibraries>(DUNGEON_LAB_SERVICES.libraries);
      controller = new DungeonSessionController({ scene: context.scene, worldRuntime, libraries });
      context.services.set(DUNGEON_LAB_SERVICES.sessionController, controller);
      unsubscribe = controller.subscribe(async ({ previous, current }) => {
        context.services.set(DUNGEON_LAB_SERVICES.preset, current.preset);
        context.services.set(DUNGEON_LAB_SERVICES.session, current);
        context.services.set(DUNGEON_LAB_SERVICES.sceneBinding, current.binding);
        context.services.set(DUNGEON_LAB_SERVICES.sceneInstance, current.instance);
        context.services.set(DUNGEON_LAB_SERVICES.spawn, current.spawn);
        context.services.set(DUNGEON_LAB_SERVICES.runtime, current.runtime);
        context.services.set(DUNGEON_LAB_SERVICES.obstacles, current.obstacles);
        sessionKey.value = `#${current.sessionId} · ${current.dungeonPresetKey}`;
        sceneKey.value = current.binding.component.presetKey;
        json.textContent = JSON.stringify({
          sessionId: current.sessionId,
          dungeonPresetKey: current.dungeonPresetKey,
          mapId: current.preset.map.id,
          mapSize: [current.preset.map.width, current.preset.map.height],
          obstacleIds: current.obstacles.map(({ entity }) => entity.id),
          deltaWarnings: current.deltaWarnings,
        }, null, 2);
        status.textContent = current.deltaWarnings.length
          ? `Session 已提交；${current.deltaWarnings.join(' ')}`
          : `Session 已原子切换到“${current.preset.name}”。`;
        await context.events.emit('dungeon:session-changed', { previous, current });
      });
    };

    const offGame = context.events.on<GameRuntimeReadyEvent>('game:runtime-ready', ({ worldRuntime }) => {
      install(worldRuntime);
    });
    const offReady = context.events.on('lab:ready', () => {
      if (controller) return;
      const standaloneWorld = createWorldRuntime('lab:standalone');
      context.services.set(WORLD_LAB_SERVICES.runtime, standaloneWorld);
      install(standaloneWorld);
    });
    return () => {
      offGame();
      offReady();
      unsubscribe?.();
      controller?.dispose();
    };
  },
};
