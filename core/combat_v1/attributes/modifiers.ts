import type { AttributeId, CharacterStats } from './attributes.ts';

export type ModifierStage = 'base' | 'flat' | 'first' | 'second' | 'independent';
export type AttributeModifier = { attribute: AttributeId; stage: ModifierStage; value: number; sourceId?: string };
export type GrowthRule = (attribute: AttributeId, adjustedBase: number) => number;

/** Percent stages store fractions: 0.2 means +20%. Independent entries multiply separately. */
export function resolveAttributes(base: CharacterStats, modifiers: readonly AttributeModifier[], growth?: GrowthRule): CharacterStats {
  const grouped = new Map<AttributeId, AttributeModifier[]>();
  for (const modifier of modifiers) {
    if (!Object.hasOwn(base, modifier.attribute)) throw new Error(`未知属性：${modifier.attribute}。`);
    if (!['base', 'flat', 'first', 'second', 'independent'].includes(modifier.stage)) throw new Error(`未知修正阶段：${modifier.stage}。`);
    if (!Number.isFinite(modifier.value)) throw new Error(`属性修正 ${modifier.attribute} 必须是有限数字。`);
    if (['first', 'second', 'independent'].includes(modifier.stage) && modifier.value < -1) throw new Error('乘区修正不能低于 -100%。');
    const entries = grouped.get(modifier.attribute) ?? [];
    entries.push(modifier); grouped.set(modifier.attribute, entries);
  }
  const result = { ...base };
  for (const [attribute, entries] of grouped) {
    const sum = (stage: ModifierStage) => entries.filter(entry => entry.stage === stage).reduce((total, entry) => total + entry.value, 0);
    const adjustedBase = base[attribute] + sum('base');
    const grown = growth ? growth(attribute, adjustedBase) : adjustedBase;
    if (!Number.isFinite(grown)) throw new Error(`属性成长结果 ${attribute} 必须是有限数字。`);
    const independent = entries.filter(entry => entry.stage === 'independent').reduce((factor, entry) => factor * (1 + entry.value), 1);
    result[attribute] = (grown + sum('flat')) * (1 + sum('first')) * (1 + sum('second')) * independent;
  }
  return result;
}
