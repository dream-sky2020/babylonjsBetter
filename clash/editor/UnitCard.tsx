import React from 'react';
import { useCombatStore } from '../store.ts';

interface UnitCardProps {
  side: 'left' | 'right';
  unitId: string;
}

export const UnitCard: React.FC<UnitCardProps> = ({ side, unitId }) => {
  const data = useCombatStore(state => {
    const units = side === 'left' ? state.leftUnits : state.rightUnits;
    return units.find(u => u.id === unitId);
  });
  
  const isSelected = useCombatStore(state => 
    side === 'left' ? state.selectedLeftUnitId === unitId : state.selectedRightUnitId === unitId
  );
  
  const selectUnit = useCombatStore(state => state.selectUnit);

  if (!data) return null;

  const maxHp = data.maxHp || data.hp || 1;
  const hpPercent = Math.min(100, Math.max(0, (data.hp / maxHp) * 100));
  const skills = data.skills || [];
  const activeSkillId = data.activeSkillId || skills[0]?.skillId;
  const activeSkillName = skills.find((skill) => skill.skillId === activeSkillId)?.skillName || '未选择';

  return (
    <div 
      onClick={() => selectUnit(side, unitId)}
      style={{ 
        display: 'block', 
        background: isSelected ? '#f0fff4' : 'white', 
        borderRadius: '8px', 
        padding: '10px', 
        boxShadow: isSelected ? '0 4px 8px rgba(0,0,0,0.15)' : '0 2px 5px rgba(0,0,0,0.1)', 
        cursor: 'pointer', 
        transition: 'transform 0.2s, border-color 0.2s', 
        border: isSelected ? '2px solid #28a745' : '2px solid transparent', 
        userSelect: 'none',
        transform: isSelected ? 'translateY(-2px)' : 'none'
      }}
    >
      <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '5px', color: '#333' }}>
        {data.name || '未知单位'} ({data.id || '?'})
      </div>
      <div style={{ fontSize: '12px', color: '#666', display: 'flex', gap: '10px' }}>
        <span>HP: {data.hp}/{maxHp}</span>
        <span style={{ color: '#007bff', fontWeight: 'bold' }}>SHD: {data.shield}</span>
        <span>SAN: {data.sanity}/{data.maxSanity ?? data.sanity ?? 0}</span>
      </div>
      <div style={{ marginTop: '6px', fontSize: '12px', color: '#555', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span>技能数: {skills.length}</span>
        <span style={{ color: '#6f42c1', fontWeight: 600 }}>当前出战: {activeSkillName}</span>
      </div>
      <div style={{ width: '100%', height: '4px', background: '#eee', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
        <div style={{ height: '100%', background: '#28a745', width: `${hpPercent}%` }}></div>
      </div>
    </div>
  );
};
