import assert from 'node:assert/strict';
import test from 'node:test';
import { createBattle } from './data.ts';
import { actionContext } from './actionContext.ts';
import { resolveAction } from './engine.ts';

test('every unit can attack without skills or MP, using physical single-target damage', () => {
  const source = createBattle(); source.teams.left[0].skills = []; source.teams.left[0].mp = 0;
  const context = actionContext(source, 'attack', undefined, 'R1');
  assert.equal(context.canConfirm, true); assert.equal(context.skill.mpCost, 0);
  const next = resolveAction(source, { kind: 'attack', actorId: 'L1', targetId: 'R1', forced: 'hit' });
  assert.equal(next.teams.right[0].hp, 188); assert.equal(next.teams.left[0].mp, 0);
  assert.deepEqual(next.icons, { full: 2, half: 0 }); assert.equal(next.actorId, 'L2');
  const customized = createBattle(); Object.assign(customized.teams.left[0].skills[0], { mpCost: 99, kind: 'heal', target: 'all', element: 'fire' });
  assert.deepEqual([actionContext(customized, 'attack').skill.mpCost, actionContext(customized, 'attack').skill.kind, actionContext(customized, 'attack').skill.target, actionContext(customized, 'attack').skill.element], [0, 'attack', 'single', 'physical']);
});

test('swap chooses a specific living teammate; skip uses the normal rotation and both spend half points', () => {
  const source = createBattle(); const before = structuredClone(source);
  const swapped = resolveAction(source, { kind: 'swap', actorId: 'L1', targetId: 'L3' });
  assert.equal(swapped.actorId, 'L3'); assert.deepEqual(swapped.icons, { full: 2, half: 1 });
  assert.deepEqual(swapped.teams, source.teams); assert.deepEqual(source, before);
  const skipped = resolveAction(source, { kind: 'skip', actorId: 'L1' });
  assert.equal(skipped.actorId, 'L2'); assert.deepEqual(skipped.icons, swapped.icons);
  for (const targetId of ['L1', 'R1', 'unknown', undefined]) {
    const rejected = resolveAction(source, { kind: 'swap', actorId: 'L1', targetId });
    assert.equal(rejected.actorId, source.actorId); assert.deepEqual(rejected.icons, source.icons); assert.match(rejected.logs.at(-1), /拒绝执行/);
  }
  source.teams.left[2].hp = 0;
  assert.match(resolveAction(source, { kind: 'swap', actorId: 'L1', targetId: 'L3' }).logs.at(-1), /拒绝执行/);
  source.icons = { full: 0, half: 1 };
  const last = resolveAction(source, { kind: 'swap', actorId: 'L1', targetId: 'L2' });
  assert.equal(last.side, 'right'); assert.equal(last.actorId, 'R1'); assert.deepEqual(last.last.after, { full: 0, half: 0 });
});

test('action options follow live targets, healing side, MP, empty teams and battle completion', () => {
  const battle = createBattle();
  assert.equal(actionContext(battle).canConfirm, false);
  assert.equal(actionContext(battle, 'guard').canConfirm, true);
  assert.equal(actionContext(battle, 'skip').canConfirm, true);
  assert.deepEqual(actionContext(battle, 'swap').targets.map(unit => unit.id), ['L2', 'L3']);
  battle.actorId = 'L3';
  const healing = actionContext(battle, 'skill', 'L3-heal', 'R1');
  assert.equal(healing.targetSide, 'left'); assert.equal(healing.target.id, 'L1');
  assert.equal(healing.skills.some(skill => skill.id === 'L3-attack'), false);
  battle.teams.left[2].mp = 0; assert.equal(actionContext(battle, 'skill', 'L3-heal').canConfirm, false);
  battle.teams.left[0].hp = 0; battle.teams.left[1].hp = 0;
  assert.equal(actionContext(battle, 'swap').canConfirm, false); assert.equal(actionContext(battle, 'skip').canConfirm, true);
  battle.winner = 'left'; assert.equal(actionContext(battle, 'skip').canConfirm, false);
});
