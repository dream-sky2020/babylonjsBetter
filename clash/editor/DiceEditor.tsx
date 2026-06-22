import React, { useState } from 'react';
import { DICE_TAGS } from '../config.ts';
import { useCombatStore } from '../store.ts';
import { DiceEffectItem } from './DiceEffectItem.tsx';

interface DiceEditorProps {
  side: 'left' | 'right';
  unitId: string;
  skillId: string;
  diceIndex: number;
}

export const DiceEditor: React.FC<DiceEditorProps> = ({ side, unitId, skillId, diceIndex }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const data = useCombatStore(state => {
    const units = side === 'left' ? state.leftUnits : state.rightUnits;
    const unit = units.find(u => u.id === unitId);
    const skill = unit?.skills.find(s => s.skillId === skillId);
    return skill?.dice[diceIndex];
  });

  const updateDice = useCombatStore(state => state.updateDice);
  const removeDice = useCombatStore(state => state.removeDice);
  const addDiceEffect = useCombatStore(state => state.addDiceEffect);

  if (!data) return null;

  const handleTagToggle = (tagValue: string) => {
    const newTags = data.tags.includes(tagValue)
      ? data.tags.filter((t) => t !== tagValue)
      : [...data.tags, tagValue];
    updateDice(side, unitId, skillId, diceIndex, { tags: newTags });
  };

  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', margin: '4px 0', 
      fontSize: '14px', padding: '5px', border: '1px solid #ccc', borderRadius: '4px',
      position: 'relative', width: '100%', boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
        <button 
          onClick={() => setIsModalOpen(true)}
          style={{ padding: '4px 8px', cursor: 'pointer', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          设置标签
        </button>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {data.tags.map((tagValue) => {
            const tagData = DICE_TAGS.find((t) => t.value === tagValue);
            return (
              <span key={tagValue} style={{ background: '#e0e0e0', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', color: '#333' }}>
                {tagData?.label || tagValue}
                <span 
                  onClick={() => handleTagToggle(tagValue)}
                  style={{ marginLeft: '4px', cursor: 'pointer', color: '#e74c3c', fontWeight: 'bold' }}
                >
                  ×
                </span>
              </span>
            );
          })}
        </div>
        <button 
          onClick={() => removeDice(side, unitId, skillId, diceIndex)}
          style={{ padding: '4px 8px', cursor: 'pointer', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', marginLeft: 'auto' }}
        >
          删除面
        </button>
      </div>
      
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
        <span>最小</span>
        <input 
          type="number" 
          value={data.min} 
          onChange={(e) => updateDice(side, unitId, skillId, diceIndex, { min: parseInt(e.target.value) || 0 })}
          style={{ width: '50px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        <span>最大</span>
        <input 
          type="number" 
          value={data.max} 
          onChange={(e) => updateDice(side, unitId, skillId, diceIndex, { max: parseInt(e.target.value) || 0 })}
          style={{ width: '50px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
        />
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
        {(data.effects || []).map((_, index) => (
          <DiceEffectItem 
            key={index} 
            side={side}
            unitId={unitId}
            skillId={skillId}
            diceIndex={diceIndex}
            effectIndex={index}
          />
        ))}
      </div>
      <button 
        onClick={() => addDiceEffect(side, unitId, skillId, diceIndex)}
        style={{ marginTop: '5px', padding: '4px 8px', cursor: 'pointer', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px' }}
      >
        + 添加效果
      </button>

      {isModalOpen && (
        <div style={{ 
          position: 'absolute', zIndex: 10, background: 'white', border: '1px solid #999', padding: '10px', 
          textAlign: 'left', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', borderRadius: '4px',
          top: '30px', left: '10px'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '5px' }}>
            {DICE_TAGS.map((tag) => (
              <label key={tag.value} style={{ fontSize: '14px' }}>
                <input 
                  type="checkbox" 
                  checked={data.tags.includes(tag.value)} 
                  onChange={() => handleTagToggle(tag.value)}
                /> {tag.label}
              </label>
            ))}
          </div>
          <button 
            onClick={() => setIsModalOpen(false)}
            style={{ marginTop: '10px', width: '100%', padding: '4px 8px', cursor: 'pointer', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            确认
          </button>
        </div>
      )}
    </div>
  );
};
