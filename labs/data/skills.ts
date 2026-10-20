import type { SkillItemDefinition } from '../../core/items/types.ts';
export const skillDefinitions: SkillItemDefinition[] = [
  ...[['fire', '火焰', 5], ['ice', '冰结', 5], ['spark', '雷电', 5], ['slash', '二连斩', 6]].map(([id, name, mp]) => ({ id: String(id), name: String(name), description: '战斗中对一名敌人造成伤害。', kind: 'skill' as const, modifiers: [], active: { battle: { target: 'oneEnemy' as const, cost: { mp: Number(mp) }, effects: [{ type: 'damage' as const, amount: { kind: 'fixed' as const, value: 30 } }] } } })),
  { id: 'heal', name: '治愈心得', description: '装备时防御 +2；战斗内外可以主动治疗，效果与消耗不同。', kind: 'skill', modifiers: [{ attribute: 'defense', stage: 'flat', value: 2 }], active: {
    battle: { target: 'oneAlly', cost: { mp: 4 }, effects: [{ type: 'restore', resource: 'hp', amount: { kind: 'fixed', value: 50 } }] },
    field: { target: 'oneAlly', cost: { mp: 2 }, effects: [{ type: 'restore', resource: 'hp', amount: { kind: 'fixed', value: 80 } }] }
  } },
  ...[['power', '力量心得', 'attack'], ['guard', '坚守心得', 'defense'], ['wisdom', '魔力心得', 'magic'], ['haste', '敏捷心得', 'speed']].map(([id, name, attribute]) => ({ id, name, description: '装备时对应属性 +6。', kind: 'skill' as const, modifiers: [{ attribute: attribute as 'attack' | 'defense' | 'magic' | 'speed', stage: 'flat' as const, value: 6 }] })),
];
