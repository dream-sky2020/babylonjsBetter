import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
import { NullEngine, Scene, Mesh, TransformNode } from '@babylonjs/core';

test('dissolve previews isolate two character layers, particles and independent transient lifecycles', async () => {
  const server = await createServer({ configFile: false, cacheDir: `node_modules/.cache/vite-tests/monster-dissolve-${process.pid}`,
    server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, resolve: { alias: { '@': path.resolve('.') } }, logLevel: 'error' });
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const { MonsterDissolvePreview } = await server.ssrLoadModule('/labs/modules/monster/monster-dissolve-preview/MonsterDissolvePreview.ts');
    const { normalizeMonsterDissolvePreset } = await server.ssrLoadModule('/core/monster/dissolve/monsterDissolve.ts');
    const { createSpriteDeathVisualRuntime } = await server.ssrLoadModule('/core/effects/sprite-death/createSpriteDeathVisualRuntime.ts');
    const targets = new Map(), updates = new Map(), masks = new Map(), particleStates = [];
    for (const id of ['a', 'b']) {
      const root = new TransformNode(id, scene), body = new Mesh(id + '-body', scene), line = new Mesh(id + '-line', scene); body.parent = root; line.parent = root;
      targets.set(id, { root, revision: 1, getLayerMesh: key => key === 'body' ? body : key === 'line' ? line : null,
        setLayerDissolve(key, options) { const layers = updates.get(id) ?? {}; layers[key] = structuredClone(options); updates.set(id, layers); },
        setLayerOpacity(key, opacity) { const layers = masks.get(id) ?? {}; layers[key] = opacity; masks.set(id, layers); } });
    }
    const objects = { selected: () => ({ id: 'a', name: 'A' }), target: id => targets.get(id) ?? null, subscribe: () => () => {}, refresh() {} };
    const preview = new MonsterDissolvePreview(scene, objects, (_scene, mesh) => {
      const record = { mesh, disposed: false, progress: 0, paused: false }; particleStates.push(record);
      return { setProgress: value => { record.progress = value; }, setPreset() {}, setDisplayScale() {}, updateTime() {}, setPaused: value => { record.paused = value; }, dispose() { record.disposed = true; } };
    });
    assert.equal(normalizeMonsterDissolvePreset('legacy', {}).bottomFillEnd, 1);
    assert.equal(normalizeMonsterDissolvePreset('clamped', { bottomFillEnd: 3, bottomBorderEnd: -1 }).bottomBorderEnd, 0);
    const preset = normalizeMonsterDissolvePreset('test', { name: 'Dissolve', duration: 1, particleMode: 'ash', bottomFillEnd: .5, bottomBorderEnd: .25 });
    const roundTrip = normalizeMonsterDissolvePreset('test', JSON.parse(JSON.stringify(preset)));
    assert.equal(roundTrip.bottomFillEnd, .5); assert.equal(roundTrip.bottomBorderEnd, .25);
    const runtimePreset = { ...roundTrip, particleMode: 'none' };
    const host = { ...targets.get('a'), setDissolve() { throw new Error('layered preset must not use legacy effect'); } };
    const runtime = createSpriteDeathVisualRuntime({ scene, host, emitterMesh: null, visual: {}, parameters: {}, duration: 1, monsterPreset: runtimePreset });
    runtime.setProgress(.25); assert.equal(masks.get('a').bottomFillMask, .5); assert.equal(masks.get('a').bottomBorder, 0);
    runtime.dispose(); assert.equal(masks.get('a').bottomBorder, 1);
    preview.play('a', preset); assert.deepEqual(masks.get('a'), { bottomFillMask: 1, bottomBorder: 1 });
    assert.deepEqual(Object.keys(updates.get('a')), ['body', 'line']); assert.equal(particleStates[0].mesh.name, 'a-body');
    preview.update(.25); assert.equal(preview.status('a').progress, .25); assert.equal(updates.get('a').line.progress, .25); assert.equal(masks.get('a').bottomBorder, 0); assert.equal(masks.get('a').bottomFillMask, .5);
    assert.equal(updates.has('b'), false); preset.duration = 5;
    preview.play('b', preset); preview.update(.75); assert.equal(preview.status('a').progress, 1); assert.equal(preview.status('a').playing, false); assert.equal(preview.status('b').progress, .15);
    preview.setPaused(true); assert.ok(particleStates.filter(value => !value.disposed).every(value => value.paused)); preview.setPaused(false);
    preview.reset('a'); assert.equal(particleStates[0].disposed, true); assert.equal(masks.get('a').bottomFillMask, 1); assert.equal(updates.get('a').body.enabled, false); assert.equal(preview.status('b').playing, true);
    preview.scrub('b', preset, .4); assert.equal(preview.status('b').playing, false); preview.update(1); assert.equal(preview.status('b').progress, .4);
    preview.play('b', preset); assert.equal(particleStates[1].disposed, true); targets.get('b').revision++; preview.prune(); assert.equal(preview.status('b'), null); assert.equal(particleStates.at(-1).disposed, true);
    preview.play('a', preset); targets.delete('a'); preview.update(.1); assert.equal(preview.status('a'), null); assert.equal(particleStates.at(-1).disposed, true);
    assert.throws(() => preview.play('missing', preset));
    preview.play('b', preset); preview.dispose(); assert.equal(preview.status('b'), null); assert.equal(masks.get('b').bottomBorder, 1);
  } finally { scene.dispose(); engine.dispose(); await server.close(); }
});
