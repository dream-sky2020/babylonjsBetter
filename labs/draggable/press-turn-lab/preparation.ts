import type { Unit } from './types.ts';
export const WEAPONS = { standard: { name: '制式武器', attack: 0 }, heavy: { name: '重刃', attack: 8 }, light: { name: '轻刃', attack: 3 } } as const;
export const ARMORS = { standard: { name: '常服', defense: 0 }, leather: { name: '皮甲', defense: 4 }, plate: { name: '重甲', defense: 8 } } as const;
export const SKILL_SLOT_LIMIT = 8;
export type Preparation = { weaponId: keyof typeof WEAPONS; armorId: keyof typeof ARMORS; disabledSkillIds: string[]; skillSlots?: (string | null)[] };
export function availableSkills(unit: Unit) { return unit.skills.filter(skill => skill.id !== `${unit.id}-attack`); }
export function currentPreparation(unit: Unit): Preparation {
  const skills = availableSkills(unit);
  const equipped = unit.skillSlots ?? skills.filter(skill => !unit.disabledSkillIds?.includes(skill.id)).slice(0, SKILL_SLOT_LIMIT).map(skill => skill.id);
  const seen = new Set<string>();
  const skillSlots = Array.from({ length: SKILL_SLOT_LIMIT }, (_, index) => { const id = equipped[index]; if (!id || seen.has(id) || !skills.some(skill => skill.id === id)) return null; seen.add(id); return id; });
  return { weaponId: unit.equipment?.weaponId ?? 'standard', armorId: unit.equipment?.armorId ?? 'standard', skillSlots, disabledSkillIds: skills.filter(skill => !skillSlots.includes(skill.id)).map(skill => skill.id) };
}
export function equippedSkills(unit: Unit) {
  const slots = currentPreparation(unit).skillSlots!;
  return slots.flatMap(id => { const skill = unit.skills.find(skill => skill.id === id); return skill ? [skill] : []; });
}
export function combatStats(unit: Unit) {
  return equippedSkills(unit).filter(skill => skill.kind === 'passive').reduce((stats, skill) => ({ attack: stats.attack + (skill.passive?.attack ?? 0), defense: stats.defense + (skill.passive?.defense ?? 0) }), { attack: unit.attack, defense: unit.defense });
}
export function draftWithSlots(unit: Unit, draft: Preparation, slots: (string | null)[]): Preparation {
  return { ...draft, skillSlots: slots, disabledSkillIds: availableSkills(unit).filter(skill => !slots.includes(skill.id)).map(skill => skill.id) };
}
export function applyPreparation(unit: Unit, draft: Preparation): boolean {
  if (!draft || !Object.hasOwn(WEAPONS, draft.weaponId) || !Object.hasOwn(ARMORS, draft.armorId) || !Array.isArray(draft.disabledSkillIds) || new Set(draft.disabledSkillIds).size !== draft.disabledSkillIds.length || draft.disabledSkillIds.some(id => id === `${unit.id}-attack` || !unit.skills.some(skill => skill.id === id))) return false;
  if (draft.skillSlots !== undefined && !Array.isArray(draft.skillSlots)) return false;
  const ids = availableSkills(unit).filter(skill => !draft.disabledSkillIds.includes(skill.id)).map(skill => skill.id);
  const slots = draft.skillSlots ?? [...ids, ...Array(Math.max(0, SKILL_SLOT_LIMIT - ids.length)).fill(null)];
  const occupied = slots.filter(id => id !== null);
  if (slots.length !== SKILL_SLOT_LIMIT || slots.some(id => id !== null && (typeof id !== 'string' || !ids.includes(id))) || occupied.length !== ids.length || new Set(occupied).size !== occupied.length || ids.length > SKILL_SLOT_LIMIT) return false;
  const previous = currentPreparation(unit);
  unit.attack = Math.max(0, unit.attack - WEAPONS[previous.weaponId].attack + WEAPONS[draft.weaponId].attack);
  unit.defense = Math.max(0, unit.defense - ARMORS[previous.armorId].defense + ARMORS[draft.armorId].defense);
  unit.equipment = { weaponId: draft.weaponId, armorId: draft.armorId };
  unit.disabledSkillIds = [...draft.disabledSkillIds];
  unit.skillSlots = [...slots];
  return true;
}
