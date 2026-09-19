import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDefaultDialogueNodeDisplay,
  createDialogueEditorDocument,
  dialogueEdgeId,
  dialogueLineId,
  dialogueNodeInputPortId,
  dialogueOptionOutputPortId,
  encodeDialogueEditorDocument,
  migrateLegacyDialogueMapPreset,
  parseDialogueEditorDocument,
  resolveDialogueEditorSelection,
  validateDialogueEditorDocument,
} from './dialogueMap.ts';
import type { DialogueEditorEdge, DialogueEditorSelection, LegacyDialogueMapPreset } from './dialogueMap.types.ts';

const legacyVillagePreset: LegacyDialogueMapPreset = {
  schemaVersion: 1,
  presetKey: 'village_gate',
  name: '村口守卫',
  startNodeId: 'greeting',
  nodes: {
    greeting: {
      id: 'greeting', kind: 'dialogue', title: '守卫招呼', speaker: '村口守卫',
      text: '旅行者，前面的路最近不太安全。', position: { x: 72, y: 168 },
      choices: [{ id: 'continue', text: '继续', targetNodeId: 'ask_reason' }],
    },
    ask_reason: {
      id: 'ask_reason', kind: 'choice', title: '如何回应', speaker: '玩家', text: '你打算怎么回应？',
      position: { x: 384, y: 144 }, choices: [
        { id: 'ask', text: '发生什么事了？', targetNodeId: 'explain' },
        { id: 'leave', text: '我会小心的。', targetNodeId: 'farewell' },
      ],
    },
    explain: {
      id: 'explain', kind: 'dialogue', title: '说明危险', speaker: '村口守卫',
      text: '北边树林里出现了魔物。若你愿意帮忙，村长会感谢你的。', position: { x: 744, y: 48 },
      choices: [{ id: 'accept', text: '我去看看。', targetNodeId: 'quest_end', event: 'quest:forest:start' }],
    },
    quest_end: { id: 'quest_end', kind: 'end', title: '接受委托', speaker: '系统', text: '已接受任务：树林里的魔物。', position: { x: 1104, y: 24 }, choices: [] },
    farewell: { id: 'farewell', kind: 'end', title: '结束交谈', speaker: '村口守卫', text: '一路小心。', position: { x: 768, y: 312 }, choices: [] },
  },
};

test('nodes and edges are independent Map-backed first-class objects', () => {
  const document = migrateLegacyDialogueMapPreset(legacyVillagePreset);
  assert.ok(document.graph.nodes instanceof Map);
  assert.ok(document.graph.edges instanceof Map);
  assert.equal(document.graph.nodes.size, 5);
  const edge = document.graph.edges.get(dialogueEdgeId('greeting', 'continue'));
  assert.deepEqual(edge?.from, { nodeId: 'greeting', portId: dialogueOptionOutputPortId('greeting', 'continue') });
  assert.deepEqual(edge?.to, { nodeId: 'ask_reason', portId: dialogueNodeInputPortId('ask_reason') });
});

test('nodes, lines, options and edges remain addressable by stable IDs', () => {
  const document = migrateLegacyDialogueMapPreset(legacyVillagePreset);
  const node = document.graph.nodes.get('greeting')!;
  assert.equal(node.lines.get(dialogueLineId('greeting'))?.speaker, '村口守卫');
  assert.equal(node.options.get('continue')?.text, '继续');
  assert.equal(document.graph.edges.get(dialogueEdgeId('greeting', 'continue'))?.to.nodeId, 'ask_reason');
});

test('every DialogueEditorSelection variant resolves to its exact target', () => {
  const document = migrateLegacyDialogueMapPreset(legacyVillagePreset);
  const selections: DialogueEditorSelection[] = [
    { kind: 'node', nodeId: 'greeting' },
    { kind: 'line', nodeId: 'greeting', lineId: dialogueLineId('greeting') },
    { kind: 'option', nodeId: 'greeting', optionId: 'continue' },
    { kind: 'edge', edgeId: dialogueEdgeId('greeting', 'continue') },
    { kind: 'port', nodeId: 'greeting', portId: dialogueOptionOutputPortId('greeting', 'continue') },
  ];
  assert.deepEqual(selections.map((selection) => resolveDialogueEditorSelection(document, selection)?.kind), ['node', 'line', 'option', 'edge', 'port']);
  assert.equal(resolveDialogueEditorSelection(document, { kind: 'line', nodeId: 'greeting', lineId: 'missing' }), undefined);
});

test('display defaults use grid units and invalid sizes or positions are reported', () => {
  assert.deepEqual(createDefaultDialogueNodeDisplay('end'), {
    shape: 'rectangle', colorToken: 'red-muted', headerColorToken: 'red-header', widthUnits: 9, heightUnits: 5, showSpeakerList: true, showPreviewText: true,
  });
  const document = createDialogueEditorDocument('intro', 'Intro');
  const node = document.graph.nodes.get('start')!;
  node.position.x = 10;
  node.display.widthUnits = 4.5;
  const codes = validateDialogueEditorDocument(document).map((issue) => issue.code);
  assert.ok(codes.includes('off-grid-position'));
  assert.ok(codes.includes('invalid-node-size'));
});

test('legacy village preset migrates, serializes as V2 and reloads without losing content', () => {
  const migrated = migrateLegacyDialogueMapPreset(legacyVillagePreset, 'village_gate');
  const encoded = encodeDialogueEditorDocument(migrated);
  assert.equal(encoded.schemaVersion, 2);
  assert.equal(encoded.graph.nodes.greeting.lines[dialogueLineId('greeting')].text, '旅行者，前面的路最近不太安全。');
  const reloaded = parseDialogueEditorDocument(encoded, 'village_gate');
  assert.equal(reloaded.graph.nodes.get('explain')?.options.get('accept')?.event, 'quest:forest:start');
  assert.equal(reloaded.graph.edges.size, migrated.graph.edges.size);
  assert.deepEqual(validateDialogueEditorDocument(reloaded), []);
});

test('invalid nodes, ports and dangling edges are all reported', () => {
  const document = createDialogueEditorDocument('broken', 'Broken');
  const start = document.graph.nodes.get('start')!;
  const optionPortId = dialogueOptionOutputPortId('start', 'go');
  start.options.set('go', { id: 'go', text: 'Go', outputPortId: optionPortId });
  start.optionOrder.push('go');
  const edge: DialogueEditorEdge = {
    id: 'broken-edge', from: { nodeId: 'start', portId: optionPortId }, to: { nodeId: 'missing', portId: 'missing-in' },
  };
  document.graph.edges.set(edge.id, edge);
  document.graph.startNodeId = 'missing-start';
  const codes = validateDialogueEditorDocument(document).map((issue) => issue.code);
  assert.ok(codes.includes('missing-start'));
  assert.ok(codes.includes('invalid-option-port'));
  assert.ok(codes.includes('missing-edge-to-node'));
  assert.ok(codes.includes('dangling-edge-from-port'));
  assert.ok(codes.includes('dangling-edge-to-port'));
});

test('duplicate node and edge identities are detected even when Map storage keys differ', () => {
  const document = migrateLegacyDialogueMapPreset(legacyVillagePreset);
  const greeting = document.graph.nodes.get('greeting')!;
  document.graph.nodes.set('greeting-alias', { ...greeting, lines: new Map(greeting.lines), options: new Map(greeting.options), ports: new Map(greeting.ports) });
  const edge = document.graph.edges.get(dialogueEdgeId('greeting', 'continue'))!;
  document.graph.edges.set('edge-alias', { ...edge, from: { ...edge.from }, to: { ...edge.to } });
  const codes = validateDialogueEditorDocument(document).map((issue) => issue.code);
  assert.ok(codes.includes('duplicate-node-id'));
  assert.ok(codes.includes('duplicate-edge-id'));
});

test('end nodes with outgoing edges are rejected', () => {
  const document = migrateLegacyDialogueMapPreset(legacyVillagePreset);
  const end = document.graph.nodes.get('quest_end')!;
  const portId = 'port:quest_end:invalid';
  end.ports.set(portId, { id: portId, direction: 'output', role: 'flow' });
  document.graph.edges.set('edge:quest_end:invalid', { id: 'edge:quest_end:invalid', from: { nodeId: 'quest_end', portId }, to: { nodeId: 'farewell', portId: dialogueNodeInputPortId('farewell') } });
  assert.ok(validateDialogueEditorDocument(document).some((issue) => issue.code === 'end-has-output-edge'));
});
