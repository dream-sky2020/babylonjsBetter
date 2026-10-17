import { useEffect, useRef } from 'react';
import { useCombatStore } from '../store.ts';
import { SkillEditor } from '../editor/SkillEditor.tsx';
import { UnitTabs, SkillTabs } from './CombatEntityTabs.tsx';
export type Side = 'left' | 'right';

export function useUnit(side: Side) {
  return useCombatStore(state => {
    const id = side === 'left' ? state.selectedLeftUnitId : state.selectedRightUnitId;
    return (side === 'left' ? state.leftUnits : state.rightUnits).find(unit => unit.id === id);
  });
}

export function UnitSummary({ side }: { side: Side }) {
  const unit = useUnit(side);
  if (!unit) return <p>请选择出战单位。</p>;
  return <div className={`clash-unit clash-unit--${side}`}>
    <div className="clash-eyebrow">{side === 'left' ? 'LEFT TEAM' : 'RIGHT TEAM'}</div>
    <h2>{unit.name}</h2>
    <div className="clash-hp"><strong>{unit.hp}</strong><span>/ {unit.maxHp} HP</span></div>
    <progress aria-label={`${unit.name}生命值`} value={unit.hp} max={Math.max(1, unit.maxHp)} />
    <div className="clash-unit-meta"><span>护盾 {unit.shield}</span><span>临时护盾 {unit.tempShield}</span><span>速度 {unit.speed}</span></div>
    <div className="clash-statuses">{unit.status.length ? unit.status.map((status, index) => <span key={index}>{status.type} · {status.power} × {status.stack}</span>) : <span>无附加状态</span>}</div>
  </div>;
}

export function UnitControls({ side, editing }: { side: Side; editing: boolean }) {
  const unit = useUnit(side);
  const update = useCombatStore(state => state.updateUnit);
  return <fieldset className="clash-controls" disabled={editing}><UnitTabs side={side} disabled={editing}>
    <SkillTabs side={side} disabled={editing} />
    {unit ? <div className="clash-number-grid">{(['hp', 'shield', 'tempShield'] as const).map((key, index) => <label key={key}>{['生命值', '护盾', '临时护盾'][index]}<input type="number" min={0} max={key === 'hp' ? unit.maxHp : undefined} value={unit[key]} onChange={event => update(side, unit.id, { [key]: Math.max(0, Math.min(key === 'hp' ? unit.maxHp : Infinity, Number(event.target.value) || 0)) })} /></label>)}</div> : <p>点击“新建”添加单位。</p>}
    </UnitTabs>
  </fieldset>;
}

export function BattleLog({ height }: { height: number }) {
  const logs = useCombatStore(state => state.logs);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs.length]);
  return <div ref={ref} className="clash-log" role="log" style={{ height }}>{logs.length ? logs.map((log, i) => <div key={i}><span>{String(i + 1).padStart(3, '0')}</span>{log}</div>) : <p>等待第一次拼点。运行界面中点击「开启拼点」查看结果。</p>}</div>;
}

export function SkillInspector({ side, editing }: { side: Side; editing: boolean }) {
  const unit = useUnit(side);
  return <fieldset disabled={editing} className="clash-controls"><SkillTabs side={side} disabled={editing}>{unit?.activeSkillId ? <SkillEditor key={unit.activeSkillId} side={side} unitId={unit.id} skillId={unit.activeSkillId} hideDelete /> : <p>{unit ? '点击“新建”添加出战技能。' : '请先新建或选择单位。'}</p>}</SkillTabs></fieldset>;
}

