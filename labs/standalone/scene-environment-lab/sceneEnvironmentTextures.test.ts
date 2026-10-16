import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveObjectURL } from 'node:buffer';
import { Mesh, NullEngine, RawTexture, Scene, StandardMaterial } from '@babylonjs/core';
import type { SceneEnvironmentInstance } from '@/core/scene/sceneEnvironment.types';
import { collectEnvironmentTextures, releaseTexturePreviews } from './sceneEnvironmentTextures.ts';
import { meshesUvTextures, modelUvCoverage } from './sceneEnvironmentUvCoverage.ts';
test('texture catalog deduplicates GPU resources and UV coverage unions all material users', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const texture = RawTexture.CreateRGBATexture(new Uint8Array(16 * 16 * 4), 16, 16, scene, false); texture.name = 'shared atlas';
    texture.getInternalTexture()!.isReady = true; // NullEngine has no GPU upload completion.
    const matA = new StandardMaterial('A', scene), matB = new StandardMaterial('B', scene); matA.diffuseTexture = matB.diffuseTexture = texture;
    const mesh = (name: string, left: number, right: number, material: StandardMaterial) => { const mesh = new Mesh(name, scene); mesh.setVerticesData('position', [0,0,0, 1,0,0, 1,1,0, 0,1,0]); mesh.setVerticesData('uv', [left,0, right,0, right,1, left,1]); mesh.setIndices([0,1,2,0,2,3]); mesh.material = material; return mesh; };
    const a = mesh('a', 0, 0.25, matA), b = mesh('b', 0.5, 0.75, matB);
    const instance = { models: [{ definition: { id: 'a' }, entity: { meshes: [a] } }, { definition: { id: 'b' }, entity: { meshes: [b] } }], groundMeshes: new Map([['object:ground', a]]) } as unknown as SceneEnvironmentInstance;
    const entries = collectEnvironmentTextures(instance);
    assert.equal(entries.length, 1); assert.equal(entries[0].materialIds.length, 2); assert.equal(entries[0].objectIds.length, 3);
    assert.deepEqual(entries[0].usages, ['底色']);
    const all = meshesUvTextures([a, b, a]);
    assert.equal(modelUvCoverage(all).percent, 50);
    assert.equal(modelUvCoverage(meshesUvTextures([a,b], `material:${matA.uniqueId}`)).percent, 25);
    assert.equal(modelUvCoverage(meshesUvTextures([a,b], undefined, entries[0].id)).percent, 50);
    assert.equal(all[0].regions.length, 2, 'identical instance UV buffers are not rasterized repeatedly');
  } finally { scene.dispose(); engine.dispose(); }
});
test('embedded image previews reuse encoded CPU buffers and owned URLs are released', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const texture = RawTexture.CreateRGBATexture(new Uint8Array(4), 1, 1, scene, false);
    texture.getInternalTexture()!._buffer = new Uint8Array([137,80,78,71,13,10,26,10]);
    const material = new StandardMaterial('material', scene); material.diffuseTexture = texture;
    const mesh = new Mesh('mesh', scene); mesh.setVerticesData('position', [0,0,0,1,0,0,0,1,0]); mesh.setIndices([0,1,2]); mesh.material = material;
    const entries = collectEnvironmentTextures({ models: [{ definition: { id: 'm' }, entity: { meshes: [mesh] } }] } as unknown as SceneEnvironmentInstance);
    assert.equal(entries[0].ownedPreview, true);
    assert.ok(resolveObjectURL(entries[0].preview!));
    releaseTexturePreviews(entries);
    assert.equal(resolveObjectURL(entries[0].preview!), undefined);
  } finally { scene.dispose(); engine.dispose(); }
});
