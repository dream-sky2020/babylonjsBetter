import { useCombatStore } from '../store.ts';
import type { UnitConfig } from '../types.ts';

export function addCombatUnit(side: 'left' | 'right') {
  const state = useCombatStore.getState();
  const units = side === 'left' ? state.leftUnits : state.rightUnits;
  const id = `${side}-${crypto.randomUUID()}`;
  const skillId = `${id}-skill`;
  const prefix = `${side === 'left' ? '左侧' : '右侧'}单位`;
  let number = units.length + 1;
  while (units.some(unit => unit.name === `${prefix} ${number}`)) number++;
  const unit: UnitConfig = { id, name: `${prefix} ${number}`, hp: 100, maxHp: 100, shield: 0, tempShield: 0, sanity: 45, maxSanity: 45, chaos: 0, chaosThreshold: 100, speed: 10, baseSpeed: 10, speedModifier: 0, status: [], activeSkillId: skillId, skills: [{ skillId, skillName: '测试技能', tags: ['active'], dice: [{ min: 4, max: 8, tags: ['slash'], effects: [] }], skillEffects: [] }] };
  state.addUnit(side, unit);
  return id;
}
