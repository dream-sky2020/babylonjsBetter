import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultMapWorkspace, mapWorkspaceKey, normalizeMapWorkspace, readMapWorkspace } from './dungeonMapWorkspace.ts';
import { dockLeaves, dockRects, moveDockPanel } from '../../../core/ui/editor-kit/dockLayout.ts';

test('v1 layout migrates its widths and visibility while adding three independent browsers', () => {
  const calls: string[] = [];
  const result = readMapWorkspace({ getItem(key) { calls.push(key);return key.endsWith(':v1') ? JSON.stringify({ left: 410, right: 310, leftOpen: false, rightOpen: true }) : null; } }, 1400);
  assert.deepEqual(calls, [mapWorkspaceKey, 'dungeon-map-canvas-lab:workspace:v1']);
  assert.equal(result.left, 410);assert.equal(result.right, 310);assert.equal(result.leftOpen, false);
  assert.deepEqual(result.visible, { contents: true, entities: true, components: true });
});
test('v2 restores reordered, hidden and folded panels without changing selection or map data', () => {
  const saved = defaultMapWorkspace(1400);
  saved.visible.entities = false;saved.collapsed.components = true;
  saved.tree = moveDockPanel(saved.tree, 'components', 'contents', 'left');
  const restored = normalizeMapWorkspace(JSON.parse(JSON.stringify(saved)), 1400);
  assert.deepEqual(restored, { ...saved, collapsed: { contents: false, entities: false, components: true } });
  assert.deepEqual(dockLeaves(restored.tree).sort(), ['components', 'contents', 'entities']);
  assert.equal(dockRects(restored.tree, ['contents']).leaves.get('contents')!.w, 1);
});
test('invalid or unavailable preferences recover, and narrow viewports retain the map workspace', () => {
  const fallback = defaultMapWorkspace(760);
  assert.equal(fallback.leftOpen, false);
  assert.deepEqual(readMapWorkspace({ getItem() { throw new Error('blocked'); } }, 760), fallback);
  assert.deepEqual(readMapWorkspace({ getItem() { return '{bad'; } }, 760), fallback);
  const invalid = normalizeMapWorkspace({ left: -20, right: Infinity, tree: 'unknown', visible: { contents: 'bad', entities: false } }, 760);
  assert.equal(invalid.left, 210);assert.equal(invalid.right, 340);assert.equal(invalid.visible.contents, true);
  assert.equal(invalid.visible.entities, false);assert.deepEqual(invalid.tree, fallback.tree);
});
