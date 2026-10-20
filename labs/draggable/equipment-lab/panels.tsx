import { skillKind } from '../../../core/items/skills.ts';
import type { PanelDirection, CharacterView } from './panelSettings.ts';
import { attributeById, attributeGroups, attributes, type AttributeId } from '../../../core/combat/attributes.ts';
import { formatAttribute } from './sampleAttributes.ts';
import { actorSkills, catalog, equipmentSkillDescription, equipmentSkillName, equippedItem, inventoryCount, itemKind, items, labels, previewStats, slots, stats } from './model.ts';
import { canEquip, useEquipment } from './store.ts';

export const titles = { inventory: '仓库', commands: '按钮列表', character: '人物面板', attributes: '属性面板', information: '信息面板', equipment: '装备面板', skills: '技能面板' };
export type PanelId = keyof typeof titles;
const stageName = { base: '基础值', flat: '固定加值', first: '第一加乘', second: '第二加乘', independent: '独立乘区' };

export function Panel({ id, editing = false, columns = 1, direction, statsColumns = 1, characterView = 'attributes' }: { id: PanelId; editing?: boolean; columns?: number; direction?: PanelDirection; statsColumns?: number; characterView?: CharacterView }) {
  const state = useEquipment();
  const actor = state.game.actors.find(value => value.id === state.actorId)!;
  const slot = slots.find(value => value.id === state.slotId)!;
  const selected = state.itemId ? catalog[state.itemId] : null;
  const current = equippedItem(actor, state.slotId);
  const currentUnit = actor.gear[state.slotId];
  const value = stats(actor);
  const selectedUnique = state.instanceId ? state.game.uniques.find(unit => unit.instanceId === state.instanceId) : null;
  const preview = selected && itemKind(selected) !== slot.kind ? value : previewStats(actor, slot.id, state.itemId, selectedUnique ?? undefined);
  const attribute = state.attributeId ? attributeById[state.attributeId] : null;
  const wear = selected?.kind === 'equipment' ? selected.wear : null;

  if (id === 'commands') return <div className={`eq-commands eq-commands-${direction ?? 'horizontal'}`}>
    <button disabled={editing || !canEquip(state)} onClick={() => state.run('equip')}>确认装备</button>
    <button disabled={editing} onClick={() => state.run('best')}>最强装备</button>
    <button disabled={editing} onClick={() => state.run('remove')}>卸下当前</button>
    <button disabled={editing} onClick={() => state.run('all')}>全部卸下</button>
    <button disabled={editing || !selected || (selected.kind === 'skill' ? inventoryCount(state.game, state.actorId, selected.id) < 1 : state.instanceId ? !selectedUnique : (state.game.stock[selected.id] ?? 0) < 1)} onClick={() => state.run('discard')}>丢弃 ×1</button>
    <button disabled={editing || !current || current.kind !== 'equipment'} onClick={() => state.run('enchant')}>附魔当前</button>
    <button disabled={editing || !currentUnit || currentUnit.kind !== 'unique' || !currentUnit.enchantments.length} onClick={() => state.run('clearEnchantments')}>清除附魔</button>
    <button disabled={editing || !current || current.kind !== 'equipment'} onClick={() => state.run('use')}>使用当前</button>
  </div>;

  if (id === 'character') return <div>
    <div className="eq-actors" aria-label="选择人物">{state.game.actors.map(person => <button disabled={editing} aria-pressed={actor.id === person.id} key={person.id} onClick={() => state.actor(person.id)}>{person.name}</button>)}</div>
    <div className="eq-character-card">
      <div className="eq-character-identity">
        <div className="eq-character-level"><span>Lv {value.level}</span><span>可用加点 <b>{value.levelUpPoints}</b></span></div>
        <span className="eq-portrait" aria-hidden="true">{actor.name[0]}</span>
        <div className="eq-character-name"><b>{actor.name}</b><span>{actor.job}</span></div>
      </div>
      <div className="eq-character-resources">
        <ResourceBar label="HP" current={value.hp} maximum={value.maxHp} tone="hp" />
        <ResourceBar label="MP" current={value.mp} maximum={value.maxMp} tone="mp" />
        <ResourceBar label="SP" current={value.sp} maximum={value.maxSp} tone="sp" />
        <ResourceBar label="经验" current={value.experience} maximum={value.experienceToLevel} tone="exp" />
      </div>
    </div>
    <div className="eq-character-status"><strong>当前状态</strong><div>{value.hp <= 0 ? <span className="eq-status-badge">无法战斗</span> : null}{actor.statuses.length ? actor.statuses.map(status => <span className="eq-status-badge" key={status}>{status}</span>) : value.hp > 0 ? <span className="eq-status-badge">正常</span> : null}</div><span className="eq-next-level">距升级 {Math.max(0, value.experienceToLevel - value.experience)} EXP</span></div>
  </div>;

  if (id === 'attributes') return <div>
    <div className="eq-list-heading"><span>{actor.name}的详细属性</span><span>含装备与技能加成</span></div>
    <p className="eq-note">点击属性，在信息面板查看含义。</p>
    {attributeGroups.map(group => <section className="eq-attribute-group" key={group}>
      <h3>{group}</h3><div className="eq-stats" style={{ display: 'grid', gridTemplateColumns: `repeat(${statsColumns},minmax(0,1fr))` }}>
        {attributes.filter(entry => entry.group === group).map(entry => {
          const key = entry.id as AttributeId;
          return <button type="button" className={`eq-attribute ${characterView === 'explanations' ? 'eq-attribute-explanation' : ''}`} aria-pressed={state.attributeId === key} disabled={editing} key={key} onClick={() => state.selectAttribute(key)}>
            {characterView === 'explanations' ? <><span><b>{entry.name}</b></span><span>{entry.description}</span></> : <><span>{entry.name}</span><b>{formatAttribute(value[key], entry.unit)}</b>{preview[key] !== value[key] && <span className={preview[key] > value[key] ? 'eq-up' : 'eq-down'}>→ {formatAttribute(preview[key], entry.unit)}</span>}</>}
          </button>;
        })}
      </div>
    </section>)}
  </div>;

  if (id === 'information') return attribute ? <div>
    <div className="eq-info-heading"><strong>{attribute.name}</strong><span>{attribute.group}</span></div>
    <p>{attribute.description}</p><div className="eq-context">{actor.name} · 当前 {formatAttribute(value[attribute.id], attribute.unit)} · 单位：{attribute.unit}</div>
  </div> : <div>
    <div className="eq-info-heading"><strong>{selected?.name ?? '卸下装备'}</strong><span>{selected?.kind === 'skill' ? skillKind(selected) : selected ? labels[itemKind(selected)] : '空装备'}</span></div>
    {selected?.kind === 'skill' && <>{(['battle', 'field'] as const).map(context => <p key={context}>{context === 'battle' ? '战斗中' : '战斗外'}：{selected.active?.[context] ? `可发动 · ${selected.active[context].cost.mp ?? 0} MP · ${selected.active[context].cost.sp ?? 0} SP` : '不可发动'}</p>)}</>}
    <p>{selected?.description ?? '空置当前装备位置，原装备将放回仓库。'}</p>
    {selected && selected.modifiers.length > 0 && <p>属性修正：{selected.modifiers.map(modifier => `${attributeById[modifier.attribute].name} ${stageName[modifier.stage]} ${modifier.value >= 0 ? '+' : ''}${['first', 'second', 'independent'].includes(modifier.stage) ? `${Math.round(modifier.value * 100)}%` : modifier.value}`).join('；')}</p>}
    {selected?.kind === 'equipment' && selected.skills.length > 0 && <p>这件物品的技能：{selected.skills.map(equipmentSkillDescription).join('；')}</p>}
    {wear && <p>使用后损耗概率：{Math.round(wear.breakChance * 100)}%{wear.kind === 'durability' ? ` · 最大耐久 ${wear.maxDurability}` : ' · 触发时损坏'}</p>}
    {selectedUnique && <p>独立物品 · 耐久 {selectedUnique.durability ?? '无'} · 附魔 {selectedUnique.enchantments.map(value => value.id).join('、') || '无'}</p>}
    {currentUnit?.kind === 'unique' && <p>当前装备：耐久 {currentUnit.durability ?? '无'} · 附魔 {currentUnit.enchantments.map(value => value.id).join('、') || '无'}</p>}
    {current?.kind === 'equipment' && current.skills.length > 0 && selected?.id !== current.id && <p>当前装备生效：{current.skills.map(equipmentSkillDescription).join('；')}。角色当前技能等级：{Object.entries(actorSkills(actor)).map(([skillId, level]) => `${equipmentSkillName(skillId)} ${level}级`).join('、')}</p>}
    <div className="eq-context">{actor.name} · {slot.label}　{current?.name ?? '未装备'} → {selected?.name ?? '未装备'}</div><p className="eq-message" role="status">{state.message}</p>
  </div>;

  if (id === 'equipment' || id === 'skills') return <div>
    <div className="eq-list-heading"><span>{id === 'skills' ? '技能装备位置 · 主动 / 被动共用' : `${actor.name}的装备位置`}</span><span>{id === 'skills' ? '最多 8 个' : '当前装备'}</span></div>
    <div className={`eq-item-grid eq-equipment-layout-${direction ?? 'grid'}`} style={{ gridTemplateColumns: `repeat(${direction === 'vertical' ? 1 : columns},minmax(0,1fr))` }}>
      {slots.filter(s => (s.kind === 'skill') === (id === 'skills')).map(s => { const equipped = equippedItem(actor, s.id); const unit = actor.gear[s.id]; return <button disabled={editing} className="eq-row eq-slot" aria-pressed={state.slotId === s.id} key={s.id} onClick={() => state.slot(s.id)} onContextMenu={event => { event.preventDefault(); if (!editing && equipped) state.inventory('remove', equipped.id, unit?.kind === 'unique' ? unit.instanceId : undefined); }} title="单击选择位置，右键卸下"><span className="eq-gold">{s.label}</span><span>{equipped?.name ?? '—'}{unit?.kind === 'unique' ? ' ✦' : ''}</span><small>{equipped?.kind === 'skill' ? skillKind(equipped) : unit?.kind === 'unique' && unit.durability !== undefined ? `耐久 ${unit.durability}` : ''}</small></button>; })}
    </div>
  </div>;

  const visible = items.filter(item => state.filter === 'all' || (state.filter === 'compatible' ? itemKind(item) === slot.kind : itemKind(item) === state.filter));
  const entries = visible.flatMap(item => {
    const count = item.kind === 'skill' ? actor.skillStock[item.id] ?? 0 : state.game.stock[item.id] ?? 0;
    const unique = item.kind === 'equipment' ? state.game.uniques.filter(unit => unit.definitionId === item.id) : [];
    return [{ item, count, instanceId: undefined as string | undefined, durability: undefined as number | undefined, enchantments: '' }, ...unique.map(unit => ({ item, count: 1, instanceId: unit.instanceId, durability: unit.durability, enchantments: unit.enchantments.map(value => value.id).join('、') }))];
  });
  return <div><div className="eq-list-heading"><span>{actor.name}的技能仓库</span><span>普通装备全队共享</span></div>
    <div className="eq-inventory-tools"><label>显示 <select disabled={editing} value={state.filter} onChange={event => state.setFilter(event.target.value)}><option value="compatible">当前部位可用</option><option value="all">全部装备与技能</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><span>持有数</span></div>
    <div className="eq-item-grid" style={{ gridTemplateColumns: `repeat(${columns},minmax(0,1fr))` }}>
      <button className="eq-row eq-empty-item" disabled={editing} aria-pressed={state.itemId === null} onClick={() => state.select(null)} onDoubleClick={() => { if (!editing) state.run('remove'); }} onContextMenu={event => { event.preventDefault(); if (!editing) state.run('remove'); }}><span>〈不装备〉</span><small>卸下当前部位</small></button>
      {entries.map(({ item, count, instanceId, durability, enchantments }) => <button className="eq-row" disabled={editing} aria-pressed={state.itemId === item.id && state.instanceId === (instanceId ?? null)} key={instanceId ?? item.id} onClick={() => state.select(item.id, instanceId)} onDoubleClick={() => { if (!editing) state.inventory('equip', item.id, instanceId); }} onContextMenu={event => { event.preventDefault(); if (!editing) state.inventory('remove', item.id, instanceId); }} title="单击查看，双击装备，右键卸下该物品"><span><small className="eq-gold">{item.kind === 'skill' ? skillKind(item) : labels[itemKind(item)]}</small>　{item.name}{instanceId ? ' ✦' : ''}{enchantments ? ` · ${enchantments}` : ''}</span><span>{durability !== undefined ? `耐久 ${durability}` : `× ${count}`}</span></button>)}
    </div><p className="eq-note">单击查看，双击装备；右键卸下当前人物的该物品。带 ✦ 的物品独立存储。</p>
  </div>;
}

function ResourceBar({ label, current, maximum, tone }: { label: string; current: number; maximum: number; tone: string }) {
  const ratio = maximum > 0 ? Math.max(0, Math.min(1, current / maximum)) : 0;
  return <div className={`eq-resource eq-resource-${tone}`}><div><span>{label}</span><b>{formatAttribute(current, '点')} / {formatAttribute(maximum, '点')}</b></div><div className="eq-resource-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={Math.max(1, maximum)} aria-valuenow={Math.max(0, Math.min(current, Math.max(1, maximum)))} aria-valuetext={`${current} / ${maximum}`}><span style={{ width: `${ratio * 100}%` }} /></div></div>;
}
