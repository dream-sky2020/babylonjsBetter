import test from 'node:test';
import assert from 'node:assert/strict';
import { moveTab, placeTab } from './tabDrag.ts';
import { combinePanels, workspaceWindows } from './tabs.ts';
import { createHistory, recordHistory, undoHistory, redoHistory } from './history.ts';
import { defaultGrid, parseGrid } from '../../draggable/equipment-lab/layouts.ts';
import { defaultGrid as pressDefault, parseGrid as pressParse } from '../../draggable/press-turn-lab/layouts.ts';
import { defaultGridLayout as clashDefault, parseGridLayout as clashParse } from '../../draggable/clash-lab/grid/gridLayoutData.ts';
const grouped = () => { const data = defaultGrid(); data.tabs = { enabled: true, dragMerge: true, groups: [{ panels: ['equipment', 'skills'], active: 'skills' }] }; return data; };
const rect = item => [item.x, item.y, item.w, item.h];

test('拖出标签独立成窗，原组保留位置和全部面板设置，撤销重做为一个步骤', () => {
  const data = grouped(); data.panelSettings = { skills: { columns: 2 } };
  const before = structuredClone(data); const next = moveTab(data, 'skills', { x: 30, y: 50 });
  assert.equal(workspaceWindows(next).length, workspaceWindows(data).length + 1);
  assert.deepEqual(next.tabs.groups, []); assert.deepEqual(next.panelSettings, data.panelSettings);
  assert.deepEqual(rect(next.items.find(i => i.i === 'equipment')), rect(data.items.find(i => i.i === 'equipment')));
  assert.deepEqual(rect(next.items.find(i => i.i === 'skills')), [30, 50, 17, 16]);
  const history = recordHistory(createHistory(data), next);
  assert.deepEqual(undoHistory(history).present, before); assert.deepEqual(redoHistory(undoHistory(history)).present, next);
  assert.deepEqual(data, before); assert.deepEqual(parseGrid(next), next);
});

test('拖出组的首标签时，剩余标签继承窗口位置，隐藏成员仍然保留', () => {
  const data = grouped(); data.tabs.groups[0] = { panels: ['equipment', 'skills', 'commands'], active: 'equipment' }; data.hidden = ['commands'];
  const next = moveTab(data, 'equipment', { x: 0, y: 60 });
  assert.deepEqual(next.tabs.groups[0], { panels: ['skills', 'commands'], active: 'skills' });
  assert.deepEqual(rect(next.items.find(i => i.i === 'skills')), rect(data.items.find(i => i.i === 'equipment')));
  assert.deepEqual(next.hidden, ['commands']); assert.deepEqual(parseGrid(next), next);
});

test('移入另一组仅移动被拖标签，保留两边窗口和目标当前尺寸', () => {
  const data = grouped(); data.tabs = combinePanels(data, 'character', 'commands');
  const next = moveTab(data, 'equipment', { x: 0, y: 0 }, 'character');
  assert.deepEqual(next.tabs.groups, [{ panels: ['character', 'commands', 'equipment'], active: 'equipment' }]);
  assert.deepEqual(rect(next.items.find(i => i.i === 'skills')), rect(data.items.find(i => i.i === 'equipment')));
  assert.deepEqual(next.items.find(i => i.i === 'character'), data.items.find(i => i.i === 'character'));
});

test('关闭开关、锁定、隐藏、原组落点及无效目标均不修改布局', () => {
  const data = grouped();
  for (const value of [{ ...data, locked: true }, { ...data, hidden: ['skills'] }, { ...data, tabs: { ...data.tabs, dragMerge: false } }, { ...data, tabs: { ...data.tabs, enabled: false } }]) assert.equal(moveTab(value, 'skills', { x: 0, y: 0 }), value);
  assert.equal(moveTab(data, 'skills', { x: 0, y: 0 }, 'equipment'), data);
  assert.equal(moveTab(data, 'skills', { x: 0, y: 0 }, 'unknown'), data);
});

test('非叠放模式自动寻找空位；三个 Lab 可保存拆分结果', () => {
  const data = grouped(); const next = placeTab(data, 'skills', { x: 14, y: 17 }, false);
  assert.ok(next.items.find(i => i.i === 'skills').y >= 33);
  assert.equal(placeTab(data, 'skills', { x: 14, y: 17 }, true).items.find(i => i.i === 'skills').y, 17);
  for (const [defaults, parse] of [[defaultGrid, parseGrid], [pressDefault, pressParse], [clashDefault, clashParse]]) {
    const value = parse(defaults()); const ids = value.items.map(i => i.i); value.tabs = { enabled: true, dragMerge: true, groups: [{ panels: ids.slice(0, 2), active: ids[0] }] };
    assert.deepEqual(parse(moveTab(value, ids[0], { x: 0, y: 70 })), moveTab(value, ids[0], { x: 0, y: 70 }));
  }
});
