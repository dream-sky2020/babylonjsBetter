import test from 'node:test';
import assert from 'node:assert/strict';
import { createDialogueEditorDocument, createDialogueEditorNode, connectDialogueNodes, validateDialogueEditorDocument, encodeDialogueEditorDocument } from '../../core/dialogue-map/dialogueMap.ts';
import { copyDialogueGraph, pasteDialogueGraph, deleteDialogueNodes, arrangeDialogueNodes, dialogueRectsIntersect, normalizedSelectionRect, toggleDialogueSelection, applyDialogueSelection, dialogueSelectionMode } from './dialogueGraphEditing.ts';
import { captureDialogueProperties, applyDialogueProperties, dialoguePropertyPasteReason } from './dialoguePropertyEditing.ts';
import { createDialogueHistory, commitDialogueHistory, undoDialogueHistory } from './dialogueHistory.ts';

const graph = () => {
  const doc = createDialogueEditorDocument('test', 'Test');
  const a = doc.graph.nodes.get('start'), b = createDialogueEditorNode('b', { x: 385, y: 197 }, 'condition'), c = createDialogueEditorNode('c', { x: 800, y: 90 }, 'event');
  doc.graph.nodes.set('b', b); doc.graph.nodes.set('c', c);
  connectDialogueNodes(doc, { nodeId: a.id, portId: a.outputOrder[0] }, { nodeId: b.id, portId: b.inputOrder[0] });
  connectDialogueNodes(doc, { nodeId: b.id, portId: b.outputOrder[0] }, { nodeId: c.id, portId: c.inputOrder[0] });
  return doc;
};

test('graph copy regenerates identities and internal connections and preserves relative positions', () => {
  const source = graph(), original = encodeDialogueEditorDocument(source), clipboard = copyDialogueGraph(source, ['start', 'b']);
  assert.equal(clipboard.edges.length, 1);
  const pasted = pasteDialogueGraph(source, clipboard, { x: 1200, y: 480 });
  assert.equal(source.graph.nodes.size, 3); assert.equal(pasted.document.graph.nodes.size, 5);
  assert.equal(pasted.document.graph.edges.size, 3);
  const [a, b] = pasted.ids.map(id => pasted.document.graph.nodes.get(id));
  assert.equal(b.position.x - a.position.x, 385 - 96); assert.equal(b.position.y - a.position.y, 197 - 96);
  assert.equal(validateDialogueEditorDocument(pasted.document).length, 0);
  assert.ok(b.outputOrder.every(id => id.includes(b.id)));
  assert.ok(a.lineOrder.every(id => !source.graph.nodes.get('start').lines.has(id)));
  b.condition.left.key = 'detached';
  assert.notEqual(source.graph.nodes.get('b').condition.left.key, 'detached');
  assert.notEqual(clipboard.nodes[1].condition.left.key, 'detached');
  assert.deepEqual(encodeDialogueEditorDocument(source), original);
  const second = pasteDialogueGraph(pasted.document, clipboard, { x: 1200, y: 480 });
  assert.equal(new Set([...pasted.ids, ...second.ids]).size, 4);
});

test('clipboard survives source deletion and pastes across presets; malformed edge cannot partially publish', () => {
  const source = graph(), clipboard = copyDialogueGraph(source, ['start', 'b']);
  deleteDialogueNodes(source, ['start', 'b']);
  assert.equal(source.graph.edges.size, 0);
  const target = createDialogueEditorDocument('other', 'Other');
  const pasted = pasteDialogueGraph(target, clipboard, { x: 0, y: 0 });
  assert.equal(pasted.document.graph.nodes.size, 3);
  assert.equal(validateDialogueEditorDocument(pasted.document).length, 0);
  clipboard.edges[0].from.portId = 'missing';
  const before = encodeDialogueEditorDocument(target);
  assert.throws(() => pasteDialogueGraph(target, clipboard, { x: 0, y: 0 }), /端口/);
  assert.deepEqual(encodeDialogueEditorDocument(target), before);
});

test('one bulk graph commit undoes removal of every node and all connections', () => {
  const source = graph(), clipboard = copyDialogueGraph(source, [...source.graph.nodes.keys()]);
  const draft = structuredClone(source); deleteDialogueNodes(draft, [...draft.graph.nodes.keys()]);
  const history = commitDialogueHistory(createDialogueHistory({ test: source }), { test: draft });
  assert.equal(history.past.length, 1); assert.equal(history.present.test.graph.nodes.size, 0);
  assert.deepEqual(encodeDialogueEditorDocument(undoDialogueHistory(history).present.test), encodeDialogueEditorDocument(source));
  assert.equal(pasteDialogueGraph(draft, clipboard, { x: 0, y: 0 }).document.graph.edges.size, 2);
});

test('property paste preserves identity, geometry, fixed branches and edge endpoints', () => {
  const doc = graph(), a = doc.graph.nodes.get('start'), b = doc.graph.nodes.get('b');
  const edgeBefore = structuredClone(doc.graph.edges), position = { ...b.position }, input = [...b.inputOrder], outputs = [...b.outputOrder];
  a.title = 'Replacement'; a.display.whitespace = { header: true, bottom: false };
  applyDialogueProperties(doc, { nodeId: b.id, scope: 'node' }, captureDialogueProperties(doc, { nodeId: a.id, scope: 'node' }));
  applyDialogueProperties(doc, { nodeId: b.id, scope: 'spacing' }, captureDialogueProperties(doc, { nodeId: a.id, scope: 'spacing' }));
  assert.equal(b.title, 'Replacement'); assert.equal(b.display.whitespace.bottom, false);
  assert.deepEqual(b.position, position); assert.deepEqual(b.inputOrder, input); assert.deepEqual(b.outputOrder, outputs); assert.deepEqual(doc.graph.edges, edgeBefore);
  assert.ok(dialoguePropertyPasteReason(doc, { nodeId: b.id, scope: 'output', id: outputs[0] }, { scope: 'output', labels: ['bad'] }).includes('固定'));
  assert.ok(dialoguePropertyPasteReason(doc, { nodeId: b.id, scope: 'spacing' }, { scope: 'appearance' }).includes('不兼容'));
});

test('option replacement enforces counts; append creates new ports while existing edges remain untouched', () => {
  const doc = graph(), node = doc.graph.nodes.get('start'), first = node.outputOrder[0], before = structuredClone(doc.graph.edges);
  const target = { nodeId: node.id, scope: 'outputs' };
  const snapshot = { scope: 'outputs', labels: ['One', 'Two'] };
  assert.match(dialoguePropertyPasteReason(doc, target, snapshot), /数量不同/);
  assert.throws(() => applyDialogueProperties(doc, target, snapshot), /数量不同/);
  assert.equal(node.outputOrder.length, 1);
  applyDialogueProperties(doc, target, snapshot, true);
  assert.equal(node.outputOrder.length, 3); assert.equal(node.outputOrder[0], first);
  applyDialogueProperties(doc, target, { scope: 'outputs', labels: ['A', 'B', 'C'] });
  assert.equal(node.outputs.get(first).label, 'A'); assert.deepEqual(doc.graph.edges, before);
});

test('event and condition collections copy snapshots, reject incompatible appends and preserve outputs', () => {
  const doc = graph(), event = doc.graph.nodes.get('c'), condition = doc.graph.nodes.get('b');
  const e = captureDialogueProperties(doc, { nodeId: event.id, scope: 'events' });
  event.events[0].eventType = 'changed';
  applyDialogueProperties(doc, { nodeId: event.id, scope: 'events' }, e, true);
  assert.equal(event.events.length, 2); assert.equal(event.events[1].eventType, '');
  event.mode = 'wait'; event.events = [event.events[0]];
  assert.match(dialoguePropertyPasteReason(doc, { nodeId: event.id, scope: 'events' }, e, true), /一个事件/);
  const outputIds = [...condition.outputOrder], snapshot = captureDialogueProperties(doc, { nodeId: condition.id, scope: 'conditions' });
  applyDialogueProperties(doc, { nodeId: condition.id, scope: 'conditions' }, snapshot, true);
  assert.equal(condition.condition.conditions.length, 2); assert.deepEqual(condition.outputOrder, outputIds);
});

test('marquee includes intersecting cards, normalizes backwards drags and shift toggles', () => {
  const rect = normalizedSelectionRect({ x: 50, y: 70 }, { x: 0, y: 0 });
  assert.deepEqual(rect, { x: 0, y: 0, width: 50, height: 70 });
  assert.ok(dialogueRectsIntersect(rect, { x: 45, y: 60, width: 100, height: 100 }));
  assert.equal(dialogueRectsIntersect(rect, { x: 51, y: 71, width: 100, height: 100 }), false);
  assert.deepEqual(toggleDialogueSelection(['a', 'b'], ['b', 'c']), ['a', 'c']);
});

test('arrange uses actual card bounds for alignment and equal gaps and supports one undo', () => {
  const doc = graph(), ids = [...doc.graph.nodes.keys()], size = node => ({ width: node.id === 'b' ? 300 : 240, height: 200 });
  arrangeDialogueNodes(doc, ids, 'horizontal', size);
  const [a, b, c] = ids.map(id => doc.graph.nodes.get(id));
  assert.equal(b.position.x - a.position.x - size(a).width, c.position.x - b.position.x - size(b).width);
  arrangeDialogueNodes(doc, ids, 'right', size);
  assert.equal(a.position.x + size(a).width, b.position.x + size(b).width);
  arrangeDialogueNodes(doc, ids, 'bottom', size);
  assert.equal(a.position.y + size(a).height, c.position.y + size(c).height);
});


test('individual content and appearance panels copy only their editable values with detached references', () => {
  const doc = graph(), source = doc.graph.nodes.get('start');
  const target = createDialogueEditorNode('target', { x: 1200, y: 100 }); doc.graph.nodes.set(target.id, target);
  source.lines.get(source.lineOrder[0]).speaker = 'Speaker';
  source.inputs.get(source.inputOrder[0]).label = 'Incoming';
  source.outputs.get(source.outputOrder[0]).label = 'Continue';
  const identities = { id: target.id, lines: [...target.lineOrder], inputs: [...target.inputOrder], outputs: [...target.outputOrder], position: { ...target.position } };
  for (const scope of ['line', 'input', 'output']) {
    const readId = scope === 'line' ? source.lineOrder[0] : scope === 'input' ? source.inputOrder[0] : source.outputOrder[0];
    const writeId = scope === 'line' ? target.lineOrder[0] : scope === 'input' ? target.inputOrder[0] : target.outputOrder[0];
    applyDialogueProperties(doc, { nodeId: target.id, scope, id: writeId }, captureDialogueProperties(doc, { nodeId: source.id, scope, id: readId }));
  }
  assert.equal(target.lines.get(target.lineOrder[0]).speaker, 'Speaker');
  assert.equal(target.inputs.get(target.inputOrder[0]).label, 'Incoming');
  assert.equal(target.outputs.get(target.outputOrder[0]).label, 'Continue');
  const appearance = captureDialogueProperties(doc, { nodeId: source.id, scope: 'appearance' });
  applyDialogueProperties(doc, { nodeId: target.id, scope: 'appearance' }, appearance);
  target.display.whitespace.bottom = false;
  assert.equal(appearance.display.whitespace.bottom, true);
  assert.equal(source.display.whitespace.bottom, true);
  assert.deepEqual({ id: target.id, lines: target.lineOrder, inputs: target.inputOrder, outputs: target.outputOrder, position: target.position }, identities);
  const event = doc.graph.nodes.get('c'), comparison = doc.graph.nodes.get('b');
  const e = captureDialogueProperties(doc, { nodeId: event.id, scope: 'event', index: 0 });
  event.events[0].eventType = 'changed';
  applyDialogueProperties(doc, { nodeId: event.id, scope: 'event', index: 0 }, e);
  assert.equal(event.events[0].eventType, '');
  const c = captureDialogueProperties(doc, { nodeId: comparison.id, scope: 'condition', index: 0 });
  comparison.condition.operator = 'ne';
  applyDialogueProperties(doc, { nodeId: comparison.id, scope: 'condition', index: 0 }, c);
  assert.equal(comparison.condition.conditions[0].operator, 'eq');
});

test('dialogue collection replacement and append do not affect outputs, connections or the clipboard', () => {
  const doc = graph(), node = doc.graph.nodes.get('start'), target = { nodeId: node.id, scope: 'lines' };
  const clipboard = captureDialogueProperties(doc, target), edges = structuredClone(doc.graph.edges), outputs = structuredClone(node.outputs);
  applyDialogueProperties(doc, target, clipboard, true);
  assert.equal(node.lines.size, 2); assert.equal(new Set(node.lineOrder).size, 2);
  applyDialogueProperties(doc, target, clipboard);
  assert.equal(node.lines.size, 1); assert.deepEqual(node.outputs, outputs); assert.deepEqual(doc.graph.edges, edges);
  node.lines.get(node.lineOrder[0]).text = 'changed';
  assert.notEqual(clipboard.lines[0].text, 'changed');
  assert.match(dialoguePropertyPasteReason(doc, { nodeId: 'missing', scope: 'lines' }, clipboard), /不存在/);
});


test('selection modes add only missing nodes and subtract only existing hits without changing inputs', () => {
  const base = ['a', 'b'], hit = ['b', 'c', 'c'];
  assert.deepEqual(applyDialogueSelection(base, hit, 'add'), ['a', 'b', 'c']);
  assert.deepEqual(applyDialogueSelection(base, hit, 'subtract'), ['a']);
  assert.deepEqual(applyDialogueSelection(base, hit, 'toggle'), ['a', 'c']);
  assert.deepEqual(applyDialogueSelection(base, hit, 'replace'), ['b', 'c']);
  assert.deepEqual(applyDialogueSelection(base, [], 'add'), base);
  assert.deepEqual(applyDialogueSelection(base, [], 'subtract'), base);
  assert.deepEqual(applyDialogueSelection([], hit, 'subtract'), []);
  assert.deepEqual(base, ['a', 'b']); assert.deepEqual(hit, ['b', 'c', 'c']);
});

test('selection modifiers have predictable precedence with Command supported for add', () => {
  assert.equal(dialogueSelectionMode({}), 'replace');
  assert.equal(dialogueSelectionMode({ ctrlKey: true }), 'add');
  assert.equal(dialogueSelectionMode({ metaKey: true }), 'add');
  assert.equal(dialogueSelectionMode({ altKey: true }), 'subtract');
  assert.equal(dialogueSelectionMode({ shiftKey: true }), 'toggle');
  assert.equal(dialogueSelectionMode({ ctrlKey: true, shiftKey: true }), 'add');
  assert.equal(dialogueSelectionMode({ altKey: true, ctrlKey: true, shiftKey: true }), 'subtract');
});
