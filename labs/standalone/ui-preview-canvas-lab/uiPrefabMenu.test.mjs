import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUiPrefabMenu } from './uiPrefabMenu.ts';

test('添加 UI 菜单按源文件目录生成多层结构，叶子使用组件名并回传定义', () => {
  let picked;
  const label = { type: 'label', label: '文本标签', category: '不是菜单分类' };
  const menu = buildUiPrefabMenu([
    { source: '基础/文字/Label.ui.tsx', definition: label },
    { source: '基础/Button.ui.tsx', definition: { type: 'button', label: '按钮' } },
    { source: '布局\\Group.ui.tsx', definition: { type: 'group', label: '容器' } },
  ], entry => { picked = entry; });
  const basic = menu.find(entry => entry.label === '基础');
  const nested = basic.children.find(entry => entry.label === '文字');
  assert.equal(nested.children[0].label, '文本标签');
  nested.children[0].action(); assert.equal(picked, label);
  assert.equal(menu.find(entry => entry.label === '布局').children[0].id, 'ui-prefab:group');
});

test('移动文件会改变添加菜单目录，不需要改分类配置', () => {
  const definition = { type: 'custom', label: '自定义 UI' };
  const before = buildUiPrefabMenu([{ source: '基础/Custom.ui.tsx', definition }], () => {});
  const after = buildUiPrefabMenu([{ source: '战斗/HUD/Custom.ui.tsx', definition }], () => {});
  assert.equal(before[0].label, '基础'); assert.equal(after[0].label, '战斗');
  assert.equal(after[0].children[0].children[0].id, 'ui-prefab:custom');
  assert.deepEqual(buildUiPrefabMenu([], () => {}), []);
});
