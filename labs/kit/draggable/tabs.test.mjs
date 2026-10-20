import test from 'node:test';
import assert from 'node:assert/strict';
import { combinePanels, parsePanelTabs, windowOwner, workspaceWindows } from './tabs.ts';
import { displayItems, mergeItems } from './layout.ts';
import { defaultGrid as equipmentDefault, parseGrid as equipmentParse } from '../../draggable/equipment-lab/layouts.ts';
import { defaultGrid as pressDefault, parseGrid as pressParse } from '../../draggable/press-turn-lab/layouts.ts';
import { defaultGridLayout as clashDefault, parseGridLayout as clashParse } from '../../draggable/clash-lab/grid/gridLayoutData.ts';
test('三个 Lab 的标签分组可保存读取，旧布局保持原样', () => {
  for (const [defaults, parse] of [[equipmentDefault, equipmentParse], [pressDefault, pressParse], [clashDefault, clashParse]]) {
    const data = parse(defaults()); assert.equal(data.tabs, undefined);
    const [first, second] = data.items; data.tabs = combinePanels(data, first.i, second.i);
    data.tabs.groups[0].active = second.i;
    const restored = parse(JSON.parse(JSON.stringify(data))); assert.deepEqual(restored, data);
    assert.equal(workspaceWindows(restored).length, data.items.length - 1); assert.equal(windowOwner(restored, second.i), first.i);
  }
});
test('合并窗口移动缩放只改变组首窗口，关闭与拆分恢复各面板几何', () => {
  const data = equipmentDefault(); const original = structuredClone(data);
  data.tabs = combinePanels(data, 'equipment', 'skills');
  const shown = displayItems(data, 2, false, { w: 4, h: 3, maxH: 1000 });
  assert.ok(!shown.some(item => item.i === 'skills'));
  const groupWindow = shown.find(item => item.i === 'equipment'); groupWindow.y += 8; groupWindow.h += 4;
  const moved = equipmentParse(mergeItems(data, shown, 2, false));
  assert.deepEqual(moved.items.find(item => item.i === 'skills'), original.items.find(item => item.i === 'skills'));
  assert.equal(moved.items.find(item => item.i === 'equipment').y, original.items.find(item => item.i === 'equipment').y + 4);
  const switchedOff = { ...moved, tabs: { ...moved.tabs, enabled: false } }; assert.equal(workspaceWindows(switchedOff).length, data.items.length);
  assert.equal(displayItems(switchedOff, 1, false, { w: 4, h: 3, maxH: 1000 }).find(item => item.i === 'skills').x, 31);
  assert.equal(workspaceWindows({ ...moved, tabs: { enabled: true, groups: [] } }).length, data.items.length);
  assert.deepEqual(data.items, original.items);
});
test('组首或当前标签隐藏时保留其余标签和组位置，全部隐藏时不显示窗口', () => {
  const data = equipmentDefault(); data.tabs = combinePanels(data, 'equipment', 'skills'); data.hidden = ['equipment'];
  const window = workspaceWindows(data).find(window => window.item.i === 'equipment');
  assert.deepEqual(window.panels, ['skills']); assert.equal(window.active, 'skills');
  const visible = displayItems(data, 1, false, { w: 4, h: 3, maxH: 1000 }); visible.find(item => item.i === 'equipment').y += 2;
  const next = mergeItems(data, visible, 1, false); assert.equal(next.items.find(item => item.i === 'equipment').y, window.item.y + 2);
  data.hidden.push('skills'); assert.ok(!workspaceWindows(data).some(window => window.item.i === 'equipment'));
});
test('合并两个已有标签组保持成员顺序，无重复且不修改来源', () => {
  const data = equipmentDefault(); data.tabs = combinePanels(data, 'equipment', 'skills'); data.tabs = combinePanels(data, 'character', 'information');
  const before = structuredClone(data); const tabs = combinePanels(data, 'skills', 'information');
  assert.deepEqual(tabs.groups, [{ panels: ['equipment', 'skills', 'character', 'information'], active: 'skills' }]); assert.deepEqual(data, before);
  assert.throws(() => combinePanels(data, 'equipment', 'skills')); assert.throws(() => combinePanels(data, 'equipment', 'equipment'));
});
test('所有布局解析器拒绝未知、重复、跨组复用和无效当前标签', () => {
  for (const [defaults, parse] of [[equipmentDefault, equipmentParse], [pressDefault, pressParse], [clashDefault, clashParse]]) {
    const data = defaults(); const [a, b, c] = data.items.map(item => item.i);
    for (const tabs of [null, { enabled: 'true', groups: [] }, { enabled: true, groups: [{ panels: [a], active: a }] }, { enabled: true, groups: [{ panels: [a, b], active: c }] }, { enabled: false, groups: [{ panels: [a, 'foreign'], active: a }] }, { enabled: true, groups: [{ panels: [a, a], active: a }] }, { enabled: true, groups: [{ panels: [a, b], active: a }, { panels: [c, b], active: b }] }]) assert.throws(() => parse({ ...data, tabs }));
  }
  assert.equal(parsePanelTabs(undefined, []), undefined);
});
