import { create } from 'zustand';
import { inventoryCount, resolveItemUse, restockItem, transferItem, type EffectTargetState, type ItemStock, type UseContext } from '../../../core/items/usage.ts';
import { catalog, categories, count, deposit, effectSets, sampleStock, sampleTargets, selectedUnit, withdraw, type CategoryFilter, type Selection, type Warehouse } from './model.ts';

type Action = 'deposit' | 'deposit10' | 'withdraw' | 'withdraw10' | 'pack' | 'unpack' | 'restock' | 'useBattle' | 'useField' | 'reset';
type State = { warehouse: Warehouse; backpack: Warehouse; hero: EffectTargetState; enemy: EffectTargetState; battleTurns: number; selection: Selection | null; category: CategoryFilter; query: string; message: string; select: (value: Selection | null) => void; filter: (category: CategoryFilter) => void; search: (query: string) => void; run: (action: Action) => void };
const initialStock = sampleStock();
const initialTargets = sampleTargets();
export const useWarehouse = create<State>((set, get) => ({
  ...initialStock, ...initialTargets, battleTurns: 0, selection: { definitionId: 'potion' }, category: '全部', query: '', message: '战斗使用背包库存，战斗外使用仓库库存；战斗中整备补货消耗一回合。',
  select: selection => set({ selection }),
  filter: category => { if (categories.includes(category)) set({ category }); },
  search: query => set({ query }),
  run: action => {
    const state = get();
    if (action === 'reset') { set({ ...sampleStock(), ...sampleTargets(), battleTurns: 0, selection: { definitionId: 'potion' }, category: '全部', query: '', message: '已恢复示例仓库与战斗背包。' }); return; }
    try {
      const selection = state.selection; if (!selection) throw new Error('请先选择物品。');
      const definition = catalog[selection.definitionId]; if (!definition) throw new Error('物品定义不存在。');
      const stock: ItemStock = { warehouse: state.warehouse, backpack: state.backpack };
      if (action === 'deposit' || action === 'deposit10' || action === 'withdraw' || action === 'withdraw10') {
        const amount = action.endsWith('10') ? 10 : 1;
        if (action.startsWith('deposit') && selection.instanceId) throw new Error('请选择物品类型存入新的一件。');
        const warehouse = action.startsWith('deposit') ? deposit(state.warehouse, definition.id, amount, crypto.randomUUID()) : withdraw(state.warehouse, selection, amount);
        const verb = action.startsWith('deposit') ? '存入' : '移出';
        set({ warehouse, selection: selectedUnit(warehouse, selection) || !selection.instanceId ? selection : { definitionId: selection.definitionId }, message: `已从外部${verb} ${amount} 件${definition.name}，仓库现有 ${count(warehouse, definition.id)} 件。` });
        return;
      }
      if (action === 'pack' || action === 'unpack') {
        const from = action === 'pack' ? 'warehouse' : 'backpack';
        const next = transferItem(stock, definition, from, selection, 1);
        set({ ...next, message: `${definition.name}已${action === 'pack' ? '放入战斗背包' : '放回仓库'} 1 件；战斗外转移不消耗回合。` });
        return;
      }
      if (action === 'restock') {
        const result = restockItem(stock, definition, selection.instanceId ? selection : undefined);
        if (!result.moved) throw new Error('没有可补充的物品，或背包已达到上限。');
        set({ ...result.stock, battleTurns: state.battleTurns + result.turnCost, message: `战斗整备：${definition.name}补入背包 ${result.moved} 件，消耗 ${result.turnCost} 回合。` });
        return;
      }
      const context: UseContext = action === 'useBattle' ? 'battle' : 'field';
      const profile = definition.use?.[context]; if (!profile) throw new Error(`此物品不能在${context === 'battle' ? '战斗中' : '战斗外'}使用。`);
      const target = profile.target === 'oneEnemy' || profile.target === 'allEnemies' ? state.enemy : state.hero;
      const result = resolveItemUse(stock, definition, context, selection, [target], effectSets);
      const updated = result.targets[0];
      const resource = updated.id === 'enemy' ? { enemy: updated } : { hero: updated };
      const effectMessage = result.events.length ? `触发 ${result.events.join('、')}` : updated.id === 'enemy' ? `敌方 HP ${target.hp} → ${updated.hp}` : `我方 HP ${target.hp} → ${updated.hp}`;
      set({ ...result.stock, ...resource, battleTurns: state.battleTurns + result.turnCost, selection: result.destroyed && selection.instanceId ? { definitionId: selection.definitionId } : selection, message: `${context === 'battle' ? '战斗中' : '战斗外'}使用${definition.name}：${effectMessage}。${result.wore ? result.destroyed ? '物品损坏。' : '触发耐久损耗。' : ''}${result.turnCost ? '消耗 1 回合。' : ''}` });
    } catch (error) { set({ message: error instanceof Error ? error.message : String(error) }); }
  },
}));
export function availableFor(state: State, context: UseContext, selection: Selection | null): number {
  if (!selection) return 0;
  const inventory = context === 'battle' ? state.backpack : state.warehouse;
  return selection.instanceId ? inventory.uniques.some(item => item.instanceId === selection.instanceId && item.definitionId === selection.definitionId) ? 1 : 0 : inventory.stacks[selection.definitionId] ?? 0;
}
export function spaceFor(state: State, definitionId: string, location: 'warehouse' | 'backpack'): number {
  const definition = catalog[definitionId];
  return definition ? Math.max(0, definition.storage[location === 'warehouse' ? 'warehouseLimit' : 'backpackLimit'] - inventoryCount(state[location], definitionId)) : 0;
}
