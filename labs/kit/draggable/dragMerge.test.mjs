import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeByDragging, mergeTarget } from './dragMerge.ts';
import { combinePanels, workspaceWindows } from './tabs.ts';
import { createHistory, recordHistory, redoHistory, undoHistory } from './history.ts';
import { defaultGrid as equipmentDefault, parseGrid as equipmentParse } from '../../draggable/equipment-lab/layouts.ts';
import { defaultGrid as pressDefault, parseGrid as pressParse } from '../../draggable/press-turn-lab/layouts.ts';
import { defaultGridLayout as clashDefault, parseGridLayout as clashParse } from '../../draggable/clash-lab/grid/gridLayoutData.ts';
test('仅标题/标签落点可合并，排除自己并优先选择上层目标', () => {
  const zones = [{ id: 'a', x: 0, y: 0, width: 200, height: 25, windowHeight: 300, rank: 1 }, { id: 'b', x: 50, y: 0, width: 200, height: 50, windowHeight: 300, rank: 2 }];
  assert.equal(mergeTarget(zones, 'a', { x: 100, y: 10 }).id, 'b'); assert.equal(mergeTarget(zones, 'b', { x: 100, y: 10 }).id, 'a');
  assert.equal(mergeTarget(zones, 'c', { x: 100, y: 10 }).id, 'b'); assert.equal(mergeTarget(zones, 'a', { x: 100, y: 100 }), undefined);
});
test('拖入目标窗口保留目标几何和其他窗口，并选中拖入面板；合并只占一个撤销步骤', () => {
  const before = equipmentDefault(); before.tabs = { enabled: true, groups: [], dragMerge: true };
  const next = mergeByDragging(before, 'skills', 'equipment');
  assert.deepEqual(next.items, before.items); assert.equal(next.tabs.groups[0].active, 'skills'); assert.deepEqual(next.tabs.groups[0].panels, ['equipment','skills']);
  let history = recordHistory(createHistory(before), next); assert.equal(history.past.length, 1);
  history = undoHistory(history); assert.deepEqual(history.present, before); history = redoHistory(history); assert.deepEqual(history.present, next);
  assert.equal(workspaceWindows(next).length, before.items.length - 1);
});
test('开关关闭、锁定、隐藏或相同窗口不会产生拖动合并，已有标签组可拖入另一组', () => {
  const data = equipmentDefault(); assert.equal(mergeByDragging(data, 'skills', 'equipment'), data);
  data.tabs = { enabled: true, dragMerge: false, groups: [] }; assert.equal(mergeByDragging(data, 'skills', 'equipment'), data);
  data.tabs.dragMerge = true; assert.equal(mergeByDragging({ ...data, locked: true }, 'skills', 'equipment').tabs.groups.length, 0);
  assert.equal(mergeByDragging({ ...data, hidden: ['skills'] }, 'skills', 'equipment').tabs.groups.length, 0);
  assert.equal(mergeByDragging(data, 'skills', 'skills'), data);
  data.tabs = combinePanels(data, 'equipment', 'skills'); data.tabs = combinePanels(data, 'character', 'information');
  const next = mergeByDragging(data, 'equipment', 'character'); assert.deepEqual(next.tabs.groups[0].panels, ['character','information','equipment','skills']); assert.equal(next.tabs.dragMerge, true);
});
test('三个 Lab 保存拖动合并开关，旧布局默认关闭且无效值被拒绝', () => {
  for (const [defaults, parse] of [[equipmentDefault, equipmentParse], [pressDefault, pressParse], [clashDefault, clashParse]]) {
    const data = defaults(); data.tabs = { enabled: true, dragMerge: true, groups: [] }; assert.deepEqual(parse(JSON.parse(JSON.stringify(data))).tabs, data.tabs);
    assert.throws(() => parse({ ...data, tabs: { ...data.tabs, dragMerge: 'yes' } })); assert.equal(parse(defaults()).tabs?.dragMerge, undefined);
  }
});
