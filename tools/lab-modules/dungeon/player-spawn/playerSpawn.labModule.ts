import { DUNGEON_PLAYER_SPAWN_MEMORY, type DungeonPlayerSpawnData } from './playerSpawn.memory';
import { Color3, MeshBuilder, StandardMaterial, TransformNode } from '@babylonjs/core';
import { createLabJson, createLabSwitch, type LabModule } from '@/tools/lab-kit';
import {
  dungeonMapChangedEvent,
} from '../dungeon-map-loader/dungeonMapLoader.protocol';

export const playerSpawnLabModule: LabModule = {
  id: 'player-spawn',
  dependencies: ['dungeon-map-loader'],
  setup(context) {
    const spawnMemory = context.memory.acquire(DUNGEON_PLAYER_SPAWN_MEMORY);
    const panel = context.ui.addPanel('player-spawn', '玩家出生点');
    const toggle = createLabSwitch('显示玩家出生格 Debug 盒', false, {
      preference: { ui: context.ui, key: 'player-spawn/debug-box' },
    });
    const json = createLabJson();
    panel.content.append(toggle.row, json);
    let current: DungeonPlayerSpawnData | null = null;
    let root: TransformNode | null = null;
    const dispose = () => {
      root?.dispose(false, true);
      root = null;
    };
    const render = () => {
      dispose();
      if (!toggle.input.checked || !current) return;
      root = new TransformNode(`player_spawn_debug_${current.loadId}`, context.scene);
      const material = new StandardMaterial(`player_spawn_debug_material_${current.loadId}`, context.scene);
      material.diffuseColor = Color3.FromHexString('#ffd34e');
      material.emissiveColor = Color3.FromHexString('#8b5f00');
      material.alpha = 0.36;
      material.wireframe = true;
      const box = MeshBuilder.CreateBox(`player_spawn_debug_box_${current.loadId}`, {
        width: current.tileSize[0], height: current.tileSize[1], depth: current.tileSize[2],
      }, context.scene);
      box.position.set(...current.worldPosition);
      box.material = material;
      box.parent = root;
      box.isPickable = false;
      box.enableEdgesRendering();
      box.edgesColor.set(1, 0.82, 0.18, 1);
      box.edgesWidth = 5;
    };
    toggle.input.addEventListener('change', render);
    const off = context.communication.on(dungeonMapChangedEvent, (next) => {
      const loaded = spawnMemory.current;
      if (!loaded || loaded.loadId !== next.loadId) return;
      current = loaded;
      json.textContent = JSON.stringify({
        loadId: loaded.loadId,
        dungeonPresetKey: loaded.presetKey,
        spawnPointId: loaded.spawnPointId,
        actorSpawnId: loaded.actorSpawnId,
        tilePosition: loaded.tilePosition,
        worldPosition: loaded.worldPosition,
        tileSize: loaded.tileSize,
      }, null, 2);
      render();
    });
    return () => { off(); toggle.input.removeEventListener('change', render); dispose(); };
  },
};
