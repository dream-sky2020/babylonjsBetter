import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryCount, restockItem, transferItem, resolveItemUse } from './usage.ts';

const target = () => ({ id: 'hero', hp: 10, maxHp: 100, mp: 0, maxMp: 20, sp: 0, maxSp: 10, statuses: {} });
const stock = () => ({ warehouse: { stacks: { potion: 4 }, uniques: [] }, backpack: { stacks: { potion: 1 }, uniques: [] } });
const potion = {
  id: 'potion', storage: { warehouseLimit: 5, backpackLimit: 3 },
  use: {
    battle: { target: 'self', cost: 'consumeOne', effectSetId: 'battle-heal' },
    field: { target: 'self', cost: 'consumeOne', effects: [{ type: 'restore', resource: 'hp', amount: { kind: 'fixed', value: 80 } }] },
  },
};

test('战斗与战斗外效果独立，分别消耗背包和仓库', () => {
  const original = stock();
  const sets = { 'battle-heal': [{ type: 'restore', resource: 'hp', amount: { kind: 'fixed', value: 50 } }] };
  const battle = resolveItemUse(original, potion, 'battle', { definitionId: 'potion' }, [target()], sets);
  assert.equal(battle.targets[0].hp, 60);
  assert.equal(battle.stock.backpack.stacks.potion, 0);
  assert.equal(battle.stock.warehouse.stacks.potion, 4);
  assert.equal(battle.turnCost, 1);
  const field = resolveItemUse(original, potion, 'field', { definitionId: 'potion' }, [target()], sets);
  assert.equal(field.targets[0].hp, 90);
  assert.equal(field.stock.warehouse.stacks.potion, 3);
  assert.equal(field.stock.backpack.stacks.potion, 1);
  assert.equal(field.turnCost, 0);
  assert.deepEqual(original, stock());
});

test('两种场景可引用同一个效果组，库存不足或禁用场景不改变输入', () => {
  const shared = { id: 'potion', storage: potion.storage, use: { battle: potion.use.battle, field: potion.use.battle } };
  const sets = { 'battle-heal': [{ type: 'restore', resource: 'hp', amount: { kind: 'fixed', value: 50 } }] };
  assert.equal(resolveItemUse(stock(), shared, 'field', { definitionId: 'potion' }, [target()], sets).targets[0].hp, 60);
  const empty = { ...stock(), backpack: { stacks: {}, uniques: [] } };
  assert.throws(() => resolveItemUse(empty, potion, 'battle', { definitionId: 'potion' }, [target()], sets), /没有所选物品/);
  assert.throws(() => resolveItemUse(stock(), { ...potion, use: { field: potion.use.field } }, 'battle', { definitionId: 'potion' }, [target()]), /不能在战斗中/);
  assert.deepEqual(empty.backpack, { stacks: {}, uniques: [] });
});

test('转移受两处上限约束，整备补满背包且仅成功补货时花一回合', () => {
  const original = stock();
  const packed = transferItem(original, potion, 'warehouse', { definitionId: 'potion' }, 2);
  assert.equal(inventoryCount(packed.backpack, 'potion'), 3);
  assert.equal(inventoryCount(packed.warehouse, 'potion'), 2);
  assert.throws(() => transferItem(original, potion, 'warehouse', { definitionId: 'potion' }, 3), /背包已达到/);
  assert.throws(() => transferItem(original, potion, 'backpack', { definitionId: 'potion' }, 2), /仓库已达到/);
  const restocked = restockItem(original, potion);
  assert.equal(restocked.moved, 2);
  assert.equal(restocked.turnCost, 1);
  assert.equal(restockItem(restocked.stock, potion).turnCost, 0);
  assert.deepEqual(original, stock());
});

test('独立物品转移保留附魔，耐久损耗触发后才减耐久，归零才损坏', () => {
  const item = { kind: 'unique', definitionId: 'blade', instanceId: 'b1', durability: 2, enchantments: [{ id: '锋锐', modifiers: [] }] };
  const blade = { id: 'blade', storage: { warehouseLimit: 1, backpackLimit: 1 }, wear: { kind: 'durability', breakChance: 0.5, maxDurability: 2, durabilityLoss: 1 }, use: { battle: { target: 'oneEnemy', cost: 'wearCheck', effects: [{ type: 'damage', amount: { kind: 'fixed', value: 8 } }] } } };
  const original = { warehouse: { stacks: {}, uniques: [item] }, backpack: { stacks: {}, uniques: [] } };
  const packed = transferItem(original, blade, 'warehouse', { definitionId: 'blade', instanceId: 'b1' }, 1);
  assert.deepEqual(packed.backpack.uniques[0].enchantments, item.enchantments);
  const selection = { definitionId: 'blade', instanceId: 'b1' };
  const safe = resolveItemUse(packed, blade, 'battle', selection, [target()], {}, () => 0.9);
  assert.equal(safe.targets[0].hp, 2);
  assert.equal(safe.stock.backpack.uniques[0].durability, 2);
  const worn = resolveItemUse(packed, blade, 'battle', selection, [target()], {}, () => 0.1);
  assert.equal(worn.stock.backpack.uniques[0].durability, 1);
  assert.equal(worn.destroyed, false);
  const broken = resolveItemUse(worn.stock, blade, 'battle', selection, [target()], {}, () => 0.1);
  assert.equal(broken.stock.backpack.uniques.length, 0);
  assert.equal(broken.destroyed, true);
  assert.equal(original.warehouse.uniques[0].durability, 2);
});

test('无耐久物品使用后按概率损坏，事件效果可在战斗外触发', () => {
  const tool = { id: 'tool', storage: { warehouseLimit: 2, backpackLimit: 1 }, wear: { kind: 'chanceOnly', breakChance: 0.5 }, use: { field: { target: 'self', cost: 'wearCheck', effects: [{ type: 'triggerEvent', eventId: 'repair' }] } } };
  const original = { warehouse: { stacks: { tool: 2 }, uniques: [] }, backpack: { stacks: {}, uniques: [] } };
  const safe = resolveItemUse(original, tool, 'field', { definitionId: 'tool' }, [target()], {}, () => 0.9);
  assert.deepEqual(safe.events, ['repair']);
  assert.equal(safe.stock.warehouse.stacks.tool, 2);
  const broken = resolveItemUse(original, tool, 'field', { definitionId: 'tool' }, [target()], {}, () => 0.1);
  assert.equal(broken.stock.warehouse.stacks.tool, 1);
  assert.equal(broken.destroyed, true);
  assert.deepEqual(original.warehouse.stacks, { tool: 2 });
});
