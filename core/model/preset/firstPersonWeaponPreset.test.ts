import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseWeaponLibrary, parseWeaponProject, mirrorWeaponTrack } from './firstPersonWeaponPreset.ts';
import { createWeaponAnimationExamples } from './firstPersonWeaponExamples.ts';
import { sampleWeaponPoses } from './firstPersonWeaponAnimation.ts';
const library = JSON.parse(readFileSync(new URL('../../../config/firstPersonWeaponPresets.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const example = () => structuredClone(library['right-hand-slash']);
test('installation transforms survive roundtrip independently of proxy dimensions', () => {
  const p = example(); p.asset.path = '/resources/Model/GLB/espada.glb';
  p.asset.offset.x = .42; p.asset.rotation.y = 90; p.asset.scale = .7; p.proxy.size.z = 3;
  const migrated = parseWeaponProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(migrated.weapons.right.asset, p.asset);
  assert.deepEqual(migrated.weapons.right.proxy, p.proxy);
  assert.deepEqual(migrated.weapons.right.keyframes, p.keyframes);
  assert.equal(migrated.weapons.left.enabled, false);
  assert.deepEqual(parseWeaponLibrary(parseWeaponLibrary(library)), parseWeaponLibrary(library));
});

test('v2 roundtrip preserves different installations and per-hand timing', () => {
  const p = createWeaponAnimationExamples()['dual-alternating-slash'];
  p.weapons.left.asset.scale = .7; p.weapons.right.asset.scale = 1.2;
  p.weapons.left.asset.offset.x = .16;
  assert.deepEqual(parseWeaponProject(JSON.parse(JSON.stringify(p))), p);
  const atFirstStrike = sampleWeaponPoses(p, .4);
  assert.deepEqual(atFirstStrike.right.position, p.weapons.right.keyframes[2].position);
  assert.deepEqual(atFirstStrike.left.position, p.weapons.left.keyframes[0].position);
  const atSecondStrike = sampleWeaponPoses(p, .85);
  assert.deepEqual(atSecondStrike.left.position, p.weapons.left.keyframes[3].position);
});

test('all examples validate; shooting has recoil and returns to aim', () => {
  const examples = createWeaponAnimationExamples();
  assert.deepEqual(parseWeaponLibrary(examples), examples);
  for (const key of ['pistol-single-shot', 'rifle-three-round-burst', 'dual-pistol-alternating']) {
    const p = examples[key];
    const start = sampleWeaponPoses(p, 0).right;
    const kick = sampleWeaponPoses(p, .115).right;
    const end = sampleWeaponPoses(p, p.duration).right;
    assert.ok(kick.position.z < start.position.z);
    assert.ok(kick.rotation.x < start.rotation.x);
    assert.deepEqual(end.position, start.position);
    assert.deepEqual(end.rotation, start.rotation);
  }
});

test('mirror changes motion only; disabled tracks retain validated data', () => {
  const p = createWeaponAnimationExamples()['dual-cross-slash'];
  const original = structuredClone(p.weapons.right);
  assert.deepEqual(mirrorWeaponTrack(mirrorWeaponTrack(original)), original);
  assert.deepEqual(mirrorWeaponTrack(original).asset, original.asset);
  p.weapons.left.enabled = false;
  assert.deepEqual(parseWeaponProject(p), p);
  p.weapons.right.enabled = false;
  assert.throws(() => parseWeaponProject(p));
  p.weapons.right.enabled = true;
  p.weapons.left.keyframes[0].time = p.duration + 1;
  assert.throws(() => parseWeaponProject(p));
});
test('reject normalization overrides, temporary paths and corrupt animation data', () => {
  for (const mutate of [
    p => { p.asset.assetProfile = {}; }, p => { p.asset.path = 'local:weapon.glb'; },
    p => { p.asset.scale = 0; }, p => { p.proxy.size.x = -1; },
    p => { p.keyframes[0].rotation.y = NaN; }, p => { p.keyframes[0].time = p.duration + 1; },
    p => { p.keyframes[1].id = p.keyframes[0].id; }, p => { p.version = 2; },
  ] as Array<(p: ReturnType<typeof example>) => void>) {
    const p = example(); mutate(p); assert.throws(() => parseWeaponProject(p));
  }
});


