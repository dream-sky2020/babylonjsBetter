import assert from 'node:assert/strict';
import test from 'node:test';
import { createBattle } from './data.ts';
import { endPhase, resolveAction, restartBattle, spendIcons } from './engine.ts';

const cast = (battle, patch = {}) => resolveAction(battle, { kind: 'skill', actorId: battle.actorId, skillId: battle.teams[battle.side].find(u => u.id === battle.actorId).skillId, targetId: 'R1', forced: 'hit', ...patch });
test('full and half icons follow approved ordinary, advantage, miss, deny and pass rules', () => {
  assert.deepEqual(spendIcons({ full: 2, half: 1 }, 'normal'), { full: 2, half: 0 });
  assert.deepEqual(spendIcons({ full: 2, half: 1 }, 'advantage'), { full: 1, half: 2 });
  assert.deepEqual(spendIcons({ full: 0, half: 2 }, 'advantage'), { full: 0, half: 1 });
  assert.deepEqual(spendIcons({ full: 2, half: 1 }, 'miss'), { full: 1, half: 0 });
  assert.deepEqual(spendIcons({ full: 0, half: 1 }, 'miss'), { full: 0, half: 0 });
  assert.deepEqual(spendIcons({ full: 3, half: 2 }, 'deny'), { full: 0, half: 0 });
  assert.deepEqual(spendIcons({ full: 1, half: 1 }, 'pass'), { full: 0, half: 2 });
});
test('weakness consumes MP, deals deterministic damage, grants a half icon, rotates actor, and leaves source untouched', () => {
  const battle = createBattle(), before = structuredClone(battle); const next = cast(battle);
  assert.equal(next.teams.right[0].hp, 156);
  assert.equal(next.teams.left[0].mp, 36);
  assert.deepEqual(next.icons, { full: 2, half: 1 });
  assert.equal(next.actorId, 'L2'); assert.deepEqual(battle, before);
});
test('weakness plus critical gives only one half icon; miss costs two and deals no damage', () => {
  const critical = cast(createBattle(), { forced: 'critical' });
  assert.deepEqual(critical.icons, { full: 2, half: 1 });
  assert.equal(critical.teams.right[0].hp, 124);
  const missed = cast(createBattle(), { forced: 'miss' });
  assert.deepEqual(missed.icons, { full: 1, half: 0 }); assert.equal(missed.teams.right[0].hp, 220);
});
test('null, repel and drain clear icons and begin the opposing phase; no recursive reflection', () => {
  for (const affinity of ['null', 'repel', 'drain']) {
    const battle = createBattle(); battle.teams.right[0].affinities.fire = affinity; battle.teams.right[0].hp = 150;
    const next = cast(battle);
    assert.equal(next.last.outcome, 'deny'); assert.deepEqual(next.last.after, { full: 0, half: 0 });
    assert.equal(next.side, 'right'); assert.deepEqual(next.icons, { full: 3, half: 0 });
    assert.equal(next.teams.left[0].hp, affinity === 'repel' ? 177 : 220);
    assert.equal(next.teams.right[0].hp, affinity === 'drain' ? 193 : 150);
  }
});
test('all-target priority is deny then miss then advantage; cost is applied once', () => {
  const battle = createBattle(); battle.teams.left[0].skills[1].target = 'all'; battle.teams.right[1].affinities.fire = 'null';
  const next = cast(battle); assert.equal(next.last.outcome, 'deny'); assert.equal(next.teams.left[0].mp, 36);
  assert.equal(next.teams.right[0].hp, 156); assert.equal(next.teams.right[1].hp, 220);
  battle.teams.right[1].affinities.fire = 'normal';
  const rolls = [.1, .9, .9]; battle.teams.left[0].skills[1].accuracy = 50;
  const mixed = resolveAction(battle, { kind: 'skill', actorId: 'L1', skillId: 'L1-fire', forced: 'random' }, () => rolls.shift() ?? .9);
  assert.equal(mixed.last.outcome, 'miss'); assert.deepEqual(mixed.icons, { full: 1, half: 0 });
});
test('guard is temporary and reduces damage; pass rotates actor; dead units do not supply next-phase icons', () => {
  let battle = resolveAction(createBattle(), { kind: 'guard', actorId: 'L1' });
  assert.equal(battle.teams.left[0].guarding, true); assert.deepEqual(battle.icons, { full: 2, half: 0 });
  battle = resolveAction(battle, { kind: 'pass', actorId: 'L2' }); assert.deepEqual(battle.icons, { full: 1, half: 1 });
  battle.teams.right[2].hp = 0; battle = endPhase(battle); assert.equal(battle.side, 'right'); assert.equal(battle.icons.full, 2);
  const hit = cast(battle, { targetId: 'L1' }); assert.equal(hit.teams.left[0].hp, 199);
  const next = endPhase(hit); assert.equal(next.round, 2); assert.equal(next.teams.left[0].guarding, false);
});
test('invalid actor, missing target and insufficient MP consume no resources', () => {
  const battle = createBattle();
  for (const patch of [{ actorId: 'L2' }, { targetId: 'absent' }, { skillId: 'absent' }]) {
    const next = cast(battle, patch); assert.deepEqual(next.teams, battle.teams); assert.deepEqual(next.icons, battle.icons); assert.match(next.logs.at(-1), /拒绝/);
  }
  battle.teams.left[0].mp = 0; const next = cast(battle); assert.deepEqual(next.teams, battle.teams); assert.deepEqual(next.icons, battle.icons);
});
test('healing targets allies and consumes ordinary cost; killing the last enemy stops without refilling', () => {
  const battle = createBattle(); battle.actorId = 'L3'; battle.teams.left[0].hp = 100;
  let next = cast(battle, { skillId: 'L3-heal', targetId: 'L1' }); assert.equal(next.teams.left[0].hp, 165); assert.equal(next.teams.left[2].mp, 34); assert.deepEqual(next.icons, { full: 2, half: 0 });
  next = createBattle(); next.teams.right.forEach(u => { u.hp = 0; }); next.teams.right[0].hp = 1;
  const win = cast(next); assert.equal(win.winner, 'left'); assert.deepEqual(win.icons, { full: 0, half: 0 }); assert.equal(win.actorId, undefined);
});
test('restart keeps edited builds, restores resources, recalculates icons and handles an empty team', () => {
  const battle = createBattle(); battle.teams.left[0].hp = 0; battle.teams.left[0].mp = 0; battle.teams.left[0].skills[1].power = 99;
  battle.teams.left.pop();
  const next = restartBattle(battle);
  assert.equal(next.teams.left[0].hp, 220); assert.equal(next.teams.left[0].mp, 40); assert.equal(next.teams.left[0].skills[1].power, 99);
  assert.deepEqual(next.icons, { full: 2, half: 0 }); assert.equal(next.actorId, 'L1');
  battle.teams.left = []; assert.equal(restartBattle(battle).winner, 'right');
});
