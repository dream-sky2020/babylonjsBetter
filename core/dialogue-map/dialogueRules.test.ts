import assert from 'node:assert/strict';
import test from 'node:test';
import { cloneDialogueEditorDocument, createDialogueEditorDocument, createDialogueEditorNode } from './dialogueMap.ts';
import { parseDialogueCondition, validateDialogueNodeRules } from './dialogueRules.ts';
import { dialogueRuleCatalog } from '../../labs/standalone/dialogue-map-canvas-lab/dialogueRuleCatalog.ts';
import { commitDialogueHistory, createDialogueHistory, redoDialogueHistory, undoDialogueHistory } from '../../labs/standalone/dialogue-map-canvas-lab/dialogueHistory.ts';

test('catalog validates numeric comparisons, event parameters and unknown references', () => {
  const node = createDialogueEditorNode('test', { x: 0, y: 0 }, 'condition'); assert.equal(node.kind, 'condition');
  if (node.kind !== 'condition') return;
  node.condition = { type: 'compare', operator: 'gte', left: { type: 'memory', key: 'dungeon.player-state', path: ['playerFacing'] }, right: { type: 'literal', value: 5 } };
  assert.ok(validateDialogueNodeRules(node, dialogueRuleCatalog).some(issue => issue.severity === 'error'));
  node.condition.left = { type: 'memory', key: 'custom', path: ['coins'] };
  assert.ok(validateDialogueNodeRules(node, dialogueRuleCatalog).some(issue => issue.severity === 'warning'));
  const event = createDialogueEditorNode('event', { x: 0, y: 0 }, 'event'); if (event.kind !== 'event') return;
  event.events = [{ type: 'event', eventType: 'dungeon.agents.loaded', version: 1, payload: { loadId: { type: 'literal', value: 1 } } }];
  assert.ok(validateDialogueNodeRules(event, dialogueRuleCatalog).some(issue => issue.message.includes('agentCount')));
  event.mode = 'wait'; assert.deepEqual(validateDialogueNodeRules(event, dialogueRuleCatalog), []);
});
test('flat all/any comparisons validate while nested groups and negation are rejected', () => {
  const comparison = { type: 'compare' as const, operator: 'eq' as const, left: { type: 'literal' as const, value: true }, right: { type: 'literal' as const, value: false } };
  const node = createDialogueEditorNode('test', { x: 0, y: 0 }, 'condition'); if (node.kind !== 'condition') return;
  for (const type of ['all', 'any'] as const) {
    node.condition = { type, conditions: [comparison, comparison] };
    assert.deepEqual(validateDialogueNodeRules(node), []);
    assert.deepEqual(parseDialogueCondition(node.condition), node.condition);
    assert.throws(() => parseDialogueCondition({ type, conditions: [{ type: 'all', conditions: [comparison] }] }));
  }
  node.condition = { type: 'all', conditions: [] }; assert.ok(validateDialogueNodeRules(node).length);
  assert.throws(() => parseDialogueCondition({ type: 'not', condition: comparison }));
  assert.throws(() => parseDialogueCondition({ type: 'legacy', expression: 'allowed' }));
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
