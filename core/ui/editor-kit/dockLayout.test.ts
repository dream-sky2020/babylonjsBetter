import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeDockPanels, dockLeaves, dockRects, moveDockPanel, setDockRatio, validateDockTree } from './dockLayout.ts';
test('generic dock supports different panel registries, all drop edges and hide/restore without losing leaves', () => {
  for (const panels of [['only'], ['contents', 'entities', 'components'], ['a', 'b', 'c', 'd']]) {
    let tree = arrangeDockPanels(panels, 'y');
    for (const source of panels) for (const target of panels) for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
      tree = moveDockPanel(tree, source, target, edge);
      assert.deepEqual(dockLeaves(tree).sort(), [...panels].sort());
      assert.deepEqual(validateDockTree(JSON.parse(JSON.stringify(tree)), panels, panels[0]), tree);
      const rects = dockRects(tree, [panels[0]]);
      assert.deepEqual(rects.leaves.get(panels[0]), { x: 0, y: 0, w: 1, h: 1 });
    }
    assert.equal(dockRects(tree, []).leaves.size, 0);
    assert.equal(moveDockPanel(tree, 'missing', panels[0], 'left'), tree);
  }
});
test('invalid registry members, duplicate leaves/splits and non-finite ratios cannot enter saved layouts', () => {
  const panels = ['a', 'b', 'c'], fallback = arrangeDockPanels(panels, 'y');
  for (const value of [null, 'missing', { id: 'x', axis: 'x', ratio: .5, first: 'a', second: 'a' },
    { id: 'x', axis: 'y', ratio: NaN, first: 'a', second: 'b' },
    { id: 'x', axis: 'y', ratio: .5, first: 'a', second: { id: 'x', axis: 'x', ratio: .5, first: 'b', second: 'c' } }]) assert.equal(validateDockTree(value, panels, fallback), fallback);
  assert.equal(setDockRatio(fallback, 'arrange-a', NaN), fallback);
});
