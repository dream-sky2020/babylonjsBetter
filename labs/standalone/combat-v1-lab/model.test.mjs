import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleBattle, useDemoSkill, nextDemoPhase, stepNonAlly } from './model.ts';
import { getPhaseActors } from '../../../core/combat_v1/index.ts';

test('伤害与治疗沿用 Core 结算，记录来源，失败不修改输入', () => {
  const original = sampleBattle();
  const hit = useDemoSkill(original, 'knight', 'boss', 'burst');
  assert.equal(original.characters[2].stats.hp, 160);
  assert.equal(hit.characters[2].stats.hp, 118);
  assert.equal(hit.characters[0].stats.mp, 10);
  assert.equal(hit.characters[0].actions.normal, 0);
  assert.equal(hit.records[0].source.userId, 'knight');
  assert.equal(hit.records[0].hpDamage, 42);
  assert.throws(() => useDemoSkill(original, 'knight', 'mage', 'attack'));
  original.characters[0].stats.hp = 105;
  const healed = useDemoSkill(original, 'mage', 'knight', 'heal');
  assert.equal(healed.records[0].hpRestored, 15);
  assert.equal(healed.records[0].overheal, 15);
  assert.equal(healed.characters[0].stats.hp, 120);
});

test('振奋每场一次，增加额外行动；冷却只在己方阶段进入时递减', () => {
  const initial = sampleBattle();
  const rally = useDemoSkill(initial, 'knight', 'knight', 'rally');
  assert.deepEqual(rally.characters[0].actions, { normal: 1, extra: 1 });
  assert.throws(() => useDemoSkill(rally, 'knight', 'knight', 'rally'), /次数/);
  const burst = useDemoSkill(rally, 'knight', 'boss', 'burst');
  assert.deepEqual(burst.characters[0].actions, { normal: 0, extra: 1 });
  assert.throws(() => useDemoSkill(burst, 'knight', 'boss', 'burst'), /冷却/);
  const extra = useDemoSkill(burst, 'knight', 'boss', 'attack');
  assert.deepEqual(extra.characters[0].actions, { normal: 0, extra: 0 });
  const enemy = nextDemoPhase(extra, true);
  assert.equal(enemy.characters[0].skills.find(s => s.skillId === 'burst').usageLimits.battle.cooldown.remaining, 2);
  const round2 = nextDemoPhase(enemy, true);
  assert.equal(round2.characters[0].skills.find(s => s.skillId === 'burst').usageLimits.battle.cooldown.remaining, 1);
});

test('非我方单步推进：Boss 两次、史莱姆一次、旅人一次，最后进入我方', () => {
  let state = nextDemoPhase(sampleBattle(), true);
  state = stepNonAlly(state);
  assert.equal(state.characters[2].actions.normal, 1);
  state = stepNonAlly(state);
  assert.equal(state.characters[2].actions.normal, 0);
  state = stepNonAlly(state);
  state = stepNonAlly(state);
  assert.equal(state.characters[4].actions.normal, 0);
  assert.equal(state.records.at(-1).type, 'healing');
  state = stepNonAlly(state);
  assert.equal(state.phase, 'ally');
  assert.equal(state.round, 2);
  assert.throws(() => stepNonAlly(state));
});

test('可完整打到胜利或失败，结束后不允许继续发动技能，重开恢复所有限制', () => {
  let state = sampleBattle();
  // 演示验证用高生命值，保证可以走完多轮而不被样例敌方击败。
  state.characters.filter(c => c.faction === 'ally').forEach(c => { c.stats.hp = 1000; c.stats.maxHp = 1000; });
  for (let i = 0; i < 100 && state.status === 'active'; i++) {
    if (state.phase === 'nonAlly') state = stepNonAlly(state);
    else {
      const actor = getPhaseActors(state)[0];
      const target = state.characters.find(c => c.faction === 'enemy' && c.stats.hp > 0);
      state = actor && target ? useDemoSkill(state, actor.id, target.id, 'attack') : nextDemoPhase(state);
    }
  }
  assert.equal(state.result.outcome, 'victory');
  assert.ok(state.records.some(r => r.type === 'damage' && r.overkill > 0));
  assert.throws(() => useDemoSkill(state, 'knight', 'boss', 'attack'));
  const reset = sampleBattle();
  assert.equal(reset.records.length, 0);
  assert.equal(reset.characters[0].skills.find(s => s.skillId === 'rally').usageLimits.battle.uses.remaining, 1);
  let losing = sampleBattle();
  losing.characters.filter(c => c.faction === 'ally').forEach(c => { c.stats.hp = 1; });
  losing = nextDemoPhase(losing, true);
  losing = stepNonAlly(stepNonAlly(losing));
  assert.equal(losing.result.outcome, 'defeat');
});
