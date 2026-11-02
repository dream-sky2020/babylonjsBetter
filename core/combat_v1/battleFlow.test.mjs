import test from 'node:test';
import assert from 'node:assert/strict';
import { attributes, createCombatCharacter, createBattleState, startBattle, getPhaseActors, endBattlePhase, checkBattleResult, finishBattle, appendBattleRecords } from './index.ts';

const character = (id, faction, actions = 1, hp = 100) => createCombatCharacter({
  id, name: id, faction, stats: { ...Object.fromEntries(attributes.map(a => [a.id, 0])), hp, maxHp: 100 },
  actionDefinition: { normalActionsPerTurn: actions },
});
const setup = () => createBattleState('battle-1', [character('hero', 'ally'), character('boss', 'enemy', 3), character('neutral', 'neutral'), character('dead', 'enemy', 1, 0)]);

test('从我方开始，行动耗尽后非我方包含敌人与中立，完整循环后轮数递增', () => {
  const ready = setup(), ally = startBattle(ready);
  assert.equal(ready.status, 'ready');
  assert.deepEqual(ready.characters[0].actions, { normal: 0, extra: 0 });
  assert.deepEqual(getPhaseActors(ally).map(actor => actor.id), ['hero']);
  assert.throws(() => startBattle(ally), /重复/);
  assert.throws(() => endBattlePhase(ally), /还有角色/);
  ally.characters[0].actions = { normal: 0, extra: 0 };
  const enemy = endBattlePhase(ally);
  assert.equal(enemy.phase, 'nonAlly');
  assert.equal(enemy.round, 1);
  assert.deepEqual(getPhaseActors(enemy).map(actor => actor.id), ['boss', 'neutral']);
  assert.equal(enemy.characters[1].actions.normal, 3);
  assert.equal(enemy.characters[3].actions.normal, 0);
  for (const actor of enemy.characters) actor.actions = { normal: 0, extra: 0 };
  const next = endBattlePhase(enemy);
  assert.equal(next.phase, 'ally');
  assert.equal(next.round, 2);
  assert.equal(next.characters[0].actions.normal, 1);
});

test('额外行动阻止自然结束，显式提前结束会清空旧阶段余额', () => {
  const state = startBattle(setup());
  state.characters[0].actions = { normal: 0, extra: 1 };
  assert.throws(() => endBattlePhase(state), /还有角色/);
  const next = endBattlePhase(state, { endEarly: true });
  assert.deepEqual(next.characters[0].actions, { normal: 0, extra: 0 });
  assert.equal(state.characters[0].actions.extra, 1);
});

test('默认胜负忽略中立，行动后可立即结束，结束后不能继续推进', () => {
  const state = startBattle(setup());
  state.characters[1].stats.hp = 0;
  const won = checkBattleResult(state);
  assert.deepEqual(won.result, { outcome: 'victory' });
  assert.equal(won.status, 'finished');
  assert.deepEqual(getPhaseActors(won), []);
  assert.ok(won.characters.every(actor => actor.actions.normal === 0 && actor.actions.extra === 0));
  assert.throws(() => endBattlePhase(won));
  assert.equal(state.status, 'active');
  assert.equal(startBattle(createBattleState('draw', [])).result.outcome, 'draw');
  assert.equal(startBattle(createBattleState('lost', [character('enemy', 'enemy')])).result.outcome, 'defeat');
});

test('用户可替换行动与胜负规则，显式逃离，不擅自推进状态或冷却', () => {
  const ready = setup();
  ready.characters[0].statuses = { stun: 2 };
  ready.characters[0].skills = [{ skillId: 'fire', level: 1, enabled: true, usageLimits: { battle: { cost: {}, cooldown: { turns: 3, remaining: 2 } } } }];
  const rules = { canAct: actor => actor.stats.hp > 0 && !actor.statuses.stun, evaluateResult: () => null };
  const active = startBattle(ready, rules);
  assert.deepEqual(getPhaseActors(active, rules), []);
  const next = endBattlePhase(active, {}, rules);
  assert.equal(next.characters[0].statuses.stun, 2);
  assert.equal(next.characters[0].skills[0].usageLimits.battle.cooldown.remaining, 2);
  assert.equal(finishBattle(next, { outcome: 'escaped', reason: '撤离' }).result.outcome, 'escaped');
  assert.equal(startBattle(createBattleState('empty', []), rules).status, 'active');
});

test('记录深拷贝保存，整批拒绝重复、错误战斗或阶段，不重复应用伤害', () => {
  const state = startBattle(setup());
  const record = { id: 'hit-1', battleId: state.id, round: 1, phase: 'ally', targetId: 'boss', type: 'damage', source: { actorId: 'hero', creditCharacterId: 'hero', kind: 'skill', definitionId: 'attack', actionId: 'action-1' }, requestedDamage: 10, resolvedDamage: 10, shieldDamage: 0, hpDamage: 10, overkill: 0, critical: false };
  const recorded = appendBattleRecords(state, [record]);
  record.source.definitionId = 'changed';
  assert.equal(recorded.records[0].source.definitionId, 'attack');
  assert.equal(recorded.characters[1].stats.hp, 100);
  assert.equal(state.records.length, 0);
  assert.throws(() => appendBattleRecords(recorded, [record]));
  assert.throws(() => appendBattleRecords(state, [record, record]));
  assert.throws(() => appendBattleRecords(state, [{ ...record, battleId: 'other' }]));
  assert.throws(() => appendBattleRecords(state, [{ ...record, phase: 'nonAlly' }]));
  assert.throws(() => appendBattleRecords(state, [{ ...record, targetId: 'missing' }]));
  const finished = finishBattle(recorded, { outcome: 'victory' });
  assert.equal(finished.records.length, 1);
  assert.throws(() => appendBattleRecords(finished, []));
});

test('拒绝空战斗 ID 和重复角色 ID，创建时不共享输入数据', () => {
  assert.throws(() => createBattleState('', []));
  const actor = character('hero', 'ally');
  assert.throws(() => createBattleState('battle', [actor, actor]));
  const state = createBattleState('battle', [actor]);
  state.characters[0].stats.hp = 5;
  assert.equal(actor.stats.hp, 100);
});
