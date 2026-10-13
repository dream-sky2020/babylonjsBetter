import assert from 'node:assert/strict';
import test from 'node:test';
import type { BaseTexture } from '@babylonjs/core';
import { estimateTextureBytes, summarizeTextures, collectModelTextureStats } from './sceneEnvironmentTextureStats.ts';

const resource = (changes = {}) => ({ width: 1024, height: 1024, depth: 1, format: 5, type: 0, isCube: false, is3D: false, is2DArray: false, generateMipMaps: false, _compression: null, ...changes });
const texture = (internal: ReturnType<typeof resource>, name = 'test') => ({ name, getInternalTexture: () => internal, getSize: () => internal, isReady: () => true, isRenderTarget: false }) as unknown as BaseTexture;

test('texture estimates account for mip levels, floating point and block edge padding', () => {
  assert.equal(estimateTextureBytes(resource()), 4194304);
  assert.equal(estimateTextureBytes(resource({ generateMipMaps: true })), 5592404);
  assert.equal(estimateTextureBytes(resource({ type: 2 })), 8388608);
  assert.equal(estimateTextureBytes(resource({ width: 5, height: 5, format: 33776 })), 32);
  assert.equal(estimateTextureBytes(resource({ width: 4, height: 4, format: 33779, generateMipMaps: true })), 48);
  assert.equal(estimateTextureBytes(resource({ width: 4, height: 4, format: 37808 })), 16);
  assert.equal(estimateTextureBytes(resource({ _compression: 'unknown' })), null);
  assert.equal(estimateTextureBytes(resource({ format: 999 })), null);
});

test('cube faces and array layers are counted throughout the mip chain', () => {
  assert.equal(estimateTextureBytes(resource({ isCube: true })), 4194304 * 6);
  assert.equal(estimateTextureBytes(resource({ width: 2, height: 2, depth: 3, is2DArray: true, generateMipMaps: true })), 60);
  assert.equal(estimateTextureBytes(resource({ width: 2, height: 2, depth: 2, is3D: true, generateMipMaps: true })), 36);
});

test('deduplicate GPU resources rather than filenames or texture wrappers', () => {
  const shared = resource();
  const stats = summarizeTextures([texture(shared), texture(shared), texture(resource())]);
  assert.equal(stats.textures.length, 2);
  assert.equal(stats.bytes, 8388608);
  const unknown = summarizeTextures([texture(resource({ format: 999 })), texture(shared)]);
  assert.equal(unknown.unknown, 1);
  assert.equal(unknown.bytes, 4194304);
});

test('model-owned meshes have separate details but shared textures count once in the scene', () => {
  const shared = texture(resource());
  const entity = { meshes: [{ material: { getActiveTextures: () => [shared, shared] } }] };
  const instance = { models: [{ definition: { id: 'a' }, entity }, { definition: { id: 'b' }, entity }] };
  const result = collectModelTextureStats(instance as unknown as Parameters<typeof collectModelTextureStats>[0]);
  assert.equal(result.models.get('model:a')!.textures.length, 1);
  assert.equal(result.models.get('model:b')!.bytes, 4194304);
  assert.equal(result.summary.textures.length, 1);
  assert.equal(result.summary.bytes, 4194304);
});
