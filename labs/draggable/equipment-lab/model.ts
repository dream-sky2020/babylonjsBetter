export type Kind = 'weapon' | 'shield' | 'head' | 'body' | 'accessory' | 'skill';
export type Stats = { attack: number; defense: number; magic: number; speed: number };
export type Item = { id: string; name: string; kind: Kind; description: string; stats: Stats; passive?: boolean; mp?: number };
export const labels: Record<Kind, string> = { weapon: '武器', shield: '盾牌', head: '头部', body: '身体', accessory: '饰品', skill: '技能' };
const item = (id: string, name: string, kind: Kind, description: string, attack = 0, defense = 0, magic = 0, speed = 0, extra: Partial<Item> = {}): Item => ({ id, name, kind, description, stats: { attack, defense, magic, speed }, ...extra });
export const items: Item[] = [
  item('sword', '铁剑', 'weapon', '沉稳可靠的单手剑。', 12), item('blade', '骑士长剑', 'weapon', '精工锻造，适合近身作战。', 22, 0, 0, -2), item('staff', '贤者手杖', 'weapon', '蕴藏魔力的古老手杖。', 4, 0, 20),
  item('shield', '圆盾', 'shield', '轻便的木制圆盾。', 0, 8), item('helm', '铁盔', 'head', '保护头部的铁制头盔。', 0, 6), item('hat', '魔法帽', 'head', '绣有星纹的帽子。', 0, 3, 8),
  item('armor', '锁子甲', 'body', '以铁环编织的护甲。', 0, 15, 0, -2), item('robe', '旅法师长袍', 'body', '为魔法旅行者缝制的长袍。', 0, 7, 10), item('boots', '疾风之靴', 'accessory', '脚步轻快如风。', 0, 0, 0, 10),
  item('fire', '火焰', 'skill', '主动技能 · 对单个敌人造成火属性伤害。', 0, 0, 0, 0, { mp: 5 }), item('heal', '治愈', 'skill', '主动技能 · 恢复一名队友的生命。', 0, 0, 0, 0, { mp: 4 }),
  item('ice', '冰结', 'skill', '主动技能 · 对单个敌人造成冰属性伤害。', 0, 0, 0, 0, { mp: 5 }), item('slash', '二连斩', 'skill', '主动技能 · 连续进行两次斩击。', 0, 0, 0, 0, { mp: 6 }),
  item('power', '力量心得', 'skill', '被动技能 · 装备时攻击力 +6。', 6, 0, 0, 0, { passive: true }), item('guard', '坚守心得', 'skill', '被动技能 · 装备时防御力 +6。', 0, 6, 0, 0, { passive: true }),
  item('wisdom', '魔力心得', 'skill', '被动技能 · 装备时魔力 +6。', 0, 0, 6, 0, { passive: true }), item('haste', '敏捷心得', 'skill', '被动技能 · 装备时敏捷 +6。', 0, 0, 0, 6, { passive: true }), item('spark', '雷电', 'skill', '主动技能 · 对单个敌人造成雷属性伤害。', 0, 0, 0, 0, { mp: 5 }),
];
export const catalog = Object.fromEntries(items.map(value => [value.id, value])) as Record<string, Item>;
export const slots: { id: string; kind: Kind; label: string }[] = [
  ...(['weapon', 'shield', 'head', 'body', 'accessory'] as Kind[]).map(kind => ({ id: kind, kind, label: labels[kind] })),
  ...Array.from({ length: 8 }, (_, i) => ({ id: `skill${i + 1}`, kind: 'skill' as const, label: `技能 ${i + 1}` })),
];
export type Actor = { id: string; name: string; job: string; level: number; base: Stats; gear: Record<string, string | null>; skillStock: Record<string, number> };
export type Game = { actors: Actor[]; stock: Record<string, number> };
export function sample(): Game {
  const stock = Object.fromEntries(items.filter(value => value.kind !== 'skill').map(value => [value.id, 3]));
  const actors = ['艾里克', '露娜', '诺亚'].map((name, index): Actor => ({ id: `actor${index}`, name, job: ['剑士', '魔法师', '游侠'][index], level: 12, base: { attack: 20 - index * 4, defense: 12, magic: 10 + index * 6, speed: 15 + index * 2 }, gear: Object.fromEntries(slots.map(slot => [slot.id, null])), skillStock: Object.fromEntries(items.filter(value => value.kind === 'skill').map(value => [value.id, 3])) }));
  actors.forEach((actor, index) => { for (const [slot, id] of Object.entries({ weapon: index === 1 ? 'staff' : 'sword', head: 'helm', body: 'armor', skill1: 'fire', skill2: 'power' })) { actor.gear[slot] = id; (catalog[id].kind === 'skill' ? actor.skillStock : stock)[id]--; } });
  return { actors, stock };
}
export function stats(actor: Actor): Stats {
  const result = { ...actor.base };
  Object.values(actor.gear).forEach(id => { if (id) for (const key of Object.keys(result) as (keyof Stats)[]) result[key] += catalog[id].stats[key]; });
  return result;
}
function stockFor(game: Game, actorId: string, itemId: string): Record<string, number> {
  const actor = game.actors.find(value => value.id === actorId); const item = catalog[itemId];
  if (!actor || !item) throw new Error('角色或物品不存在。');
  return item.kind === 'skill' ? actor.skillStock : game.stock;
}
export function inventoryCount(game: Game, actorId: string, itemId: string): number { return stockFor(game, actorId, itemId)[itemId] ?? 0; }
export function equip(game: Game, actorId: string, slotId: string, itemId: string | null): Game {
  const actor = game.actors.find(value => value.id === actorId); const slot = slots.find(value => value.id === slotId);
  if (!actor || !slot) throw new Error('角色或装备位置不存在。');
  if (actor.gear[slotId] === itemId) return game;
  if (itemId && (!catalog[itemId] || catalog[itemId].kind !== slot.kind || !(inventoryCount(game, actorId, itemId) > 0))) throw new Error('装备类型不匹配，或当前人物仓库数量不足。');
  if (itemId && slot.kind === 'skill' && Object.values(actor.gear).includes(itemId)) throw new Error('同一角色不能重复装备同一个技能。');
  const next = structuredClone(game); const target = next.actors.find(value => value.id === actorId)!;
  const old = target.gear[slotId]; if (old) { const stock = stockFor(next, actorId, old); stock[old] = (stock[old] ?? 0) + 1; }
  if (itemId) stockFor(next, actorId, itemId)[itemId]--;
  target.gear[slotId] = itemId; return next;
}
export function unequipAll(game: Game, actorId: string): Game { return slots.reduce((state, slot) => equip(state, actorId, slot.id, null), game); }
export function optimize(game: Game, actorId: string): Game {
  let next = unequipAll(game, actorId);
  for (const slot of slots) {
    const actor = next.actors.find(value => value.id === actorId)!;
    const candidates = items.filter(value => value.kind === slot.kind && inventoryCount(next, actorId, value.id) > 0 && (slot.kind !== 'skill' || !Object.values(actor.gear).includes(value.id)));
    candidates.sort((a, b) => Object.values(b.stats).reduce((n, v) => n + v, 0) - Object.values(a.stats).reduce((n, v) => n + v, 0));
    if (candidates[0]) next = equip(next, actorId, slot.id, candidates[0].id);
  }
  return next;
}
export function discard(game: Game, actorId: string, itemId: string): Game {
  if (!catalog[itemId] || !(inventoryCount(game, actorId, itemId) > 0)) throw new Error('只能丢弃当前仓库中的物品。');
  const next = structuredClone(game); stockFor(next, actorId, itemId)[itemId]--; return next;
}
