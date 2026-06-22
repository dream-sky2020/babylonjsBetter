import React from 'react';
import { STATUS_TYPES } from '../config.ts';
import { useCombatStore } from '../store.ts';

interface StatusEditorProps {
  side: 'left' | 'right';
  unitId: string;
  index: number;
}

export const StatusEditor: React.FC<StatusEditorProps> = ({ side, unitId, index }) => {
  const data = useCombatStore(state => {
    const units = side === 'left' ? state.leftUnits : state.rightUnits;
    const unit = units.find(u => u.id === unitId);
    return unit?.status[index];
  });

  const updateStatus = useCombatStore(state => state.updateStatus);
  const removeStatus = useCombatStore(state => state.removeStatus);

  if (!data) return null;

  return (
    <div style={{ display: 'flex', gap: '5px', alignItems: 'center', margin: '4px 0', fontSize: '14px' }}>
      <select 
        value={data.type} 
        onChange={(e) => updateStatus(side, unitId, index, { type: e.target.value })}
        style={{ padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
      >
        {STATUS_TYPES.map((status) => (
          <option key={status.id} value={status.id}>
            {status.label}
          </option>
        ))}
      </select>
      <span>层数</span>
      <input 
        type="number" 
        value={data.stack} 
        onChange={(e) => updateStatus(side, unitId, index, { stack: parseInt(e.target.value) || 0 })}
        min="0" 
        style={{ width: '50px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
      />
      <span>强度</span>
      <input 
        type="number" 
        value={data.power} 
        onChange={(e) => updateStatus(side, unitId, index, { power: parseInt(e.target.value) || 0 })}
        min="0" 
        style={{ width: '50px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
      />
      <button 
        type="button" 
        onClick={() => removeStatus(side, unitId, index)}
        style={{ padding: '4px 8px', cursor: 'pointer', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px' }}
      >
        删
      </button>
    </div>
  );
};
