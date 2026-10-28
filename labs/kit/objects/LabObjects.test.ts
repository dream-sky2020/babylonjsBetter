import assert from 'node:assert/strict';
import test from 'node:test';
import type { Node } from '@babylonjs/core';
import { LabObjects } from './LabObjects.ts';

function node(parent: Node | null = null) {
  let enabled = true, disposed = false;
  return { parent, isDisposed: () => disposed, isEnabled: () => enabled, setEnabled: (value: boolean) => { enabled = value; },
    dispose: () => { disposed = true; } } as unknown as Node;
}
test('object selection uses domain identity, resolves children and locks only viewport picking', () => {
  const registry = new LabObjects(), actor = node(), child = node(actor), selected: (string | null)[] = [];
  const registration = registry.scope('monster').register({ id: 'actors', label: '怪物', objects: () => [{ id: 'a', name: 'A', node: actor }], onSelect: id => { selected.push(id); } });
  const key = registry.getSnapshot().records[0].key;
  assert.equal(registry.findNode(child)?.id, 'a'); registry.select(key); assert.deepEqual(selected, ['a']);
  registration.select('a'); assert.deepEqual(selected, ['a']);
  registry.setLocked(key, true); assert.equal(registry.findNode(child, true), undefined); assert.equal(registry.findNode(child)?.id, 'a');
  registry.setVisible(key, false); assert.equal(actor.isEnabled(), false);
  registration.dispose(); assert.equal(registry.getSnapshot().records.length, 0); assert.equal(registry.getSnapshot().selectedKey, null);
});
test('refresh rebinds stable IDs to replacement nodes, drops removed objects, and scopes Host cleanup', () => {
  const registry = new LabObjects(), other = new LabObjects(); let actor = node();
  const registration = registry.scope('loader').register({ id: 'scene', label: '场景', objects: () => [{ id: 'model', name: '模型', node: actor }] });
  registration.select('model'); const first = registry.getSnapshot(), key = first.records[0].key;
  assert.equal(registry.getSnapshot(), first);
  registry.setVisible(key, false); const old = actor; actor = node(); old.dispose(); registration.refresh();
  assert.equal(registry.getSnapshot().records[0].node, actor); assert.equal(registry.getSnapshot().selectedKey, key); assert.equal(actor.isEnabled(), false);
  assert.equal(other.getSnapshot().records.length, 0);
  registry.removeOwner('loader'); assert.equal(registry.getSnapshot().records.length, 0);
  registry.dispose(); registration.dispose(); assert.throws(() => registry.scope('late').register({ id: 'late', label: 'late', objects: () => [] }));
});

test('background provider refresh cannot steal another provider selection', () => {
  const registry = new LabObjects();
  const a = registry.scope('a').register({ id: 'actors', label: 'Actors', objects: () => [{ id: 'a', name: 'A', node: node() }] });
  const b = registry.scope('b').register({ id: 'scene', label: 'Scene', objects: () => [{ id: 'b', name: 'B', node: node() }] });
  a.select('a'); b.select('b'); a.select('a', { onlyIfSelected: true });
  assert.equal(registry.getSnapshot().selectedKey, 'scene/b');
  a.select('a'); a.select('a', { onlyIfSelected: true }); assert.equal(registry.getSnapshot().selectedKey, 'actors/a');
});


test('scene selection falls back to an enabled ancestor, stays editable in tree, and persists independently', () => {
  const values = new Map<string, string>();
  const prior = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
  try {
    const root = node(), layer = node(root), mesh = node(layer), front = node(root), frontMesh = node(front), unrelated = node(); let includeLayer = true;
    const make = () => { const registry = new LabObjects(() => {}, 'test-picking'); const registration = registry.scope('monster').register({ id: 'objects', label: 'Objects', objects: () => [
      { id: 'root', name: 'Root', node: root }, { id: 'front', name: 'Front', node: front, parentId: 'root', defaultSceneSelectable: false }, ...(includeLayer ? [{ id: 'layer', name: 'Layer', node: layer, parentId: 'root', defaultSceneSelectable: false }] : [])
    ] }); return { registry, registration }; };
    const { registry, registration } = make();
    assert.equal(registry.findNode(mesh, true)?.id, 'root');
    registry.select('objects/layer'); assert.equal(registry.getSnapshot().selectedKey, 'objects/layer');
    registry.setSceneSelectable('objects/layer', true); assert.equal(registry.findNode(mesh, true)?.id, 'layer');
    assert.equal(registry.scenePickNode([frontMesh, mesh]), mesh);
    assert.equal(registry.scenePickNode([frontMesh, unrelated, mesh]), frontMesh);
    registry.setSceneSelectable('objects/root', false); registry.setSceneSelectable('objects/layer', false);
    assert.equal(registry.findNode(mesh, true), undefined); assert.equal(registry.findNode(mesh)?.id, 'layer');
    registry.setSceneSelectable('objects/layer', true);
    const reloaded = make(); assert.equal(reloaded.registry.findNode(mesh, true)?.id, 'layer');
    reloaded.registry.setSceneSelectable('objects/layer', false); assert.equal(reloaded.registry.findNode(mesh, true), undefined);
    includeLayer = false; registration.refresh(); registry.getSnapshot();
    assert.equal(JSON.parse(values.get('test-picking')!).hasOwnProperty('objects/layer'), false);
    registry.dispose(); reloaded.registry.dispose();
  } finally { if (prior === undefined) delete (globalThis as { localStorage?: Storage }).localStorage; else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: prior }); }
});
