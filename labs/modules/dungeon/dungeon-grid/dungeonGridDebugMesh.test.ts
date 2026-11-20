import test from 'node:test';
import assert from 'node:assert/strict';
import { Matrix, NullEngine, Scene, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import { createDungeonGridDebugMeshes, createDungeonGridDebugOutlines } from './dungeonGridDebugMesh.ts';
import { resolveDungeonMapTileWorldLayout } from '../../../../core/scene/dungeonMapSceneLayout.ts';
import type { DungeonGridData } from './dungeonGrid.memory.ts';

test('chunked grid keeps all tile positions, styles, parent view and cleanup with nine meshes instead of 361', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const grid: DungeonGridData = { loadId: 1, presetKey: 'test', mapId: 'test', width: 19, height: 19,
      tileIds: Array.from({ length: 361 }, (_, i) => String(i)), mapAnchorMode: 'map-center',
      mapOffset: [3, 2, 5], tileSpacing: [8, 6], tileSize: [7.5, .5, 5.5] };
    const root = new TransformNode('grid', scene), material = new StandardMaterial('grid', scene);
    const chunks = createDungeonGridDebugMeshes(scene, root, grid, material);
    assert.equal(chunks.length, 9); assert.equal(scene.meshes.length, 9);
    assert.equal(chunks.reduce((n, mesh) => n + mesh.thinInstanceCount, 0), 361);
    const positions = chunks.flatMap(mesh => {
      assert.equal(mesh.parent, root); assert.equal(mesh.material, material); assert.equal(mesh.isPickable, false);
      assert.ok(mesh.edgesRenderer?.isEnabled); assert.equal(mesh.edgesWidth, 2); assert.equal(mesh.edgesColor.a, 1);
      return mesh.thinInstanceGetWorldMatrices().map(matrix => matrix.getTranslation().asArray().join(','));
    });
    const expected = Array.from({ length: 361 }, (_, i) => resolveDungeonMapTileWorldLayout(grid, 19, 19, i % 19, Math.floor(i / 19)).center.join(','));
    assert.deepEqual(positions.sort(), expected.sort());
    const before = chunks[0].thinInstanceGetWorldMatrices()[0].clone();
    root.scaling.z = 2; root.position.x = 10; root.computeWorldMatrix(true);
    const displayed = before.multiply(chunks[0].computeWorldMatrix(true));
    const point = Vector3.TransformCoordinates(Vector3.Zero(), displayed);
    assert.equal(point.x, before.getTranslation().x + 10); assert.equal(point.z, before.getTranslation().z * 2);
    assert.ok(chunks[0].getBoundingInfo().boundingBox.minimum.x < chunks[0].getBoundingInfo().boundingBox.maximum.x);
    assert.deepEqual(before.asArray(), chunks[0].thinInstanceGetWorldMatrices()[0].asArray());
    assert.notDeepEqual(displayed.asArray(), Matrix.Identity().asArray());
    root.dispose(false, false); assert.equal(scene.meshes.length, 0); assert.ok(chunks.every(mesh => mesh.isDisposed()));
    assert.ok(scene.materials.includes(material)); material.dispose();
  } finally { scene.dispose(); engine.dispose(); }
});

test('flat grid draws four coplanar outline segments per tile and keeps the gaps between tiles', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const grid: DungeonGridData = { loadId: 2, presetKey: 'flat', mapId: 'flat', width: 9, height: 1,
      tileIds: Array.from({ length: 9 }, (_, i) => String(i)), mapAnchorMode: 'first-tile',
      mapOffset: [3, 2, 5], tileSpacing: [8, 6], tileSize: [7.5, .5, 5.5] };
    const root = new TransformNode('flat-grid', scene);
    const chunks = createDungeonGridDebugOutlines(scene, root, grid);
    assert.equal(chunks.length, 2);
    assert.equal(chunks.reduce((count, mesh) => count + mesh.getTotalIndices(), 0), 9 * 4 * 2);
    for (const mesh of chunks) {
      assert.equal(mesh.parent, root);
      assert.equal(mesh.isPickable, false);
      const vertices = mesh.getVerticesData('position')!;
      const indices = mesh.getIndices()!;
      for (let i = 1; i < vertices.length; i += 3) {
        assert.ok(Math.abs(vertices[i] - 2.51) < 1e-6);
      }
      for (let i = 0; i < indices.length; i += 2) {
        const from = indices[i] * 3, to = indices[i + 1] * 3;
        const dx = Math.abs(vertices[from] - vertices[to]);
        const dz = Math.abs(vertices[from + 2] - vertices[to + 2]);
        assert.ok((dx === 7.5 && dz === 0) || (dx === 0 && dz === 5.5));
      }
    }
    const firstChunk = chunks[0].getVerticesData('position')!;
    assert.equal(firstChunk[15] - firstChunk[3], 0.5);
    root.dispose(false, false);
    assert.equal(scene.meshes.length, 0);
  } finally { scene.dispose(); engine.dispose(); }
});
