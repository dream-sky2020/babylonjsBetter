import test from 'node:test';
import assert from 'node:assert/strict';
import { createTurnPhase, advanceTurnPhase, phaseForFaction, createCombatCharacter, attributes } from '../index.ts';

test('我方先行动，敌人与中立同属非我方阶段，之后才开始下一轮', () => {
  const start = createTurnPhase();
  const next = advanceTurnPhase(start);
  assert.deepEqual(start, { round: 1, phase: 'ally' });
  assert.deepEqual(next, { round: 1, phase: 'nonAlly' });
  assert.deepEqual(advanceTurnPhase(next), { round: 2, phase: 'ally' });
  assert.equal(phaseForFaction('ally'), 'ally');
  assert.equal(phaseForFaction('enemy'), 'nonAlly');
  assert.equal(phaseForFaction('neutral'), 'nonAlly');
  assert.throws(() => advanceTurnPhase({ round: 0, phase: 'ally' }));
  assert.throws(() => advanceTurnPhase({ round: 1, phase: 'invalid' }));
});

test('角色集中持有独立属性、行动和技能限制，Boss 可配置多次行动', () => {
  const definition = { id: 'hero', name: '角色', faction: 'ally', stats: Object.fromEntries(attributes.map(a => [a.id, 0])), skills: [{ skillId: 'heal', level: 1, enabled: true, usageLimits: { battle: { cost: { mp: 5 }, uses: { limit: 2, remaining: 2 } } } }] };
  const hero = createCombatCharacter(definition);
  const other = createCombatCharacter({ ...definition, id: 'other' });
  hero.skills[0].usageLimits.battle.cost.mp = 1;
  hero.stats.hp = 50;
  assert.equal(other.skills[0].usageLimits.battle.cost.mp, 5);
  assert.equal(definition.stats.hp, 0);
  assert.deepEqual(hero.actions, { normal: 0, extra: 0 });
  hero.actions = { normal: hero.actionDefinition.normalActionsPerTurn, extra: 0 };
  assert.deepEqual(hero.actions, { normal: 1, extra: 0 });
  const boss = createCombatCharacter({ ...definition, faction: 'enemy', actionDefinition: { normalActionsPerTurn: 3 } });
  assert.deepEqual({ normal: boss.actionDefinition.normalActionsPerTurn, extra: 0 }, { normal: 3, extra: 0 });
});
