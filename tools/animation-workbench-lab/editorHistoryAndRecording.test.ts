import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultAnimationWorkspace } from './animationWorkspace.ts';
import { recordContributionProperty, recordTransformKey, setContributionArmed } from './transformRecording.ts';
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

test('arming is exclusive per target and REC never writes a disarmed source', () => {
  const first = recordTransformKey(createDefaultAnimationWorkspace(), 'preview-object', 'position.x', 2, 0, .5, 'record');
  const original = first.previewBindings[0];
  const originalOutput = first.signalGraph.outputs.find(output => output.id === original.outputId)!;
  const originalCurve = first.signalGraph.nodes.find(node => node.id === originalOutput.source.nodeId)!;
  const secondOutput = { ...originalOutput, id: 'second-output', source: { ...originalOutput.source, nodeId: 'second-curve' } };
  const secondCurve = { ...originalCurve, id: 'second-curve', config: { ...originalCurve.config, keys: structuredClone(originalCurve.config.keys) } };
  const second = { ...original, id: 'second-source', outputId: secondOutput.id, config: { ...original.config, recordArmed: false } };
  const workspace = { ...first, signalGraph: { ...first.signalGraph, nodes: [...first.signalGraph.nodes, secondCurve], outputs: [...first.signalGraph.outputs, secondOutput] }, previewBindings: [...first.previewBindings, second] };
  const switched = { ...workspace, previewBindings: setContributionArmed(workspace.previewBindings, second.id, true) };
  assert.equal(switched.previewBindings.find(item => item.id === original.id)?.config.recordArmed, false);
  assert.equal(switched.previewBindings.find(item => item.id === second.id)?.config.recordArmed, true);
  const recorded = recordTransformKey(switched, 'preview-object', 'position.x', 4, 0, .75, 'record');
  const keys = recorded.signalGraph.nodes.find(node => node.id === recorded.signalGraph.outputs.find(output => output.id === second.outputId)?.source.nodeId)?.config.keys as Array<{ time: number; value: number }>;
  assert.equal(keys.find(key => key.time === .75)?.value, 4);
  const untouched = recorded.signalGraph.nodes.find(node => node.id === originalCurve.id)?.config.keys as Array<{ time: number; value: number }>;
  assert.equal(untouched.some(key => key.time === .75), false);
});

test('contribution properties create their own animation outputs when armed', () => {
  const source = recordTransformKey(createDefaultAnimationWorkspace(), 'preview-object', 'position.y', 1, 0, .5, 'record');
  const binding = source.previewBindings[0];
  const armed = { ...source, previewBindings: source.previewBindings.map(item => item.id === binding.id ? { ...item, config: { ...item.config, recordProperty: 'weight' } } : item) };
  const recorded = recordContributionProperty(armed, binding.id, 'weight', .35, .75, 'record');
  const updated = recorded.previewBindings.find(item => item.id === binding.id);
  assert.equal(typeof updated?.config.weightOutputId, 'string');
  assert.equal(recorded.signalGraph.outputs.some(output => output.id === updated?.config.weightOutputId), true);
});
