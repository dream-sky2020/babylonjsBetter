import { Matrix, MeshBuilder, Vector3, type Mesh, type Scene, type StandardMaterial, type TransformNode } from '@babylonjs/core';
import { resolveDungeonMapTileWorldLayout } from '../../../../core/scene/dungeonMapSceneLayout.ts';
import type { DungeonGridData } from './dungeonGrid.memory.ts';

function* gridChunks({ width, height }: DungeonGridData) {
  const chunkSize = 8;
  for (let startY = 0; startY < height; startY += chunkSize) {
    for (let startX = 0; startX < width; startX += chunkSize) {
      yield { startX, startY, endX: Math.min(startX + chunkSize, width), endY: Math.min(startY + chunkSize, height) };
    }
  }
}

/** Keep tile boxes and their thick edges, with one static instance buffer per spatial chunk.
 * Chunk bounds let Babylon cull parts of larger maps; grid view transforms stay on the parent.
 */
export function createDungeonGridDebugMeshes(scene: Scene, root: TransformNode, grid: DungeonGridData, material: StandardMaterial): Mesh[] {
  const chunks: Mesh[] = [], matrix = Matrix.Identity();
  for (const { startX, startY, endX, endY } of gridChunks(grid)) {
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
  return chunks;
}

/** Four coplanar segments per tile, with a small lift to avoid depth fighting with the floor. */
export function createDungeonGridDebugOutlines(scene: Scene, root: TransformNode, grid: DungeonGridData): Mesh[] {
  const chunks: Mesh[] = [];
  const [width, height, depth] = grid.tileSize;
  for (const { startX, startY, endX, endY } of gridChunks(grid)) {
    const lines: Vector3[][] = [];
    for (let tileY = startY; tileY < endY; tileY++) {
      for (let tileX = startX; tileX < endX; tileX++) {
        const { center: [x, y, z] } = resolveDungeonMapTileWorldLayout(grid, grid.width, grid.height, tileX, tileY);
        const top = y + height / 2 + 0.01;
        const left = x - width / 2, right = x + width / 2;
        const north = z - depth / 2, south = z + depth / 2;
        const start = new Vector3(left, top, north);
        lines.push([
          start,
          new Vector3(right, top, north),
          new Vector3(right, top, south),
          new Vector3(left, top, south),
          start,
        ]);
      }
    }
    const outline = MeshBuilder.CreateLineSystem(`dungeon_grid_debug_${grid.loadId}_${startX}_${startY}`, { lines }, scene);
    outline.parent = root;
    outline.isPickable = false;
    outline.color.set(0.25, 0.82, 1);
    chunks.push(outline);
  }
  return chunks;
}
