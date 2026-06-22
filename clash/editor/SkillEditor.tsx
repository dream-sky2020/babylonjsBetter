import React from 'react';
import { useCombatStore } from '../store.ts';
import { DiceEditor } from './DiceEditor.tsx';
import { SkillEffectItem } from './SkillEffectItem.tsx';

interface SkillEditorProps {
  side: 'left' | 'right';
  unitId: string;
  skillId: string;
}

export const SkillEditor: React.FC<SkillEditorProps> = ({ side, unitId, skillId }) => {
  const data = useCombatStore(state => {
    const units = side === 'left' ? state.leftUnits : state.rightUnits;
    const unit = units.find(u => u.id === unitId);
    return unit?.skills.find(s => s.skillId === skillId);
  });

  const updateSkill = useCombatStore(state => state.updateSkill);
  const removeSkill = useCombatStore(state => state.removeSkill);
  const addDice = useCombatStore(state => state.addDice);
  const addSkillEffect = useCombatStore(state => state.addSkillEffect);

  if (!data) return null;

  return (
    <div style={{ background: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '15px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0 }}>技能: {data.skillId}</h3>
        <button 
          onClick={() => removeSkill(side, unitId, skillId)}
          style={{ width: 'auto', margin: 0, background: '#dc3545', color: 'white', padding: '4px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          删除技能
        </button>
      </div>
      
      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
        名称: 
        <input 
          type="text" 
          value={data.skillName} 
          onChange={(e) => updateSkill(side, unitId, skillId, { skillName: e.target.value })}
          style={{ padding: '4px', border: '1px solid #ccc', borderRadius: '4px', flex: 1, marginLeft: '10px' }}
        />
      </div>
      
      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
        标签(逗号分隔): 
        <input 
          type="text" 
          value={data.tags.join(', ')} 
          onChange={(e) => updateSkill(side, unitId, skillId, { tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
          style={{ padding: '4px', border: '1px solid #ccc', borderRadius: '4px', flex: 1, marginLeft: '10px' }}
        />
      </div>
      
      <div style={{ margin: '12px 0 8px', fontWeight: 600, color: '#333', borderBottom: '1px solid #eee', paddingBottom: '4px', fontSize: '14px' }}>
        硬币面板 (骰子)
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {data.dice.map((_, index) => (
          <DiceEditor 
            key={index} 
            side={side}
            unitId={unitId}
            skillId={skillId}
            diceIndex={index}
          />
        ))}
      </div>
      <button 
        onClick={() => addDice(side, unitId, skillId)}
        style={{ width: '100%', padding: '8px', marginTop: '8px', cursor: 'pointer', border: '1px dashed #ccc', borderRadius: '4px', fontSize: '12px', background: '#f0f0f0', color: '#333' }}
      >
        + 添加硬币
      </button>

      <div style={{ margin: '12px 0 8px', fontWeight: 600, color: '#333', borderBottom: '1px solid #eee', paddingBottom: '4px', fontSize: '14px' }}>
        全局技能效果
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {data.skillEffects.map((_, index) => (
          <SkillEffectItem 
            key={index} 
            side={side}
            unitId={unitId}
            skillId={skillId}
            effectIndex={index}
          />
        ))}
      </div>
      <button 
        onClick={() => addSkillEffect(side, unitId, skillId)}
        style={{ width: '100%', padding: '8px', marginTop: '8px', cursor: 'pointer', border: '1px dashed #ccc', borderRadius: '4px', fontSize: '12px', background: '#f0f0f0', color: '#333' }}
      >
        + 添加技能效果
      </button>
    </div>
  );
};
