import test from 'node:test';
import assert from 'node:assert/strict';
import { createUsageLimits, advanceUsageCooldown, restoreUsageCount, resolveSkillUse } from '../index.ts';

const template = { cost: { mp: 4 }, actionCost: 1, cooldown: { turns: 2, remaining: 0 }, uses: { limit: 2, remaining: 2 } };
const hero = { id: 'hero', hp: 10, maxHp: 100, mp: 20, maxMp: 20, sp: 0, maxSp: 0, statuses: {} };
const skill = { id: 'heal', kind: 'skill', name: '治疗', description: '', modifiers: [], active: { battle: { target: 'self', usageLimits: template, effects: [{ type: 'restore', resource: 'hp', amount: { kind: 'fixed', value: 5 } }] } } };
const use = (limits, caster = hero) => resolveSkillUse(skill, 'battle', caster, [caster], true, {}, Math.random, limits);

test('每个角色独立持有可变限制，修改消耗、冷却和次数不会污染模板或别人', () => {
  const a = createUsageLimits(template), b = createUsageLimits(template);
  a.cost.mp = 1; a.cooldown.turns = 3; a.uses.limit = 4; a.uses.remaining = 4;
  const result = use(a);
  assert.equal(result.caster.mp, 19);
  assert.deepEqual(result.usageLimits.cooldown, { turns: 3, remaining: 3 });
  assert.deepEqual(result.usageLimits.uses, { limit: 4, remaining: 3 });
  assert.deepEqual(b, template);
  assert.equal(a.cooldown.remaining, 0);
});

test('成功发动扣次数并进入冷却，显式推进冷却与恢复次数，无隐藏回合推进', () => {
  const first = use(createUsageLimits(template));
  assert.equal(first.usageLimits.uses.remaining, 1);
  assert.throws(() => use(first.usageLimits), /冷却/);
  const oneTurn = advanceUsageCooldown(first.usageLimits);
  assert.equal(oneTurn.cooldown.remaining, 1);
  assert.throws(() => use(oneTurn), /冷却/);
  const second = use(advanceUsageCooldown(oneTurn));
  assert.equal(second.usageLimits.uses.remaining, 0);
  const ready = advanceUsageCooldown(second.usageLimits, 10);
  assert.throws(() => use(ready), /次数不足/);
  assert.equal(use(restoreUsageCount(ready)).usageLimits.uses.remaining, 1);
  assert.equal(first.usageLimits.cooldown.remaining, 2);
});

test('资源不足、缺少效果组和非法限制都不提交次数或冷却', () => {
  const limits = createUsageLimits(template);
  assert.throws(() => use(limits, { ...hero, mp: 0 }), /不足/);
  const broken = { ...skill, active: { battle: { target: 'self', usageLimits: template, effectSetId: 'missing' } } };
  assert.throws(() => resolveSkillUse(broken, 'battle', hero, [hero], true, {}, Math.random, limits));
  assert.deepEqual(limits, template);
  for (const value of [-1, 0.5, Infinity, NaN]) {
    assert.throws(() => createUsageLimits({ cost: {}, cooldown: { turns: value, remaining: 0 } }));
  }
  assert.throws(() => createUsageLimits({ cost: { mp: -1 } }));
  assert.throws(() => createUsageLimits({ cost: {}, uses: { limit: 1, remaining: 2 } }));
  assert.throws(() => advanceUsageCooldown(limits, -1));
});

test('省略冷却与次数代表无此限制，仍可动态调整行动消耗', () => {
  const limits = { cost: {}, actionCost: 0 };
  assert.equal(use(limits).turnCost, 0);
  assert.deepEqual(use(limits).usageLimits, limits);
});
