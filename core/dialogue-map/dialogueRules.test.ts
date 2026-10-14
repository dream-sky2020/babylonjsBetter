import assert from 'node:assert/strict';
import test from 'node:test';
import { cloneDialogueEditorDocument, createDialogueEditorDocument, encodeDialogueEditorDocument, parseDialogueEditorDocument, validateDialogueEditorDocument } from './dialogueMap.ts';
import { parseDialogueCondition, validateDialogueOutputRules } from './dialogueRules.ts';
import type { DialogueOutputPort } from './dialogueMap.types.ts';
import { dialogueRuleCatalog } from '../../tools/dialogue-map-canvas-lab/dialogueRuleCatalog.ts';
import { commitDialogueHistory, createDialogueHistory, redoDialogueHistory, undoDialogueHistory } from '../../tools/dialogue-map-canvas-lab/dialogueHistory.ts';

const port = (): DialogueOutputPort => ({ id: 'next', activation: { type: 'choice' }, condition: {
  type: 'all', conditions: [{ type: 'compare', operator: 'gte',
    left: { type: 'memory', key: 'dungeon.player-state', path: ['playerPosition', 'tileX'] }, right: { type: 'literal', value: 5 } },
  { type: 'not', condition: { type: 'compare', operator: 'eq', left: { type: 'literal', value: false }, right: { type: 'literal', value: true } } }],
}, effects: [{ type: 'event', eventType: 'custom.arrived', version: 2, payload: {
  tileX: { type: 'memory', key: 'dungeon.player-state', path: ['playerPosition', 'tileX'] },
  name: { type: 'literal', value: 'gate' },
} }] });
const documentWith = (output: DialogueOutputPort) => {
  const document = createDialogueEditorDocument('rules', 'Rules'), node = document.graph.nodes.get('start')!;
  node.outputs.set(output.id, output); node.outputOrder.push(output.id); return document;
};

test('V4 nested rules and event payloads round trip without aliasing saved or cloned data', () => {
  const document = documentWith(port()), encoded = encodeDialogueEditorDocument(document), cloned = cloneDialogueEditorDocument(document);
  assert.equal(encoded.schemaVersion, 4);
  assert.deepEqual(cloned.graph.nodes.get('start')?.outputs.get('next'), port());
  const effect = cloned.graph.nodes.get('start')!.outputs.get('next')!.effects![0];
  if (effect.type === 'event') effect.eventType = 'changed';
  assert.deepEqual(document.graph.nodes.get('start')!.outputs.get('next'), port());
  assert.deepEqual(encoded.graph.nodes.start.outputs.next, port());
});

test('V3 strings are retained as explicit legacy rules and event activation keeps default version', () => {
  const encoded = encodeDialogueEditorDocument(documentWith(port()));
  const old = JSON.parse(JSON.stringify(encoded)); old.schemaVersion = 3;
  old.graph.nodes.start.outputs.next = { id: 'next', activation: { type: 'event', eventId: 'old.signal' }, condition: 'allowed', effects: ['quest:start'] };
  const output = parseDialogueEditorDocument(old).graph.nodes.get('start')!.outputs.get('next')!;
  assert.deepEqual(output.activation, { type: 'event', eventType: 'old.signal', version: 1 });
  assert.deepEqual(output.condition, { type: 'legacy', expression: 'allowed' });
  assert.deepEqual(output.effects, [{ type: 'legacy', event: 'quest:start' }]);
});

test('unfinished rules remain cloneable but cannot pass save validation', () => {
  const output: DialogueOutputPort = { id: 'draft', activation: { type: 'event', eventType: '', version: 0 },
    condition: { type: 'all', conditions: [] }, effects: [{ type: 'event', eventType: '', version: 1 }] };
  const document = cloneDialogueEditorDocument(documentWith(output));
  assert.deepEqual(document.graph.nodes.get('start')!.outputs.get('draft'), output);
  assert.ok(validateDialogueEditorDocument(document).filter(issue => issue.severity === 'error').length >= 3);
});

test('catalog validates comparisons and required event parameters, unknown references remain warnings', () => {
  const output = port();
  assert.deepEqual(validateDialogueOutputRules(output), []);
  assert.equal(validateDialogueOutputRules(output, dialogueRuleCatalog).filter(issue => issue.severity === 'error').length, 0);
  assert.ok(validateDialogueOutputRules(output, dialogueRuleCatalog).some(issue => issue.severity === 'warning'));
  output.condition = { type: 'compare', operator: 'gte', left: { type: 'memory', key: 'dungeon.player-state', path: ['playerFacing'] }, right: { type: 'literal', value: 5 } };
  assert.ok(validateDialogueOutputRules(output, dialogueRuleCatalog).some(issue => issue.severity === 'error'));
  output.condition = undefined;
  output.effects = [{ type: 'event', eventType: 'dungeon.agents.loaded', version: 1, payload: { loadId: { type: 'literal', value: 1 } } }];
  assert.ok(validateDialogueOutputRules(output, dialogueRuleCatalog).some(issue => issue.message.includes('agentCount')));
});

test('malformed rule arrays and operators are rejected rather than silently discarded', () => {
  assert.throws(() => parseDialogueCondition({ type: 'compare', operator: 'javascript', left: {}, right: {} }));
  const encoded = JSON.parse(JSON.stringify(encodeDialogueEditorDocument(documentWith(port()))));
  encoded.graph.nodes.start.outputs.next.effects = ['legacy', 42];
  assert.throws(() => parseDialogueEditorDocument(encoded));
});

test('history restores nested rules, clears redo after branching and limits retained edits', () => {
  const first = documentWith(port()); let history = createDialogueHistory({ rules: first });
  const second = cloneDialogueEditorDocument(first); second.graph.nodes.get('start')!.outputs.get('next')!.condition = undefined;
  history = commitDialogueHistory(history, { rules: second });
  history = undoDialogueHistory(history);
  assert.deepEqual(history.present.rules.graph.nodes.get('start')!.outputs.get('next'), port());
  history = redoDialogueHistory(history); assert.equal(history.present.rules, second);
  history = commitDialogueHistory(undoDialogueHistory(history), { rules: cloneDialogueEditorDocument(first) });
  assert.equal(history.future.length, 0);
  for (let i = 0; i < 120; i++) history = commitDialogueHistory(history, { rules: cloneDialogueEditorDocument(first) });
  assert.equal(history.past.length, 100);
});
