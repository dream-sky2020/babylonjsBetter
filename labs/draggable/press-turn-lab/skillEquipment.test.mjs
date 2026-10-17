import assert from 'node:assert/strict';
import test from 'node:test';
import { createBattle, createSkill } from './data.ts';
import { applyPreparation, combatStats, currentPreparation, draftWithSlots, equippedSkills } from './preparation.ts';
import { actionContext } from './actionContext.ts';
import { chooseAutoAction } from './autoAction.ts';
import { resolveAction } from './engine.ts';
import { usePressStore } from './store.ts';

test('active and passive skills share eight slots, excess skills stay in inventory and invalid slots reject atomically', () => {
  const unit = createBattle().teams.left[0];
  unit.skills = [unit.skills[0], ...Array.from({ length: 10 }, (_, index) => ({ ...createSkill(`s${index}`), kind: index % 2 ? 'passive' : 'attack', passive: { attack: 1, defense: 1 } }))];
  unit.disabledSkillIds = [];
  assert.equal(equippedSkills(unit).length, 8); assert.equal(currentPreparation(unit).disabledSkillIds.length, 2);
  const before = structuredClone(unit);
  assert.equal(applyPreparation(unit, { weaponId: 'heavy', armorId: 'plate', disabledSkillIds: [] }), false); assert.deepEqual(unit, before);
  const valid = currentPreparation(unit); assert.equal(applyPreparation(unit, valid), true); assert.equal(unit.skillSlots.length, 8);
  for (const slots of [[...valid.skillSlots, 's8'], Array(8).fill('s0'), ['missing', ...valid.skillSlots.slice(1)], 'invalid']) {
    const snapshot = structuredClone(unit); assert.equal(applyPreparation(unit, { ...valid, weaponId: 'heavy', skillSlots: slots }), false); assert.deepEqual(unit, snapshot);
  }
  const battle = createBattle(); battle.teams.left[0] = unit;
  assert.equal(actionContext(battle, 'skill').skills.length, 4); assert.ok(actionContext(battle, 'skill').skills.every(skill => skill.kind !== 'passive'));
  const auto = chooseAutoAction(battle); assert.notEqual(unit.skills.find(skill => skill.id === auto.action.skillId)?.kind, 'passive');
});

test('passives affect combat only while equipped, never spend MP and cannot be actively executed', () => {
  const battle = createBattle(); const unit = battle.teams.left[0];
  let draft = currentPreparation(unit);
  draft = draftWithSlots(unit, draft, ['L1-fire', 'L1-might', null, null, null, null, null, null]);
  assert.equal(applyPreparation(unit, draft), true); assert.equal(combatStats(unit).attack, 24);
  const passive = resolveAction(battle, { kind: 'skill', actorId: 'L1', skillId: 'L1-might', targetId: 'R1' });
  assert.match(passive.logs.at(-1), /被动技能/); assert.deepEqual(passive.icons, battle.icons); assert.equal(passive.teams.left[0].mp, 40);
  const hit = resolveAction(battle, { kind: 'attack', actorId: 'L1', targetId: 'R1', forced: 'hit' }); assert.equal(hit.teams.right[0].hp, 184);
  assert.equal(applyPreparation(unit, draft), true); assert.equal(combatStats(unit).attack, 24);
  draft = draftWithSlots(unit, draft, ['L1-fire', null, null, null, null, null, null, null]); applyPreparation(unit, draft);
  assert.equal(combatStats(unit).attack, 20); assert.equal(equippedSkills(unit).some(skill => skill.kind === 'passive'), false);
  const target = battle.teams.right[0]; const defensive = draftWithSlots(target, currentPreparation(target), ['R1-ward', null, null, null, null, null, null, null]); applyPreparation(target, defensive);
  const defended = resolveAction(battle, { kind: 'attack', actorId: 'L1', targetId: 'R1', forced: 'hit' }); assert.equal(defended.teams.right[0].hp, 192);
});

test('configuration editor saves loadouts without consuming battle actions and rejects invalid saves', () => {
  const original = usePressStore.getState();
  try {
    original.reset(); const state = usePressStore.getState(); const before = structuredClone(state.battle);
    const unit = state.battle.teams.left[0];
    const draft = draftWithSlots(unit, { ...currentPreparation(unit), weaponId: 'heavy' }, ['L1-fire', 'L1-might', null, null, null, null, null, null]);
    assert.equal(state.configurePreparation('left', 'L1', draft), true);
    const next = usePressStore.getState().battle; assert.deepEqual(next.icons, before.icons); assert.equal(next.actorId, before.actorId); assert.equal(combatStats(next.teams.left[0]).attack, 32);
    assert.equal(state.configurePreparation('left', 'L1', { ...draft, skillSlots: Array(8).fill('L1-might') }), false);
    assert.equal(combatStats(usePressStore.getState().battle.teams.left[0]).attack, 32);
  } finally { usePressStore.setState(original, true); }
});
