import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createDialogueEditorDocument, createDialogueEditorNode, connectDialogueNodes, dialogueNodeInputPortId, encodeDialogueEditorDocument, parseDialogueEditorDocument, validateDialogueEditorDocument, cloneDialogueEditorDocument } from './dialogueMap.ts';
import { compileDialogueEditorDocument } from './dialogueCompiler.ts';
import { dialogueRuleCatalog } from '../../tools/dialogue-map-canvas-lab/dialogueRuleCatalog.ts';

const preset = () => parseDialogueEditorDocument(JSON.parse(readFileSync(new URL('../../config/dialogueMapPresets/village_gate.json', import.meta.url), 'utf8')));
test('new preset contains four node kinds and send/wait events, compiles with no issues', () => {
  const document = preset();
  assert.deepEqual(new Set([...document.graph.nodes.values()].map(node => node.kind)), new Set(['dialogue', 'condition', 'choice', 'event']));
  const result = compileDialogueEditorDocument(document, 'greeting', dialogueRuleCatalog);
  assert.deepEqual(result.issues, []); assert.ok(result.program);
  assert.equal(result.program.instructions.gate_check.kind, 'condition');
  const event = result.program.instructions.wait_gate; assert.equal(event.kind, 'event'); if (event.kind === 'event') assert.equal(event.mode, 'wait');
  assert.equal('display' in result.program.instructions.greeting, false);
});
test('V5 round trip preserves typed nodes, rules, ports and edges without aliasing', () => {
  const document = preset(), encoded = encodeDialogueEditorDocument(document);
  assert.deepEqual(encodeDialogueEditorDocument(parseDialogueEditorDocument(encoded)), encoded);
  encoded.graph.nodes.greeting.lines['line:greeting:main'].text = 'changed';
  assert.notEqual(document.graph.nodes.get('greeting')!.lines.get('line:greeting:main')!.text, 'changed');
  const cloned = cloneDialogueEditorDocument(document), node = cloned.graph.nodes.get('open_gate')!;
  if (node.kind === 'event') node.event.payload!.gateId = { type: 'literal', value: 'changed' };
  assert.notDeepEqual(encodeDialogueEditorDocument(cloned), encodeDialogueEditorDocument(document));
});
test('old schemas and legacy rules are rejected explicitly', () => {
  for (const version of [1, 2, 3, 4]) assert.throws(() => parseDialogueEditorDocument({ ...encodeDialogueEditorDocument(preset()), schemaVersion: version }), /V5/);
  const saved = encodeDialogueEditorDocument(preset());
  Object.assign(saved.graph.nodes.gate_check, { condition: { type: 'legacy', expression: 'allowed' } });
  assert.throws(() => parseDialogueEditorDocument(saved));
});
test('unfinished rules and multiple/dangling connections remain saveable drafts, compilation reports errors', () => {
  const document = createDialogueEditorDocument('draft', 'Draft'), condition = createDialogueEditorNode('check', { x: 400, y: 80 }, 'condition');
  document.graph.nodes.set(condition.id, condition);
  const start = document.graph.nodes.get('start')!, from = { nodeId: start.id, portId: start.outputOrder[0] }, to = { nodeId: condition.id, portId: condition.inputOrder[0] };
  const a = connectDialogueNodes(document, from, to), b = connectDialogueNodes(document, from, to);
  assert.notEqual(a, b); assert.equal(document.graph.edges.size, 2);
  connectDialogueNodes(document, { nodeId: 'absent', portId: 'missing' }, to);
  assert.deepEqual(validateDialogueEditorDocument(document), []);
  assert.deepEqual(encodeDialogueEditorDocument(parseDialogueEditorDocument(encodeDialogueEditorDocument(document))), encodeDialogueEditorDocument(document));
  const result = compileDialogueEditorDocument(document, 'start'); assert.equal(result.program, undefined);
  for (const code of ['ambiguous-route', 'invalid-source', 'node-rule']) assert.ok(result.issues.some(issue => issue.code === code), code);
});
test('valid loops stay allowed; closed flows and unreachable nodes only warn', () => {
  const document = createDialogueEditorDocument('loop', 'Loop'), start = document.graph.nodes.get('start')!;
  connectDialogueNodes(document, { nodeId: 'start', portId: start.outputOrder[0] }, { nodeId: 'start', portId: dialogueNodeInputPortId('start') });
  const island = createDialogueEditorNode('island', { x: 240, y: 96 }); island.outputs.clear(); island.outputOrder = []; document.graph.nodes.set(island.id, island);
  const result = compileDialogueEditorDocument(document, 'start'); assert.ok(result.program);
  assert.ok(result.issues.some(issue => issue.code === 'closed-flow' && issue.severity === 'warning'));
  assert.ok(result.issues.some(issue => issue.code === 'entry-unreachable-node'));
});
test('compilation catches node/branch mismatches, missing choices and absent entry', () => {
  const document = preset(), choices = document.graph.nodes.get('choices')!; choices.outputs.get(choices.outputOrder[0])!.branch = 'true';
  const result = compileDialogueEditorDocument(document, 'missing'); assert.equal(result.program, undefined);
  assert.ok(result.issues.some(issue => issue.code === 'missing-entry')); assert.ok(result.issues.some(issue => issue.code === 'invalid-branch'));
});
test('compiled instructions are independent snapshots of authoring data', () => {
  const document = preset(), result = compileDialogueEditorDocument(document, 'greeting'); assert.ok(result.program);
  const node = result.program.instructions.open_gate; if (node.kind === 'event') node.event.eventType = 'changed';
  const original = document.graph.nodes.get('open_gate')!; assert.equal(original.kind, 'event'); if (original.kind === 'event') assert.equal(original.event.eventType, 'dialogue.demo.gate.open');
});
