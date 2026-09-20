import assert from 'node:assert/strict';
import test from 'node:test';
import { createDialogueEditorNode } from './dialogueMap.ts';
import { computeDialogueNodeLayout, dialogueLayoutPointToWorld } from './dialogueNodeLayout.ts';

test('node rows use one shared discrete grid', () => {
  const node = createDialogueEditorNode('node', { x: 48, y: 72 });
  const secondLine = 'line:node:second'; node.lines.set(secondLine, { id: secondLine, speaker: '', text: '' }); node.lineOrder.push(secondLine);
  const firstOutput = 'port:node:output:first'; const secondOutput = 'port:node:output:second';
  node.outputs.set(firstOutput, { id: firstOutput, activation: { type: 'choice' } }); node.outputs.set(secondOutput, { id: secondOutput, activation: { type: 'auto' } }); node.outputOrder.push(firstOutput, secondOutput);
  const layout = computeDialogueNodeLayout(node);
  assert.equal(layout.header.height, 2);
  assert.deepEqual([...layout.lineRows.values()].map((row) => [row.rect.y, row.rect.height]), [[3, 2], [5, 2]]);
  assert.deepEqual([...layout.outputRows.values()].map((row) => [row.rect.y, row.rect.height, row.centerY]), [[8, 2, 9], [10, 2, 11]]);
  assert.deepEqual(layout.outputAnchors.get(firstOutput), { x: 10, y: 9 });
  assert.equal(layout.minimumHeightUnits, 13);
  assert.equal(layout.actualHeightUnits, 13);
});

test('actual height is the larger of requested and content minimum', () => {
  const node = createDialogueEditorNode('node', { x: 0, y: 0 });
  node.display.heightUnits = 12;
  assert.equal(computeDialogueNodeLayout(node).actualHeightUnits, 12);
  node.display.heightUnits = 3;
  const layout = computeDialogueNodeLayout(node);
  assert.equal(layout.minimumHeightUnits, 6);
  assert.equal(layout.actualHeightUnits, 6);
});

test('input rail uses integer slots and can raise minimum height', () => {
  const node = createDialogueEditorNode('node', { x: 0, y: 0 });
  for (let index = 1; index <= 5; index += 1) { const id = `port:node:in_${index}`; node.inputs.set(id, { id }); node.inputOrder.push(id); }
  const layout = computeDialogueNodeLayout(node);
  assert.deepEqual([...layout.inputAnchors.values()].map((point) => point.y), [2.5, 3.5, 4.5, 5.5, 6.5, 7.5]);
  assert.equal(layout.minimumHeightUnits, 9);
});

test('layout anchors convert to canvas world coordinates once', () => {
  const node = createDialogueEditorNode('node', { x: 48, y: 72 }); const inputId = node.inputOrder[0]; const anchor = computeDialogueNodeLayout(node).inputAnchors.get(inputId)!;
  assert.deepEqual(dialogueLayoutPointToWorld(node, anchor), { x: 48, y: 132 });
});
