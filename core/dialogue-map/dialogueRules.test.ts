import assert from 'node:assert/strict';
import test from 'node:test';
import { cloneDialogueEditorDocument, createDialogueEditorDocument, createDialogueEditorNode } from './dialogueMap.ts';
import { parseDialogueCondition, validateDialogueNodeRules } from './dialogueRules.ts';
import { dialogueRuleCatalog } from '../../tools/dialogue-map-canvas-lab/dialogueRuleCatalog.ts';
import { commitDialogueHistory, createDialogueHistory, redoDialogueHistory, undoDialogueHistory } from '../../tools/dialogue-map-canvas-lab/dialogueHistory.ts';

test('catalog validates numeric comparisons, event parameters and unknown references', () => {
  const node = createDialogueEditorNode('test', { x: 0, y: 0 }, 'condition'); assert.equal(node.kind, 'condition');
  if (node.kind !== 'condition') return;
  node.condition = { type: 'compare', operator: 'gte', left: { type: 'memory', key: 'dungeon.player-state', path: ['playerFacing'] }, right: { type: 'literal', value: 5 } };
  assert.ok(validateDialogueNodeRules(node, dialogueRuleCatalog).some(issue => issue.severity === 'error'));
  node.condition.left = { type: 'memory', key: 'custom', path: ['coins'] };
  assert.ok(validateDialogueNodeRules(node, dialogueRuleCatalog).some(issue => issue.severity === 'warning'));
  const event = createDialogueEditorNode('event', { x: 0, y: 0 }, 'event'); if (event.kind !== 'event') return;
  event.event = { type: 'event', eventType: 'dungeon.agents.loaded', version: 1, payload: { loadId: { type: 'literal', value: 1 } } };
  assert.ok(validateDialogueNodeRules(event, dialogueRuleCatalog).some(issue => issue.message.includes('agentCount')));
  event.mode = 'wait'; assert.deepEqual(validateDialogueNodeRules(event, dialogueRuleCatalog), []);
});
test('nested groups validate recursively and do not accept legacy expressions', () => {
  const node = createDialogueEditorNode('test', { x: 0, y: 0 }, 'condition'); if (node.kind !== 'condition') return;
  node.condition = { type: 'all', conditions: [{ type: 'not', condition: { type: 'compare', operator: 'eq', left: { type: 'literal', value: true }, right: { type: 'literal', value: false } } }] };
  assert.deepEqual(validateDialogueNodeRules(node), []);
  node.condition.conditions = []; assert.ok(validateDialogueNodeRules(node).length);
  assert.throws(() => parseDialogueCondition('allowed')); assert.throws(() => parseDialogueCondition({ type: 'legacy', expression: 'allowed' }));
  assert.throws(() => parseDialogueCondition({ type: 'compare', operator: 'javascript' }));
});
test('history restores typed nodes, clears redo on branching and bounds retained edits', () => {
  const first = createDialogueEditorDocument('rules', 'Rules'); let history = createDialogueHistory({ rules: first });
  const second = cloneDialogueEditorDocument(first); second.graph.nodes.set('check', createDialogueEditorNode('check', { x: 240, y: 0 }, 'condition'));
  history = commitDialogueHistory(history, { rules: second }); history = undoDialogueHistory(history);
  assert.equal(history.present.rules.graph.nodes.has('check'), false);
  history = redoDialogueHistory(history); assert.equal(history.present.rules, second);
  history = commitDialogueHistory(undoDialogueHistory(history), { rules: cloneDialogueEditorDocument(first) }); assert.equal(history.future.length, 0);
  for (let i = 0; i < 120; i++) history = commitDialogueHistory(history, { rules: cloneDialogueEditorDocument(first) });
  assert.equal(history.past.length, 100);
});
