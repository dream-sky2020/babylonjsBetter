import test from 'node:test';
import assert from 'node:assert/strict';
import { sample, slots } from './model.ts';
import { useEquipment } from './store.ts';
const reset = () => useEquipment.setState({ game: sample(), actorId: 'actor0', slotId: 'weapon', itemId: null, filter: 'all' });
test('仓库双击按物品类型装备，立即替换并返还旧物品，不依赖之前的选中项', () => {
  reset(); useEquipment.getState().inventory('equip', 'hat');
  let state = useEquipment.getState(); assert.equal(state.game.actors[0].gear.head, 'hat'); assert.equal(state.game.stock.hat, 2); assert.equal(state.game.stock.helm, 1); assert.equal(state.slotId, 'head');
  state.inventory('equip', 'blade'); state = useEquipment.getState(); assert.equal(state.game.actors[0].gear.weapon, 'blade'); assert.equal(state.game.stock.sword, 2);
});
test('右键返还当前人物的对应装备，即使仓库数量为零，不会卸下别人的物品或其它部位', () => {
  reset(); assert.equal(useEquipment.getState().game.stock.helm, 0);
  useEquipment.getState().inventory('remove', 'helm'); const state = useEquipment.getState();
  assert.equal(state.game.actors[0].gear.head, null); assert.equal(state.game.stock.helm, 1); assert.equal(state.game.actors[1].gear.head, 'helm');
  state.inventory('remove', 'staff'); assert.equal(useEquipment.getState().game, state.game); assert.equal(state.game.actors[0].gear.weapon, 'sword');
});
test('技能双击优先选中技能位置，否则用空位；拒绝超额并支持右键卸下', () => {
  reset(); useEquipment.getState().inventory('equip', 'guard'); assert.equal(useEquipment.getState().game.actors[0].gear.skill3, 'guard');
  useEquipment.getState().slot('skill2'); useEquipment.getState().inventory('equip', 'ice'); assert.equal(useEquipment.getState().game.actors[0].gear.skill2, 'ice');
  for (const id of ['heal','slash','wisdom','haste','spark']) { useEquipment.getState().slot('weapon'); useEquipment.getState().inventory('equip', id); }
  let state = useEquipment.getState(); assert.equal(slots.filter(slot => slot.kind === 'skill' && state.game.actors[0].gear[slot.id]).length, 8);
  const before = state.game; state.slot('weapon'); state.inventory('equip', 'power'); assert.equal(useEquipment.getState().game, before);
  state.inventory('remove', 'ice'); state = useEquipment.getState(); assert.equal(state.game.actors[0].gear.skill2, null); assert.equal(state.game.actors[0].skillStock.ice, 3);
});
