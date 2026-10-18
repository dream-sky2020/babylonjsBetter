import { create } from 'zustand';
import type { AttributeId } from '../../../core/combat/attributes.ts';
import { catalog, clearEnchantments, discard, enchantEquipped, equip, equippedId, inventoryCount, itemKind, optimize, sample, slots, unequipAll, useEquipped, type Game } from './model.ts';

type State = { game: Game; actorId: string; slotId: string; itemId: string | null; instanceId: string | null; attributeId: AttributeId | null; filter: string; message: string; actor: (id: string) => void; slot: (id: string) => void; select: (id: string | null, instanceId?: string) => void; selectAttribute: (id: AttributeId) => void; setFilter: (value: string) => void; run: (action: string) => void; inventory: (action: 'equip' | 'remove', itemId: string, instanceId?: string) => void };
export const useEquipment = create<State>((set, get) => ({
  game: sample(), actorId: 'actor0', slotId: 'weapon', itemId: 'blade', instanceId: null, attributeId: null, filter: 'compatible', message: '单击查看物品或人物属性，双击仓库装备，右键卸下。',
  actor: actorId => set({ actorId, itemId: null, instanceId: null }),
  slot: slotId => set({ slotId, itemId: null, instanceId: null, attributeId: null, filter: 'compatible' }),
  select: (itemId, instanceId) => set({ itemId, instanceId: instanceId ?? null, attributeId: null }), selectAttribute: attributeId => set({ attributeId }), setFilter: filter => set({ filter }),
  inventory: (action, itemId, instanceId) => {
    const state = get(); const actor = state.game.actors.find(value => value.id === state.actorId)!; const item = catalog[itemId];
    try {
      if (!item) throw new Error('物品不存在。');
      const equipped = slots.find(slot => { const unit = actor.gear[slot.id]; return equippedId(actor, slot.id) === itemId && (!instanceId || unit?.kind === 'unique' && unit.instanceId === instanceId); });
      if (action === 'remove') {
        if (!equipped) throw new Error(`${actor.name}未装备${item.name}。`);
        set({ game: equip(state.game, state.actorId, equipped.id, null), slotId: equipped.id, itemId, instanceId: instanceId ?? null, attributeId: null, message: `已卸下 ${item.name}，放回仓库。` }); return;
      }
      if (equipped) { set({ slotId: equipped.id, itemId, instanceId: instanceId ?? null, attributeId: null, message: `${actor.name}已装备${item.name}。` }); return; }
      if (action === 'equip' && item.kind === 'equipment' && !instanceId && (state.game.stock[itemId] ?? 0) <= 0) throw new Error('请选择带 ✦ 的独立物品条目。');
      const kind = itemKind(item);
      const target = slots.find(slot => slot.id === state.slotId && slot.kind === kind) ?? slots.find(slot => slot.kind === kind && (kind !== 'skill' || !actor.gear[slot.id]));
      if (!target) throw new Error('八个技能位置已满，请先选择要替换的技能位置。');
      set({ game: equip(state.game, state.actorId, target.id, itemId, instanceId), slotId: target.id, itemId, instanceId: instanceId ?? null, attributeId: null, message: `已装备 ${item.name}。` });
    } catch (error) { set({ message: error instanceof Error ? error.message : String(error) }); }
  },
  run: action => {
    const state = get();
    try {
      let game = state.game; let message = '';
      if (action === 'equip') { game = equip(game, state.actorId, state.slotId, state.itemId, state.instanceId ?? undefined); message = state.itemId ? `已装备 ${catalog[state.itemId].name}。` : '已卸下当前装备。'; }
      if (action === 'remove') { game = equip(game, state.actorId, state.slotId, null); message = '已卸下当前装备并放回仓库。'; }
      if (action === 'all') { game = unequipAll(game, state.actorId); message = '全部装备与技能已放回仓库。'; }
      if (action === 'best') { game = optimize(game, state.actorId); message = '已按装备属性选择装备，技能共用八个位置。'; }
      if (action === 'discard') { if (!state.itemId) throw new Error('请先从仓库选择要丢弃的物品。'); game = discard(game, state.actorId, state.itemId, state.instanceId ?? undefined); message = `已丢弃 1 个${catalog[state.itemId].name}。`; }
      if (action === 'enchant') { game = enchantEquipped(game, state.actorId, state.slotId, { id: '锋锐', modifiers: [{ attribute: 'attack', stage: 'first', value: 0.1 }] }, crypto.randomUUID()); message = '已附魔：物品变为独立实例，物理攻击第一加乘 +10%。'; }
      if (action === 'clearEnchantments') { game = clearEnchantments(game, state.actorId, state.slotId); message = '已清除附魔；符合条件时重新合并为普通物品。'; }
      if (action === 'use') { const result = useEquipped(game, state.actorId, state.slotId); game = result.game; message = result.destroyed ? '使用后物品损坏。' : result.wore ? '使用后损耗 1 点耐久。' : '已使用，没有触发损耗。'; }
      if (action === 'reset') { game = sample(); message = '已恢复示例人物与仓库。'; }
      set({ game, attributeId: null, message });
    } catch (error) { set({ message: error instanceof Error ? error.message : String(error) }); }
  },
}));
export function canEquip(state: State): boolean {
  const slot = slots.find(value => value.id === state.slotId)!;
  const actor = state.game.actors.find(value => value.id === state.actorId)!;
  return state.itemId === null || (Boolean(catalog[state.itemId]) && itemKind(catalog[state.itemId]) === slot.kind && (state.instanceId ? state.game.uniques.some(unit => unit.instanceId === state.instanceId && unit.definitionId === state.itemId) : catalog[state.itemId].kind === 'skill' ? inventoryCount(state.game, state.actorId, state.itemId) > 0 : (state.game.stock[state.itemId] ?? 0) > 0) && (slot.kind !== 'skill' || !Object.values(actor.gear).some(unit => unit?.definitionId === state.itemId)));
}
