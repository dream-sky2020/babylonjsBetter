import type { LabModule } from '@/labs/kit';
import { LAB_UI_RUNTIME, type LabUiOverlay } from '@/labs/modules/shared/ui-runtime/uiRuntime.service';
import { DUNGEON_SESSION_INFO_MEMORY } from '../dungeon-map-loader/dungeonSession.memory';
import { DUNGEON_LIBRARIES_MEMORY } from '../dungeon-libraries/dungeonLibraries.memory';
import { dungeonMapChangedEvent, dungeonMapSwitchRequest } from '../dungeon-map-loader/dungeonMapLoader.protocol';

/** Demonstrates the UI bridge without giving the document access to domain state. */
export const dungeonHudLabModule: LabModule = {
  id: 'dungeon-hud', dependencies: ['ui-runtime', 'dungeon-config'],
  setup(context) {
    const ui = context.services.get(LAB_UI_RUNTIME);
    const session = context.memory.acquire(DUNGEON_SESSION_INFO_MEMORY), libraries = context.memory.acquire(DUNGEON_LIBRARIES_MEMORY);
    let overlay: LabUiOverlay | null = null, disposed = false, switching = false;
    const refresh = () => overlay?.update({ 'map.name': `地图：${session.current.mapId ?? '未加载'}`, 'map.status': `状态：${session.current.status}` });
    const off = context.communication.on(dungeonMapChangedEvent, refresh);
    return { async start() {
      const result = await ui.open({ id: 'dungeon-hud', presetKey: 'dungeon_hud_demo', onAction: async action => {
        if (action !== 'map.next' || switching) return;
        const presets = Object.keys(libraries.current?.maps ?? {}); if (!presets.length) return;
        const next = presets[(presets.indexOf(session.current.presetKey ?? '') + 1) % presets.length];
        switching = true; try { await context.communication.request(dungeonMapSwitchRequest, { presetKey: next }); refresh(); } finally { switching = false; }
      } });
      if (disposed) { result.dispose(); return; } overlay = result; refresh();
    }, dispose() { disposed = true; off(); overlay?.dispose(); } };
  },
};
