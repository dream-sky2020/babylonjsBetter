import { useState } from 'react';
import { usePressStore } from './store.ts';
import { currentPreparation, type Preparation } from './preparation.ts';
import { PreparationOptions } from './PreparationOptions.tsx';
import { sideName, type Side, type Unit } from './types.ts';

function LoadoutEditor({ unit, save }: { unit: Unit; save: (draft: Preparation) => void }) {
  const [draft, setDraft] = useState(() => currentPreparation(unit));
  return <><PreparationOptions actor={unit} draft={draft} change={setDraft} mode="editor" /><div className="pt-buttons"><button className="pt-primary" onClick={() => save(draft)}>保存整备配置</button><button onClick={() => setDraft(currentPreparation(unit))}>撤销未保存修改</button></div></>;
}
export function PreparationPanel({ editing = false }: { editing?: boolean }) {
  const battle = usePressStore(state => state.battle);
  const selected = usePressStore(state => state.selected);
  const [side, setSide] = useState<Side>('left'); const [message, setMessage] = useState('');
  const units = battle.teams[side]; const unit = units.find(item => item.id === selected[side]) ?? units[0];
  const state = usePressStore.getState();
  return <fieldset disabled={editing} className="pt-business pt-preparation-panel">
    <div className="pt-preparation-banner"><b>角色整备</b><span>EQUIPMENT & SKILL LOADOUT</span></div>
    <div className="pt-buttons" aria-label="整备队伍">{(['left', 'right'] as const).map(id => <button key={id} aria-pressed={id === side} onClick={() => { setSide(id); setMessage(''); }}>{sideName(id)}</button>)}</div>
    <div className="pt-party-select" aria-label="整备角色">{units.map(item => <button key={item.id} aria-pressed={item.id === unit?.id} onClick={() => { state.select(side, item.id); setMessage(''); }}><b>{item.name}</b><small>HP {item.hp} / {item.maxHp}</small></button>)}</div>
    {unit ? <><div className="pt-preparation-character"><b>{unit.name}</b><span>{sideName(side)} · 8 个技能装备槽</span></div><LoadoutEditor key={`${unit.id}-${JSON.stringify(currentPreparation(unit))}-${unit.skills.map(skill => skill.id).join(',')}`} unit={unit} save={draft => setMessage(state.configurePreparation(side, unit.id, draft) ? '整备配置已保存，主动与被动技能已同步生效。' : '未保存：检查技能槽，最多 8 个且不能重复装配。')} /></> : <p className="pt-muted">此队伍暂无角色，请先在角色数据面板新增。</p>}
    <p className="pt-message" role="status">{message}</p>
  </fieldset>;
}
