import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createDialogueEditorDocument, createDialogueEditorNode, connectDialogueNodes, dialogueNodeInputPortId, encodeDialogueEditorDocument, parseDialogueEditorDocument, validateDialogueEditorDocument, cloneDialogueEditorDocument } from './dialogueMap.ts';
import { compileDialogueEditorDocument } from './dialogueCompiler.ts';
import { dialogueRuleCatalog } from '../../tools/dialogue-map-canvas-lab/dialogueRuleCatalog.ts';

const preset = () => parseDialogueEditorDocument(JSON.parse(readFileSync(new URL('../../config/dialogueMapPresets/village_gate.json', import.meta.url), 'utf8')));
test('new preset contains three node kinds and send/wait events, compiles with no issues', () => {
  const document = preset();
  assert.deepEqual(new Set([...document.graph.nodes.values()].map(node => node.kind)), new Set(['condition', 'choice', 'event']));
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
test('unfinished rules and dangling connections remain saveable drafts, compilation reports errors', () => {
  const document = createDialogueEditorDocument('draft', 'Draft'), condition = createDialogueEditorNode('check', { x: 400, y: 80 }, 'condition');
  document.graph.nodes.set(condition.id, condition);
  const start = document.graph.nodes.get('start')!, from = { nodeId: start.id, portId: start.outputOrder[0] }, to = { nodeId: condition.id, portId: condition.inputOrder[0] };
  connectDialogueNodes(document, from, to);
  connectDialogueNodes(document, { nodeId: 'absent', portId: 'missing' }, { nodeId: 'check', portId: condition.inputOrder[0] });
  assert.deepEqual(validateDialogueEditorDocument(document), []);
  assert.deepEqual(encodeDialogueEditorDocument(parseDialogueEditorDocument(encodeDialogueEditorDocument(document))), encodeDialogueEditorDocument(document));
  const result = compileDialogueEditorDocument(document, 'start'); assert.equal(result.program, undefined);
  for (const code of ['invalid-source', 'node-rule']) assert.ok(result.issues.some(issue => issue.code === code), code);
});
test('each output accepts one edge while inputs can merge multiple edges, including imported data', () => {
  const document = createDialogueEditorDocument('ports', 'Ports'), start = document.graph.nodes.get('start')!;
  const first = createDialogueEditorNode('first', { x: 240, y: 80 });
  const second = createDialogueEditorNode('second', { x: 440, y: 80 });
  document.graph.nodes.set(first.id, first); document.graph.nodes.set(second.id, second);
  const from = { nodeId: start.id, portId: start.outputOrder[0] };
  const to = { nodeId: first.id, portId: first.inputOrder[0] };
  connectDialogueNodes(document, from, to);
  assert.throws(() => connectDialogueNodes(document, from, { nodeId: second.id, portId: second.inputOrder[0] }), /出口只能连接一条线/);
  connectDialogueNodes(document, { nodeId: second.id, portId: second.outputOrder[0] }, to);
  assert.equal(document.graph.edges.size, 2);
  assert.deepEqual(validateDialogueEditorDocument(document), []);
  assert.equal(parseDialogueEditorDocument(encodeDialogueEditorDocument(document)).graph.edges.size, 2);
  document.graph.edges.set('duplicate-output', { id: 'duplicate-output', from, to: { nodeId: second.id, portId: second.inputOrder[0] } });
  const issues = validateDialogueEditorDocument(document);
  assert.ok(issues.some(issue => issue.code === 'occupied-output'));
  assert.throws(() => parseDialogueEditorDocument(encodeDialogueEditorDocument(document)), /只能连接一条线/);
});
test('valid loops stay allowed; closed flows and unreachable nodes only warn', () => {
  const document = createDialogueEditorDocument('loop', 'Loop'), start = document.graph.nodes.get('start')!;
  const other = createDialogueEditorNode('other', { x: 240, y: 96 }); document.graph.nodes.set(other.id, other);
  connectDialogueNodes(document, { nodeId: 'start', portId: start.outputOrder[0] }, { nodeId: 'other', portId: dialogueNodeInputPortId('other') });
  connectDialogueNodes(document, { nodeId: 'other', portId: other.outputOrder[0] }, { nodeId: 'start', portId: dialogueNodeInputPortId('start') });
  const island = createDialogueEditorNode('island', { x: 480, y: 96 }); island.outputs.clear(); island.outputOrder = []; document.graph.nodes.set(island.id, island);
  const result = compileDialogueEditorDocument(document, 'start'); assert.ok(result.program);
  assert.ok(result.issues.some(issue => issue.code === 'closed-flow' && issue.severity === 'warning'));
  assert.ok(result.issues.some(issue => issue.code === 'entry-unreachable-node'));
});
test('a node cannot connect its output to its own input, including via imported data', () => {
  const document = createDialogueEditorDocument('self', 'Self'), node = document.graph.nodes.get('start')!;
  const from = { nodeId: node.id, portId: node.outputOrder[0] }, to = { nodeId: node.id, portId: node.inputOrder[0] };
  assert.throws(() => connectDialogueNodes(document, from, to), /自身入口/);
  assert.equal(document.graph.edges.size, 0);
  document.graph.edges.set('self-edge', { id: 'self-edge', from, to });
  assert.ok(validateDialogueEditorDocument(document).some(issue => issue.code === 'self-connection' && issue.edgeId === 'self-edge'));
  assert.throws(() => parseDialogueEditorDocument(encodeDialogueEditorDocument(document)), /自身入口/);
  assert.equal(compileDialogueEditorDocument(document, 'start').program, undefined);
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

test('one continuation and multiple choices share dialogue content in compiled instructions', () => {
  const document = createDialogueEditorDocument('unified', 'Unified'), node = document.graph.nodes.get('start')!;
  assert.equal(node.kind, 'choice'); assert.equal(node.outputs.size, 1);
  const single = compileDialogueEditorDocument(document, 'start').program!.instructions.start;
  assert.equal(single.kind, 'choice');
  if (single.kind === 'choice') { assert.equal(single.lines.length, 1); assert.equal(single.choices.length, 1); }
  node.outputs.set('alternate', { id: 'alternate', label: 'Another path', branch: 'choice' }); node.outputOrder.push('alternate');
  const multiple = compileDialogueEditorDocument(document, 'start').program!.instructions.start;
  if (multiple.kind === 'choice') { assert.equal(multiple.lines.length, 1); assert.equal(multiple.choices.length, 2); }
});

test('every card requires exactly one input at the storage boundary', () => {
  for (const kind of ['choice', 'condition', 'event'] as const) {
    const document = createDialogueEditorDocument('input', 'Input');
    const node = createDialogueEditorNode('card', { x: 0, y: 0 }, kind); document.graph.nodes.set(node.id, node);
    assert.equal(node.inputs.size, 1);
    node.inputs.set('extra', { id: 'extra' }); node.inputOrder.push('extra');
    assert.ok(validateDialogueEditorDocument(document).some(issue => issue.code === 'single-input'));
    assert.throws(() => parseDialogueEditorDocument(encodeDialogueEditorDocument(document)), /一个输入/);
    node.inputs.clear(); node.inputOrder = [];
    assert.ok(validateDialogueEditorDocument(document).some(issue => issue.code === 'single-input'));
  }
});
