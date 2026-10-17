import test from 'node:test';
import assert from 'node:assert/strict';
import { displayItems, mergeItems, overlaps } from './layout.ts';
import { defaultGridSettings, parseGridSettings } from './settings.ts';
import { defaultGrid as pressDefault, parseGrid as parsePress, GRID_KEY as PRESS_KEY } from '../../draggable/press-turn-lab/layouts.ts';
import { defaultGrid as equipmentDefault, parseGrid as parseEquipment, GRID_KEY as EQUIPMENT_KEY } from '../../draggable/equipment-lab/layouts.ts';
import { defaultGridLayout, parseGridLayout, GRID_LAYOUT_KEY } from '../../draggable/clash-lab/grid/gridLayoutData.ts';
test('shared scaling round-trips every Lab without changing hidden geometry, settings or source', () => {
  for (const [defaults, parse] of [[pressDefault, parsePress], [equipmentDefault, parseEquipment], [defaultGridLayout, parseGridLayout]]) {
    const data = parse(defaults()); data.hidden = [data.items.at(-1).i];
    const before = structuredClone(data); const shown = displayItems(data, 2, false, { w: 3, h: 5, maxH: 100 });
    const restored = parse(mergeItems(data, shown, 2, false)); assert.deepEqual(restored, before);
    shown[0].x = 0; shown[0].y += 8;
    const changed = parse(mergeItems(data, shown, 2, false)); assert.equal(changed.items[0].y, before.items[0].y + 4);
    assert.deepEqual(changed.items.at(-1), before.items.at(-1)); assert.deepEqual(data, before);
    assert.equal(mergeItems(data, shown, 2, true), data);
    const locked = { ...data, locked: true }; assert.equal(mergeItems(locked, shown, 2, false), locked);
  }
});
test('mobile display sorts, stacks and preserves saved desktop geometry', () => {
  const data = pressDefault(); const copy = structuredClone(data);
  const result = displayItems(data, 4, true, { w: 3, h: 5, maxH: 100 });
  let y = 0; for (const item of result) { assert.equal(item.x, 0); assert.equal(item.w, 1); assert.equal(item.y, y); y += item.h; }
  assert.deepEqual(data, copy);
});
test('shared collision preferences validate and preserve independent compaction semantics', () => {
  const settings = defaultGridSettings(); assert.equal(parseGridSettings({ ...settings, collision: undefined }).collision, 'push');
  assert.equal(parseGridSettings({ ...settings, autoCompact: true, collision: 'overlap' }).autoCompact, false);
  for (const patch of [{ threshold: -1 }, { threshold: 25 }, { collision: 'unknown' }, { precision: 3 }]) assert.throws(() => parseGridSettings({ ...settings, ...patch }));
  assert.ok(overlaps({ i: 'a', x: 0, y: 0, w: 3, h: 4 }, { i: 'b', x: 2, y: 0, w: 3, h: 4 }));
  assert.equal(overlaps({ i: 'a', x: 0, y: 0, w: 3, h: 4 }, { i: 'b', x: 3, y: 0, w: 3, h: 4 }), false);
});
test('legacy storage keys stay distinct and Lab parsers continue to reject foreign layouts', () => {
  assert.deepEqual([PRESS_KEY, EQUIPMENT_KEY, GRID_LAYOUT_KEY], ['press-turn-lab.grid.v1', 'equipment-lab.grid.v1', 'clash-lab.grid-layout.v1']);
  assert.throws(() => parsePress(equipmentDefault())); assert.throws(() => parseEquipment(defaultGridLayout())); assert.throws(() => parseGridLayout(pressDefault()));
  const clash = defaultGridLayout(); clash.items[0].x = 0.25; clash.settings = { ...defaultGridSettings(), collision: 'overlap' };
  assert.deepEqual(parseGridLayout(parseGridLayout(clash)), parseGridLayout(clash));
});
