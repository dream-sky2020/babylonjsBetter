import assert from 'node:assert/strict';
import test from 'node:test';
import { collides, getCompactor } from 'react-grid-layout';
import { defaultGrid, parseGrid } from './layouts.ts';
import { placeBattlefieldTop } from './gridPlacement.ts';

test('place the merged battlefield on top and move conflicting windows without overlap', () => {
  const original = defaultGrid(); const before = structuredClone(original);
  const next = placeBattlefieldTop(original);

  const overview = next.items.find(item => item.i === 'battlefield');

  assert.equal(overview.x, 0); assert.equal(overview.y, 0);
  assert.equal(overview.w, 12);
  for (const item of next.items) for (const other of next.items) if (item.i !== other.i) assert.equal(collides(item, other), false);
  assert.deepEqual(original, before); assert.deepEqual(parseGrid(next), next);
  assert.deepEqual(placeBattlefieldTop(next), next);
});

test('placement respects locks, reveals the battlefield and preserves hidden windows', () => {
  const data = defaultGrid(); data.locked = true;
  assert.equal(placeBattlefieldTop(data), data); data.locked = false;
  data.hidden = ['battlefield', 'state'];

  const next = placeBattlefieldTop(data);
  assert.deepEqual(next.hidden, ['state']);
  assert.equal(next.items.find(item => item.i === 'battlefield').w, 12);
  assert.deepEqual(next.items.find(item => item.i === 'state'), data.items.find(item => item.i === 'state'));
});

test('legacy settings enable collision yielding independently from upward compaction', () => {
  const data = defaultGrid(); delete data.settings.collision;
  const next = parseGrid(data);
  assert.equal(next.settings.collision, 'push'); assert.equal(next.settings.autoCompact, false);
  const compactor = getCompactor(null, false, next.settings.collision === 'block');
  assert.equal(Boolean(compactor.preventCollision), false);
  assert.deepEqual(parseGrid({ ...next, items: compactor.compact(next.items, 12) }).items, next.items);
  assert.throws(() => parseGrid({ ...next, settings: { ...next.settings, collision: 'bad' } }));
});

test('free stacking persists overlapping geometry and disables compaction', () => {
  const data = defaultGrid(); data.settings.collision = 'overlap'; data.settings.autoCompact = true;
  const player = data.items.find(item => item.i === 'left'); player.x = 1; player.y = 1;
  const next = parseGrid(JSON.parse(JSON.stringify(data)));
  assert.equal(next.settings.collision, 'overlap'); assert.equal(next.settings.autoCompact, false);
  assert.equal(collides(next.items.find(item => item.i === 'left'), next.items.find(item => item.i === 'battlefield')), true);
  const compactor = getCompactor(null, true);
  assert.equal(compactor.allowOverlap, true);
  assert.deepEqual(parseGrid({ ...next, items: compactor.compact(next.items, 12) }).items, next.items);
});
