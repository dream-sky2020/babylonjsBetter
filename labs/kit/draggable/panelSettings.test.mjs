import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePanelSettings, resetPanelSettings, resolvedPanelSettings, updatePanelSetting } from './panelSettings.ts';
import { createHistory, recordHistory, redoHistory, undoHistory } from './history.ts';
import { combinePanels } from './tabs.ts';
import { defaultGrid as equipmentDefault, parseGrid as equipmentParse, defaultPuck, parsePuck } from '../../draggable/equipment-lab/layouts.ts';
import { equipmentPanelSettings } from '../../draggable/equipment-lab/panelSettings.ts';
import { defaultGrid as pressDefault, parseGrid as pressParse } from '../../draggable/press-turn-lab/layouts.ts';
import { defaultGridLayout as clashDefault, parseGridLayout as clashParse } from '../../draggable/clash-lab/grid/gridLayoutData.ts';
test('合并面板仍独立保存各自设置，导出读取、撤销重做保留几何与分组', () => {
  const before = equipmentDefault(); before.tabs = combinePanels(before, 'equipment', 'skills');
  let next = updatePanelSetting(before, 'equipment', 'columns', 2, before.items.map(item => item.i), equipmentPanelSettings);
  next = updatePanelSetting(next, 'skills', 'columns', 3, before.items.map(item => item.i), equipmentPanelSettings);
  assert.deepEqual(equipmentParse(JSON.parse(JSON.stringify(next))), next); assert.deepEqual(next.items, before.items); assert.deepEqual(next.tabs, before.tabs);
  assert.equal(resolvedPanelSettings(next.panelSettings, 'equipment', equipmentPanelSettings).columns, 2);
  assert.equal(resolvedPanelSettings(next.panelSettings, 'skills', equipmentPanelSettings).columns, 3);
  assert.equal(resolvedPanelSettings(next.panelSettings, 'inventory', equipmentPanelSettings).columns, 1);
  let history = recordHistory(createHistory(before), next); history = undoHistory(history); assert.deepEqual(history.present, before);
  history = redoHistory(history); assert.deepEqual(history.present, next);
  const reset = resetPanelSettings(next, 'equipment'); assert.deepEqual(reset.panelSettings, { skills: { columns: 3 } });
  assert.equal(resetPanelSettings(reset, 'skills').panelSettings, undefined); assert.deepEqual(before.panelSettings, undefined);
});
test('所有 Lab 拒绝未知面板和非法选项值，整备面板严格校验列数和注册字段', () => {
  for (const [defaults, parse] of [[equipmentDefault, equipmentParse], [pressDefault, pressParse], [clashDefault, clashParse]]) {
    const data = defaults(); const id = data.items[0].i;
    for (const panelSettings of [null, [], { foreign: { columns: 2 } }, { [id]: { columns: {} } }, { [id]: { columns: NaN } }, { [id]: { constructor: 2 } }]) assert.throws(() => parse({ ...data, panelSettings }));
    assert.equal(parse(defaults()).panelSettings, undefined);
  }
  for (const columns of [0, 5, 1.5, '2', true]) assert.throws(() => equipmentParse({ ...equipmentDefault(), panelSettings: { inventory: { columns } } }));
  assert.throws(() => equipmentParse({ ...equipmentDefault(), panelSettings: { inventory: { unknown: 1 } } }));
  assert.throws(() => equipmentParse({ ...equipmentDefault(), panelSettings: { character: { columns: 2 } } }));
});
test('面板可声明开关、数值范围和枚举接口', () => {
  const registry = { demo: [{ key: 'visible', label: '显示', type: 'boolean', default: true }, { key: 'spacing', label: '间距', type: 'number', min: 0, max: 20, step: 2, default: 4 }, { key: 'view', label: '显示方式', type: 'select', default: 'list', options: [{ label: '列表', value: 'list' }, { label: '卡片', value: 'cards' }] }] };
  assert.deepEqual(parsePanelSettings({ demo: { visible: false, spacing: 8, view: 'cards' } }, ['demo'], registry), { demo: { visible: false, spacing: 8, view: 'cards' } });
  for (const options of [{ visible: 1 }, { spacing: 3 }, { spacing: 30 }, { view: 'unknown' }]) assert.throws(() => parsePanelSettings({ demo: options }, ['demo'], registry));
});
test('Puck 列数配置兼容旧布局并拒绝非法数值', () => {
  const data = defaultPuck(); const panel = data.content.find(block => block.type === 'Panel'); panel.props.columns = 2;
  assert.deepEqual(parsePuck(JSON.parse(JSON.stringify(data))), data);
  panel.props.columns = 5; assert.throws(() => parsePuck(data));
});
