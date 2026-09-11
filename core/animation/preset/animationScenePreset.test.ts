import assert from 'node:assert/strict';
import test from 'node:test';
import { createWeaponAnimationExamples } from '../../model/preset/firstPersonWeaponExamples.ts';
import { AnimationScenePlayer, evaluateAnimationScenePreset } from './animationScenePlayer.ts';
import { migrateFirstPersonWeaponPreset } from './migrateFirstPersonWeaponPreset.ts';
import { parseAnimationScenePreset } from './animationScenePreset.ts';

test('model-shake actions migrate to generic objects, mounts, events and signals', () => {
    const preset = migrateFirstPersonWeaponPreset(createWeaponAnimationExamples()['pistol-single-shot'], 'pistol-single-shot');
    assert.deepEqual(parseAnimationScenePreset(preset), preset);
    assert.deepEqual(preset.mountPoints.map(mount => mount.id), ['right-item']);
    assert.equal(preset.objects.some(object => object.factoryTypeId === 'asset.model'), false);
    assert.equal(preset.signalGraph.nodes.filter(node => node.typeId === 'core.curve.number').length, 6);
    assert.equal(preset.events.some(event => event.config.label === '后坐 / 枪口上跳'), true);
});

test('generic animation scene evaluates and plays without Babylon scene ownership', () => {
    const preset = migrateFirstPersonWeaponPreset(createWeaponAnimationExamples()['right-hand-slash']);
    const frame = evaluateAnimationScenePreset(preset, .4);
    assert.ok(Math.abs((frame.mix.values.get('right-weapon-pose:position.x') ?? 0) - (-.18)) < .0001);
    let applyCount = 0; let eventCount = 0;
    const applyNumber = () => { applyCount += 1; }; const emitEvent = () => { eventCount += 1; };
    const player = new AnimationScenePlayer(preset, { applyNumber, emitEvent });
    player.play(); player.update(.41);
    assert.ok(applyCount > 0);
    assert.ok(eventCount > 0);
    assert.equal(player.getMountPoint('right-item')?.objectId, 'right-weapon-model-mount');
});
