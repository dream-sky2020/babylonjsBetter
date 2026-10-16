import type { ReactNode } from 'react';
import { useCombatStore } from '../store.ts';
import { EntityTabs } from './EntityTabs.tsx';
import { addCombatUnit } from './combatEntityActions.ts';
import type { Side } from './CombatWidgets.tsx';

export function UnitTabs({ side, disabled = false, children }: { side: Side; disabled?: boolean; children?: ReactNode }) {
  const units = useCombatStore(state => side === 'left' ? state.leftUnits : state.rightUnits);
  const selectedId = useCombatStore(state => side === 'left' ? state.selectedLeftUnitId : state.selectedRightUnitId);
  const selected = units.find(unit => unit.id === selectedId);
  return <EntityTabs label={`${side === 'left' ? '左侧' : '右侧'}单位`} items={units.map(unit => ({ id: unit.id, label: unit.name }))} selectedId={selectedId} disabled={disabled}
    onSelect={id => useCombatStore.getState().selectUnit(side, id)} onAdd={() => addCombatUnit(side)} onRemove={id => useCombatStore.getState().removeUnit(side, id)}>
    {children ?? <div className="xp-selection-summary">{selected ? `${selected.name} · HP ${selected.hp}/${selected.maxHp} · 技能 ${selected.skills.length}` : '点击“新建”添加单位。'}</div>}
  </EntityTabs>;
}

export function SkillTabs({ side, disabled = false, children }: { side: Side; disabled?: boolean; children?: ReactNode }) {
  const unit = useCombatStore(state => {
    const id = side === 'left' ? state.selectedLeftUnitId : state.selectedRightUnitId;
    return (side === 'left' ? state.leftUnits : state.rightUnits).find(item => item.id === id);
  });
  const active = unit?.skills.find(skill => skill.skillId === unit.activeSkillId);
  return <EntityTabs label={`${side === 'left' ? '左侧' : '右侧'}技能`} items={unit?.skills.map(skill => ({ id: skill.skillId, label: skill.skillName })) ?? []} selectedId={unit?.activeSkillId} disabled={disabled || !unit}
    onSelect={id => { if (unit) useCombatStore.getState().updateUnit(side, unit.id, { activeSkillId: id }); }} onAdd={() => { if (unit) useCombatStore.getState().addSkill(side, unit.id); }} onRemove={id => { if (unit) useCombatStore.getState().removeSkill(side, unit.id, id); }}>
    {children ?? <div className="xp-selection-summary">{active ? `骰子 ${active.dice.length} · 技能效果 ${active.skillEffects.length}` : unit ? '点击“新建”添加技能。' : '请先新建或选择单位。'}</div>}
  </EntityTabs>;
}
