import assert from 'node:assert/strict';
import test from 'node:test';
import { createBattle } from './data.ts';
import { chooseAutoAction } from './autoAction.ts';
import { usePressStore } from './store.ts';

test('auto selection exploits weakness and does not mutate the source', () => {
  const battle = createBattle(), before = structuredClone(battle);
  const choice = chooseAutoAction(battle);
  assert.equal(choice.action.skillId, 'L1-fire'); assert.equal(choice.action.targetId, 'R1'); assert.match(choice.reason, /弱点/);
  assert.deepEqual(battle, before);
});
test('auto selection respects MP, avoids denial affinities including all-target attacks, and passes without a safe skill', () => {
  const battle = createBattle(); battle.teams.left[0].mp = 0;
  assert.equal(chooseAutoAction(battle).action.skillId, 'L1-attack');
  battle.teams.right.forEach(unit => { unit.affinities.physical = 'repel'; unit.affinities.fire = 'drain'; });
  assert.equal(chooseAutoAction(battle).action.kind, 'pass');
  battle.teams.left[0].mp = 40; battle.teams.left[0].skills[1].target = 'all'; battle.teams.right[0].affinities.fire = 'weak';
  assert.equal(chooseAutoAction(battle).action.kind, 'pass');
});
test('auto selection heals badly wounded living allies and supports the enemy phase', () => {
  const battle = createBattle(); battle.actorId = 'L3'; battle.teams.left[0].hp = 30;
  const heal = chooseAutoAction(battle); assert.equal(heal.action.skillId, 'L3-heal'); assert.equal(heal.action.targetId, 'L1');
  battle.side = 'right'; battle.actorId = 'R1'; battle.teams.left[1].affinities.fire = 'weak';
  const enemy = chooseAutoAction(battle); assert.equal(enemy.action.actorId, 'R1'); assert.equal(enemy.action.targetId, 'L2');
  battle.winner = 'left'; assert.equal(chooseAutoAction(battle), undefined);
});
test('auto step executes exactly one action for either side through the shared engine and roll mode', () => {
  const original = usePressStore.getState();
  try {
    original.reset(); original.setForced('hit'); original.autoStep();
    let state = usePressStore.getState();
    assert.equal(state.battle.teams.right[0].hp, 156); assert.equal(state.battle.teams.left[0].mp, 36); assert.equal(state.battle.actorId, 'L2');
    assert.deepEqual(state.battle.icons, { full: 2, half: 1 }); assert.equal(state.targetId, 'R1'); assert.match(state.battle.logs.join('\n'), /自动一步/);
    state.end(); state = usePressStore.getState(); state.setForced('miss'); state.autoStep(); state = usePressStore.getState();
    assert.equal(state.battle.teams.left.reduce((sum, unit) => sum + unit.hp, 0), 660);
    assert.deepEqual(state.battle.icons, { full: 1, half: 0 }); assert.equal(state.battle.actorId, 'R2');
    state.removeUnit('right', 'R2'); state.removeUnit('right', 'R3'); state.removeUnit('right', 'R1');
    const before = usePressStore.getState().battle; state.autoStep(); assert.deepEqual(usePressStore.getState().battle, before);
  } finally { usePressStore.setState(original, true); }
});
