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
