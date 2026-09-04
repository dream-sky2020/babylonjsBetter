import { Color3, MeshBuilder, StandardMaterial, TransformNode } from '@babylonjs/core';
import { createLabJson, createLabSwitch, type LabModule } from '@/tools/lab-kit';
import {
  dungeonMapChangedEvent,
} from '../dungeon-map-loader/dungeonMapLoader.protocol';
import {
  DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY,
  type DungeonMapLoaderReferences,
  type LoadedDungeonReferences,
} from '../dungeon-map-loader/dungeonMapLoader.references';

export const playerSpawnLabModule: LabModule = {
  id: 'player-spawn',
  dependencies: ['dungeon-map-loader'],
  setup(context) {
    const references = context.services.get<DungeonMapLoaderReferences>(
      DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY,
    );
    const panel = context.ui.addPanel('player-spawn', '玩家出生点');
    const toggle = createLabSwitch('显示玩家出生格 Debug 盒');
    const json = createLabJson();
    panel.content.append(toggle.row, json);
    let current: LoadedDungeonReferences | null = null;
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
      const layout = current.spawn.tileWorldLayout;
      const box = MeshBuilder.CreateBox(`player_spawn_debug_box_${current.loadId}`, {
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
    const off = context.communication.on(dungeonMapChangedEvent, (next) => {
      const loaded = references.current;
      if (!loaded || loaded.loadId !== next.loadId) return;
      current = loaded;
      const { spawn } = loaded;
      json.textContent = JSON.stringify({
        dungeonPresetKey: next.presetKey,
        spawnPointEntity: spawn.spawnPointEntity,
        actorSpawnComponent: spawn.actorSpawnComponent,
        tilePosition: spawn.tilePosition,
        worldPosition: spawn.worldPosition,
      }, null, 2);
      render();
    });
    return () => { off(); dispose(); };
  },
};
