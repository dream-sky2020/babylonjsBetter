import { DUNGEON_GRID_MEMORY } from '../dungeon-grid/dungeonGrid.memory';
import { DUNGEON_PLAYER_STATE_MEMORY, DUNGEON_OBSTACLE_STATE_MEMORY } from './dungeonRuntime.memory';
import { createLabField, createLabJson, createLabStatus, type LabModule } from '@/tools/lab-kit';
import {
  dungeonMapChangedEvent,
  dungeonRuntimeChangedEvent,
} from '../dungeon-map-loader/dungeonMapLoader.protocol';

const readonlyInput = () => {
  const input = document.createElement('input');
  input.readOnly = true;
  return input;
};

export const dungeonRuntimeLabModule: LabModule = {
  id: 'dungeon-runtime',
  dependencies: ['dungeon-map-loader'],
  setup(context) {
    const gridMemory = context.memory.acquire(DUNGEON_GRID_MEMORY);
    const playerMemory = context.memory.acquire(DUNGEON_PLAYER_STATE_MEMORY);
    const obstacleMemory = context.memory.acquire(DUNGEON_OBSTACLE_STATE_MEMORY);
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
    let currentLoadId: number | null = null;
    const refresh = () => {
      const grid = gridMemory.current, runtime = playerMemory.current, obstacleState = obstacleMemory.current;
      if (!grid || !runtime || !obstacleState || currentLoadId !== grid.loadId
        || currentLoadId !== runtime.loadId || currentLoadId !== obstacleState.loadId) return;
      mapId.value = grid.mapId;
      position.value = `(${runtime.playerPosition.tileX}, ${runtime.playerPosition.tileY})`;
      facing.value = runtime.playerFacing;
      obstacles.value = `${[...obstacleState.states.values()].filter(Boolean).length} / ${obstacleState.states.size} 启用`;
      json.textContent = JSON.stringify({
        loadId: runtime.loadId,
        dungeonPresetKey: runtime.presetKey,
        mapSize: [grid.width, grid.height],
        playerPosition: runtime.playerPosition,
        playerFacing: runtime.playerFacing,
        playerWorldPosition: runtime.playerWorldPosition,
        playerMovement: runtime.playerMovement,
        obstacleStates: Object.fromEntries(obstacleState.states),
      }, null, 2);
    };
    const offMap = context.communication.on(dungeonMapChangedEvent, (next) => {
      const loaded = playerMemory.current;
      if (!loaded || loaded.loadId !== next.loadId) return;
      currentLoadId = loaded.loadId;
      status.textContent = `正在显示地图加载 #${next.loadId} 的 Runtime。`;
      refresh();
    });
    const offChanged = context.communication.on(dungeonRuntimeChangedEvent, (changed) => {
      if (currentLoadId === null || changed.loadId !== currentLoadId) return;
      status.textContent = `Runtime revision ${changed.revision} · ${changed.reason}`;
      refresh();
    });
    return () => { offMap(); offChanged(); panel.root.remove(); };
  },
};
