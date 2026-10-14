import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDockTree, dockLeaves, dockRects, moveDockPanel, panels, setDockRatio, validateDockTree } from './sceneEnvironmentDockLayout.ts';
test('moving panels to every edge preserves all leaves and a valid persisted tree', () => {
  let tree = defaultDockTree;
  for (let round = 0; round < 5; round++) for (const source of panels) for (const target of panels) for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
    tree = moveDockPanel(tree, source, target, edge);
    assert.deepEqual([...dockLeaves(tree)].sort(), [...panels].sort());
    assert.deepEqual(validateDockTree(JSON.parse(JSON.stringify(tree))), tree);
  }
  assert.equal(moveDockPanel(tree, 'objects', 'objects', 'left'), tree);
});
test('hiding panels expands remaining leaves without mutating the saved layout', () => {
  const one = dockRects(defaultDockTree, ['textures']);
  assert.deepEqual(one.leaves.get('textures'), { x: 0, y: 0, w: 1, h: 1 });
  assert.equal(one.splits.length, 0);
  assert.equal(dockRects(defaultDockTree, []).leaves.size, 0);
  const two = dockRects(defaultDockTree, ['objects', 'materials']);
  assert.equal(two.leaves.get('materials')!.h, 1);
  assert.deepEqual(dockLeaves(defaultDockTree), panels);
});
test('invalid persisted trees fall back and split values remain bounded', () => {
  assert.deepEqual(validateDockTree({ id: 'bad', axis: 'x', ratio: 0.5, first: 'objects', second: 'objects' }), defaultDockTree);
  assert.deepEqual(validateDockTree(null), defaultDockTree);
  const updated = setDockRatio(defaultDockTree, 'resources', 100);
  assert.equal(typeof updated === 'object' && typeof updated.second === 'object' && updated.second.ratio, 0.85);
});
