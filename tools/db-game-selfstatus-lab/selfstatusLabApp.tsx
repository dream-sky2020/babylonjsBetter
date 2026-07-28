import React from 'react';
import { CharacterAvatarCard, OscilloscopeWrapper } from '@/core/ui';

// ⚠️ 保持完全不动
const rightPanelConfig = {
  shapeType: 'rectangle' as const,
  colorTheme: '#4ade80',
  lineWidth: 2.2,
  enableLineGlow: false,
  wavePreset: 'ecg_sharp' as const,
  pointerWavePreset: 'shock' as const,
  interactionRadius: 120,
  clearFillAlpha: 0.24
};

// ⚠️ 保持完全不动
const panelBackground = {
  mode: 'scanline' as const,
  gradientFrom: 'rgba(10, 32, 20, 0.86)',
  gradientTo: 'rgba(3, 10, 7, 0.98)'
};

const avatarPanelConfig = {
  shapeType: 'square' as const,
  colorTheme: '#86efac',
  lineWidth: 2.1,
  enableLineGlow: false,
  wavePreset: 'soft' as const,
  pointerWavePreset: 'shock' as const,
  interactionRadius: 130,
  clearFillAlpha: 0.2
};

const avatarBackground = {
  mode: 'solid' as const,
  solidColor: 'rgba(4, 12, 9, 0.95)'
};

const StatBar: React.FC<{ label: string; value: string; ratio: number; color: string }> = ({
  label,
  value,
  ratio,
  color
}) => {
  const width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.95 }}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div
        style={{
          width: '100%',
          height: 8,
          borderRadius: 999,
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(148, 163, 184, 0.4)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width,
            height: '100%',
            borderRadius: 999,
            background: color
          }}
        />
      </div>
    </div>
  );
};

export const DbGameSelfstatusLab: React.FC = () => {
  const WAVE_EXPAND = 80;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        boxSizing: 'border-box',
        overflow: 'hidden',
        background: '#040909',
        color: '#e2e8f0',
        fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        padding: 14
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          // 💡 1. 改为 visible，避免扩散出去的极酷炫动画光晕被页面父级裁剪掉
          overflow: 'visible'
        }}
      >
        {/* 💡 2. 原始 360px 逻辑容器：完全保留，用来锁定页面相对位置 */}
        <div
          style={{
            position: 'absolute', // 改为 absolute 或保持 relative 配套 flex/margin-left: auto
            right: 0,             // 👈 关键点：将 left: 0 改为 right: 0
            top: 0,
            width: 360,
            height: '100%',
            zIndex: 1,
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr)',
            gap: 14
          }}
        >
          <OscilloscopeWrapper
            waveExpand={WAVE_EXPAND}
            config={avatarPanelConfig}
            background={avatarBackground}
            lockHitAreaToHost
            contentPointerEvents="auto"
            style={{ width: '100%', height: 'auto', aspectRatio: '1 / 1', alignSelf: 'start' }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'grid',
                placeItems: 'center',
                padding: 20,
                boxSizing: 'border-box'
              }}
            >
              <CharacterAvatarCard displayName="晨曦" />
            </div>
          </OscilloscopeWrapper>

          <OscilloscopeWrapper
            waveExpand={WAVE_EXPAND}
            config={rightPanelConfig}
            background={panelBackground}
            lockHitAreaToHost
            contentPointerEvents="auto"
            style={{ width: '100%', height: '100%' }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                padding: 24,
                boxSizing: 'border-box',
                display: 'grid',
                gridTemplateRows: 'auto auto auto auto auto auto 1fr',
                gap: 12
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color: '#86efac' }}>人物状态</div>
              <div style={{ fontSize: 14 }}>代号：<strong>晨曦执行者</strong></div>
              <div style={{ fontSize: 12, opacity: 0.88 }}>职业：前锋 / 等级：23 / 阶段：II</div>

              <StatBar label="生命值 HP" value="1250 / 1500" ratio={1250 / 1500} color="#f87171" />
              <StatBar label="精神值 SP" value="68 / 100" ratio={0.68} color="#60a5fa" />
              <StatBar label="行动点 AP" value="4 / 6" ratio={4 / 6} color="#34d399" />

              <div
                style={{
                  marginTop: 2,
                  borderTop: '1px solid rgba(134, 239, 172, 0.35)',
                  paddingTop: 10,
                  display: 'grid',
                  gap: 6,
                  fontSize: 13
                }}
              >
                <div>攻击力：248</div>
                <div>防御力：131</div>
                <div>速度：112</div>
                <div>暴击率：21%</div>
                <div>当前状态：专注、轻伤</div>
              </div>
            </div>
          </OscilloscopeWrapper>
        </div>
      </div>
    </div>
  );
};