import assert from 'node:assert/strict';
import test from 'node:test';
import type { AnimationEventMarker } from '../../core/animation/preset/animationScenePreset.ts';
import { deleteAnimationEvent, eventsCrossed, moveAnimationEvent, snapEventTime } from './eventTrackModel.ts';

const markers: readonly AnimationEventMarker[] = [
  { id: 'a', time: .2, typeId: 'weapon.fire', config: {} },
  { id: 'b', time: .8, typeId: 'audio.play', config: {} },
];

test('event time snapping and clamping are deterministic', () => {
  assert.equal(snapEventTime(.123, 60), 7 / 60);
  assert.equal(moveAnimationEvent(markers, 'a', 1.6, 1, 60).find(marker => marker.id === 'a')?.time, 1);
});

test('event deletion preserves other markers', () => {
  assert.deepEqual(deleteAnimationEvent(markers, 'a').map(marker => marker.id), ['b']);
});

test('event crossing supports forward playback and loop wrap', () => {
  assert.deepEqual(eventsCrossed(markers, .1, .5, false).map(marker => marker.id), ['a']);
  assert.deepEqual(eventsCrossed(markers, .7, .25, true).map(marker => marker.id), ['b', 'a']);
});
