import React from 'react';
import { OscilloscopeWrapper } from './OscilloscopeWrapper';
import type { OscilloscopeBackgroundConfig, OscilloscopePanelConfig } from './OscilloscopeMaskPanel';

export type BattleDebuff = {
  id: string;
  name: string;
  stacks?: number;
  remainingSec?: number;
};

export type BattleSkillSlotData = {
  id: string;
  roleName: string;
  skillName: string;
  charge: number;
  chargeMax: number;
  skillIcon?: string;
  isTeammate?: boolean;
  hpCurrent?: number;
  hpMax?: number;
  negativeStatuses?: BattleDebuff[];
};

export type BattleSkillSlotsPanelProps = {
  slots: BattleSkillSlotData[];
  className?: string;
  style?: React.CSSProperties;
  onUseSkill?: (slotId: string) => void;
  wrapperConfig?: Partial<OscilloscopePanelConfig>;
  wrapperBackground?: Partial<OscilloscopeBackgroundConfig>;
  waveExpand?: number;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const SLOT_CONFIG: Partial<OscilloscopePanelConfig> = {
  shapeType: 'rectangle',
  colorTheme: '#4ade80',
  lineWidth: 2.1,
  wavePreset: 'ecg_sharp',
  pointerWavePreset: 'shock',
  clearFillAlpha: 0.22,
  interactionRadius: 120
};

const SLOT_BACKGROUND: Partial<OscilloscopeBackgroundConfig> = {
  mode: 'scanline',
  gradientFrom: 'rgba(12, 28, 20, 0.9)',
  gradientTo: 'rgba(3, 10, 7, 0.98)'
};

const SkillSlotCard: React.FC<{
  slot: BattleSkillSlotData;
  onUseSkill?: (slotId: string) => void;
  wrapperConfig?: Partial<OscilloscopePanelConfig>;
  wrapperBackground?: Partial<OscilloscopeBackgroundConfig>;
  waveExpand: number;
}> = ({ slot, onUseSkill, wrapperConfig, wrapperBackground, waveExpand }) => {
  const chargeMax = Math.max(1, slot.chargeMax);
  const chargeRatio = clamp01(slot.charge / chargeMax);
  const isReady = chargeRatio >= 1;
  const hpRatio = slot.isTeammate ? clamp01((slot.hpCurrent ?? 0) / Math.max(1, slot.hpMax ?? 1)) : 0;

  return (
    <OscilloscopeWrapper
      waveExpand={waveExpand}
      config={{ ...SLOT_CONFIG, ...(wrapperConfig ?? {}) }}
      background={{ ...SLOT_BACKGROUND, ...(wrapperBackground ?? {}) }}
      lockHitAreaToHost
      contentPointerEvents="auto"
      style={{ width: '100%', minHeight: 172 }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          gap: 10,
          padding: 14,
          boxSizing: 'border-box',
          color: '#e2e8f0'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: 13, color: slot.isTeammate ? '#a7f3d0' : '#86efac' }}>
            {slot.isTeammate ? '队友槽位' : '技能槽位'} · {slot.roleName}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            {Math.floor(slot.charge)} / {chargeMax}
          </div>
        </div>

        <div
          style={{
            position: 'relative',
            border: '1px solid rgba(148, 163, 184, 0.35)',
            borderRadius: 10,
            overflow: 'hidden',
            minHeight: 74,
            background: 'rgba(2, 6, 4, 0.68)'
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, rgba(52,211,153,0.35), rgba(56,189,248,0.3))',
              opacity: isReady ? 0.95 : 0.55
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: `${(1 - chargeRatio) * 100}%`,
              background: 'rgba(2, 6, 23, 0.78)',
              borderBottom: '1px solid rgba(148, 163, 184, 0.4)',
              transition: 'height 160ms linear'
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 10
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 8,
                border: `1px solid ${isReady ? 'rgba(74,222,128,0.95)' : 'rgba(148,163,184,0.48)'}`,
                boxShadow: isReady ? '0 0 16px rgba(74,222,128,0.32)' : 'none',
                display: 'grid',
                placeItems: 'center',
                fontSize: 22,
                overflow: 'hidden',
                background: 'rgba(15, 23, 42, 0.6)'
              }}
            >
              {slot.skillIcon ? (
                <img
                  src={slot.skillIcon}
                  alt={slot.skillName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span>{slot.skillName.slice(0, 1)}</span>
              )}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{slot.skillName}</div>
              <div style={{ marginTop: 5, fontSize: 12, color: isReady ? '#86efac' : '#cbd5e1' }}>
                {isReady ? '技能已就绪，可释放' : `充能中 ${Math.round(chargeRatio * 100)}%`}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!isReady) return;
                onUseSkill?.(slot.id);
              }}
              disabled={!isReady}
              style={{
                minWidth: 74,
                height: 34,
                borderRadius: 8,
                border: `1px solid ${isReady ? 'rgba(74,222,128,0.92)' : 'rgba(100,116,139,0.7)'}`,
                background: isReady ? 'rgba(34,197,94,0.2)' : 'rgba(15,23,42,0.55)',
                color: isReady ? '#bbf7d0' : '#94a3b8',
                cursor: isReady ? 'pointer' : 'not-allowed'
              }}
            >
              释放
            </button>
          </div>
        </div>

        {slot.isTeammate ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span>队友血量</span>
                <span>
                  {slot.hpCurrent ?? 0} / {slot.hpMax ?? 0}
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 8,
                  borderRadius: 999,
                  overflow: 'hidden',
                  border: '1px solid rgba(248, 113, 113, 0.45)',
                  background: 'rgba(30, 41, 59, 0.72)'
                }}
              >
                <div
                  style={{
                    width: `${hpRatio * 100}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: 'linear-gradient(90deg, rgba(248,113,113,0.9), rgba(239,68,68,0.95))'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(slot.negativeStatuses ?? []).length > 0 ? (
                slot.negativeStatuses?.map((status) => (
                  <span
                    key={status.id}
                    style={{
                      borderRadius: 999,
                      border: '1px solid rgba(251,113,133,0.5)',
                      padding: '2px 8px',
                      fontSize: 11,
                      color: '#fecdd3',
                      background: 'rgba(69, 10, 10, 0.45)'
                    }}
                  >
                    {status.name}
                    {status.stacks ? ` x${status.stacks}` : ''}
                    {status.remainingSec ? ` · ${status.remainingSec}s` : ''}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: 11, color: '#94a3b8' }}>无负面状态</span>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </OscilloscopeWrapper>
  );
};

export const BattleSkillSlotsPanel: React.FC<BattleSkillSlotsPanelProps> = ({
  slots,
  className,
  style,
  onUseSkill,
  wrapperConfig,
  wrapperBackground,
  waveExpand = 68
}) => {
  return (
    <div
      className={className}
      style={{
        width: '100%',
        display: 'grid',
        gap: 12,
        ...style
      }}
    >
      {slots.map((slot) => (
        <SkillSlotCard
          key={slot.id}
          slot={slot}
          onUseSkill={onUseSkill}
          wrapperConfig={wrapperConfig}
          wrapperBackground={wrapperBackground}
          waveExpand={waveExpand}
        />
      ))}
    </div>
  );
};
