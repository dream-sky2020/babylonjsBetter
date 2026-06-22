import React from 'react';
import { useCombatStore } from '../store.ts';

interface SkillCardProps {
  side: 'left' | 'right';
  unitId: string;
  skillId: string;
}

export const SkillCard: React.FC<SkillCardProps> = ({ side, unitId, skillId }) => {
  const data = useCombatStore(state => {
    const units = side === 'left' ? state.leftUnits : state.rightUnits;
    const unit = units.find(u => u.id === unitId);
    return unit?.skills.find(s => s.skillId === skillId);
  });

  const isSelected = useCombatStore(state => {
    const units = side === 'left' ? state.leftUnits : state.rightUnits;
    const unit = units.find(u => u.id === unitId);
    return unit?.activeSkillId === skillId;
  });

  const updateUnit = useCombatStore(state => state.updateUnit);

  if (!data) return null;

  return (
    <div 
      onClick={() => updateUnit(side, unitId, { activeSkillId: skillId })}
      style={{ 
        display: 'block', 
        background: isSelected ? '#e9f5ff' : 'white', 
        borderRadius: '8px', 
        padding: '10px', 
        boxShadow: isSelected ? '0 4px 8px rgba(0,0,0,0.15)' : '0 2px 5px rgba(0,0,0,0.1)', 
        cursor: 'pointer', 
        transition: 'transform 0.2s, border-color 0.2s', 
        border: isSelected ? '2px solid #007bff' : '2px solid transparent', 
        userSelect: 'none',
        transform: isSelected ? 'translateY(-2px)' : 'none'
      }}
    >
      <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '5px', color: '#333' }}>
        {data.skillName || '新技能'}
      </div>
      <div style={{ fontSize: '12px', color: '#666' }}>
        标签: {(data.tags || []).join(', ') || '无'}
      </div>
      <div style={{ fontSize: '12px', color: '#666' }}>
        硬币数: {(data.dice || []).length}枚
      </div>
    </div>
  );
};
