import { applyEffects, effectsFor, type UseContext, type EffectTargetState, type EffectSets } from './usage.ts';
import type { SkillItemDefinition } from './types.ts';
import type { EquipmentSkill, ItemUnit, EquipmentDefinition } from './types.ts';

export function itemSkills(item: ItemUnit, definition: EquipmentDefinition): EquipmentSkill[] {
  if (item.definitionId !== definition.id) throw new Error('物品定义不匹配。');
  const skills = [...definition.skills, ...(item.kind === 'unique' ? item.enchantments.flatMap(enchantment => enchantment.skills ?? []) : [])];
  return skills.map(skill => ({ ...skill, level: item.kind === 'unique' ? item.skillLevels?.[skill.skillId] ?? skill.level : skill.level }));
}
export function effectiveSkillLevels(learned: Readonly<Record<string, number>>, equipped: readonly EquipmentSkill[]): Record<string, number> {
  const result = { ...learned };
  for (const skill of equipped.filter(skill => skill.mode === 'grant')) result[skill.skillId] = Math.max(result[skill.skillId] ?? 0, skill.level);
  for (const skill of equipped.filter(skill => skill.mode === 'levelBonus')) result[skill.skillId] = (result[skill.skillId] ?? 0) + skill.level;
  return result;
}

export function skillKind(skill: SkillItemDefinition): string {
  const active = !!(skill.active?.battle || skill.active?.field);
  return skill.modifiers.length ? active ? '主动＋被动' : '被动' : active ? '主动' : '无效果';
}
/** Resolves an enabled skill without touching inventory. All inputs remain unchanged. */
export function resolveSkillUse(skill: SkillItemDefinition, context: UseContext, caster: EffectTargetState, targets: readonly EffectTargetState[], enabled: boolean, sets: EffectSets = {}, random: () => number = Math.random) {
  if (!enabled) throw new Error('技能尚未装备或启用。');
  const action = skill.active?.[context];
  if (!action) throw new Error('此技能不能在当前场景发动。');
  if (!targets.length || new Set(targets.map(target => target.id)).size !== targets.length) throw new Error('技能目标无效。');
  if (['self', 'oneAlly', 'oneEnemy'].includes(action.target) && targets.length !== 1) throw new Error('此技能需要单个目标。');
  if (action.target === 'self' && targets[0].id !== caster.id) throw new Error('此技能只能对自己发动。');
  const paid = structuredClone(caster);
  for (const resource of ['mp', 'sp'] as const) {
    const cost = action.cost[resource] ?? 0;
    if (!Number.isFinite(cost) || cost < 0) throw new Error('技能消耗无效。');
    if (!Number.isFinite(paid[resource]) || paid[resource] < cost) throw new Error(`${resource.toUpperCase()} 不足。`);
    paid[resource] -= cost;
  }
  const turnCost = context === 'battle' ? action.turnCost ?? 1 : 0;
  if (turnCost !== 0 && turnCost !== 1) throw new Error('行动消耗无效。');
  const result = applyEffects(targets.map(target => target.id === caster.id ? paid : target), effectsFor(action, sets), random);
  return { ...result, caster: result.targets.find(target => target.id === caster.id) ?? paid, turnCost };
}
