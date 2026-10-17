import { STATUS_TYPES } from '../config.ts';
import { useCombatStore } from '../store.ts';
import { SkillInspector, UnitSummary, useUnit, type Side } from '../shared/CombatWidgets.tsx';
import { UnitTabs } from '../shared/CombatEntityTabs.tsx';

const fields = [
  ['hp', '生命值'], ['maxHp', '生命上限'], ['shield', '护盾'],
  ['tempShield', '临时护盾'], ['sanity', '理智'], ['maxSanity', '理智上限'],
  ['chaos', '混乱'], ['chaosThreshold', '混乱阈值'], ['speed', '当前速度'],
  ['baseSpeed', '基础速度'], ['speedModifier', '速度修正'],
] as const;

export function UnitParameters({ side }: { side: Side }) {
  const unit = useUnit(side);
  const state = useCombatStore.getState();
  return <UnitTabs side={side}><div className="xp-unit-parameters">
    {unit ? <>
      <UnitSummary side={side} />
      <div className="xp-unit-identification"><label>名称<input value={unit.name} onChange={event => state.updateUnit(side, unit.id, { name: event.target.value })} /></label><span title={unit.id}>ID: {unit.id}</span></div>
      <SkillInspector side={side} editing={false} />
      <div className="xp-parameter-table">{fields.map(([key, label]) => <label key={key}>{label}<input type="number" value={unit[key]} onChange={event => {
        const value = Number(event.target.value);
        if (!Number.isFinite(value)) return;
        const patch = { [key]: value };
        if (key === 'hp') patch.hp = Math.max(0, Math.min(unit.maxHp, value));
        if (key === 'maxHp') { patch.maxHp = Math.max(1, value); patch.hp = Math.min(unit.hp, patch.maxHp); }
        if (key === 'shield' || key === 'tempShield') patch[key] = Math.max(0, value);
        state.updateUnit(side, unit.id, patch);
      }} /></label>)}</div>
      <div className="xp-subsection"><strong>特殊状态 / {unit.status.length}</strong><button onClick={() => state.addStatus(side, unit.id)}>＋ 添加状态</button></div>
      <table className="xp-status-table"><thead><tr><th>状态类型</th><th>强度</th><th>层数</th><th>操作</th></tr></thead><tbody>{unit.status.map((status, index) => <tr key={index}>
        <td><select aria-label={`状态 ${index + 1} 类型`} value={status.type} onChange={event => state.updateStatus(side, unit.id, index, { type: event.target.value })}>{!STATUS_TYPES.some(type => type.id === status.type) && <option value={status.type}>{status.type}</option>}{STATUS_TYPES.map(type => <option value={type.id} key={type.id}>{type.label}</option>)}</select></td>
        <td><input aria-label={`状态 ${index + 1} 强度`} type="number" value={status.power} onChange={event => state.updateStatus(side, unit.id, index, { power: Number(event.target.value) || 0 })} /></td>
        <td><input aria-label={`状态 ${index + 1} 层数`} type="number" value={status.stack} onChange={event => state.updateStatus(side, unit.id, index, { stack: Number(event.target.value) || 0 })} /></td>
        <td><button aria-label={`删除状态 ${index + 1}`} onClick={() => state.removeStatus(side, unit.id, index)}>×</button></td>
      </tr>)}</tbody></table>{!unit.status.length && <div className="xp-empty-row">无状态记录</div>}
    </> : <div className="xp-empty-row">暂无单位，点击“＋ 新建”开始。</div>}
  </div></UnitTabs>;
}
