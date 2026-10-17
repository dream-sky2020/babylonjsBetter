import { useState } from 'react';
import { applyPreparation, ARMORS, availableSkills, combatStats, draftWithSlots, WEAPONS, type Preparation } from './preparation.ts';
import { ELEMENTS, type Unit } from './types.ts';

export function PreparationOptions({ actor, draft, change, mode = 'battle' }: { actor: Unit; draft: Preparation; change: (draft: Preparation) => void; mode?: 'battle' | 'editor' }) {
  const [slot, setSlot] = useState(0);
  const [filter, setFilter] = useState<'all' | 'active' | 'passive'>('all');
  const skills = availableSkills(actor);
  const slots = draft.skillSlots ?? Array.from({ length: 8 }, (_, index) => skills.filter(skill => !draft.disabledSkillIds.includes(skill.id))[index]?.id ?? null);
  const preview = structuredClone(actor); const valid = applyPreparation(preview, draft); const stats = combatStats(valid ? preview : actor);
  const assign = (id: string | null) => { const next = [...slots]; next[slot] = id; change(draftWithSlots(actor, draft, next)); };
  return <section aria-label="整备选项" className="pt-loadout">
    <div className="pt-loadout-stats"><span>装配后攻击 <b>{stats.attack}</b></span><span>装配后防御 <b>{stats.defense}</b></span></div>
    <h4>装备栏</h4><div className="pt-equipment-slots"><label><span>武器</span><select value={draft.weaponId} onChange={event => change({ ...draft, weaponId: event.target.value as Preparation['weaponId'] })}>{Object.entries(WEAPONS).map(([id, item]) => <option key={id} value={id}>{item.name} · 攻击 +{item.attack}</option>)}</select></label><label><span>防具</span><select value={draft.armorId} onChange={event => change({ ...draft, armorId: event.target.value as Preparation['armorId'] })}>{Object.entries(ARMORS).map(([id, item]) => <option key={id} value={id}>{item.name} · 防御 +{item.defense}</option>)}</select></label></div>
    <h4 className="pt-slot-title">技能装备 <span>{slots.filter(Boolean).length} / 8 · 主动与被动共用</span></h4>
    <div className="pt-skill-slots" aria-label="八个技能装备槽">{slots.map((id, index) => {
      const skill = skills.find(item => item.id === id);
      return <div key={index} className={`pt-skill-slot${slot === index ? ' is-selected' : ''}`}>
        <button type="button" aria-label={`选择技能槽 ${index + 1}`} aria-pressed={slot === index} onClick={() => setSlot(index)}><small>SLOT {String(index + 1).padStart(2, '0')}</small><b>{skill?.name ?? '空槽位'}</b><span>{skill ? skill.kind === 'passive' ? '被动 · 自动生效' : `主动 · ${skill.mpCost} MP` : '从下方仓库装配'}</span></button>
        {skill && <button type="button" className="pt-slot-remove" aria-label={`卸下技能槽 ${index + 1} 的${skill.name}`} onClick={() => { const next = [...slots]; next[index] = null; change(draftWithSlots(actor, draft, next)); }}>卸下</button>}
      </div>;
    })}</div>
    <div className="pt-inventory-heading"><b>技能仓库</b><div className="pt-buttons">{(['all', 'active', 'passive'] as const).map(id => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{id === 'all' ? '全部' : id === 'active' ? '主动' : '被动'}</button>)}</div></div>
    <p className="pt-muted">先选槽位，再选技能。装入技能槽 {slot + 1}，原技能将回到仓库；普通攻击不占槽。</p>
    <div className="pt-skill-inventory" aria-label="技能仓库">{skills.filter(skill => filter === 'all' || (filter === 'passive' ? skill.kind === 'passive' : skill.kind !== 'passive')).map(skill => {
      const equippedAt = slots.indexOf(skill.id);
      return <button type="button" key={skill.id} className={skill.kind === 'passive' ? 'is-passive' : ''} aria-label={`装配技能 ${skill.name}`} onClick={() => equippedAt >= 0 ? setSlot(equippedAt) : assign(skill.id)}><div><b>{skill.name}</b><small>{equippedAt >= 0 ? `槽 ${equippedAt + 1} · 已装配` : skill.kind === 'passive' ? '被动' : '主动'}</small></div><span>{skill.kind === 'passive' ? `攻击 +${skill.passive?.attack ?? 0} · 防御 +${skill.passive?.defense ?? 0}` : `${skill.kind === 'heal' ? '治疗' : ELEMENTS[skill.element]} · 威力 ${skill.power} · ${skill.mpCost} MP`}</span></button>;
    })}</div>
    {!skills.length && <p className="pt-muted">仓库为空，可在角色数据面板新建技能。</p>}
    <p className="pt-muted">{mode === 'battle' ? '确认行动后才应用本次整备，并消耗一次普通行动；取消不生效、不扣点。' : '点击保存配置后生效。此处编辑实验配置不扣行动点；战斗内整备仍消耗一次普通行动。'}</p>
  </section>;
}
