import { Color3, MeshBuilder, StandardMaterial, TransformNode } from '@babylonjs/core';
import { resolveDungeonPlayerSpawn } from '@/core/dungeon-player-spawn';
import { createLabJson, createLabSwitch, type LabModule } from '@/tools/lab-kit';
import {
  DUNGEON_LAB_SERVICES,
  type DungeonSceneReadyEvent,
  type DungeonSpawnReadyEvent,
} from './dungeonLab.types';

export const playerSpawnLabModule: LabModule = {
  id: 'player-spawn',
  dependencies: ['dungeon-scene'],
  setup(context) {
    const panel = context.ui.addPanel('player-spawn', '玩家出生点');
    const toggle = createLabSwitch('显示玩家出生格 Debug 盒');
    const json = createLabJson();
    panel.content.append(toggle.row, json);
    let current: DungeonSpawnReadyEvent | null = null;
    let root: TransformNode | null = null;
    const dispose = () => {
      root?.dispose(false, true);
      root = null;
    };
    const render = () => {
      dispose();
      if (!toggle.input.checked || !current) return;
      root = new TransformNode('player_spawn_debug', context.scene);
      const material = new StandardMaterial('player_spawn_debug_material', context.scene);
      material.diffuseColor = Color3.FromHexString('#ffd34e');
      material.emissiveColor = Color3.FromHexString('#8b5f00');
      material.alpha = 0.36;
      material.wireframe = true;
      const layout = current.spawn.tileWorldLayout;
      const box = MeshBuilder.CreateBox('player_spawn_debug_box', {
        width: layout.size[0], height: layout.size[1], depth: layout.size[2],
      }, context.scene);
      box.position.set(...layout.center);
      box.material = material;
      box.parent = root;
      box.isPickable = false;
      box.enableEdgesRendering();
      box.edgesColor.set(1, 0.82, 0.18, 1);
      box.edgesWidth = 5;
    };
    toggle.input.addEventListener('change', render);
    const offScene = context.events.on<DungeonSceneReadyEvent>('dungeon:scene-ready', async (event) => {
      const spawn = resolveDungeonPlayerSpawn(event.preset.map, event.libraries.environments);
      current = { ...event, spawn };
      context.services.set(DUNGEON_LAB_SERVICES.spawn, spawn);
      json.textContent = JSON.stringify({
        spawnPointEntity: spawn.spawnPointEntity,
        actorSpawnComponent: spawn.actorSpawnComponent,
        tilePosition: spawn.tilePosition,
        worldPosition: spawn.worldPosition,
      }, null, 2);
      render();
      await context.events.emit('dungeon:spawn-ready', current);
    });
    return () => {
      offScene();
      dispose();
    };
  },
};
