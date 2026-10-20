import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSkillUse, skillKind } from './skills.ts';
import { skillDefinitions } from '../../labs/data/skills.ts';
const heal = skillDefinitions.find(skill => skill.id === 'heal');
const hero = { id: 'hero', hp: 10, maxHp: 100, mp: 10, maxMp: 20, sp: 5, maxSp: 10, statuses: {} };
test('混合技能保留被动，场景分别扣费治疗，输入不变', () => {
  assert.equal(skillKind(heal), '主动＋被动');
  const battle = resolveSkillUse(heal, 'battle', hero, [hero], true);
  assert.equal(battle.caster.hp, 60); assert.equal(battle.caster.mp, 6); assert.equal(battle.turnCost, 1);
  const field = resolveSkillUse(heal, 'field', hero, [hero], true);
  assert.equal(field.caster.hp, 90); assert.equal(field.caster.mp, 8); assert.equal(field.turnCost, 0);
  assert.equal(hero.hp, 10); assert.equal(hero.mp, 10);
});
test('未启用、资源不足、纯被动及缺少场景拒绝发动', () => {
  assert.throws(() => resolveSkillUse(heal, 'battle', hero, [hero], false), /启用/);
  assert.throws(() => resolveSkillUse(heal, 'battle', { ...hero, mp: 1 }, [hero], true), /不足/);
  assert.throws(() => resolveSkillUse(skillDefinitions.find(s => s.id === 'power'), 'battle', hero, [hero], true), /场景/);
  assert.throws(() => resolveSkillUse(skillDefinitions.find(s => s.id === 'fire'), 'field', hero, [hero], true), /场景/);
});
test('敌方效果保留施法者扣费，支持 SP、自身目标与效果组', () => {
  const enemy = { ...hero, id: 'enemy' };
  const skill = { ...heal, active: { battle: { target: 'oneEnemy', cost: { sp: 3 }, effectSetId: 'hit', turnCost: 0 } } };
  const result = resolveSkillUse(skill, 'battle', hero, [enemy], true, { hit: [{ type: 'damage', amount: { kind: 'fixed', value: 5 } }] });
  assert.equal(result.caster.sp, 2); assert.equal(result.targets[0].hp, 5); assert.equal(result.turnCost, 0);
  assert.equal(enemy.hp, 10);
  assert.throws(() => resolveSkillUse({ ...skill, active: { battle: { ...skill.active.battle, target: 'self' } } }, 'battle', hero, [enemy], true), /自己/);
});
