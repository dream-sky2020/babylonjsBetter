import assert from 'node:assert/strict';
import test from 'node:test';
import { parseUiDocument } from './uiDocument.ts';
import { canReparentUiNode, duplicateUiSubtree, reparentUiNode } from './uiDocument.hierarchy.ts';
import { applyUiAnchorPreset, resolveUiNodeLayout } from './uiDocument.layout.ts';
import { UiDocumentStore } from './uiDocument.store.ts';

const fixture = () => parseUiDocument({
  schemaVersion: 2, presetKey: 'test', name: 'test', canvas: { width: 1000, height: 600 }, rootIds: ['panel', 'other'],
  nodes: {
    panel: { id: 'panel', type: 'panel', childIds: ['button'], layout: { x: 100, y: 100, width: 400, height: 300 } },
    button: { id: 'button', type: 'button', parentId: 'panel', childIds: ['label'], layout: { x: 20, y: 30, width: 100, height: 40 }, bindings: { text: { source: 'label' } } },
    label: { id: 'label', type: 'label', parentId: 'button', layout: { x: 4, y: 5, width: 80, height: 20 } },
    other: { id: 'other', type: 'panel', layout: { x: 600, y: 50, width: 300, height: 400 } },
  },
});

test('换父级保持世界矩形、子树位置与锚点，并可撤销重做和序列化', () => {
  const doc = fixture(); applyUiAnchorPreset(doc, doc.nodes.button, { x: 1, y: 1 });
  const store = new UiDocumentStore(doc);
  const before = resolveUiNodeLayout(doc, 'button')!.layout;
  const labelBefore = resolveUiNodeLayout(doc, 'label')!.layout;
  store.mutate('换父级', draft => reparentUiNode(draft, 'button', 'other'));
  const after = store.getDocument();
  assert.deepEqual(resolveUiNodeLayout(after, 'button')!.layout, before);
  assert.deepEqual(resolveUiNodeLayout(after, 'label')!.layout, labelBefore);
  assert.equal(after.nodes.button.layout.mode, 'rect-transform');
  assert.deepEqual(after.nodes.panel.childIds, []);
  assert.deepEqual(parseUiDocument(JSON.parse(JSON.stringify(after))), after);
  assert.equal(store.undo(), true); assert.deepEqual(store.getDocument(), doc);
  assert.equal(store.redo(), true); assert.equal(store.getDocument().nodes.button.parentId, 'other');
});

test('保留局部坐标换父级，之后随父级移动和尺寸变化响应', () => {
  const doc = fixture(); applyUiAnchorPreset(doc, doc.nodes.button, { x: 1, y: 1 });
  const local = structuredClone(doc.nodes.button.layout);
  reparentUiNode(doc, 'button', 'other', false);
  assert.deepEqual(doc.nodes.button.layout, local);
  const before = resolveUiNodeLayout(doc, 'button')!.layout;
  const parent = doc.nodes.other.layout;
  if (parent.mode !== 'absolute') assert.fail();
  parent.width += 100; parent.x += 10;
  assert.equal(resolveUiNodeLayout(doc, 'button')!.layout.x, before.x + 110);
  assert.equal(resolveUiNodeLayout(doc, 'button')!.layout.width, before.width);
});

test('拒绝循环、丢失父级和继承锁定，失败不修改原文档', () => {
  const doc = fixture(); const before = structuredClone(doc);
  assert.equal(canReparentUiNode(doc, 'panel', 'label'), false);
  assert.throws(() => reparentUiNode(doc, 'panel', 'label'), /循环/);
  assert.throws(() => reparentUiNode(doc, 'button', 'missing'));
  assert.deepEqual(doc, before);
  doc.nodes.panel.locked = true;
  assert.equal(canReparentUiNode(doc, 'button', null), false);
  assert.equal(canReparentUiNode(doc, 'other', 'button'), false);
});

test('拉伸子节点随父级尺寸变化保留左右边距，固定子节点不会被强制缩放', () => {
  const doc = fixture(); applyUiAnchorPreset(doc, doc.nodes.button, { x: 0, y: 0 }, { x: 1, y: 0 });
  const childBefore = resolveUiNodeLayout(doc, 'label')!.layout;
  const before = resolveUiNodeLayout(doc, 'button')!.layout;
  const parent = doc.nodes.panel.layout;
  if (parent.mode !== 'absolute') assert.fail();
  parent.width += 120; parent.height += 100;
  const after = resolveUiNodeLayout(doc, 'button')!.layout;
  assert.equal(after.x, before.x); assert.equal(after.y, before.y);
  assert.equal(after.width, before.width + 120); assert.equal(after.height, before.height);
  assert.deepEqual(resolveUiNodeLayout(doc, 'label')!.layout, childBefore);
});

test('完整复制子树：父级、绑定、锚点保留，ID 不冲突且数据互相独立', () => {
  const doc = fixture(); applyUiAnchorPreset(doc, doc.nodes.button, { x: .5, y: .5 });
  const id = duplicateUiSubtree(doc, 'button');
  const copy = doc.nodes[id]; const child = doc.nodes[copy.childIds[0]];
  assert.equal(copy.parentId, 'panel'); assert.equal(child.parentId, id);
  assert.deepEqual(doc.nodes.panel.childIds, ['button', id]);
  assert.deepEqual(copy.bindings, doc.nodes.button.bindings);
  assert.equal(copy.layout.mode, 'rect-transform');
  assert.equal(resolveUiNodeLayout(doc, child)!.layout.x, resolveUiNodeLayout(doc, 'label')!.layout.x + 24);
  copy.bindings!.text.source = 'changed'; assert.equal(doc.nodes.button.bindings!.text.source, 'label');
  assert.notEqual(duplicateUiSubtree(doc, 'button'), id);
  assert.deepEqual(parseUiDocument(JSON.parse(JSON.stringify(doc))), doc);
});
