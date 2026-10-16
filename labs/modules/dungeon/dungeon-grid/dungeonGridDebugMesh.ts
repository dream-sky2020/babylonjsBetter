import { Matrix, MeshBuilder, type Mesh, type Scene, type StandardMaterial, type TransformNode } from '@babylonjs/core';
import { resolveDungeonMapTileWorldLayout } from '../../../../core/scene/dungeonMapSceneLayout.ts';
import type { DungeonGridData } from './dungeonGrid.memory.ts';

/** Keep tile boxes and their thick edges, with one static instance buffer per spatial chunk.
 * Chunk bounds let Babylon cull parts of larger maps; grid view transforms stay on the parent.
 */
export function createDungeonGridDebugMeshes(scene: Scene, root: TransformNode, grid: DungeonGridData, material: StandardMaterial): Mesh[] {
  const chunks: Mesh[] = [], chunkSize = 8, matrix = Matrix.Identity();
  for (let startY = 0; startY < grid.height; startY += chunkSize) {
    for (let startX = 0; startX < grid.width; startX += chunkSize) {
      const endY = Math.min(startY + chunkSize, grid.height), endX = Math.min(startX + chunkSize, grid.width);
      const data = new Float32Array((endY - startY) * (endX - startX) * 16);
      let index = 0;
      for (let tileY = startY; tileY < endY; tileY++) for (let tileX = startX; tileX < endX; tileX++) {
        const { center } = resolveDungeonMapTileWorldLayout(grid, grid.width, grid.height, tileX, tileY);
        matrix.setTranslationFromFloats(...center); matrix.copyToArray(data, index++ * 16);
      }
      const box = MeshBuilder.CreateBox(`dungeon_grid_debug_${grid.loadId}_${startX}_${startY}`, {
        width: grid.tileSize[0], height: grid.tileSize[1], depth: grid.tileSize[2],
      }, scene);
      box.material = material; box.parent = root; box.isPickable = false;
      box.thinInstanceSetBuffer('matrix', data, 16, true);
      box.enableEdgesRendering(); box.edgesColor.set(0.25, 0.82, 1, 1); box.edgesWidth = 2;
      chunks.push(box);
    }
  }
  return chunks;
}
