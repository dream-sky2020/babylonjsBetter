import test from 'node:test';
import assert from 'node:assert/strict';
import { createDialogueEditorDocument, createDialogueEditorNode, connectDialogueNodes, encodeDialogueEditorDocument } from '../../../core/dialogue-map/dialogueMap.ts';
import { startDialogueFlowPreview, chooseDialogueFlowPreview, nextDialogueFlowPreviewLine } from './dialogueFlowPreviewState.ts';

const fixture = () => {
  const document = createDialogueEditorDocument('preview', 'Preview');
  const add = (id, kind) => { const node = createDialogueEditorNode(id, { x: 0, y: 0 }, kind); document.graph.nodes.set(id, node); return node; };
  const send = add('send', 'event'), wait = add('wait', 'event'), check = add('check', 'condition'), end = add('end', 'choice');
  send.events = [{ type: 'event', eventType: 'first', version: 1 }, { type: 'event', eventType: 'second', version: 1 }];
  wait.mode = 'wait'; wait.events[0].eventType = 'ready';
  const connect = (from, to, index = 0) => connectDialogueNodes(document, { nodeId: from.id, portId: from.outputOrder[index] }, { nodeId: to.id, portId: to.inputOrder[0] });
  connect(document.graph.nodes.get('start'), send); connect(send, wait); connect(wait, check); connect(check, end);
  return { document, send, wait, check, end, connect };
};
test('preview preserves draft while choices traverse events and manual judgments', () => {
  const { document, check, end } = fixture(), before = encodeDialogueEditorDocument(document);
  let state = startDialogueFlowPreview(document, 'start');
  state = chooseDialogueFlowPreview(document, state, document.graph.nodes.get('start').outputOrder[0]);
  assert.equal(state.nodeId, 'check');
  assert.deepEqual(state.events, ['模拟触发：first', '模拟触发：second', '等待已放行：ready']);
  const passed = chooseDialogueFlowPreview(document, state, check.outputOrder[0]);
  assert.equal(passed.nodeId, 'end');
  assert.equal(chooseDialogueFlowPreview(document, state, check.outputOrder[1]).ended, '对话已结束。');
  assert.equal(chooseDialogueFlowPreview(document, passed, end.outputOrder[0]).ended, '对话已结束。');
  assert.deepEqual(encodeDialogueEditorDocument(document), before);
});
test('selected event start auto advances and automatic loops stop', () => {
  const { document, send, wait, connect } = fixture();
  assert.equal(startDialogueFlowPreview(document, 'wait').nodeId, 'check');
  const edge = [...document.graph.edges.values()].find(edge => edge.from.nodeId === 'wait'); document.graph.edges.delete(edge.id);
  connect(wait, send);
  assert.match(startDialogueFlowPreview(document, 'send').ended, /循环/);
});
test('lines advance individually; invalid and missing destinations stop safely', () => {
  const { document } = fixture(), start = document.graph.nodes.get('start');
  start.lines.set('second', { id: 'second', speaker: 'Speaker', text: 'Second line' }); start.lineOrder.push('second');
  const state = nextDialogueFlowPreviewLine(document, startDialogueFlowPreview(document, 'start'));
  assert.equal(state.lineIndex, 1);
  const edge = [...document.graph.edges.values()].find(edge => edge.from.nodeId === 'start'); edge.to.nodeId = 'missing';
  assert.match(chooseDialogueFlowPreview(document, state, start.outputOrder[0]).ended, /目标节点/);
  assert.match(startDialogueFlowPreview(document, 'missing').ended, /起始节点/);
});
