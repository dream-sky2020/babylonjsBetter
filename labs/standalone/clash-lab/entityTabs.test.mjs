import assert from 'node:assert/strict';
import test from 'node:test';
import { useCombatStore } from './store.ts';
import { addCombatUnit } from './shared/combatEntityActions.ts';

function isolated(callback) {
  const before = useCombatStore.getState();
  useCombatStore.setState({ leftUnits: [], rightUnits: [], selectedLeftUnitId: undefined, selectedRightUnitId: undefined });
  try { callback(); } finally { useCombatStore.setState(before); }
}

test('new unit tabs activate immediately; switching preserves each unit draft', () => isolated(() => {
  const first = addCombatUnit('left');
  const state = useCombatStore.getState();
  state.updateUnit('left', first, { name: '第一单位', hp: 73 });
  const second = addCombatUnit('left');
  assert.equal(useCombatStore.getState().selectedLeftUnitId, second);
  state.updateUnit('left', second, { hp: 42 });
  state.selectUnit('left', first);
  assert.equal(state.getUnit(first).hp, 73);
  assert.equal(state.getUnit(first).name, '第一单位');
  state.selectUnit('left', second);
  assert.equal(state.getUnit(second).hp, 42);
}));

test('closing current unit selects the right neighbour, then left; background deletion preserves selection', () => isolated(() => {
  const first = addCombatUnit('left'), middle = addCombatUnit('left'), last = addCombatUnit('left');
  const right = addCombatUnit('right');
  const state = useCombatStore.getState();
  state.selectUnit('left', middle);
  state.removeUnit('left', middle);
  assert.equal(useCombatStore.getState().selectedLeftUnitId, last);
  state.removeUnit('left', last);
  assert.equal(useCombatStore.getState().selectedLeftUnitId, first);
  const background = addCombatUnit('left'); state.selectUnit('left', first); state.removeUnit('left', background);
  assert.equal(useCombatStore.getState().selectedLeftUnitId, first);
  state.removeUnit('left', first);
  assert.equal(useCombatStore.getState().selectedLeftUnitId, undefined);
  assert.equal(useCombatStore.getState().selectedRightUnitId, right);
}));

test('skill tabs retain edits, have unique IDs and select a surviving neighbour after deletion', () => isolated(() => {
  const unitId = addCombatUnit('left');
  const state = useCombatStore.getState();
  const first = state.getUnit(unitId).activeSkillId;
  state.updateSkill('left', unitId, first, { skillName: '初始技能修改' });
  for (let index = 0; index < 20; index++) state.addSkill('left', unitId);
  const unit = state.getUnit(unitId);
  assert.equal(new Set(unit.skills.map(skill => skill.skillId)).size, 21);
  const last = unit.activeSkillId;
  const previous = unit.skills.at(-2).skillId;
  state.updateUnit('left', unitId, { activeSkillId: first });
  assert.equal(state.getUnit(unitId).skills[0].skillName, '初始技能修改');
  state.updateUnit('left', unitId, { activeSkillId: last });
  state.removeSkill('left', unitId, last);
  assert.equal(state.getUnit(unitId).activeSkillId, previous);
  const next = state.getUnit(unitId).skills[1].skillId;
  state.updateUnit('left', unitId, { activeSkillId: first });
  state.removeSkill('left', unitId, first);
  assert.equal(state.getUnit(unitId).activeSkillId, next);
  for (const skill of [...state.getUnit(unitId).skills]) state.removeSkill('left', unitId, skill.skillId);
  assert.equal(state.getUnit(unitId).activeSkillId, undefined);
  state.addSkill('left', unitId);
  assert.ok(state.getUnit(unitId).activeSkillId);
}));
