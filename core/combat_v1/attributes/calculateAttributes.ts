import type { AttributeId, CharacterStats } from './attributes.ts';

export type AttributeBonus = Partial<Record<AttributeId, number>>;

/** Add static bonuses such as equipment and passive skills without changing the base values. */
export function calculateAttributes(base: CharacterStats, bonuses: readonly AttributeBonus[]): CharacterStats {
  const result = { ...base };
  for (const bonus of bonuses) {
    for (const [id, amount] of Object.entries(bonus) as [AttributeId, number][]) {
      if (!(id in result)) throw new Error(`未知属性：${id}。`);
      if (!Number.isFinite(amount)) throw new Error(`属性加成 ${id} 必须是有限数字。`);
      result[id] += amount;
    }
  }
  return result;
}
