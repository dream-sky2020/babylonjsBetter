import assert from 'node:assert/strict';
import test from 'node:test';
import { createBattle } from './data.ts';
import { endPhase, resolveAction, restartBattle } from './engine.ts';
import { currentPreparation } from './preparation.ts';
import { actionContext } from './actionContext.ts';
import { playerContext } from './playerContext.ts';
import { chooseAutoAction } from './autoAction.ts';

test('preparation applies equipment and skill changes atomically, spends ordinary points and never stacks bonuses', () => {
  const source = createBattle(); const before = structuredClone(source);
  const draft = currentPreparation(source.teams.left[0]);
  draft.weaponId = 'heavy'; draft.armorId = 'plate'; draft.disabledSkillIds.push('L1-fire'); draft.skillSlots[0] = null;
  assert.deepEqual(source, before);
  const next = resolveAction(source, { kind: 'prepare', actorId: 'L1', preparation: draft });
  assert.deepEqual(source, before); assert.equal(next.teams.left[0].attack, 28); assert.equal(next.teams.left[0].defense, 20);
  assert.deepEqual(next.icons, { full: 2, half: 0 }); assert.equal(next.actorId, 'L2');
  next.actorId = 'L1';
  const repeated = resolveAction(next, { kind: 'prepare', actorId: 'L1', preparation: draft });
  assert.equal(repeated.teams.left[0].attack, 28); assert.equal(repeated.teams.left[0].defense, 20);
  assert.equal(actionContext(next, 'skill').skills.length, 0); assert.equal(actionContext(next, 'attack').canConfirm, true);
  const denied = resolveAction(next, { kind: 'skill', actorId: 'L1', skillId: 'L1-fire', targetId: 'R1' });
  assert.match(denied.logs.at(-1), /尚未装配/); assert.deepEqual(denied.icons, next.icons);
  const automatic = chooseAutoAction(next); assert.notEqual(automatic.action.skillId, 'L1-fire');
  const restarted = restartBattle(next); assert.equal(restarted.teams.left[0].attack, 28); assert.ok(restarted.teams.left[0].disabledSkillIds.includes('L1-fire'));
  const restored = resolveAction(restarted, { kind: 'prepare', actorId: 'L1', preparation: { weaponId: 'standard', armorId: 'standard', disabledSkillIds: [] } });
  assert.equal(restored.teams.left[0].attack, 20); assert.equal(restored.teams.left[0].defense, 12); assert.equal(actionContext(restored, 'skill').skills.length, 1);
});

test('invalid preparation rejects without partial mutation, resource spend or actor rotation', () => {
  for (const preparation of [undefined, { weaponId: 'bad', armorId: 'plate', disabledSkillIds: [] }, { weaponId: 'heavy', armorId: 'plate', disabledSkillIds: ['missing'] }, { weaponId: 'heavy', armorId: 'plate', disabledSkillIds: ['L1-attack'] }]) {
    const source = createBattle(); const next = resolveAction(source, { kind: 'prepare', actorId: 'L1', preparation });
    assert.deepEqual(next.teams, source.teams); assert.deepEqual(next.icons, source.icons); assert.equal(next.actorId, 'L1'); assert.match(next.logs.at(-1), /拒绝执行/);
  }
});

test('observe and talk reveal deterministic results and spend one ordinary action without changing the target', () => {
  for (const kind of ['talk', 'observe']) {
    const source = createBattle();
    const next = resolveAction(source, { kind, actorId: 'L1', targetId: 'R1', message: '愿意休战吗？' });
    assert.deepEqual(next.teams, source.teams); assert.deepEqual(next.icons, { full: 2, half: 0 }); assert.equal(next.actorId, 'L2');
    assert.match(next.report.title, /冰霜守卫/);
    assert.match(next.report.text, kind === 'talk' ? /愿意休战吗/ : /火炎 弱点/);
    const rejected = resolveAction(source, { kind, actorId: 'L1', targetId: 'L2' }); assert.deepEqual(rejected.icons, source.icons); assert.match(rejected.logs.at(-1), /拒绝执行/);
  }
});

test('escape ends both manual and auto controls, cannot change phases, and restart clears the escape result', () => {
  const source = createBattle(); const next = resolveAction(source, { kind: 'escape', actorId: 'L1' });
  assert.equal(next.escapedBy, 'left'); assert.equal(next.winner, undefined); assert.equal(next.actorId, undefined); assert.deepEqual(next.icons, { full: 0, half: 0 });
  assert.equal(playerContext(next).finished, true); assert.equal(actionContext(next, 'prepare').canConfirm, false); assert.equal(chooseAutoAction(next), undefined);
  assert.deepEqual(endPhase(next), next); assert.match(resolveAction(next, { kind: 'skip', actorId: 'L1' }).logs.at(-1), /战斗已结束/);
  const restarted = restartBattle(next); assert.equal(restarted.escapedBy, undefined); assert.equal(restarted.actorId, 'L1'); assert.equal(playerContext(restarted).finished, false);
});
