import { effectsFor, type ItemEffect, type ItemUseAction } from '../../../core/items/usage.ts';
import { catalog, categories, count, effectSets, items, selectedUnit, type CategoryFilter } from './model.ts';
import { availableFor, spaceFor, useWarehouse } from './store.ts';
import type { PanelId } from './layouts.ts';

const targetNames: Record<ItemUseAction['target'], string> = { self: '自己', oneAlly: '一名队友', oneEnemy: '一名敌人', allAllies: '全体队友', allEnemies: '全体敌人' };
const costNames: Record<ItemUseAction['cost'], string> = { consumeOne: '消耗 1 件', wearCheck: '使用后判定损耗', none: '不消耗' };
function effectText(effect: ItemEffect): string {
  if (effect.type === 'triggerEvent') return `触发事件：${effect.eventId}`;
  if (effect.type === 'applyStatus') return `施加状态 ${effect.statusId}（${Math.round(effect.chance * 100)}%，${effect.turns} 回合）`;
  const amount = effect.amount.kind === 'fixed' ? `${effect.amount.value}` : `目标上限的 ${Math.round(effect.amount.ratio * 100)}%`;
  if (effect.type === 'damage') return `造成 ${amount} 点伤害`;
  return `恢复 ${amount} 点${{ hp: '生命', mp: '魔法', sp: '技能值' }[effect.resource]}`;
}
function profileText(action: ItemUseAction | undefined): string {
  return action ? `目标：${targetNames[action.target]}；${effectsFor(action, effectSets).map(effectText).join('；')}；${costNames[action.cost]}` : '不可使用';
}

export function Panel({ id, editing = false, columns = 1 }: { id: PanelId; editing?: boolean; columns?: number }) {
  const state = useWarehouse();
  const selection = state.selection;
  const selected = selection ? catalog[selection.definitionId] : null;
  const warehouseUnit = selectedUnit(state.warehouse, selection);
  const backpackUnit = selectedUnit(state.backpack, selection);
  const unit = warehouseUnit ?? backpackUnit;
  const warehouseAvailable = availableFor(state, 'field', selection);
  const backpackAvailable = availableFor(state, 'battle', selection);
  const room = selected ? spaceFor(state, selected.id, 'backpack') : 0;
  if (id === 'commands') return <div className="wh-commands">
    <button disabled={editing || !selected || !!selection?.instanceId || spaceFor(state, selected.id, 'warehouse') < 1} onClick={() => state.run('deposit')}>存入仓库 1 件</button>
    <button disabled={editing || !selected?.stackable || !!selection?.instanceId || spaceFor(state, selected.id, 'warehouse') < 10} onClick={() => state.run('deposit10')}>存入仓库 10 件</button>
    <button disabled={editing || !selected || warehouseAvailable < 1} onClick={() => state.run('withdraw')}>移出仓库 1 件</button>
    <button disabled={editing || !selected?.stackable || !!selection?.instanceId || warehouseAvailable < 10} onClick={() => state.run('withdraw10')}>移出仓库 10 件</button>
    <button disabled={editing || !selected || warehouseAvailable < 1 || room < 1} onClick={() => state.run('pack')}>放入背包 1 件</button>
    <button disabled={editing || !selected || backpackAvailable < 1 || spaceFor(state, selected.id, 'warehouse') < 1} onClick={() => state.run('unpack')}>放回仓库 1 件</button>
    <button disabled={editing || !selected || room < 1 || (selection?.instanceId ? warehouseAvailable < 1 : count(state.warehouse, selected.id) < 1)} onClick={() => state.run('restock')}>战斗整备补货</button>
    <button disabled={editing || !selected?.use?.battle || backpackAvailable < 1} onClick={() => state.run('useBattle')}>战斗中使用</button>
    <button disabled={editing || !selected?.use?.field || warehouseAvailable < 1} onClick={() => state.run('useField')}>战斗外使用</button>
    <button disabled={editing} onClick={() => state.run('reset')}>恢复示例</button>
  </div>;
  if (id === 'information') return <div className="wh-information"><div className="wh-info-heading"><strong>{selected?.name ?? '未选择物品'}</strong><span>{selected?.category ?? '仓库'}</span></div>
    <p>{selected?.description ?? '从仓库面板选择一件物品查看详情。'}</p>
    {selected && <><p>仓库 {count(state.warehouse, selected.id)}/{selected.storage.warehouseLimit} · 战斗背包 {count(state.backpack, selected.id)}/{selected.storage.backpackLimit}</p><p>存放方式：{selected.stackable ? '普通物品合并计数；有独立状态时单独保存' : '每件独立保存'}</p><p>战斗中：{profileText(selected.use?.battle)}</p><p>战斗外：{profileText(selected.use?.field)}</p></>}
    {unit && <p>独立物品 ✦ 位置：{warehouseUnit ? '仓库' : '战斗背包'} 编号：{unit.instanceId} {unit.durability !== undefined ? `耐久：${unit.durability}/${selected?.maxDurability ?? unit.durability} ` : ''}附魔：{unit.enchantments.map(enchantment => enchantment.id).join('、') || '无'}</p>}
    <p>效果演示：我方 HP {state.hero.hp}/{state.hero.maxHp} · 敌方 HP {state.enemy.hp}/{state.enemy.maxHp} · 已消耗战斗回合 {state.battleTurns}</p>
    <p className="wh-message" role="status">{state.message}</p>
  </div>;
  const query = state.query.trim().toLocaleLowerCase();
  const visible = items.filter(item => (state.category === '全部' || item.category === state.category) && (!query || `${item.name} ${item.id} ${item.description}`.toLocaleLowerCase().includes(query)));
  return <div><div className="wh-tools"><label>类别 <select disabled={editing} value={state.category} onChange={event => state.filter(event.target.value as CategoryFilter)}>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select></label><label>搜索 <input disabled={editing} value={state.query} onChange={event => state.search(event.target.value)} placeholder="名称或说明" /></label></div>
    <div className="wh-inventory" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
      {visible.flatMap(item => {
        const warehouseCount = state.warehouse.stacks[item.id] ?? 0;
        const backpackCount = state.backpack.stacks[item.id] ?? 0;
        const uniques = [...state.warehouse.uniques.map(unit => ({ unit, location: '仓库' })), ...state.backpack.uniques.map(unit => ({ unit, location: '背包' }))].filter(entry => entry.unit.definitionId === item.id);
        return [<button className="wh-row" key={item.id} disabled={editing} aria-pressed={selection?.definitionId === item.id && !selection.instanceId} onClick={() => state.select({ definitionId: item.id })}><span><small>{item.category}</small> {item.name}</span><b>{item.stackable ? `仓 ${warehouseCount} · 包 ${backpackCount}` : '新增实例'}</b></button>,
          ...uniques.map(({ unit, location }) => <button className="wh-row" key={unit.instanceId} disabled={editing} aria-pressed={selection?.instanceId === unit.instanceId} onClick={() => state.select({ definitionId: item.id, instanceId: unit.instanceId })}><span><small>{location} · {item.category}</small> {item.name} ✦</span><b>{unit.durability !== undefined ? `耐久 ${unit.durability}` : '独立'}</b></button>)];
      })}
    </div>{visible.length === 0 && <p className="wh-note">没有符合条件的物品。</p>}<p className="wh-note">战斗使用背包，战斗外使用仓库；整备从仓库补满所选物品的背包上限，消耗一回合。</p>
  </div>;
}
