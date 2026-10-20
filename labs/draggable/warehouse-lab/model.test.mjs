import test from 'node:test';
import assert from 'node:assert/strict';
import { count, deposit, sample, withdraw } from './model.ts';
import { defaultGrid, defaultPuck, parseGrid, parsePuck } from './layouts.ts';
import { useWarehouse } from './store.ts';

test('普通物品按数量存取，原仓库不变，独立物品保留实例', () => {
  const original = sample();
  const added = deposit(original, 'iron-ore', 10);
  assert.equal(added.stacks['iron-ore'], 46); assert.equal(original.stacks['iron-ore'], 36);
  const taken = withdraw(added, { definitionId: 'iron-ore' }, 10);
  assert.equal(taken.stacks['iron-ore'], 36);
  const unique = deposit(original, 'relic', 1, 'new-relic');
  assert.equal(count(unique, 'relic'), 2);
  assert.equal(unique.uniques.find(item => item.instanceId === 'new-relic')?.durability, 5);
  assert.equal(withdraw(unique, { definitionId: 'relic', instanceId: 'new-relic' }, 1).uniques.length, original.uniques.length);
  assert.throws(() => withdraw(original, { definitionId: 'relic' }, 1), /数量不足/);
  assert.throws(() => deposit(original, 'relic', 10, 'many'), /一次只能/);
});

test('三个 Grid 面板和 Puck 布局分别校验', () => {
  const grid = defaultGrid(); assert.equal(grid.items.length, 3);
  assert.deepEqual(parseGrid(JSON.parse(JSON.stringify(grid))), grid);
  assert.throws(() => parseGrid({ ...grid, lab: 'equipment' }));
  assert.throws(() => parseGrid({ ...grid, items: [grid.items[0], grid.items[0], grid.items[2]] }));
  const puck = defaultPuck(); assert.deepEqual(parsePuck(JSON.parse(JSON.stringify(puck))), puck);
  const invalid = structuredClone(puck); invalid.content[0].props.content[0].props.panel = 'character';
  assert.throws(() => parsePuck(invalid));
});

test('仓库按钮读取当前选择，独立物品取出后回到物品定义', () => {
  useWarehouse.setState({ warehouse: sample(), selection: { definitionId: 'relic', instanceId: 'sample-relic-1' }, category: '全部', query: '' });
  useWarehouse.getState().run('withdraw');
  const state = useWarehouse.getState();
  assert.equal(count(state.warehouse, 'relic'), 0);
  assert.deepEqual(state.selection, { definitionId: 'relic' });
  state.run('deposit');
  assert.equal(count(useWarehouse.getState().warehouse, 'relic'), 1);
});

test('仓库演示区使用、整备和两种库存分别更新', () => {
  useWarehouse.getState().run('reset');
  useWarehouse.getState().run('useBattle');
  assert.equal(useWarehouse.getState().hero.hp, 70);
  assert.equal(useWarehouse.getState().backpack.stacks.potion, 0);
  assert.equal(useWarehouse.getState().battleTurns, 1);
  useWarehouse.getState().run('restock');
  assert.equal(useWarehouse.getState().backpack.stacks.potion, 3);
  assert.equal(useWarehouse.getState().warehouse.stacks.potion, 5);
  assert.equal(useWarehouse.getState().battleTurns, 2);
  useWarehouse.getState().run('useField');
  assert.equal(useWarehouse.getState().hero.hp, 100);
  assert.equal(useWarehouse.getState().warehouse.stacks.potion, 4);
  assert.equal(useWarehouse.getState().battleTurns, 2);
});

test('技能启用与发动不消耗库存，停用后不能发动', () => {
  const run = action => useWarehouse.getState().run(action);
  run('reset'); useWarehouse.getState().select({ definitionId: 'heal' });
  run('useBattle'); assert.equal(useWarehouse.getState().hero.mp, 10);
  run('toggleSkill'); run('useBattle');
  assert.equal(useWarehouse.getState().hero.hp, 70); assert.equal(useWarehouse.getState().hero.mp, 6);
  assert.equal(useWarehouse.getState().warehouse.stacks.heal, 1);
  run('useField'); assert.equal(useWarehouse.getState().hero.hp, 100); assert.equal(useWarehouse.getState().hero.mp, 4);
  assert.equal(useWarehouse.getState().battleTurns, 1);
  run('withdraw'); assert.equal(useWarehouse.getState().warehouse.stacks.heal, 1);
  run('toggleSkill'); run('useBattle'); assert.equal(useWarehouse.getState().hero.mp, 4);
  run('reset');
});
