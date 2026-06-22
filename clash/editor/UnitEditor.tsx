import React from 'react';
import { useCombatStore } from '../store.ts';
import { StatusEditor } from './StatusEditor.tsx';
import type { UnitConfig } from '../types.ts';

interface UnitEditorProps {
  side: 'left' | 'right';
  unitId: string;
  isSelected?: boolean;
}

export const UnitEditor: React.FC<UnitEditorProps> = ({ side, unitId, isSelected }) => {
  const data = useCombatStore(state => {
    const units = side === 'left' ? state.leftUnits : state.rightUnits;
    return units.find(u => u.id === unitId);
  });

  const updateUnit = useCombatStore(state => state.updateUnit);
  const removeUnit = useCombatStore(state => state.removeUnit);
  const addStatus = useCombatStore(state => state.addStatus);

  if (!data) return null;

  const handleChange = (field: keyof UnitConfig, value: any) => {
    updateUnit(side, unitId, { [field]: value });
  };

  return (
    <div style={{ 
      display: 'block', 
      background: isSelected ? '#f8fff9' : 'white', 
      padding: '15px', 
      borderRadius: '12px', 
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)', 
      marginBottom: '15px',
      border: isSelected ? '2px solid #28a745' : '2px solid transparent'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0 }}>单位 {data.id}</h3>
        <button 
          onClick={() => removeUnit(side, unitId)}
          style={{ width: 'auto', margin: 0, background: '#dc3545', color: 'white', padding: '4px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          删除单位
        </button>
      </div>
      
      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
        名称: 
        <input 
          type="text" 
          value={data.name} 
          onChange={(e) => handleChange('name', e.target.value)}
          style={{ width: '100px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
        />
      </div>
      
      {[
        { label: '血量', field: 'hp' },
        { label: '最大血量', field: 'maxHp' },
        { label: '护盾', field: 'shield' },
        { label: '临时护盾', field: 'tempShield' },
        { label: '理智', field: 'sanity' },
        { label: '最大理智', field: 'maxSanity' },
        { label: '混乱值', field: 'chaos' },
        { label: '混乱阈值', field: 'chaosThreshold' },
      ].map((item) => (
        <div key={item.field} style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
          {item.label}: 
          <input 
            type="number" 
            value={data[item.field as keyof UnitConfig] as number} 
            onChange={(e) => handleChange(item.field as keyof UnitConfig, parseInt(e.target.value) || 0)}
            style={{ width: '60px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>
      ))}
      
      <div style={{ margin: '12px 0 8px', fontWeight: 600, color: '#333', borderBottom: '1px solid #eee', paddingBottom: '4px', fontSize: '14px' }}>
        特殊状态
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {data.status.map((_, index) => (
          <StatusEditor 
            key={index} 
            side={side}
            unitId={unitId}
            index={index}
          />
        ))}
      </div>
      <button 
        onClick={() => addStatus(side, unitId)}
        style={{ width: '100%', padding: '8px', marginTop: '8px', cursor: 'pointer', border: '1px dashed #ccc', borderRadius: '4px', fontSize: '12px', background: '#f0f0f0', color: '#333' }}
      >
        + 添加特殊状态
      </button>
    </div>
  );
};
