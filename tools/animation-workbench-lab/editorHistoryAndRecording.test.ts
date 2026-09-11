import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultAnimationWorkspace } from './animationWorkspace.ts';
import { recordTransformKey } from './transformRecording.ts';
import { workspaceHistoryReducer, type WorkspaceHistoryState } from './useWorkspaceHistory.ts';

test('workspace history groups a continuous edit into one undo step', () => {
  const initial = createDefaultAnimationWorkspace();
  let state: WorkspaceHistoryState = { past: [], present: initial, future: [], transactionStart: null };
  state = workspaceHistoryReducer(state, { type: 'begin' });
  state = workspaceHistoryReducer(state, { type: 'commit', update: current => ({ ...current, name: 'drag 1' }) });
  state = workspaceHistoryReducer(state, { type: 'commit', update: current => ({ ...current, name: 'drag 2' }) });
  state = workspaceHistoryReducer(state, { type: 'end' });
  assert.equal(state.past.length, 1);
  state = workspaceHistoryReducer(state, { type: 'undo' });
  assert.equal(state.present.name, initial.name);
  state = workspaceHistoryReducer(state, { type: 'redo' });
  assert.equal(state.present.name, 'drag 2');
});

test('record mode creates and updates an object property curve while auto mode only updates existing tracks', () => {
  const initial = createDefaultAnimationWorkspace();
  assert.equal(recordTransformKey(initial, 'preview-object', 'position.x', 2, 0, .5, 'auto'), initial);
  const recorded = recordTransformKey(initial, 'preview-object', 'position.x', 2, 0, .5, 'record');
  assert.equal(recorded.previewBindings.length, 1);
  const updated = recordTransformKey(recorded, 'preview-object', 'position.x', 3, 0, .5, 'auto');
  const curve = updated.signalGraph.nodes.find(node => node.typeId === 'core.curve.number' && node.id !== 'curve');
  assert.equal((curve?.config.keys as Array<{ time: number; value: number }>).find(key => key.time === .5)?.value, 3);
});
