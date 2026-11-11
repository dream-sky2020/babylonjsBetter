import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createDialogueEditorDocument, createDialogueEditorNode, connectDialogueNodes, dialogueNodeInputPortId, encodeDialogueEditorDocument, parseDialogueEditorDocument, validateDialogueEditorDocument, cloneDialogueEditorDocument, resolveDialogueEditorSelection } from './dialogueMap.ts';
import { compileDialogueEditorDocument } from './dialogueCompiler.ts';
import { dialogueRuleCatalog } from '../../labs/standalone/dialogue-map-canvas-lab/dialogueRuleCatalog.ts';

const preset = () => parseDialogueEditorDocument(JSON.parse(readFileSync(new URL('../../config/dialogueMapPresets/village_gate.json', import.meta.url), 'utf8')));
test('text bindings survive storage and compilation reports unbound placeholders', () => {
  const document = createDialogueEditorDocument('text', 'Text');
  document.textVariables = { 次数: { key: 'counter', path: [] } };
  const node = document.graph.nodes.get('start')!;
  node.lines.get(node.lineOrder[0])!.text = '{次数}，{未绑定}，{{普通文字}}';
  const restored = parseDialogueEditorDocument(encodeDialogueEditorDocument(document));
  const result = compileDialogueEditorDocument(restored, node.id);
  assert.deepEqual(result.program?.textVariables, document.textVariables);
  assert.deepEqual(result.issues.filter(issue => issue.code === 'text-variable').map(issue => issue.message), ['对白变量「未绑定」未绑定。']);
});
test('V6 preset compiles publishing, waiting and map actions', () => {
  const document = preset();
  assert.deepEqual(new Set([...document.graph.nodes.values()].map(node => node.kind)), new Set(['condition', 'choice', 'event', 'action']));
  const result = compileDialogueEditorDocument(document, 'greeting', dialogueRuleCatalog);
  assert.deepEqual(result.issues.filter(issue => issue.severity === 'error'), []); assert.ok(result.program);
  assert.equal(result.program.instructions.open_gate.kind, 'action');
  assert.equal(result.program.instructions.gate_check.kind, 'condition');
  const event = result.program.instructions.wait_gate; assert.equal(event.kind, 'event'); if (event.kind === 'event') assert.equal(event.mode, 'wait');
  assert.equal('display' in result.program.instructions.greeting, false);
});
test('V6 round trip preserves typed nodes, rules, ports and edges without aliasing', () => {
  const document = preset(), encoded = encodeDialogueEditorDocument(document);
  assert.deepEqual(encodeDialogueEditorDocument(parseDialogueEditorDocument(encoded)), encoded);
  encoded.graph.nodes.greeting.lines['line:greeting:main'].text = 'changed';
  assert.notEqual(document.graph.nodes.get('greeting')!.lines.get('line:greeting:main')!.text, 'changed');
  const cloned = cloneDialogueEditorDocument(document), node = cloned.graph.nodes.get('accept_quest')!;
  if (node.kind === 'event') node.events[0].payload!.questId = { type: 'literal', value: 'changed' };
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
  const node = result.program.instructions.accept_quest; if (node.kind === 'event') node.events[0].eventType = 'changed';
  const original = document.graph.nodes.get('accept_quest')!; assert.equal(original.kind, 'event'); if (original.kind === 'event') assert.equal(original.events[0].eventType, 'dialogue.quest.accepted');
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

test('legacy conditions migrate to a single formula using preset bindings', () => {
  const document = preset();
  const node = document.graph.nodes.get('gate_check');
  assert.ok(node?.kind === 'condition');
  assert.match(node.formula ?? '', /&&/);
  assert.equal(node.condition, undefined);
  assert.ok(Object.keys(document.textVariables ?? {}).length);
  assert.equal(resolveDialogueEditorSelection(document, { kind: 'condition-mode', nodeId: 'gate_check' })?.kind, 'condition-mode');
  assert.equal(resolveDialogueEditorSelection(document, { kind: 'condition', nodeId: 'gate_check', conditionIndex: 1 }), undefined);
  assert.equal(resolveDialogueEditorSelection(document, { kind: 'condition', nodeId: 'gate_check', conditionIndex: 99 }), undefined);
  assert.equal(resolveDialogueEditorSelection(document, { kind: 'condition-mode', nodeId: 'greeting' }), undefined);
});

test('event content selection resolves only event cards', () => {
  const document = preset();
  const target = resolveDialogueEditorSelection(document, { kind: 'event', nodeId: 'accept_quest' });
  assert.equal(target?.kind, 'event'); assert.equal(target?.node.id, 'accept_quest');
  assert.equal(resolveDialogueEditorSelection(document, { kind: 'event', nodeId: 'greeting' }), undefined);
});

test('send lists compile in order while wait and empty lists enforce event counts', () => {
  const document = preset(), node = document.graph.nodes.get('accept_quest')!; assert.ok(node.kind === 'event' && node.mode === 'send');
  node.events.push({ type: 'event', eventType: 'second.event', version: 1 });
  assert.deepEqual(validateDialogueEditorDocument(document), []);
  const program = compileDialogueEditorDocument(document, 'greeting').program!;
  const instruction = program.instructions.accept_quest; assert.ok(instruction.kind === 'event');
  assert.deepEqual(instruction.events.map(event => event.eventType), ['dialogue.quest.accepted', 'second.event']);
  assert.equal(resolveDialogueEditorSelection(document, { kind: 'event', nodeId: node.id, eventIndex: 1 })?.kind, 'event');
  assert.equal(resolveDialogueEditorSelection(document, { kind: 'event', nodeId: node.id, eventIndex: 2 }), undefined);
  const wait = document.graph.nodes.get('wait_gate')!; assert.ok(wait.kind === 'event' && wait.mode === 'wait');
  wait.events.push({ type: 'event', eventType: 'extra', version: 1 });
  assert.throws(() => parseDialogueEditorDocument(encodeDialogueEditorDocument(document)), /等待节点/);
  wait.events.pop(); node.events = [];
  assert.throws(() => parseDialogueEditorDocument(encodeDialogueEditorDocument(document)), /触发节点/);
});

test('V5 wait payload migrates to equality filters with its existing ports and edges', () => {
  const raw = encodeDialogueEditorDocument(preset());
  const node = raw.graph.nodes.wait_gate;
  assert.ok(node.kind === 'event' && node.mode === 'wait');
  const { wait: _wait, ...legacyNode } = node;
  legacyNode.events[0].payload = { gateId: { type: 'literal', value: 'north' } };
  const { open_gate: _action, ...legacyNodes } = raw.graph.nodes;
  const migrated = parseDialogueEditorDocument({ ...raw, schemaVersion: 5,
    graph: { ...raw.graph, nodes: { ...legacyNodes, wait_gate: legacyNode } } });
  assert.equal(migrated.schemaVersion, 6);
  const wait = migrated.graph.nodes.get('wait_gate')!;
  assert.ok(wait.kind === 'event' && wait.mode === 'wait');
  assert.equal(wait.events[0].payload, undefined);
  assert.deepEqual(wait.wait.filters, [{ field: 'gateId', operator: 'eq', value: { type: 'literal', value: 'north' } }]);
  assert.deepEqual(wait.outputOrder, node.outputOrder);
  assert.deepEqual(encodeDialogueEditorDocument(migrated).graph.edges, raw.graph.edges);
});


test('node whitespace survives storage, remains independent and validates boolean flags', () => {
  const document = preset();
  const node = document.graph.nodes.get('open_gate')!;
  node.display.whitespace = { header: true, content: false, outputs: false, top: false, sections: false, bottom: false, height: false };
  const encoded = encodeDialogueEditorDocument(document);
  const restored = parseDialogueEditorDocument(encoded);
  assert.deepEqual(restored.graph.nodes.get('open_gate')!.display.whitespace, node.display.whitespace);
  assert.equal(restored.graph.nodes.get('gate_check')!.display.whitespace, undefined);
  assert.deepEqual(resolveDialogueEditorSelection(restored, { kind: 'spacing', nodeId: node.id }), { kind: 'spacing', node: restored.graph.nodes.get(node.id) });
  restored.graph.nodes.get(node.id)!.display.whitespace!.header = false;
  assert.equal(node.display.whitespace.header, true);
  for (const invalid of [null, [], true, { header: 'true' }, { unknown: true }]) {
    const raw = encodeDialogueEditorDocument(document);
    Object.assign(raw.graph.nodes.open_gate.display, { whitespace: invalid });
    assert.throws(() => parseDialogueEditorDocument(raw), /留白/);
  }
});
