import { Color3, MeshBuilder, StandardMaterial, TransformNode } from '@babylonjs/core';
import { moveDungeonPlayer } from '@/core/dungeon-player-movement';
import type { DungeonMapDirection } from '@/core/map';
import { resolveDungeonMapTileWorldLayout } from '@/core/scene';
import { createLabJson, createLabStatus, createLabSwitch, type LabModule } from '@/tools/lab-kit';
import type { DungeonObstaclesReadyEvent } from './dungeonLab.types';

export const playerMovementLabModule: LabModule = {
  id: 'player-movement',
  dependencies: ['dungeon-grid-debug', 'dungeon-obstacle'],
  setup(context) {
    const panel = context.ui.addPanel('player-movement', '玩家移动');
    const boundsToggle = createLabSwitch('限制玩家不能移出地图', true);
    const obstacleToggle = createLabSwitch('限制玩家不能跨越障碍', true);
    const controls = document.createElement('div');
    controls.className = 'lab-movement-grid';
    const directions: ReadonlyArray<readonly [DungeonMapDirection, string]> = [
      ['north', '↑ 北'], ['west', '← 西'], ['south', '↓ 南'], ['east', '→ 东'],
    ];
    directions.forEach(([direction, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.move = direction;
      button.textContent = label;
      controls.append(button);
    });
    const status = createLabStatus('尚未创建 DungeonRuntime。');
    const runtimeJson = createLabJson();
    panel.content.append(boundsToggle.row, obstacleToggle.row, controls, status, runtimeJson);
    let current: DungeonObstaclesReadyEvent | null = null;
    let markerRoot: TransformNode | null = null;
    const disposeMarker = () => {
      markerRoot?.dispose(false, true);
      markerRoot = null;
    };
    const refresh = () => {
      disposeMarker();
      if (!current) return;
      const event = current;
      const layout = resolveDungeonMapTileWorldLayout(
        event.spawn.sceneEnvironmentComponent,
        event.runtime.map.width,
        event.runtime.map.height,
        event.runtime.playerPosition.tileX,
        event.runtime.playerPosition.tileY,
      );
      markerRoot = new TransformNode('composable_player_position', context.scene);
      const material = new StandardMaterial('composable_player_position_material', context.scene);
      material.diffuseColor = Color3.FromHexString('#3dde83');
      material.emissiveColor = Color3.FromHexString('#12683a');
      const marker = MeshBuilder.CreateCylinder('composable_player_position_marker', {
        diameter: Math.min(layout.size[0], layout.size[2]) * 0.18,
        height: Math.max(layout.size[1] * 1.5, 1.2),
      }, context.scene);
      marker.position.set(
        layout.center[0],
        layout.center[1] + layout.size[1] / 2 + Math.max(layout.size[1] * 0.75, 0.6),
        layout.center[2],
      );
      marker.material = material;
      marker.parent = markerRoot;
      marker.isPickable = false;
      runtimeJson.textContent = JSON.stringify({
        mapId: event.runtime.map.id,
        playerPosition: event.runtime.playerPosition,
        obstacleStates: Object.fromEntries(event.runtime.obstacleStates),
      }, null, 2);
    };
    const move = (direction: DungeonMapDirection) => {
      if (!current) return;
      const result = moveDungeonPlayer(current.runtime, direction, {
        restrictToMapBounds: boundsToggle.input.checked,
        restrictMovementObstacles: obstacleToggle.input.checked,
      });
      if (!result.moved) {
        status.textContent = result.blockedReason === 'movement-obstacle'
          ? `移动被阻碍挡住：${result.blockedObstacleIds?.join('、') ?? '未知阻碍'}。`
          : `移动被地图边界阻挡：目标格 (${result.to.tileX}, ${result.to.tileY})。`;
        return;
      }
      refresh();
      status.textContent = `玩家移动到 (${result.to.tileX}, ${result.to.tileY})。`;
      void context.events.emit('dungeon:runtime-changed', { reason: 'player-position', runtime: current.runtime });
    };
    controls.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((button) => {
      button.addEventListener('click', () => move(button.dataset.move as DungeonMapDirection));
    });
    const keyDirections: Readonly<Record<string, DungeonMapDirection>> = {
      ArrowUp: 'north', w: 'north', W: 'north', ArrowRight: 'east', d: 'east', D: 'east',
      ArrowDown: 'south', s: 'south', S: 'south', ArrowLeft: 'west', a: 'west', A: 'west',
    };
    const keyHandler = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
      const direction = keyDirections[event.key];
      if (!direction) return;
      event.preventDefault();
      move(direction);
    };
    window.addEventListener('keydown', keyHandler);
    const offReady = context.events.on<DungeonObstaclesReadyEvent>('dungeon:obstacles-ready', (event) => {
      current = event;
      refresh();
      status.textContent = `玩家已在出生格 (${event.runtime.playerPosition.tileX}, ${event.runtime.playerPosition.tileY}) 创建。`;
    });
    const offChanged = context.events.on('dungeon:runtime-changed', refresh);
    return () => {
      offReady();
      offChanged();
      window.removeEventListener('keydown', keyHandler);
      disposeMarker();
    };
  },
};
