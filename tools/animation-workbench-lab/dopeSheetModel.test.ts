import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultAnimationWorkspace } from './animationWorkspace.ts';
import { recordTransformKey } from './transformRecording.ts';
import { collectDopeSheetTracks, deleteDopeSheetKeys, dopeKeyToken, moveDopeSheetKeys } from './dopeSheetModel.ts';

test('dope sheet collects object property tracks and moves selected keys with frame snapping', () => {
  const recorded = recordTransformKey(createDefaultAnimationWorkspace(), 'preview-object', 'position.x', 2, 0, .5, 'record');
  const tracks = collectDopeSheetTracks(recorded.signalGraph, recorded.previewBindings, 'preview-object');
  assert.equal(tracks.length, 1);
  const key = tracks[0].keys.find(item => item.time === .5)!;
  const selected = new Set([dopeKeyToken(tracks[0].nodeId, key.id)]);
  const moved = moveDopeSheetKeys(recorded.signalGraph, selected, .11, 2, 10);
  assert.equal(collectDopeSheetTracks(moved, recorded.previewBindings, 'preview-object')[0].keys.at(-1)?.time, .6);
  const deleted = deleteDopeSheetKeys(moved, selected);
  assert.equal(collectDopeSheetTracks(deleted, recorded.previewBindings, 'preview-object')[0].keys.length, 1);
});
