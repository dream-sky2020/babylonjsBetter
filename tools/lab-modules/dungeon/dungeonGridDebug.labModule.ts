import { Color3, MeshBuilder, StandardMaterial, TransformNode } from '@babylonjs/core';
import { resolveDungeonMapTileWorldLayout } from '@/core/scene';
import { createLabSwitch, type LabModule } from '@/tools/lab-kit';
import type { DungeonSceneReadyEvent } from './dungeonLab.types';

export const dungeonGridDebugLabModule: LabModule = {
  id: 'dungeon-grid-debug',
  dependencies: ['dungeon-scene'],
  setup(context) {
    const panel = context.ui.addPanel('dungeon-grid-debug', '地图 Debug');
    const toggle = createLabSwitch('显示全部格子 Debug 盒');
    panel.content.append(toggle.row);
    let root: TransformNode | null = null;
    let current: DungeonSceneReadyEvent | null = null;
    const dispose = () => {
      root?.dispose(false, true);
      root = null;
    };
    const render = () => {
      dispose();
      if (!toggle.input.checked || !current) return;
      root = new TransformNode(`dungeon_grid_debug_${current.preset.presetKey}`, context.scene);
      const material = new StandardMaterial(`dungeon_grid_debug_material_${current.preset.presetKey}`, context.scene);
      material.diffuseColor = Color3.FromHexString('#36bff2');
      material.emissiveColor = Color3.FromHexString('#17698a');
      material.alpha = 0.2;
      material.wireframe = true;
      current.preset.map.tiles.forEach((tile) => {
        const layout = resolveDungeonMapTileWorldLayout(
          current!.binding.component,
          current!.preset.map.width,
          current!.preset.map.height,
          tile.x,
          tile.y,
        );
        const box = MeshBuilder.CreateBox(`dungeon_grid_debug_${tile.x}_${tile.y}`, {
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
    const off = context.events.on<DungeonSceneReadyEvent>('dungeon:scene-ready', (event) => {
      current = event;
      render();
    });
    return () => {
      off();
      dispose();
    };
  },
};
