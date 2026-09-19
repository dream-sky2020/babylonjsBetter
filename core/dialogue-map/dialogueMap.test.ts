import assert from 'node:assert/strict';
import test from 'node:test';
import { createDialogueMapPreset, parseDialogueMapPreset, validateDialogueMapPreset } from './dialogueMap.ts';

test('a new dialogue preset starts as a valid one-node graph', () => {
  const preset = createDialogueMapPreset('intro', 'Intro');
  assert.equal(preset.startNodeId, 'start');
  assert.deepEqual(validateDialogueMapPreset(preset), []);
  assert.deepEqual(parseDialogueMapPreset(preset, 'intro'), preset);
});

test('validation reports broken targets and unreachable nodes', () => {
  const preset = createDialogueMapPreset('intro', 'Intro');
  preset.nodes.start.choices.push({ id: 'next', text: 'Next', targetNodeId: 'missing' });
  preset.nodes.orphan = {
    id: 'orphan', kind: 'end', title: 'Orphan', speaker: '', text: '',
    position: { x: 400, y: 100 }, choices: [],
  };
  const issues = validateDialogueMapPreset(preset);
  assert.ok(issues.some((issue) => issue.code === 'missing-target'));
  assert.ok(issues.some((issue) => issue.code === 'unreachable-node' && issue.nodeId === 'orphan'));
});

test('choice and end node invariants are validated', () => {
  const preset = createDialogueMapPreset('intro', 'Intro');
  preset.nodes.start.kind = 'choice';
  assert.ok(validateDialogueMapPreset(preset).some((issue) => issue.code === 'choice-count'));
  preset.nodes.start.kind = 'end';
  preset.nodes.start.choices.push({ id: 'invalid', text: 'Invalid' });
  assert.ok(validateDialogueMapPreset(preset).some((issue) => issue.code === 'end-has-choice'));
});
