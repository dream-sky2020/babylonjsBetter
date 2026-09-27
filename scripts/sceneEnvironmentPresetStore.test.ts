import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeSceneEnvironmentPresets } from './sceneEnvironmentPresetStore.ts';
import { parseSceneEnvironmentPresetLibrary } from '../core/scene/sceneEnvironment.parser.ts';
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
