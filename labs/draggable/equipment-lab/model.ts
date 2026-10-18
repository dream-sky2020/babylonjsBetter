import { resolveAttributes, type AttributeModifier, type CharacterStats } from '../../../core/combat/index.ts';
import { canStack, enchantItem, itemSkills, makeItem, putItem, takeItem, useItem, effectiveSkillLevels, type Enchantment, type EquipmentDefinition, type EquipmentSkill, type ItemUnit, type SkillItemDefinition, type UniqueItem, type WearRule } from '../../../core/items/index.ts';
import { startingAttributes } from './sampleAttributes.ts';

export type Kind = 'weapon' | 'shield' | 'head' | 'body' | 'accessory' | 'skill';
export type Item = EquipmentDefinition | SkillItemDefinition;
export const labels: Record<Kind, string> = { weapon: '武器', shield: '盾牌', head: '头部', body: '身体', accessory: '饰品', skill: '技能' };
const equipmentSkillNames: Record<string, string> = { screwdriver: '螺丝刀', 'long-handle': '长柄武器' };
export const equipmentSkillName = (skillId: string): string => equipmentSkillNames[skillId] ?? skillId;
export const equipmentSkillDescription = (skill: EquipmentSkill): string => skill.mode === 'grant'
  ? `装备后获得「${equipmentSkillName(skill.skillId)}」${skill.level}级`
  : `装备后「${equipmentSkillName(skill.skillId)}」技能等级 +${skill.level}`;
export const itemKind = (item: Item): Kind => item.kind === 'skill' ? 'skill' : item.slot as Kind;
const flat = (attack: number, defense: number, magic: number, speed: number): AttributeModifier[] => Object.entries({ attack, defense, magic, speed }).filter(([, value]) => value !== 0).map(([attribute, value]) => ({ attribute: attribute as AttributeModifier['attribute'], stage: 'flat', value }));
const item = (id: string, name: string, kind: Kind, description: string, attack = 0, defense = 0, magic = 0, speed = 0, extra: { mpCost?: number; passive?: boolean; skills?: EquipmentSkill[]; wear?: WearRule; modifiers?: AttributeModifier[] } = {}): Item => {
  const modifiers = [...flat(attack, defense, magic, speed), ...(extra.modifiers ?? [])];
  if (kind === 'skill') return { id, name, description, kind, modifiers, mpCost: extra.mpCost, passive: extra.passive };
  return { id, name, description, kind: 'equipment', slot: kind, modifiers, skills: extra.skills ?? [], wear: extra.wear ?? { kind: 'chanceOnly', breakChance: 0.05 } };
};
export const items: Item[] = [
  item('sword', '铁剑', 'weapon', '沉稳可靠的单手剑。', 12), item('blade', '骑士长剑', 'weapon', '精工锻造，适合近身作战。', 22, 0, 0, -2), item('staff', '贤者手杖', 'weapon', '蕴藏魔力的古老手杖。', 4, 0, 20),
  item('shield', '圆盾', 'shield', '轻便的木制圆盾。', 0, 8), item('helm', '铁盔', 'head', '保护头部的铁制头盔。', 0, 6), item('hat', '魔法帽', 'head', '绣有星纹的帽子。', 0, 3, 8),
  item('armor', '锁子甲', 'body', '以铁环编织的护甲。', 0, 15, 0, -2), item('robe', '旅法师长袍', 'body', '为魔法旅行者缝制的长袍。', 0, 7, 10), item('boots', '疾风之靴', 'accessory', '脚步轻快如风。', 0, 0, 0, 10),
  item('screwdriver', '工匠螺丝刀', 'weapon', '自带螺丝刀与长柄技能的普通工具。', 8, 0, 0, 2, { skills: [{ skillId: 'screwdriver', level: 2, mode: 'grant' }, { skillId: 'long-handle', level: 3, mode: 'levelBonus' }] }),
  item('seal', '锻造徽章', 'accessory', '展示基础值变更、固定加值、两层加乘和独立乘区。', 0, 0, 0, 0, { modifiers: [{ attribute: 'attack', stage: 'base', value: 2 }, { attribute: 'attack', stage: 'flat', value: 1 }, { attribute: 'attack', stage: 'first', value: 0.1 }, { attribute: 'attack', stage: 'second', value: 0.05 }, { attribute: 'attack', stage: 'independent', value: 0.2 }] }),
  item('relic', '传承之刃', 'weapon', '使用后可能损耗耐久的独立装备。', 18, 0, 5, 0, { wear: { kind: 'durability', breakChance: 0.25, maxDurability: 5, durabilityLoss: 1 } }),
  item('fire', '火焰', 'skill', '主动技能 · 对单个敌人造成火属性伤害。', 0, 0, 0, 0, { mpCost: 5 }), item('heal', '治愈', 'skill', '主动技能 · 恢复一名队友的生命。', 0, 0, 0, 0, { mpCost: 4 }),
  item('ice', '冰结', 'skill', '主动技能 · 对单个敌人造成冰属性伤害。', 0, 0, 0, 0, { mpCost: 5 }), item('slash', '二连斩', 'skill', '主动技能 · 连续进行两次斩击。', 0, 0, 0, 0, { mpCost: 6 }),
  item('power', '力量心得', 'skill', '被动技能 · 装备时攻击力 +6。', 6, 0, 0, 0, { passive: true }), item('guard', '坚守心得', 'skill', '被动技能 · 装备时防御力 +6。', 0, 6, 0, 0, { passive: true }),
  item('wisdom', '魔力心得', 'skill', '被动技能 · 装备时魔力 +6。', 0, 0, 6, 0, { passive: true }), item('haste', '敏捷心得', 'skill', '被动技能 · 装备时敏捷 +6。', 0, 0, 0, 6, { passive: true }), item('spark', '雷电', 'skill', '主动技能 · 对单个敌人造成雷属性伤害。', 0, 0, 0, 0, { mpCost: 5 }),
];
export const catalog = Object.fromEntries(items.map(value => [value.id, value])) as Record<string, Item>;
export const slots: { id: string; kind: Kind; label: string }[] = [
  ...(['weapon', 'shield', 'head', 'body', 'accessory'] as Kind[]).map(kind => ({ id: kind, kind, label: labels[kind] })),
  ...Array.from({ length: 8 }, (_, i) => ({ id: `skill${i + 1}`, kind: 'skill' as const, label: `技能 ${i + 1}` })),
];
export type Actor = { id: string; name: string; job: string; base: CharacterStats; gear: Record<string, ItemUnit | null>; skillStock: Record<string, number>; learnedSkills: Record<string, number> };
export type Game = { actors: Actor[]; stock: Record<string, number>; uniques: UniqueItem[] };
export const equippedId = (actor: Actor, slotId: string): string | null => actor.gear[slotId]?.definitionId ?? null;
export const equippedItem = (actor: Actor, slotId: string): Item | null => catalog[equippedId(actor, slotId) ?? ''] ?? null;
export function sample(): Game {
  const stock = Object.fromEntries(items.filter(value => value.kind === 'equipment' && value.wear.kind === 'chanceOnly').map(value => [value.id, 3]));
  const uniques = [makeItem(catalog.relic as EquipmentDefinition, 'sample-relic-1') as UniqueItem];
  const actors = ['艾里克', '露娜', '诺亚'].map((name, index): Actor => ({ id: `actor${index}`, name, job: ['剑士', '魔法师', '游侠'][index], base: startingAttributes(index), gear: Object.fromEntries(slots.map(slot => [slot.id, null])), skillStock: Object.fromEntries(items.filter(value => value.kind === 'skill').map(value => [value.id, 3])), learnedSkills: {} }));
  actors.forEach((actor, index) => { for (const [slot, id] of Object.entries({ weapon: index === 1 ? 'staff' : 'sword', head: 'helm', body: 'armor', skill1: 'fire', skill2: 'power' })) { actor.gear[slot] = { kind: 'plain', definitionId: id }; (catalog[id].kind === 'skill' ? actor.skillStock : stock)[id]--; } });
  return { actors, stock, uniques };
}
export function modifiersFor(unit: ItemUnit): AttributeModifier[] {
  const definition = catalog[unit.definitionId];
  if (!definition) throw new Error('装备物品不存在。');
  return [...definition.modifiers, ...(unit.kind === 'unique' ? [...unit.enchantments.flatMap(enchantment => enchantment.modifiers), ...(unit.extraModifiers ?? [])] : [])];
}
export function stats(actor: Actor): CharacterStats { return resolveAttributes(actor.base, Object.values(actor.gear).filter((unit): unit is ItemUnit => unit !== null).flatMap(modifiersFor)); }
export function previewStats(actor: Actor, slotId: string, itemId: string | null, selectedUnit?: ItemUnit): CharacterStats {
  if (itemId && !catalog[itemId]) return stats(actor);
  const unit = itemId ? selectedUnit ?? { kind: 'plain' as const, definitionId: itemId } : null;
  return stats({ ...actor, gear: { ...actor.gear, [slotId]: unit } });
}
export function actorSkills(actor: Actor): Record<string, number> {
  return effectiveSkillLevels(actor.learnedSkills, Object.values(actor.gear).filter((unit): unit is ItemUnit => unit !== null).flatMap(unit => { const definition = catalog[unit.definitionId]; return definition?.kind === 'equipment' ? itemSkills(unit, definition) : []; }));
}
export function inventoryCount(game: Game, actorId: string, itemId: string): number {
  const actor = game.actors.find(value => value.id === actorId); const definition = catalog[itemId];
  if (!actor || !definition) throw new Error('角色或物品不存在。');
  return definition.kind === 'skill' ? actor.skillStock[itemId] ?? 0 : (game.stock[itemId] ?? 0) + game.uniques.filter(unit => unit.definitionId === itemId).length;
}
function returnUnit(game: Game, actor: Actor, unit: ItemUnit) {
  const definition = catalog[unit.definitionId];
  if (definition.kind === 'skill') actor.skillStock[definition.id] = (actor.skillStock[definition.id] ?? 0) + 1;
  else { const inventory = putItem({ stacks: game.stock, uniques: game.uniques }, unit, definition); game.stock = inventory.stacks; game.uniques = inventory.uniques; }
}
export function equip(game: Game, actorId: string, slotId: string, itemId: string | null, instanceId?: string): Game {
  const actor = game.actors.find(value => value.id === actorId); const slot = slots.find(value => value.id === slotId);
  if (!actor || !slot) throw new Error('角色或装备位置不存在。');
  const current = actor.gear[slotId];
  if (itemId && current?.definitionId === itemId && (!instanceId || current.kind === 'unique' && current.instanceId === instanceId)) return game;
  if (itemId && (!catalog[itemId] || itemKind(catalog[itemId]) !== slot.kind || inventoryCount(game, actorId, itemId) <= 0)) throw new Error('装备类型不匹配，或当前人物仓库数量不足。');
  if (itemId && slot.kind === 'skill' && Object.values(actor.gear).some(unit => unit?.definitionId === itemId)) throw new Error('同一角色不能重复装备同一个技能。');
  const next = structuredClone(game); const target = next.actors.find(value => value.id === actorId)!;
  let incoming: ItemUnit | null = null;
  if (itemId) {
    const definition = catalog[itemId];
    if (definition.kind === 'skill') { target.skillStock[itemId]--; incoming = { kind: 'plain', definitionId: itemId }; }
    else {
      const selector = instanceId ? { kind: 'unique' as const, instanceId } : (next.stock[itemId] ?? 0) > 0 ? { kind: 'stack' as const, definitionId: itemId } : { kind: 'unique' as const, instanceId: next.uniques.find(unit => unit.definitionId === itemId)?.instanceId ?? '' };
      const taken = takeItem({ stacks: next.stock, uniques: next.uniques }, selector);
      if (taken.item.definitionId !== itemId) throw new Error('独立物品与所选类型不匹配。');
      next.stock = taken.inventory.stacks; next.uniques = taken.inventory.uniques; incoming = taken.item;
    }
  }
  if (current) returnUnit(next, target, current);
  target.gear[slotId] = incoming;
  return next;
}
export function unequipAll(game: Game, actorId: string): Game { return slots.reduce((state, slot) => equip(state, actorId, slot.id, null), game); }
export function optimize(game: Game, actorId: string): Game {
  let next = unequipAll(game, actorId);
  for (const slot of slots) {
    const actor = next.actors.find(value => value.id === actorId)!;
    const candidates = items.filter(value => itemKind(value) === slot.kind && inventoryCount(next, actorId, value.id) > 0 && (slot.kind !== 'skill' || !Object.values(actor.gear).some(unit => unit?.definitionId === value.id)));
    candidates.sort((a, b) => b.modifiers.reduce((n, modifier) => n + modifier.value, 0) - a.modifiers.reduce((n, modifier) => n + modifier.value, 0));
    if (candidates[0]) next = equip(next, actorId, slot.id, candidates[0].id);
  }
  return next;
}
export function discard(game: Game, actorId: string, itemId: string, instanceId?: string): Game {
  if (!catalog[itemId] || inventoryCount(game, actorId, itemId) <= 0) throw new Error('只能丢弃当前仓库中的物品。');
  const next = structuredClone(game); const definition = catalog[itemId];
  if (definition.kind === 'skill') next.actors.find(value => value.id === actorId)!.skillStock[itemId]--;
  else if (instanceId) { const index = next.uniques.findIndex(unit => unit.definitionId === itemId && unit.instanceId === instanceId); if (index < 0) throw new Error('所选独立物品已不在仓库。'); next.uniques.splice(index, 1); }
  else if ((next.stock[itemId] ?? 0) > 0) next.stock[itemId]--;
  else throw new Error('此物品仅有独立实例，请选择带 ✦ 的条目。');
  return next;
}
export function enchantEquipped(game: Game, actorId: string, slotId: string, enchantment: Enchantment, instanceId: string): Game {
  const next = structuredClone(game); const actor = next.actors.find(value => value.id === actorId); const unit = actor?.gear[slotId];
  if (!actor || !unit) throw new Error('请先装备物品。');
  const definition = catalog[unit.definitionId]; if (definition.kind !== 'equipment') throw new Error('技能物品不能附魔。');
  if (next.uniques.some(value => value.instanceId === instanceId) || next.actors.some(value => Object.values(value.gear).some(equipped => equipped?.kind === 'unique' && equipped.instanceId === instanceId))) throw new Error('实例 ID 重复。');
  actor.gear[slotId] = enchantItem(unit, definition, enchantment, unit.kind === 'plain' ? instanceId : undefined);
  return next;
}
export function useEquipped(game: Game, actorId: string, slotId: string, random: () => number = Math.random): { game: Game; wore: boolean; destroyed: boolean } {
  const next = structuredClone(game); const actor = next.actors.find(value => value.id === actorId); const unit = actor?.gear[slotId];
  if (!actor || !unit) throw new Error('请先装备物品。');
  const definition = catalog[unit.definitionId]; if (definition.kind !== 'equipment') throw new Error('技能物品不适用装备损耗。');
  const result = useItem(unit, definition, random); actor.gear[slotId] = result.item;
  return { game: next, wore: result.wore, destroyed: result.destroyed };
}
export function clearEnchantments(game: Game, actorId: string, slotId: string): Game {
  const next = structuredClone(game); const actor = next.actors.find(value => value.id === actorId); const unit = actor?.gear[slotId];
  if (!actor || !unit || unit.kind !== 'unique') throw new Error('当前装备没有独立附魔。');
  const cleared = { ...unit, enchantments: [] }; const definition = catalog[unit.definitionId] as EquipmentDefinition;
  actor.gear[slotId] = canStack(cleared, definition) ? { kind: 'plain', definitionId: unit.definitionId } : cleared;
  return next;
}
