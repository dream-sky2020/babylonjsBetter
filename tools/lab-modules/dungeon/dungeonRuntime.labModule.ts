import { createLabField, createLabJson, createLabStatus, type LabModule } from '@/tools/lab-kit';
import type { DungeonLabSession, DungeonSessionChangedEvent } from './dungeonLab.types';

const readonlyInput = () => {
  const input = document.createElement('input');
  input.readOnly = true;
  return input;
};

export const dungeonRuntimeLabModule: LabModule = {
  id: 'dungeon-runtime',
  dependencies: ['dungeon-session'],
  setup(context) {
    const panel = context.ui.addPanel('dungeon-runtime', '当前地牢运行时');
    const mapId = readonlyInput();
    const position = readonlyInput();
    const facing = readonlyInput();
    const obstacles = readonlyInput();
    const json = createLabJson('尚未提交 DungeonSession。');
    const status = createLabStatus('等待地牢 Session……');
    panel.content.append(
      createLabField('地图 ID', mapId),
      createLabField('玩家位置', position),
      createLabField('玩家朝向', facing),
      createLabField('阻碍状态', obstacles),
      json,
      status,
    );
    let current: DungeonLabSession | null = null;
    const refresh = () => {
      if (!current) return;
      const { runtime } = current;
      mapId.value = runtime.map.id;
      position.value = `(${runtime.playerPosition.tileX}, ${runtime.playerPosition.tileY})`;
      facing.value = runtime.playerFacing;
      obstacles.value = `${[...runtime.obstacleStates.values()].filter(Boolean).length} / ${runtime.obstacleStates.size} 启用`;
      json.textContent = JSON.stringify({
        sessionId: current.sessionId,
        dungeonPresetKey: current.dungeonPresetKey,
        mapSize: [runtime.map.width, runtime.map.height],
        playerPosition: runtime.playerPosition,
        playerFacing: runtime.playerFacing,
        playerWorldPosition: runtime.playerWorldPosition,
        playerMovement: runtime.playerMovement,
        obstacleStates: Object.fromEntries(runtime.obstacleStates),
      }, null, 2);
    };
    const offSession = context.events.on<DungeonSessionChangedEvent>('dungeon:session-changed', ({ current: next }) => {
      current = next;
      status.textContent = `正在显示 Session #${next.sessionId} 的唯一 Runtime。`;
      refresh();
    });
    const offChanged = context.events.on('dungeon:runtime-changed', refresh);
    return () => { offSession(); offChanged(); };
  },
};
