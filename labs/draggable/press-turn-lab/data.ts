import { ELEMENTS, type Unit, type Skill, type Battle } from './types.ts';
export function createSkill(id: string = crypto.randomUUID()): Skill {
  return { id, name: '火炎术', element: 'fire', power: 35, mpCost: 4, accuracy: 100, critical: 0, kind: 'attack', target: 'single' };
}
export function basicAttack(unit: Unit): Skill {
  const configured = unit.skills.find(skill => skill.id === `${unit.id}-attack`);
  return { power: 24, accuracy: 100, critical: 10, ...configured, id: `${unit.id}-attack`, name: '普通攻击', element: 'physical', mpCost: 0, kind: 'attack', target: 'single' };
}
export function createUnit(id: string, name: string): Unit {
  const skill = createSkill(`${id}-fire`);
  return { id, name, hp: 220, maxHp: 220, mp: 40, maxMp: 40, attack: 20, defense: 12, guarding: false,
    affinities: Object.fromEntries(Object.keys(ELEMENTS).map(key => [key, 'normal'])) as Unit['affinities'],
    skills: [{ ...skill, id: `${id}-attack`, name: '普通攻击', element: 'physical', power: 24, mpCost: 0, critical: 10 }, skill,
      { ...skill, id: `${id}-might`, name: '力量心得', kind: 'passive', mpCost: 0, passive: { attack: 4, defense: 0 } },
      { ...skill, id: `${id}-ward`, name: '坚守心得', kind: 'passive', mpCost: 0, passive: { attack: 0, defense: 4 } }],
    disabledSkillIds: [`${id}-might`, `${id}-ward`], skillId: skill.id };
}
export function createBattle(): Battle {
  const left = [createUnit('L1', '先锋'), createUnit('L2', '术士'), createUnit('L3', '医师')];
  const right = [createUnit('R1', '冰霜守卫'), createUnit('R2', '反射魔偶'), createUnit('R3', '吸收兽')];
  right[0].affinities.fire = 'weak'; right[0].affinities.ice = 'null';
  right[1].affinities.physical = 'resist'; right[1].affinities.electric = 'repel';
  right[2].affinities.dark = 'drain'; right[2].affinities.light = 'weak';
  left[1].affinities.ice = 'weak';
  left[2].skills.push({ ...createSkill('L3-heal'), name: '治疗术', kind: 'heal', power: 65, mpCost: 6 });
  return { teams: { left, right }, side: 'left', actorId: 'L1', icons: { full: left.length, half: 0 }, round: 1, phase: 1,
    logs: ['[初始化] 我方行动阶段：3 大点 / 0 半点。先锋的火炎术可命中冰霜守卫弱点。'] };
}
