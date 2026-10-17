import { create } from 'zustand';
import { catalog, discard, equip, inventoryCount, optimize, sample, slots, unequipAll, type Game } from './model.ts';
type State = { game: Game; actorId: string; slotId: string; itemId: string | null; filter: string; message: string; actor: (id: string) => void; slot: (id: string) => void; select: (id: string | null) => void; setFilter: (value: string) => void; run: (action: string) => void; inventory: (action: 'equip' | 'remove', itemId: string) => void };
export const useEquipment = create<State>((set, get) => ({
  game: sample(), actorId: 'actor0', slotId: 'weapon', itemId: 'blade', filter: 'compatible', message: '单击查看物品，双击仓库装备，右键卸下；技能与装备操作相同。',
  actor: actorId => set({ actorId, itemId: null }),
  slot: slotId => set({ slotId, itemId: null, filter: 'compatible' }),
  select: itemId => set({ itemId }), setFilter: filter => set({ filter }),
  inventory: (action, itemId) => {
    const state = get(); const actor = state.game.actors.find(value => value.id === state.actorId)!; const item = catalog[itemId];
    try {
      if (!item) throw new Error('物品不存在。');
      const equipped = slots.find(slot => actor.gear[slot.id] === itemId);
      if (action === 'remove') {
        if (!equipped) throw new Error(`${actor.name}未装备${item.name}。`);
        set({ game: equip(state.game, state.actorId, equipped.id, null), slotId: equipped.id, itemId, message: `已卸下 ${item.name}，放回仓库。` }); return;
      }
      if (equipped) { set({ slotId: equipped.id, itemId, message: `${actor.name}已装备${item.name}。` }); return; }
      const target = slots.find(slot => slot.id === state.slotId && slot.kind === item.kind) ?? slots.find(slot => slot.kind === item.kind && (slot.kind !== 'skill' || !actor.gear[slot.id]));
      if (!target) throw new Error('八个技能位置已满，请先选择要替换的技能位置。');
      set({ game: equip(state.game, state.actorId, target.id, itemId), slotId: target.id, itemId, message: `已装备 ${item.name}。` });
    } catch (error) { set({ message: error instanceof Error ? error.message : String(error) }); }
  },
  run: action => {
    const state = get();
    try {
      let game = state.game; let message = '';
      if (action === 'equip') { game = equip(game, state.actorId, state.slotId, state.itemId); message = state.itemId ? `已装备 ${catalog[state.itemId].name}。` : '已卸下当前装备。'; }
      if (action === 'remove') { game = equip(game, state.actorId, state.slotId, null); message = '已卸下当前装备并放回仓库。'; }
      if (action === 'all') { game = unequipAll(game, state.actorId); message = '全部装备与技能已放回仓库。'; }
      if (action === 'best') { game = optimize(game, state.actorId); message = '最强装备完成：按装备参数总和排序，技能共用八个位置。'; }
      if (action === 'discard') { if (!state.itemId) throw new Error('请先从仓库选择要丢弃的物品。'); game = discard(game, state.actorId, state.itemId); message = `已丢弃 1 个${catalog[state.itemId].name}。`; }
      if (action === 'reset') { game = sample(); message = '已恢复示例人物与仓库。'; }
      set({ game, message });
    } catch (error) { set({ message: error instanceof Error ? error.message : String(error) }); }
  },
}));
export function canEquip(state: State): boolean {
  const slot = slots.find(value => value.id === state.slotId)!;
  const actor = state.game.actors.find(value => value.id === state.actorId)!;
  return state.itemId === null || (catalog[state.itemId].kind === slot.kind && inventoryCount(state.game, state.actorId, state.itemId) > 0 && (slot.kind !== 'skill' || !Object.values(actor.gear).includes(state.itemId)));
}
