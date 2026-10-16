import assert from 'node:assert/strict';
import test from 'node:test';
import { createBattle } from './data.ts';
import { playerContext } from './playerContext.ts';
import { usePressStore } from './store.ts';

test('player selection follows live actor, switches ally/enemy target pools and rejects dead/deleted targets', () => {
  const battle = createBattle();
  let context = playerContext(battle, 'R2');
  assert.equal(context.actor.id, 'L1'); assert.equal(context.target.id, 'R2');
  battle.teams.right[1].hp = 0;
  context = playerContext(battle, 'R2'); assert.equal(context.target.id, 'R1');
  battle.actorId = 'L3'; battle.teams.left[2].skillId = 'L3-heal';
  context = playerContext(battle, 'R1'); assert.equal(context.targetSide, 'left'); assert.equal(context.target.id, 'L1');
  battle.side = 'right'; battle.actorId = 'R1';
  context = playerContext(battle, 'R1'); assert.equal(context.actor.id, 'R1'); assert.equal(context.targetSide, 'left');
  battle.teams.left = [];
  context = playerContext(battle, 'L1'); assert.equal(context.target, undefined); assert.equal(context.finished, true);
});

test('editor selection leaves actor and target untouched; player submits the target displayed by its context', () => {
  const original = usePressStore.getState();
  try {
    original.reset(); original.setForced('hit'); original.setTarget('R2'); original.select('right', 'R3');
    let state = usePressStore.getState();
    assert.equal(state.battle.actorId, 'L1'); assert.equal(state.targetId, 'R2');
    const context = playerContext(state.battle, state.targetId);
    state.act({ kind: 'skill', actorId: context.actor.id, skillId: context.skill.id, targetId: context.target.id, forced: state.forced });
    state = usePressStore.getState();
    assert.equal(state.battle.teams.right[0].hp, 220); assert.equal(state.battle.teams.right[1].hp, 177); assert.equal(state.battle.teams.right[2].hp, 220);
    assert.equal(playerContext(state.battle, state.targetId).actor.id, 'L2');
    state.removeUnit('right', 'R2'); assert.equal(playerContext(usePressStore.getState().battle, state.targetId).target.id, 'R1');
    state.reset(); assert.equal(usePressStore.getState().targetId, 'R1'); assert.equal(usePressStore.getState().forced, 'random');
  } finally { usePressStore.setState(original, true); }
});
