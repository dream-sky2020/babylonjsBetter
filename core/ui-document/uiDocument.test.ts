import assert from 'node:assert/strict';
import test from 'node:test';
import { UiDefinitionRegistry } from './uiDefinition.registry.ts';
import { parseUiDocument } from './uiDocument.ts';
import { UiDocumentStore } from './uiDocument.store.ts';
import { resolveUiNode } from './uiDocument.renderer.ts';
import { applyUiAnchorPreset, getUiSafeAreaRect, setUiNodeWorldRect } from './uiDocument.layout.ts';

const legacyPreset = {
  schemaVersion: 1,
  presetKey: 'legacy',
  name: '旧预设',
  canvas: { width: 1600, height: 900, backgroundTop: '#111111', backgroundBottom: '#222222', gridSize: 20 },
  components: [{ id: 'custom', name: '未知组件', kind: 'third-party.widget', x: 10, y: 20, width: 100, height: 50, zIndex: 2, visible: true, locked: false, opacity: .8, content: '保留内容', style: { customValue: 42 } }],
};

test('V1 文档迁移为 V2，并保留未知 Definition 的参数', () => {
  const document = parseUiDocument(legacyPreset, 'legacy');
  assert.equal(document.schemaVersion, 2);
  assert.deepEqual(document.rootIds, ['custom']);
  assert.equal(document.nodes.custom.type, 'third-party.widget');
  assert.equal(document.nodes.custom.props.content, '保留内容');
  assert.equal(document.nodes.custom.props.customValue, 42);
});

test('拖动事务中的多次修改只产生一个撤销步骤', () => {
  const store = new UiDocumentStore(parseUiDocument(legacyPreset));
  store.beginTransaction('拖动');
  store.updateNode('custom', '移动', (node) => { node.layout.x = 20; });
  store.updateNode('custom', '移动', (node) => { node.layout.x = 30; });
  assert.equal(store.commitTransaction(), true);
  assert.equal(store.getDocument().nodes.custom.layout.x, 30);
  assert.equal(store.undo(), true);
  assert.equal(store.getDocument().nodes.custom.layout.x, 10);
  assert.equal(store.canUndo, false);
  assert.equal(store.redo(), true);
  assert.equal(store.getDocument().nodes.custom.layout.x, 30);
});

test('保存状态会随撤销和重做精确变化', () => {
  const store = new UiDocumentStore(parseUiDocument(legacyPreset));
  store.updateNode('custom', '移动', (node) => { node.layout.y = 40; });
  store.markSaved();
  assert.equal(store.dirty, false);
  store.undo();
  assert.equal(store.dirty, true);
  store.redo();
  assert.equal(store.dirty, false);
});

test('Definition Registry 拒绝重复类型', () => {
  const registry = new UiDefinitionRegistry();
  const definition = {
    type: 'test', version: 1, label: '测试', category: '测试', defaultSize: { width: 10, height: 10 }, fields: [],
    createDefaultProps: () => ({}), normalizeProps: () => ({}), render: () => undefined,
  };
  registry.register(definition);
  assert.throws(() => registry.register(definition), /重复注册/);
});

test('层级节点使用父级相对坐标并继承可见性、锁定和透明度', () => {
  const base = parseUiDocument(legacyPreset);
  const document = parseUiDocument({
    ...base,
    rootIds: ['group'],
    nodes: {
      group: { id: 'group', type: 'group', definitionVersion: 1, name: 'Group', parentId: null, childIds: ['custom'], layout: { mode: 'absolute', x: 100, y: 200, width: 300, height: 200, zIndex: 0 }, visible: true, locked: true, opacity: .5, props: {} },
      custom: { ...base.nodes.custom, parentId: 'group', layout: { ...base.nodes.custom.layout, x: 20, y: 30 } },
    },
  });
  const resolved = resolveUiNode(document, 'custom');
  assert.equal(resolved?.layout.x, 120);
  assert.equal(resolved?.layout.y, 230);
  assert.equal(resolved?.locked, true);
  assert.equal(resolved?.opacity, .4);
});

test('层级校验拒绝不一致的父子关系', () => {
  const base = parseUiDocument(legacyPreset);
  assert.throws(() => parseUiDocument({
    ...base,
    rootIds: [],
    nodes: { custom: { ...base.nodes.custom, parentId: 'missing' } },
  }), /父节点不存在/);
});

test('RectTransform 随画布分辨率和拉伸锚点响应', () => {
  const document = parseUiDocument({
    ...parseUiDocument(legacyPreset),
    canvas: { ...legacyPreset.canvas, width: 1000, height: 600 },
    nodes: { custom: { ...parseUiDocument(legacyPreset).nodes.custom, layout: { mode: 'rect-transform', anchorMin: { x: 0, y: 1 }, anchorMax: { x: 1, y: 1 }, pivot: { x: .5, y: 1 }, anchoredPosition: { x: 0, y: -20 }, sizeDelta: { x: -80, y: 100 }, relativeTo: 'parent', zIndex: 0 } } },
  });
  assert.deepEqual(resolveUiNode(document, 'custom')?.layout, { mode: 'absolute', x: 40, y: 480, width: 920, height: 100, zIndex: 0 });
  document.canvas.width = 1200;
  assert.deepEqual(resolveUiNode(document, 'custom')?.layout, { mode: 'absolute', x: 40, y: 480, width: 1120, height: 100, zIndex: 0 });
});

test('安全区域锚点、预设切换和世界矩形回写保持视觉位置', () => {
  const document = parseUiDocument(legacyPreset);
  document.canvas.safeArea = { top: 30, right: 40, bottom: 50, left: 60 };
  const node = document.nodes.custom;
  const original = resolveUiNode(document, node)?.layout;
  applyUiAnchorPreset(document, node, { x: 1, y: 1 });
  assert.deepEqual(resolveUiNode(document, node)?.layout, original);
  if (node.layout.mode !== 'rect-transform') assert.fail('应转换为 RectTransform');
  node.layout.relativeTo = 'safe-area';
  if (original) setUiNodeWorldRect(document, node, original);
  assert.deepEqual(resolveUiNode(document, node)?.layout, original);
  assert.deepEqual(getUiSafeAreaRect(document), { x: 60, y: 30, width: 1500, height: 820 });
});
