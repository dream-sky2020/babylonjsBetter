import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUiDocument } from './uiDocument.ts';
import { UiDocumentStore } from './uiDocument.store.ts';
import { applyUiAnchorPreset, resolveUiNodeLayout } from './uiDocument.layout.ts';
import { canPasteUiNodes, canRemoveUiNodes, copyUiNodes, pasteUiNodes, removeUiNodes } from './uiDocument.clipboard.ts';

const fixture = () => parseUiDocument({ schemaVersion: 2, presetKey: 'test', canvas: { width: 1000, height: 600 }, rootIds: ['panel', 'other'], nodes: {
  panel: { id: 'panel', type: 'panel', childIds: ['button'], layout: { x: 100, y: 100, width: 400, height: 300 } },
  button: { id: 'button', type: 'button', parentId: 'panel', childIds: ['label'], layout: { x: 20, y: 30, width: 100, height: 40 }, props: { content: '原始' }, bindings: { text: { source: 'actor.name' } } },
  label: { id: 'label', type: 'label', parentId: 'button', layout: { x: 4, y: 5, width: 80, height: 20 } },
  other: { id: 'other', type: 'panel', layout: { x: 600, y: 50, width: 300, height: 400 } },
} });

test('复制是独立子树快照，父子重复选中只复制一次，不修改原文档', () => {
  const doc = fixture(); const before = structuredClone(doc);
  const clip = copyUiNodes(doc, ['button', 'panel', 'button'])!;
  assert.deepEqual(clip.roots, ['panel']); assert.equal(Object.keys(clip.nodes).length, 3);
  assert.deepEqual(doc, before); assert.equal(copyUiNodes(doc, ['missing']), null);
  doc.nodes.button.props.content = '已修改'; assert.equal(clip.nodes.button.props.content, '原始');
});
test('多节点粘贴保持组内间距与子树，定位鼠标位置，重复粘贴不覆盖节点', () => {
  const doc = fixture(); const clip = copyUiNodes(doc, ['panel', 'button', 'other'])!;
  const original = structuredClone(doc.nodes);
  const inserted = pasteUiNodes(doc, clip, null, { x: 400, y: 300 });
  assert.deepEqual(inserted, ['panel-copy', 'other-copy']);
  assert.equal(resolveUiNodeLayout(doc, 'panel-copy')!.layout.x, 0);
  assert.equal(resolveUiNodeLayout(doc, 'panel-copy')!.layout.y, 150);
  assert.equal(resolveUiNodeLayout(doc, 'other-copy')!.layout.x, 500);
  assert.equal(doc.nodes['button-copy'].parentId, 'panel-copy');
  assert.equal(doc.nodes['label-copy'].parentId, 'button-copy');
  assert.deepEqual(doc.nodes['button-copy'].bindings, original.button.bindings);
  const second = pasteUiNodes(doc, clip); assert.equal(second[0], 'panel-copy-2');
  for (const [id, node] of Object.entries(original)) assert.deepEqual(doc.nodes[id], node);
  assert.deepEqual(parseUiDocument(JSON.parse(JSON.stringify(doc))), doc);
});
test('跨预设粘贴保留组件类型、属性、锚点和子节点局部布局', () => {
  const source = fixture(); applyUiAnchorPreset(source, source.nodes.button, { x: 1, y: 1 });
  const clip = copyUiNodes(source, ['button'])!;
  const target = fixture(); const [id] = pasteUiNodes(target, clip, 'other');
  const pasted = target.nodes[id]; assert.equal(pasted.parentId, 'other');
  assert.equal(pasted.type, 'button'); assert.equal(pasted.layout.mode, 'rect-transform');
  assert.deepEqual(pasted.props, source.nodes.button.props);
  assert.deepEqual(target.nodes[pasted.childIds[0]].layout, source.nodes.label.layout);
  assert.equal(resolveUiNodeLayout(target, id)!.layout.x, 700);
  assert.equal(resolveUiNodeLayout(target, id)!.layout.y, 230);
});
test('锁定子节点阻止剪切或删除祖先，复制可用；锁定父级拒绝粘贴', () => {
  const doc = fixture(); doc.nodes.label.locked = true;
  assert.equal(canRemoveUiNodes(doc, ['panel', 'other']), false);
  const before = structuredClone(doc);
  assert.throws(() => removeUiNodes(doc, ['panel', 'other'])); assert.deepEqual(doc, before);
  const clip = copyUiNodes(doc, ['panel'])!; assert.ok(clip);
  doc.nodes.other.locked = true;
  assert.equal(canPasteUiNodes(doc, 'other'), false); assert.equal(canPasteUiNodes(doc, 'missing'), false);
  assert.throws(() => pasteUiNodes(doc, clip, 'other'));
  assert.equal(canPasteUiNodes(doc, null), true);
});
test('批量剪切和粘贴分别只占一个撤销步骤，剪切可保留原 ID', () => {
  const doc = fixture(); const store = new UiDocumentStore(doc); const clip = copyUiNodes(doc, ['panel', 'button', 'other'])!;
  store.mutate('剪切', draft => removeUiNodes(draft, clip.roots));
  assert.deepEqual(store.getDocument().rootIds, []);
  store.mutate('粘贴', draft => { assert.deepEqual(pasteUiNodes(draft, clip, null, undefined, true), ['panel', 'other']); });
  assert.equal(store.getDocument().nodes.label.parentId, 'button');
  store.undo(); assert.deepEqual(store.getDocument().nodes, {});
  store.undo(); assert.deepEqual(store.getDocument(), doc); assert.equal(store.dirty, false);
  store.redo(); store.redo(); assert.equal(Object.keys(store.getDocument().nodes).length, 4);
});
