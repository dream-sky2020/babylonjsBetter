import { createLabField, createLabJson, createLabStatus, type LabModule } from '@/tools/lab-kit';
import type { DungeonRuntime } from '@/core/dungeon-runtime';
import { DUNGEON_LAB_SERVICES, dungeonMapChangedEvent, dungeonRuntimeChangedEvent } from './dungeonLab.types';

const readonlyInput = () => {
  const input = document.createElement('input');
  input.readOnly = true;
  return input;
};

export const dungeonRuntimeLabModule: LabModule = {
  id: 'dungeon-runtime',
  dependencies: ['dungeon-map-loader'],
  setup(context) {
    const panel = context.ui.addPanel('dungeon-runtime', '当前地牢运行时');
    const mapId = readonlyInput();
    const position = readonlyInput();
    const facing = readonlyInput();
    const obstacles = readonlyInput();
    const json = createLabJson('尚未加载地图。');
    const status = createLabStatus('等待地图……');
    panel.content.append(
      createLabField('地图 ID', mapId),
      createLabField('玩家位置', position),
      createLabField('玩家朝向', facing),
      createLabField('阻碍状态', obstacles),
      json,
      status,
    );
    let current: { loadId: number; presetKey: string; runtime: DungeonRuntime } | null = null;
    const refresh = () => {
      if (!current) return;
      const { runtime } = current;
      mapId.value = runtime.map.id;
      position.value = `(${runtime.playerPosition.tileX}, ${runtime.playerPosition.tileY})`;
      facing.value = runtime.playerFacing;
      obstacles.value = `${[...runtime.obstacleStates.values()].filter(Boolean).length} / ${runtime.obstacleStates.size} 启用`;
      json.textContent = JSON.stringify({
        loadId: current.loadId,
        dungeonPresetKey: current.presetKey,
        mapSize: [runtime.map.width, runtime.map.height],
        playerPosition: runtime.playerPosition,
        playerFacing: runtime.playerFacing,
        playerWorldPosition: runtime.playerWorldPosition,
        playerMovement: runtime.playerMovement,
        obstacleStates: Object.fromEntries(runtime.obstacleStates),
      }, null, 2);
    };
    const offMap = context.communication.on(dungeonMapChangedEvent, (next) => {
      const runtime = context.services.get<DungeonRuntime>(DUNGEON_LAB_SERVICES.runtime);
      current = { loadId: next.loadId, presetKey: next.presetKey, runtime };
      status.textContent = `正在显示地图加载 #${next.loadId} 的 Runtime。`;
      refresh();
    });
    const offChanged = context.communication.on(dungeonRuntimeChangedEvent, (changed) => {
      if (!current || changed.loadId !== current.loadId) return;
      status.textContent = `Runtime revision ${changed.revision} · ${changed.reason}`;
      refresh();
    });
    return () => { offMap(); offChanged(); };
  },
};
