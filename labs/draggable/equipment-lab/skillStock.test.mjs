import test from 'node:test';
import assert from 'node:assert/strict';
import { discard, equip, inventoryCount, optimize, sample, unequipAll } from './model.ts';
import { useEquipment } from './store.ts';
test('技能装卸与丢弃只改变所属人物仓库，装备仍共享', () => {
  const original = sample(); assert.equal(original.stock.guard, undefined);
  let next = equip(original, 'actor0', 'skill3', 'guard');
  assert.equal(inventoryCount(next, 'actor0', 'guard'), 2); assert.equal(inventoryCount(next, 'actor1', 'guard'), 3);
  assert.deepEqual(next.actors[1], original.actors[1]); assert.deepEqual(next.stock, original.stock);
  next = equip(next, 'actor0', 'skill3', null); assert.equal(inventoryCount(next, 'actor0', 'guard'), 3);
  next = discard(next, 'actor0', 'guard'); assert.equal(inventoryCount(next, 'actor0', 'guard'), 2); assert.equal(inventoryCount(next, 'actor1', 'guard'), 3);
  next = equip(next, 'actor0', 'head', 'hat'); assert.equal(inventoryCount(next, 'actor1', 'hat'), 2);
});
test('技能不能借用别人的库存，最强装备与全部卸下同样遵守归属', () => {
  const game = sample(); game.actors[0].skillStock.guard = 0;
  assert.throws(() => equip(game, 'actor0', 'skill3', 'guard')); assert.throws(() => discard(game, 'actor0', 'guard'));
  const optimized = optimize(game, 'actor0'); assert.ok(!Object.values(optimized.actors[0].gear).includes('guard'));
  assert.deepEqual(optimized.actors[1], game.actors[1]);
  const cleared = unequipAll(optimized, 'actor0'); assert.equal(cleared.actors[0].skillStock.fire, 3); assert.deepEqual(cleared.actors[1], game.actors[1]);
});
test('切换人物后快捷装备、右键卸下和丢弃读取当前人物技能仓库', () => {
  useEquipment.setState({ game: sample(), actorId: 'actor0', slotId: 'skill3', itemId: null });
  useEquipment.getState().inventory('equip', 'ice');
  useEquipment.getState().actor('actor1'); useEquipment.getState().slot('skill3'); useEquipment.getState().inventory('equip', 'ice');
  assert.equal(useEquipment.getState().game.actors[0].skillStock.ice, 2); assert.equal(useEquipment.getState().game.actors[1].skillStock.ice, 2);
  useEquipment.getState().inventory('remove', 'ice'); useEquipment.getState().run('discard');
  const state = useEquipment.getState(); assert.equal(state.game.actors[1].skillStock.ice, 2); assert.equal(state.game.actors[0].gear.skill3, 'ice'); assert.equal(state.game.actors[0].skillStock.ice, 2);
});
