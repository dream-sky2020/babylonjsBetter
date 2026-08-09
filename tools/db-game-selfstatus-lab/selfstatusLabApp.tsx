import React, { useEffect, useMemo, useState } from 'react';
import { ConfigurableAvatar, OscilloscopeWrapper, type AvatarExpressionConfig } from '@/core/ui';
import { joinPublicPath, normalizePublicPath, type TexturePackerAtlas } from '@/core/sprite';
import { requestDevServer } from '@/core/network/devServerPortResolver.ts';

type AvatarCharacterConfig = { id: string; name: string; expressions: AvatarExpressionConfig[] };
type AvatarConfigMap = Record<string, AvatarCharacterConfig>;

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
  const [avatarConfigs, setAvatarConfigs] = useState<AvatarConfigMap>({});
  const [characterId, setCharacterId] = useState('');
  const [expressionId, setExpressionId] = useState('');
  const [atlas, setAtlas] = useState<TexturePackerAtlas | null>(null);
  const [avatarMessage, setAvatarMessage] = useState('正在读取头像配置…');
  const character = avatarConfigs[characterId];
  const expression = character?.expressions.find((item) => item.id === expressionId) ?? character?.expressions[0];

  useEffect(() => {
    void (async () => {
      try {
        let response = await fetch(`/config/avatarConfigs.json?t=${Date.now()}`, { cache: 'no-store' });
        let payload: AvatarConfigMap;
        if (response.ok) payload = await response.json() as AvatarConfigMap;
        else {
          response = await requestDevServer(`/api/avatar-configs?t=${Date.now()}`, { method: 'GET' });
          const serverPayload = await response.json();
          if (!response.ok || serverPayload.success === false) throw new Error(serverPayload.message || `HTTP ${response.status}`);
          payload = serverPayload.data as AvatarConfigMap;
        }
        const ids = Object.keys(payload);
        if (!ids.length) throw new Error('尚未保存任何头像配置');
        const firstId = ids[0];
        setAvatarConfigs(payload);
        setCharacterId(firstId);
        setExpressionId(payload[firstId].expressions[0]?.id ?? '');
        setAvatarMessage(`已读取 ${ids.length} 个角色`);
      } catch (error) { setAvatarMessage(`头像配置读取失败：${String(error)}`); }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      if (!expression?.atlas?.jsonPath) { setAtlas(null); return; }
      try {
        const response = await fetch(encodeURI(`/${normalizePublicPath(expression.atlas.jsonPath)}`));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setAtlas(await response.json() as TexturePackerAtlas);
      } catch (error) { setAtlas(null); setAvatarMessage(`头像图集读取失败：${String(error)}`); }
    })();
  }, [expression]);

  const resolvedExpression = useMemo<AvatarExpressionConfig | undefined>(() => {
    if (!expression || !expression.atlas || !atlas) return expression;
    return { ...expression, imagePath: joinPublicPath(expression.atlas.jsonPath, atlas.meta.image) };
  }, [atlas, expression]);
  const resolvedAtlasFrame = expression?.atlas && atlas?.frames[expression.atlas.frameName]
    ? { frame: atlas.frames[expression.atlas.frameName].frame, atlasSize: atlas.meta.size }
    : undefined;

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
            right: 0,
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
            <ConfigurableAvatar
              expression={resolvedExpression}
              atlasFrame={resolvedAtlasFrame}
              fallbackText={character?.name.slice(0, 2) || '晨曦'}
              aria-label={`${character?.name || '晨曦'}头像`}
            />
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

        <aside
          style={{
            position: 'absolute', left: 0, top: 0, width: 290, boxSizing: 'border-box', padding: 16,
            border: '1px solid rgba(134, 239, 172, 0.42)', borderRadius: 12,
            background: 'rgba(8, 20, 15, 0.96)',
            display: 'grid', gap: 12, zIndex: 2
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: '#86efac' }}>头像预览控制</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{avatarMessage}</div>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            角色
            <select
              value={characterId}
              disabled={!Object.keys(avatarConfigs).length}
              onChange={(event) => {
                const nextId = event.target.value;
                setCharacterId(nextId);
                setExpressionId(avatarConfigs[nextId]?.expressions[0]?.id ?? '');
              }}
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #365247', background: '#07110d', color: '#e2e8f0' }}
            >
              {!Object.keys(avatarConfigs).length ? <option value="">无可用角色</option> : null}
              {Object.values(avatarConfigs).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            表情
            <select
              value={expression?.id ?? ''}
              disabled={!character?.expressions.length}
              onChange={(event) => setExpressionId(event.target.value)}
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #365247', background: '#07110d', color: '#e2e8f0' }}
            >
              {!character?.expressions.length ? <option value="">无可用表情</option> : null}
              {character?.expressions.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}
            </select>
          </label>
          <div style={{ paddingTop: 10, borderTop: '1px solid rgba(134, 239, 172, 0.2)', color: '#789386', fontSize: 11, lineHeight: 1.6 }}>
            此处只能切换预览。角色、表情、图片及偏移请在 Avatar Visual Lab 中修改。
          </div>
        </aside>
      </div>
    </div>
  );
};
