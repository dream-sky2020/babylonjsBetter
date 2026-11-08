import { Color3, MeshBuilder, PointLight, StandardMaterial, TransformNode, Vector3, type Scene } from '@babylonjs/core';
import { applyDungeonViewToNode, type ResolvedDungeonView } from '@/core/dungeon-view/dungeonOverheadView';
import { resolveDungeonMapTileWorldLayout } from '@/core/scene/dungeonMapSceneLayout';
import type { DungeonGridData } from '../dungeon-grid/dungeonGrid.memory';

export function createDungeonInteractionLamps(scene: Scene) {
  let root: TransformNode | null = null;
  let view: ResolvedDungeonView | null = null;
  const lit = new Set<string>();
  return {
    setView(next: ResolvedDungeonView | null) {
      view = next;
      if (root) applyDungeonViewToNode(root, view);
    },
    light(entityId: string, grid: DungeonGridData, position: { tileX: number; tileY: number }) {
      const key = `${entityId}:${position.tileX},${position.tileY}`;
      if (lit.has(key)) return;
      if (!root) {
        root = new TransformNode('dungeon-interaction-lamps', scene);
        applyDungeonViewToNode(root, view);
      }
      const tile = resolveDungeonMapTileWorldLayout(grid, grid.width, grid.height, position.tileX, position.tileY);
      const diameter = Math.min(tile.size[0], tile.size[2]) * .24;
      const bulb = MeshBuilder.CreateSphere(`interaction-lamp:${key}`, { diameter, segments: 12 }, scene);
      bulb.parent = root;
      bulb.position.set(tile.center[0], tile.center[1] + tile.size[1] / 2 + diameter / 2, tile.center[2]);
      bulb.isPickable = false;
      const material = new StandardMaterial(`interaction-lamp-material:${key}`, scene);
      material.disableLighting = true;
      material.emissiveColor = Color3.FromHexString('#ffdc75');
      bulb.material = material;
      const light = new PointLight(`interaction-lamp-light:${key}`, Vector3.Zero(), scene);
      light.parent = bulb;
      light.diffuse = material.emissiveColor;
      light.range = diameter * 5;
      light.intensity = 1.2;
      lit.add(key);
    },
    clear() {
      root?.dispose(false, true);
      root = null;
      lit.clear();
    },
  };
}
