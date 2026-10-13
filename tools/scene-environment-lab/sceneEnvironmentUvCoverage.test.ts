import test from 'node:test';
import assert from 'node:assert/strict';
import { modelUvCoverage, textureUvCoverage, modelUvTextures, type UvRegion, type UvTexture } from './sceneEnvironmentUvCoverage.ts';

const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const region = (uv: number[], changes: Partial<UvRegion> = {}): UvRegion => ({ uv, indices: null, start: 0, count: uv.length / 2, matrix, wrapU: 0, wrapV: 0, ...changes });
const texture = (regions: UvRegion[], pixels = 100): UvTexture => ({ name: 'test', pixels, regions });
const rectangle = (left = 0, right = 1) => [left, 0, right, 0, right, 1, left, 0, right, 1, left, 1];

test('coverage measures triangle union rather than UV bounds or overlapping area sum', () => {
  const triangle = region([0, 0, 1, 0, 0, 1]);
  const half = textureUvCoverage(texture([triangle]))!;
  assert.ok(Math.abs(half - 50) < 1);
  assert.equal(textureUvCoverage(texture([triangle, triangle])), half);
  assert.equal(textureUvCoverage(texture([region(rectangle())])), 100);
  assert.equal(textureUvCoverage(texture([region(rectangle(0, 0.25))])), 25);
});

test('texture transform, repeat, mirror, clamp and indexed submesh ranges', () => {
  const shifted = [...matrix]; shifted[8] = 1;
  assert.equal(textureUvCoverage(texture([region(rectangle(), { matrix: shifted })])), 0);
  assert.equal(textureUvCoverage(texture([region(rectangle(), { matrix: shifted, wrapU: 1 })])), 100);
  assert.equal(textureUvCoverage(texture([region(rectangle(1, 1.25), { wrapU: 2 })])), 25);
  assert.equal(textureUvCoverage(texture([region(rectangle(-0.5, 0.5))])), 50);
  assert.equal(textureUvCoverage(texture([region([0, 0, 1, 0, 1, 1, 0, 1], { indices: [0, 1, 2, 0, 2, 3], start: 0, count: 6 })])), 100);
});

test('model percentage is pixel weighted and unavailable data is never treated as zero', () => {
  const result = modelUvCoverage([texture([region(rectangle(0, 0.25))], 100), texture([region(rectangle())], 300)]);
  assert.equal(result.percent, 81.25);
  assert.equal(modelUvCoverage([texture([region(rectangle())]), { ...texture([]), reason: '缺少 UV' }]).percent, null);
  assert.equal(modelUvCoverage([]).percent, null);
  assert.equal(textureUvCoverage(texture([region([NaN, 0, 1, 0, 1, 1])])), null);
  assert.equal(textureUvCoverage(texture([region(rectangle(0, 1000000), { wrapU: 1 })])), null);
});

test('model extraction honors submesh material assignment, shared resources and UV channel', () => {
  const internal = {}, requested: string[] = [];
  const tex = { name: 'atlas', getInternalTexture: () => internal, getSize: () => ({ width: 256, height: 128 }), isReady: () => true, coordinatesMode: 0, coordinatesIndex: 1, getTextureMatrix: () => ({ m: matrix }), wrapU: 0, wrapV: 0 };
  const material = { getActiveTextures: () => [tex] };
  const mesh = { getIndices: () => [0, 1, 2, 0, 2, 3], getVerticesData: (kind: string) => { requested.push(kind); return [0, 0, 1, 0, 1, 1, 0, 1]; }, subMeshes: [{ getMaterial: () => material, indexStart: 0, indexCount: 6 }] };
  const textures = modelUvTextures({ meshes: [mesh, mesh] } as unknown as Parameters<typeof modelUvTextures>[0]);
  assert.deepEqual(requested, ['uv2', 'uv2']);
  assert.equal(textures.length, 1);
  assert.equal(textures[0].pixels, 32768);
  assert.equal(modelUvCoverage(textures).percent, 100);
});
