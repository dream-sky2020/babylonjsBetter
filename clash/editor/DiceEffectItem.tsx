import React, { useState } from 'react';
import { DAMAGE_TAGS, DICE_EFFECTS, STATUS_TYPES } from '../config.ts';
import { useCombatStore } from '../store.ts';

interface DiceEffectItemProps {
  side: 'left' | 'right';
  unitId: string;
  skillId: string;
  diceIndex: number;
  effectIndex: number;
}

export const DiceEffectItem: React.FC<DiceEffectItemProps> = ({ side, unitId, skillId, diceIndex, effectIndex }) => {
  const data = useCombatStore(state => {
    const units = side === 'left' ? state.leftUnits : state.rightUnits;
    const unit = units.find(u => u.id === unitId);
    const skill = unit?.skills.find(s => s.skillId === skillId);
    const dice = skill?.dice[diceIndex];
    return dice?.effects?.[effectIndex];
  });

  const updateDiceEffect = useCombatStore(state => state.updateDiceEffect);
  const removeDiceEffect = useCombatStore(state => state.removeDiceEffect);

  if (!data) return null;

  const onPatch = (updates: Record<string, unknown>) => {
    updateDiceEffect(side, unitId, skillId, diceIndex, effectIndex, updates);
  };

  return (
    <EffectItemContainer
      type={data.type}
      onTypeChange={(type) => {
        const effectMeta = DICE_EFFECTS.find((effect) => effect.value === type);
        if (effectMeta?.type === 'status') {
          onPatch({ type, statusId: STATUS_TYPES[0].id, power: 0, stack: 0 });
          return;
        }
        onPatch({ type, value: 0, tags: [] });
      }}
      onRemove={() => removeDiceEffect(side, unitId, skillId, diceIndex, effectIndex)}
    >
      {data.type === 'dmg' ? (
        <DamageEffectItem
          value={data.value || 0}
          tags={Array.isArray(data.tags) ? data.tags : []}
          onChange={(updates) => onPatch(updates)}
        />
      ) : (
        <StatusEffectItem
          statusId={data.statusId || STATUS_TYPES[0].id}
          power={data.power || 0}
          stack={data.stack || 0}
          onChange={(updates) => onPatch(updates)}
        />
      )}
    </EffectItemContainer>
  );
};

interface EffectItemContainerProps {
  type: string;
  children: React.ReactNode;
  onTypeChange: (type: string) => void;
  onRemove: () => void;
}

const EffectItemContainer: React.FC<EffectItemContainerProps> = ({ type, children, onTypeChange, onRemove }) => {
  return (
    <div style={{ display: 'flex', gap: '5px', alignItems: 'center', margin: '4px 0', fontSize: '14px', flexWrap: 'wrap' }}>
      <select
        value={type}
        onChange={(e) => onTypeChange(e.target.value)}
        style={{ padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
      >
        {DICE_EFFECTS.map((effect) => (
          <option key={effect.value} value={effect.value}>
            {effect.label}
          </option>
        ))}
      </select>
      {children}
      <button
        onClick={onRemove}
        style={{ padding: '4px 8px', cursor: 'pointer', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px' }}
      >
        删
      </button>
    </div>
  );
};

interface DamageEffectItemProps {
  value: number;
  tags: string[];
  onChange: (updates: Record<string, unknown>) => void;
}

const DamageEffectItem: React.FC<DamageEffectItemProps> = ({ value, tags, onChange }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleTagToggle = (tagValue: string) => {
    const nextTags = tags.includes(tagValue)
      ? tags.filter((tag) => tag !== tagValue)
      : [...tags, tagValue];
    onChange({ tags: nextTags });
  };

  return (
    <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
      <span>数值</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange({ value: parseInt(e.target.value, 10) || 0 })}
        style={{ width: '50px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
      />
      <button
        onClick={() => setIsModalOpen(true)}
        style={{ padding: '4px 8px', cursor: 'pointer', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px' }}
      >
        设置标签
      </button>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {tags.map((tagValue) => {
          const tagData = DAMAGE_TAGS.find((tag) => tag.value === tagValue);
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
      {isModalOpen && (
        <div style={{
          position: 'absolute', zIndex: 20, background: 'white', border: '1px solid #999', padding: '10px',
          textAlign: 'left', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', borderRadius: '4px',
          top: '30px', left: '10px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
            {DAMAGE_TAGS.map((tag) => (
              <label key={tag.value} style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={tags.includes(tag.value)}
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

interface StatusEffectItemProps {
  statusId: string;
  power: number;
  stack: number;
  onChange: (updates: Record<string, unknown>) => void;
}

const StatusEffectItem: React.FC<StatusEffectItemProps> = ({ statusId, power, stack, onChange }) => {
  return (
    <>
      <select
        value={statusId}
        onChange={(e) => onChange({ statusId: e.target.value })}
        style={{ padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
      >
        {STATUS_TYPES.map((status) => (
          <option key={status.id} value={status.id}>
            {status.label}
          </option>
        ))}
      </select>
      <span>强度</span>
      <input
        type="number"
        value={power}
        onChange={(e) => onChange({ power: parseInt(e.target.value, 10) || 0 })}
        style={{ width: '50px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
      />
      <span>层数</span>
      <input
        type="number"
        value={stack}
        onChange={(e) => onChange({ stack: parseInt(e.target.value, 10) || 0 })}
        style={{ width: '50px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
      />
    </>
  );
};
