import {
  attributes, createCombatCharacter, createBattleState, startBattle, endBattlePhase,
  getPhaseActors, checkBattleResult, appendBattleRecords, resolveSkillUse,
  createUsageLimits, advanceUsageCooldown,
  type BattleState, type CombatCharacter, type SkillItemDefinition, type EffectTargetState, type CombatRecord,
} from '../../../core/combat_v1/index.ts';

/** 本页的样例技能；数值和自动决策不属于 Core 规则。 */
export const skills: Record<string, SkillItemDefinition> = {
  attack: { id: 'attack', name: '普通攻击', description: '造成 24 点伤害。', kind: 'skill', modifiers: [], active: { battle: { target: 'oneEnemy', usageLimits: { cost: {} }, effects: [{ type: 'damage', amount: { kind: 'fixed', value: 24 } }] } } },
  burst: { id: 'burst', name: '火焰冲击', description: '42 点伤害 · 4 MP · 冷却 2 · 每场 3 次', kind: 'skill', modifiers: [], active: { battle: { target: 'oneEnemy', usageLimits: { cost: { mp: 4 }, cooldown: { turns: 2, remaining: 0 }, uses: { limit: 3, remaining: 3 } }, effects: [{ type: 'damage', amount: { kind: 'fixed', value: 42 } }] } } },
  heal: { id: 'heal', name: '治疗', description: '恢复 30 HP · 3 MP · 每场 4 次', kind: 'skill', modifiers: [], active: { battle: { target: 'oneAlly', usageLimits: { cost: { mp: 3 }, uses: { limit: 4, remaining: 4 } }, effects: [{ type: 'restore', resource: 'hp', amount: { kind: 'fixed', value: 30 } }] } } },
  rally: { id: 'rally', name: '振奋', description: '不消耗行动，获得 1 次额外行动 · 每场 1 次', kind: 'skill', modifiers: [], active: { battle: { target: 'self', usageLimits: { cost: {}, actionCost: 0, uses: { limit: 1, remaining: 1 } }, effects: [{ type: 'triggerEvent', eventId: 'extra-action' }] } } },
};

export function sampleBattle(): BattleState {
  const make = (id: string, name: string, faction: CombatCharacter['faction'], hp: number, normal = 1) => createCombatCharacter({
    id, name, faction,
    stats: { ...Object.fromEntries(attributes.map(a => [a.id, 0])), hp, maxHp: hp, mp: 14, maxMp: 14, sp: 0, maxSp: 0 } as CombatCharacter['stats'],
    actionDefinition: { normalActionsPerTurn: normal },
    skills: Object.values(skills).map(skill => ({ skillId: skill.id, level: 1, enabled: true, usageLimits: { battle: createUsageLimits(skill.active!.battle!.usageLimits) } })),
  });
  return startBattle(createBattleState('combat-v1-demo', [
    make('knight', '艾琳 · 骑士', 'ally', 120), make('mage', '米洛 · 法师', 'ally', 85),
    make('boss', '铁甲守卫 · BOSS', 'enemy', 160, 2), make('slime', '蓝色史莱姆', 'enemy', 55),
    make('traveler', '旅人 · 中立', 'neutral', 70),
  ]));
}

/** 将角色当前属性适配到现有技能效果接口，避免引入第二套生命状态。 */
function targetState(actor: CombatCharacter): EffectTargetState {
  return { id: actor.id, hp: actor.stats.hp, maxHp: actor.stats.maxHp, mp: actor.stats.mp, maxMp: actor.stats.maxMp, sp: actor.stats.sp, maxSp: actor.stats.maxSp, statuses: structuredClone(actor.statuses) };
}

export function useDemoSkill(state: BattleState, actorId: string, targetId: string, skillId: string): BattleState {
  const actor = getPhaseActors(state).find(value => value.id === actorId);
  const target = state.characters.find(value => value.id === targetId);
  const skill = skills[skillId];
  if (!actor || !target || target.stats.hp <= 0 || !skill) throw new Error('行动者、目标或技能无效。');
  const healing = skillId === 'heal';
  if (skillId === 'rally' ? targetId !== actorId : healing ? target.faction !== actor.faction : target.faction === actor.faction || target.faction === 'neutral') throw new Error('请选择有效目标。');
  const owned = actor.skills.find(value => value.skillId === skillId);
  if (!owned?.usageLimits.battle) throw new Error('角色未持有该技能。');
  const result = resolveSkillUse(skill, 'battle', targetState(actor), [targetState(target)], owned.enabled, {}, () => 0.5, owned.usageLimits.battle);
  const next = structuredClone(state);
  const caster = next.characters.find(value => value.id === actorId)!;
  for (const value of [result.caster, ...result.targets]) {
    const unit = next.characters.find(character => character.id === value.id)!;
    Object.assign(unit.stats, { hp: value.hp, mp: value.mp, sp: value.sp });
    unit.statuses = value.statuses;
  }
  caster.skills.find(value => value.skillId === skillId)!.usageLimits.battle = result.usageLimits;
  if (result.turnCost) {
    // 本 Lab 优先消耗正常行动，耗尽后消耗额外行动。
    if (caster.actions.normal > 0) caster.actions.normal -= 1;
    else caster.actions.extra -= 1;
  }
  if (result.events.includes('extra-action')) caster.actions.extra += 1;
  const source = { actorId, creditCharacterId: actorId, ...(actor.faction === 'ally' ? { userId: actorId } : {}), kind: 'skill' as const, definitionId: skillId, actionId: `action-${state.records.length + 1}-${actorId}` };
  const base = { id: `record-${state.records.length + 1}`, battleId: state.id, source, targetId, round: state.round, phase: state.phase };
  let record: CombatRecord | undefined;
  if (skillId === 'attack' || skillId === 'burst') {
    const damage = skillId === 'attack' ? 24 : 42;
    const hpDamage = target.stats.hp - result.targets[0].hp;
    record = { ...base, type: 'damage', requestedDamage: damage, resolvedDamage: damage, hpDamage, shieldDamage: 0, overkill: damage - hpDamage, critical: false };
  } else if (healing) {
    const hpRestored = result.targets[0].hp - target.stats.hp;
    record = { ...base, type: 'healing', resolvedHealing: 30, hpRestored, overheal: 30 - hpRestored };
  }
  return checkBattleResult(record ? appendBattleRecords(next, [record]) : next);
}

/** 本 Lab 约定：进入角色所属阶段时减一次冷却；额外行动不减冷却。 */
export function nextDemoPhase(state: BattleState, endEarly = false): BattleState {
  const next = endBattlePhase(state, { endEarly });
  if (next.status === 'active') {
    for (const actor of next.characters.filter(value => (value.faction === 'ally') === (next.phase === 'ally'))) {
      for (const skill of actor.skills) if (skill.usageLimits.battle) skill.usageLimits.battle = advanceUsageCooldown(skill.usageLimits.battle);
    }
  }
  return next;
}

/** 非我方单步：敌人攻击生命最低的我方；中立旅人治疗自己，不代表与敌人结盟。 */
export function stepNonAlly(state: BattleState): BattleState {
  if (state.phase !== 'nonAlly' || state.status !== 'active') throw new Error('当前不是非我方阶段。');
  const actor = getPhaseActors(state)[0];
  if (!actor) return nextDemoPhase(state);
  const target = actor.faction === 'neutral' ? actor : state.characters.filter(value => value.faction === 'ally' && value.stats.hp > 0).sort((a, b) => a.stats.hp - b.stats.hp)[0];
  if (!target) return checkBattleResult(state);
  // 旅人资源不足时显式放弃行动，避免自动流程卡住。
  if (actor.faction === 'neutral' && (actor.stats.mp < 3 || !actor.skills.find(value => value.skillId === 'heal')?.usageLimits.battle?.uses?.remaining)) {
    const next = structuredClone(state);
    next.characters.find(value => value.id === actor.id)!.actions = { normal: 0, extra: 0 };
    return next;
  }
  return useDemoSkill(state, actor.id, target.id, actor.faction === 'neutral' ? 'heal' : 'attack');
}
