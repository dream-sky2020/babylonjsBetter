import { createDungeonRuntime, type DungeonRuntime } from '@/core/dungeon-runtime';
import { createLabField, createLabJson, createLabStatus, type LabModule } from '@/tools/lab-kit';
import {
  DUNGEON_LAB_SERVICES,
  type DungeonObstaclesReadyEvent,
  type DungeonRuntimeReadyEvent,
  type DungeonSpawnReadyEvent,
} from './dungeonLab.types';

const readonlyInput = (): HTMLInputElement => {
  const input = document.createElement('input');
  input.readOnly = true;
  return input;
};

const runtimeSnapshot = (runtime: DungeonRuntime) => ({
  map: { id: runtime.map.id, width: runtime.map.width, height: runtime.map.height },
  playerPosition: runtime.playerPosition,
  playerFacing: runtime.playerFacing,
  playerWorldPosition: runtime.playerWorldPosition,
  playerWorldRotationY: runtime.playerWorldRotationY,
  playerMovement: runtime.playerMovement,
  obstacleStates: Object.fromEntries(runtime.obstacleStates),
});

export const dungeonRuntimeLabModule: LabModule = {
  id: 'dungeon-runtime',
  dependencies: ['player-spawn'],
  setup(context) {
    const panel = context.ui.addPanel('dungeon-runtime', '地牢动态数据');
    const mapId = readonlyInput();
    const tilePosition = readonlyInput();
    const facing = readonlyInput();
    const worldPosition = readonlyInput();
    const worldRotation = readonlyInput();
    const movement = readonlyInput();
    const obstacles = readonlyInput();
    const json = createLabJson('尚未创建 DungeonRuntime。');
    const status = createLabStatus('等待玩家出生点，随后由本模块创建 Runtime……');
    panel.content.append(
      createLabField('地图 ID', mapId),
      createLabField('玩家权威格子位置', tilePosition),
      createLabField('玩家朝向', facing),
      createLabField('玩家连续世界位置', worldPosition),
      createLabField('玩家连续 Y 轴旋转', worldRotation),
      createLabField('当前移动状态', movement),
      createLabField('阻碍运行时状态', obstacles),
      json,
      status,
    );

    let runtime: DungeonRuntime | null = null;
    let refreshElapsedSeconds = 0;
    const refresh = () => {
      if (!runtime) return;
      mapId.value = runtime.map.id;
      tilePosition.value = `(${runtime.playerPosition.tileX}, ${runtime.playerPosition.tileY})`;
      facing.value = runtime.playerFacing;
      worldPosition.value = runtime.playerWorldPosition.map((value) => value.toFixed(3)).join(', ');
      worldRotation.value = `${runtime.playerWorldRotationY.toFixed(4)} rad`;
      movement.value = runtime.playerMovement
        ? `${runtime.playerMovement.kind} · ${runtime.playerMovement.elapsedSeconds.toFixed(3)}s`
        : 'idle';
      const activeObstacles = [...runtime.obstacleStates.values()].filter(Boolean).length;
      obstacles.value = `${activeObstacles} / ${runtime.obstacleStates.size} 启用`;
      json.textContent = JSON.stringify(runtimeSnapshot(runtime), null, 2);
    };
    const offSpawn = context.events.on<DungeonSpawnReadyEvent>('dungeon:spawn-ready', async (event) => {
      runtime = createDungeonRuntime(event.preset.map, event.spawn);
      context.services.set(DUNGEON_LAB_SERVICES.runtime, runtime);
      const readyEvent: DungeonRuntimeReadyEvent = { ...event, runtime };
      status.textContent = `已创建地图“${event.preset.name}”的唯一 DungeonRuntime。`;
      refresh();
      await context.events.emit('dungeon:runtime-ready', readyEvent);
    });
    const offObstacles = context.events.on<DungeonObstaclesReadyEvent>('dungeon:obstacles-ready', (event) => {
      runtime = event.runtime;
      refresh();
    });
    const offChanged = context.events.on<{ runtime: DungeonRuntime }>('dungeon:runtime-changed', (event) => {
      runtime = event.runtime;
      refresh();
    });
    const frameObserver = context.scene.onBeforeRenderObservable.add(() => {
      if (!runtime?.playerMovement) return;
      refreshElapsedSeconds += context.engine.getDeltaTime() / 1000;
      if (refreshElapsedSeconds >= 0.1) { refreshElapsedSeconds = 0; refresh(); }
    });
    return () => {
      offSpawn();
      offObstacles();
      offChanged();
      context.scene.onBeforeRenderObservable.remove(frameObserver);
    };
  },
};
