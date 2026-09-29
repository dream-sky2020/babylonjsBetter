import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeSceneEnvironmentPresets } from './sceneEnvironmentPresetStore.ts';
import { parseSceneEnvironmentPresetLibrary } from '../core/scene/sceneEnvironment.parser.ts';
import { readSceneEnvironmentPresets, writeSceneEnvironmentPreset } from './sceneEnvironmentPresetStore.ts';
import { migrateSceneEnvironmentPresets } from './migrateSceneEnvironmentPresets.ts';
import { parseSceneEnvironmentCatalog } from '../core/scene/sceneEnvironment.catalog.ts';
test('scene preset save/reload preserves transform and inheritance; invalid writes leave file intact', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'scene-editor-')); const file = join(dir, 'presets.json');
  const base = { presetKey: 'base', name: 'Base', clearColor: '#000000', lights: [], models: [], objects: [{ id: 'box', name: 'Box', geometry: { primitive: 'box', width: 1, height: 1, depth: 1 }, color: '#ffffff', position: [3, 4, 5], rotation: [0, .5, 0] }] };
  const library = { base, derived: { presetKey: 'derived', name: 'Derived', extendsPresetKey: 'base' } };
  try {
    await writeSceneEnvironmentPresets(file, library);
    const saved = JSON.parse(await readFile(file, 'utf8')); assert.deepEqual(saved, library);
    assert.deepEqual(parseSceneEnvironmentPresetLibrary(saved).derived.objects[0].position, [3, 4, 5]);
    await assert.rejects(writeSceneEnvironmentPresets(file, { base: { ...base, objects: [{ ...base.objects[0], position: [null, 1, 2] }] } }));
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), saved);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('migration is repeatable and parsed-equivalent; single scene writes preserve index, base and inheritance', async () => {
  const config = await mkdtemp(join(tmpdir(), 'scene-split-'));
  const dir = join(config, 'sceneEnvironmentPresets');
  const base = { presetKey: 'base', name: 'Base', clearColor: '#000000', lights: [], models: [], objects: [] };
  const raw = { base, child: { presetKey: 'child', name: 'Child', extendsPresetKey: 'base' } };
  try {
    await writeFile(join(config, 'sceneEnvironmentPresets.json'), JSON.stringify(raw));
    await writeFile(join(config, 'shadowQualityPresets.json'), '{}');
    assert.deepEqual(await migrateSceneEnvironmentPresets(config), { count: 2, migrated: true });
    assert.deepEqual(parseSceneEnvironmentPresetLibrary(await readSceneEnvironmentPresets(dir)), parseSceneEnvironmentPresetLibrary(raw));
    const baseBefore = await readFile(join(dir, 'base.json'), 'utf8');
    const indexBefore = await readFile(join(dir, 'index.json'), 'utf8');
    await writeSceneEnvironmentPreset(dir, 'child', { ...raw.child, clearColor: '#123456' });
    assert.deepEqual(await migrateSceneEnvironmentPresets(config), { count: 2, migrated: false });
    assert.equal(await readFile(join(dir, 'base.json'), 'utf8'), baseBefore);
    assert.equal(await readFile(join(dir, 'index.json'), 'utf8'), indexBefore);
    const saved = await readFile(join(dir, 'child.json'), 'utf8');
    assert.equal(parseSceneEnvironmentPresetLibrary(await readSceneEnvironmentPresets(dir)).child.clearColor, '#123456');
    for (const [key, declaration] of [['../escape', raw.child], ['child', { ...raw.child, presetKey: 'bad' }], ['child', { ...raw.child, extendsPresetKey: 'child' }], ['child', { ...raw.child, extendsPresetKey: 'absent' }], ['child', { ...raw.child, clearColor: 'wrong' }]] as const) await assert.rejects(writeSceneEnvironmentPreset(dir, key, declaration));
    await assert.rejects(writeSceneEnvironmentPreset(dir, 'base', { ...base, lights: [{ id: 'light', name: 'Light', color: '#ffffff', intensity: 1, light: { primitive: 'point', position: [0, 1, 0] }, shadow: { qualityPresetKey: 'missing' } }] }));
    assert.equal(await readFile(join(dir, 'child.json'), 'utf8'), saved);
    assert.deepEqual((await readdir(dir)).sort(), ['base.json', 'child.json', 'index.json']);
  } finally { await rm(config, { recursive: true, force: true }); }
});
test('catalog rejects traversal, case collisions and Windows device filenames', () => {
  for (const presets of [{ base: '../base.json' }, { base: 'other.json' }, { base: 'base.json', BASE: 'BASE.json' }, { CON: 'CON.json' }]) assert.throws(() => parseSceneEnvironmentCatalog({ version: 1, presets }));
});
test('interrupted migration refuses to overwrite divergent destination files', async () => {
  const config = await mkdtemp(join(tmpdir(), 'scene-migrate-'));
  try {
    const base = { presetKey: 'base', name: 'Base', clearColor: '#000000', lights: [], objects: [] };
    await writeFile(join(config, 'sceneEnvironmentPresets.json'), JSON.stringify({ base }));
    await mkdir(join(config, 'sceneEnvironmentPresets'));
    await writeFile(join(config, 'sceneEnvironmentPresets', 'base.json'), JSON.stringify({ ...base, name: 'Edited' }));
    await assert.rejects(migrateSceneEnvironmentPresets(config));
    assert.equal(JSON.parse(await readFile(join(config, 'sceneEnvironmentPresets', 'base.json'), 'utf8')).name, 'Edited');
  } finally { await rm(config, { recursive: true, force: true }); }
});
