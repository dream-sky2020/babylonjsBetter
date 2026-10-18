import { attributes, type AttributeUnit, type CharacterStats } from '../../../core/combat/attributes.ts';

export function startingAttributes(index: number): CharacterStats {
  const values = Object.fromEntries(attributes.map(attribute => [attribute.id, 0])) as CharacterStats;
  Object.assign(values, { level: 12, maxLevel: 99, experience: 180, experienceMultiplier: 1, experienceToLevel: 250, levelUpPoints: 0, hp: 88, maxHp: 88, mp: 40, maxMp: 40, sp: 20, maxSp: 20, recoverableHp: 88, attack: 20 - index * 4, defense: 12, magic: 10 + index * 6, magicDefense: 12, speed: 15 + index * 2, luck: 10, accuracy: 95, evasion: 5, critChance: 5, critDamage: 50 });
  return values;
}

const attributeNumber = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });
export function formatAttribute(value: number, unit: AttributeUnit): string { return `${attributeNumber.format(value)}${unit === '点' ? '' : unit}`; }
