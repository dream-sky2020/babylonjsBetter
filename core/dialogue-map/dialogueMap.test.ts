import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDialogueEditorDocument, createDialogueEditorNode, diagnoseDialogueEditorDocument,
  diagnoseDialogueEntry, dialogueEdgeId, dialogueNodeInputPortId, dialogueOutputPortId,
  encodeDialogueEditorDocument, migrateLegacyDialogueMapPreset, parseDialogueEditorDocument,
  validateDialogueEditorDocument,
} from './dialogueMap.ts';
import { startDialogue, stepDialogue } from './dialogueRuntime.ts';
import type { LegacyDialogueMapPreset } from './dialogueMap.types.ts';

const legacy: LegacyDialogueMapPreset = {
  schemaVersion: 1, presetKey: 'village', name: '村口', startNodeId: 'greeting', nodes: {
    greeting: { id: 'greeting', kind: 'choice', title: '招呼', speaker: '守卫', text: '站住。', position: { x: 72, y: 168 }, choices: [{ id: 'go', text: '继续', targetNodeId: 'end', condition: 'allowed', event: 'quest:start' }] },
    end: { id: 'end', kind: 'end', title: '结束', speaker: '守卫', text: '一路小心。', position: { x: 384, y: 168 }, choices: [] },
  },
};

test('V1 migrates directly to unified V3 nodes and output ports', () => {
  const document = migrateLegacyDialogueMapPreset(legacy); const greeting = document.graph.nodes.get('greeting')!; const outputId = dialogueOutputPortId('greeting', 'go');
  assert.equal(document.schemaVersion, 3); assert.equal('startNodeId' in document.graph, false); assert.equal('kind' in greeting, false); assert.equal(greeting.outputs.get(outputId)?.label, '继续'); assert.deepEqual(greeting.outputs.get(outputId)?.effects, ['quest:start']); assert.equal(document.graph.edges.get(dialogueEdgeId('greeting', 'go'))?.from.portId, outputId);
});

test('V2 migrates options, removes kinds and preserves edges', () => {
  const v2 = { schemaVersion: 2, presetKey: 'old', name: 'Old', graph: { startNodeId: 'a', nodes: { a: { id: 'a', kind: 'dialogue', title: 'A', position: { x: 0, y: 0 }, display: { shape: 'rectangle', colorToken: 'blue-muted', widthUnits: 10, heightUnits: 6 }, lines: {}, lineOrder: [], options: { next: { id: 'next', text: 'Next', outputPortId: 'old-output' } }, optionOrder: ['next'], ports: { input: { id: 'input', direction: 'input', role: 'flow' }, 'old-output': { id: 'old-output', direction: 'output', role: 'option', optionId: 'next' } } }, b: { id: 'b', kind: 'end', title: 'B', position: { x: 240, y: 0 }, display: { shape: 'rectangle', colorToken: 'red-muted', widthUnits: 9, heightUnits: 5 }, lines: {}, lineOrder: [], options: {}, optionOrder: [], ports: { 'port:b:in': { id: 'port:b:in', direction: 'input', role: 'flow' } } } }, edges: { edge: { id: 'edge', from: { nodeId: 'a', portId: 'old-output' }, to: { nodeId: 'b', portId: 'port:b:in' } } } } };
  const document = parseDialogueEditorDocument(v2); assert.equal(document.graph.nodes.get('a')?.outputs.size, 1); assert.equal(document.graph.edges.get('edge')?.from.portId, dialogueOutputPortId('a', 'next')); assert.deepEqual(validateDialogueEditorDocument(document), []);
});

test('V3 round trip preserves first-class inputs and outputs', () => {
  const document = createDialogueEditorDocument('test', 'Test'); const node = document.graph.nodes.get('start')!; const outputId = dialogueOutputPortId(node.id, 'auto'); node.outputs.set(outputId, { id: outputId, label: 'Go', activation: { type: 'auto', priority: 2 }, effects: ['opened'] }); node.outputOrder.push(outputId); const target = createDialogueEditorNode('target', { x: 240, y: 96 }); document.graph.nodes.set(target.id, target); document.graph.edges.set('edge', { id: 'edge', from: { nodeId: node.id, portId: outputId }, to: { nodeId: target.id, portId: dialogueNodeInputPortId(target.id) } });
  const encoded = encodeDialogueEditorDocument(document); const parsed = parseDialogueEditorDocument(encoded); assert.equal(encoded.schemaVersion, 3); assert.equal(parsed.graph.nodes.get('start')?.outputs.get(outputId)?.activation.type, 'auto'); assert.deepEqual(validateDialogueEditorDocument(parsed), []);
});

test('structural validation and quality diagnostics are separated', () => {
  const document = createDialogueEditorDocument('test', 'Test'); const node = document.graph.nodes.get('start')!; const outputId = dialogueOutputPortId(node.id, 'conditional'); node.outputs.set(outputId, { id: outputId, activation: { type: 'choice' }, condition: 'flag' }); node.outputOrder.push(outputId);
  assert.deepEqual(validateDialogueEditorDocument(document), []); const codes = diagnoseDialogueEditorDocument(document).map((item) => item.code); assert.ok(codes.includes('dangling-output')); assert.ok(codes.includes('missing-fallback-output'));
});

test('reachability is diagnosed relative to an explicit entry', () => {
  const document = createDialogueEditorDocument('test', 'Test'); document.graph.nodes.set('island', createDialogueEditorNode('island', { x: 240, y: 96 })); const issues = diagnoseDialogueEntry(document, 'start'); assert.ok(issues.some((item) => item.code === 'entry-unreachable-node' && item.nodeId === 'island')); assert.ok(diagnoseDialogueEntry(document, 'island').some((item) => item.nodeId === 'start'));
});

test('runtime chooses automatic outputs and ends at nodes without outputs', () => {
  const document = createDialogueEditorDocument('runtime', 'Runtime'); const start = document.graph.nodes.get('start')!; const end = createDialogueEditorNode('end', { x: 240, y: 96 }); document.graph.nodes.set(end.id, end); const outputId = dialogueOutputPortId('start', 'next'); start.outputs.set(outputId, { id: outputId, activation: { type: 'auto', priority: 1 }, effects: ['arrived'] }); start.outputOrder.push(outputId); document.graph.edges.set('edge', { id: 'edge', from: { nodeId: 'start', portId: outputId }, to: { nodeId: 'end', portId: dialogueNodeInputPortId('end') } }); const session = startDialogue(document, 'start'); const transition = stepDialogue(session); assert.deepEqual(transition, { type: 'transition', nodeId: 'start', outputId, targetNodeId: 'end', effects: ['arrived'] }); assert.deepEqual(stepDialogue(session), { type: 'ended', nodeId: 'end', reason: 'no-outputs' });
});
