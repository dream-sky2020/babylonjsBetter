import assert from 'node:assert/strict';
import test from 'node:test';
import { createDialogueEditorNode } from './dialogueMap.ts';
import { computeDialogueNodeLayout, dialogueLayoutPointToWorld } from './dialogueNodeLayout.ts';
import { drawDialogueCanvasText, getDialogueCanvasFontSize, getDialogueCanvasTextDetail } from '../../tools/dialogue-map-canvas-lab/dialogueCanvasText.ts';

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

const measure = (text: string) => [...text].length * 10;
test('measured dialogue rows grow on the grid and move the following output anchors', () => {
  const node = createDialogueEditorNode('long', { x: 0, y: 0 });
  node.lines.get(node.lineOrder[0])!.text = '长对白需要自动换行而不能溢出边框。'.repeat(8);
  node.outputs.set('next', { id: 'next', activation: { type: 'choice' }, label: '继续' }); node.outputOrder.push('next');
  const layout = computeDialogueNodeLayout(node, undefined, measure);
  const line = layout.lineRows.get(node.lineOrder[0])!, output = layout.outputRows.get('next')!;
  assert.equal(line.textBlocks?.find(block => block.role === 'body')?.lines.length, 3);
  assert.equal(line.textBlocks?.find(block => block.role === 'body')?.truncated, true);
  assert.equal(line.rect.height, 4);
  assert.ok(output.rect.y >= line.rect.y + line.rect.height);
  assert.equal(layout.outputAnchors.get('next')?.y, output.centerY);
  assert.equal(layout.actualHeightUnits, layout.minimumHeightUnits);
});

test('measured layout respects hidden speaker and preview text and grows narrower rows', () => {
  const node = createDialogueEditorNode('node', { x: 0, y: 0 });
  node.lines.get(node.lineOrder[0])!.text = '这是一段根据节点实际宽度排版的对白。';
  node.display.widthUnits = 14;
  const wide = computeDialogueNodeLayout(node, undefined, measure);
  node.display.widthUnits = 4;
  const narrow = computeDialogueNodeLayout(node, undefined, measure);
  assert.ok(narrow.minimumHeightUnits > wide.minimumHeightUnits);
  node.display.showSpeakerList = false;
  const noSpeaker = computeDialogueNodeLayout(node, undefined, measure);
  assert.ok(noSpeaker.lineRows.get(node.lineOrder[0])!.textBlocks!.every(block => block.role !== 'speaker'));
  node.display.showPreviewText = false;
  assert.deepEqual(computeDialogueNodeLayout(node, undefined, measure).lineRows.get(node.lineOrder[0])!.textBlocks, []);
});

test('output summaries have at most two measured lines and collapsed slots stay discrete', () => {
  const node = createDialogueEditorNode('node', { x: 0, y: 0 }); node.display.widthUnits = 4;
  node.outputs.set('event', { id: 'event', label: '很长的输出标签'.repeat(8), activation: { type: 'event', eventType: 'very.long.event.name'.repeat(10), version: 1 } }); node.outputOrder.push('event');
  const output = computeDialogueNodeLayout(node, undefined, measure).outputRows.get('event')!;
  assert.equal(output.textBlocks![0].lines.length, 1);
  assert.equal(output.textBlocks![1].lines.length, 2);
  assert.ok(output.textBlocks!.every(block => block.lines.every(line => measure(line) <= output.rect.width * 24)));
  node.display.collapsed = true;
  const collapsed = computeDialogueNodeLayout(node, undefined, measure);
  assert.equal(collapsed.outputRows.get('event')!.rect.height, 1);
  assert.equal(collapsed.outputAnchors.get('event')!.y, 2.5);
});

test('text drawing clips to its own box and restores state without compressing glyphs', () => {
  const calls: unknown[][] = [];
  const context = Object.fromEntries(['save', 'beginPath', 'rect', 'clip', 'fillText', 'restore'].map(name => [name, (...args: unknown[]) => calls.push([name, ...args])])) as unknown as CanvasRenderingContext2D;
  context.getTransform = () => ({ a: 1 }) as DOMMatrix;
  context.measureText = text => ({ width: [...text].length * 10, actualBoundingBoxLeft: 1, actualBoundingBoxRight: [...text].length * 10 - 1, actualBoundingBoxAscent: 9, actualBoundingBoxDescent: 3 }) as TextMetrics;
  drawDialogueCanvasText(context, { lines: ['第一行', '第二行…'], truncated: true }, { x: 20, y: 40, width: 80, height: 28, scale: 1, color: '#fff' });
  assert.deepEqual(calls[2], ['rect', 20, 40, 80, 28]);
  assert.ok(calls.findIndex(call => call[0] === 'clip') < calls.findIndex(call => call[0] === 'fillText'));
  const painted = calls.filter(call => call[0] === 'fillText');
  assert.deepEqual(painted.map(call => call[1]), ['第一行', '第二行…']);
  assert.equal(context.textBaseline, 'alphabetic');
  painted.forEach(call => {
    const metrics = context.measureText(call[1] as string), x = call[2] as number, y = call[3] as number;
    assert.ok(x - metrics.actualBoundingBoxLeft >= 20);
    assert.ok(x + metrics.actualBoundingBoxRight <= 100);
    assert.ok(y - metrics.actualBoundingBoxAscent >= 40);
    assert.ok(y + metrics.actualBoundingBoxDescent <= 68);
    assert.ok(Number.isInteger(x) && Number.isInteger(y));
  });
  assert.equal(calls.at(-1)![0], 'restore');
});

test('readability modes and font sizes remain bounded at fractional zoom and DPR', () => {
  for (const ratio of [1, 1.25, 2]) for (const scale of [.45, .75, .9, .97, 1, 1.25]) {
    const size = getDialogueCanvasFontSize(12, scale, ratio);
    assert.ok(size >= 10);
    assert.ok(Math.abs(size * ratio - Math.round(size * ratio)) < 1e-8);
  }
  assert.equal(getDialogueCanvasTextDetail(.3), 'overview');
  assert.equal(getDialogueCanvasTextDetail(.75), 'compact');
  assert.equal(getDialogueCanvasTextDetail(.9), 'full');
});
