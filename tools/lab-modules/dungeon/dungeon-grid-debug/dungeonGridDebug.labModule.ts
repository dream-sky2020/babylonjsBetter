import { Color3, MeshBuilder, StandardMaterial, TransformNode } from '@babylonjs/core';
import { resolveDungeonMapTileWorldLayout } from '@/core/scene';
import { createLabSwitch, type LabModule } from '@/tools/lab-kit';
import {
  dungeonMapChangedEvent,
} from '../dungeon-map-loader/dungeonMapLoader.protocol';
import {
  DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY,
  type DungeonMapLoaderReferences,
  type LoadedDungeonReferences,
} from '../dungeon-map-loader/dungeonMapLoader.references';

export const dungeonGridDebugLabModule: LabModule = {
  id: 'dungeon-grid-debug',
  dependencies: ['dungeon-map-loader'],
  setup(context) {
    const references = context.services.get<DungeonMapLoaderReferences>(
      DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY,
    );
    const panel = context.ui.addPanel('dungeon-grid-debug', '地图 Debug');
    const toggle = createLabSwitch('显示全部格子 Debug 盒');
    panel.content.append(toggle.row);
    let root: TransformNode | null = null;
    let current: LoadedDungeonReferences | null = null;
    const dispose = () => {
      root?.dispose(false, true);
      root = null;
    };
    const render = () => {
      dispose();
      if (!toggle.input.checked || !current) return;
      const loaded = current;
      root = new TransformNode(`dungeon_grid_debug_${loaded.loadId}`, context.scene);
      const material = new StandardMaterial(`dungeon_grid_debug_material_${loaded.loadId}`, context.scene);
      material.diffuseColor = Color3.FromHexString('#36bff2');
      material.emissiveColor = Color3.FromHexString('#17698a');
      material.alpha = 0.2;
      material.wireframe = true;
      loaded.map.tiles.forEach((tile) => {
        const layout = resolveDungeonMapTileWorldLayout(
          loaded.sceneBinding.component,
          loaded.map.width,
          loaded.map.height,
          tile.x,
          tile.y,
        );
        const box = MeshBuilder.CreateBox(`dungeon_grid_debug_${loaded.loadId}_${tile.x}_${tile.y}`, {
          width: layout.size[0], height: layout.size[1], depth: layout.size[2],
        }, context.scene);
        box.position.set(...layout.center);
        box.material = material;
        box.parent = root;
        box.isPickable = false;
        box.enableEdgesRendering();
        box.edgesColor.set(0.25, 0.82, 1, 1);
        box.edgesWidth = 2;
      });
    };
    toggle.input.addEventListener('change', render);
    const off = context.communication.on(dungeonMapChangedEvent, (next) => {
      const loaded = references.current;
      if (!loaded || loaded.loadId !== next.loadId) return;
      current = loaded;
      render();
    });
    return () => { off(); dispose(); };
  },
};
