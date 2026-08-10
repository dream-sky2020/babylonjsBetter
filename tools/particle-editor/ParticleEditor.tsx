import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  INPUT_STEP,
  normalizePublicPath,
  type ParticleController,
  type ParticleEditorPreset,
  type ParticleVisualPreset
} from '@/core/particle';
import { useClipboardActions } from '@/hooks/particleEditor/useClipboardActions.ts';
import { useBabylonScene } from '@/hooks/particleEditor/useBabylonScene.ts';
import { useExportActions } from '@/hooks/particleEditor/useExportActions.ts';
import { useGradientManagement } from '@/hooks/particleEditor/useGradientManagement.ts';
import { useParticleController } from '@/hooks/particleEditor/useParticleController.ts';
import { usePresetManagement } from '@/hooks/particleEditor/usePresetManagement.ts';
import { hexToRgb, rgbToHex } from '@/core/utils/color.ts';
import { clamp, toFixedNumber } from '@/core/utils/math.ts';
import { CommitNumberInput } from '@/core/ui/CommitNumberInput.tsx';

const RESOURCE_IMAGE_MODULES = import.meta.glob('/public/**/*.{png,jpg,jpeg,webp,gif,avif,svg}', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>;

export const ParticleEditor: React.FC = () => {
  const particleControllerRef = useRef<ParticleController | null>(null);
  const {
    presetKeys,
    activePresetKey,
    presetSourceLabel,
    message,
    viewMode,
    preset,
    visualPreset,
    setMessage,
    setViewMode,
    setPreset,
    setVisualPreset,
    fallbackPreset,
    loadedPresetVersion,
    serverConnected,
    serverPort,
    retryServerConnection,
    refreshPresetState,
    handlePresetSelectionChange,
    saveCurrentPreset,
    importCurrentLocalPreset,
    clearCurrentPreset,
    createEffectPreset,
    duplicateEffectPreset,
    renameEffectPreset,
  } = usePresetManagement();
  const {
    colorGradientNodes,
    sizeGradientNodes,
    colorPreviewGradientCss,
    sizePreviewSamples,
    refreshGradientNodes,
    updateColorGradient,
    addColorGradient,
    removeColorGradient,
    updateSizeGradient,
    addSizeGradient,
    removeSizeGradient,
    sortColorGradientsByOffset,
    sortSizeGradientsByOffset
  } = useGradientManagement({
    initialPreset: visualPreset,
    setPreset: setVisualPreset
  });

  useEffect(() => {
    if (loadedPresetVersion > 0) {
      refreshGradientNodes(visualPreset);
    }
  }, [loadedPresetVersion, visualPreset, refreshGradientNodes]);

  const textureOptions = useMemo(() => {
    const scanned = Object.values(RESOURCE_IMAGE_MODULES).map((assetUrl) => normalizePublicPath(assetUrl));
    const merged = new Set<string>([...scanned, visualPreset.texturePath]);
    return [...merged].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [visualPreset.texturePath]);

  const updatePresetNumber = useCallback((key: keyof ParticleEditorPreset, rawValue: string, min?: number, max?: number) => {
    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) return;
    const clamped = min !== undefined && max !== undefined ? clamp(parsed, min, max) : parsed;
    setPreset((prev) => ({ ...prev, [key]: toFixedNumber(clamped) as never }));
  }, [setPreset]);

  const updatePresetVectorField = useCallback((
    vectorKey: 'direction1' | 'direction2' | 'minEmitBox' | 'maxEmitBox' | 'gravity',
    axis: 'x' | 'y' | 'z',
    rawValue: string
  ) => {
    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) return;
    setPreset((prev) => ({
      ...prev,
      [vectorKey]: { ...prev[vectorKey], [axis]: toFixedNumber(parsed) }
    }));
  }, [setPreset]);

  const updateSpriteSheetNumber = useCallback((
    key: 'cellWidth' | 'cellHeight' | 'startCellID' | 'endCellID',
    rawValue: string
  ) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    setVisualPreset((prev) => prev.spriteSheet ? ({
      ...prev,
      spriteSheet: { ...prev.spriteSheet, [key]: Math.max(key.startsWith('cell') ? 1 : 0, Math.round(value)) }
    }) : prev);
  }, [setVisualPreset]);

  const { canvasRef, sceneRef, reset3dCameraView } = useBabylonScene({
    viewMode,
    setMessage,
    particleControllerRef
  });

  const { playParticle, pauseParticle, resumeParticle, stopParticle, playbackState } = useParticleController({
    sceneRef,
    particleControllerRef,
    preset,
    visualPreset,
    setMessage
  });
  const previewConfigSignature = useMemo(() => JSON.stringify({ preset, visualPreset }), [preset, visualPreset]);
  const lastPreviewConfigSignatureRef = useRef(previewConfigSignature);

  useEffect(() => {
    if (playbackState !== 'playing') {
      lastPreviewConfigSignatureRef.current = previewConfigSignature;
      return;
    }
    if (lastPreviewConfigSignatureRef.current === previewConfigSignature) return;
    lastPreviewConfigSignatureRef.current = previewConfigSignature;
    const refreshTimer = window.setTimeout(() => playParticle(), 60);
    return () => window.clearTimeout(refreshTimer);
  }, [playParticle, playbackState, previewConfigSignature]);

  const { exportJson } = useExportActions({ setMessage });
  const { copyCurrentPreset, pastePreset } = useClipboardActions({
    preset,
    visualPreset,
    activePresetKey,
    fallbackPreset,
    refreshPresetState,
    setVisualPreset,
    setMessage
  });

  const renderDragNumberControl = (
    label: string,
    value: number,
    min: number,
    max: number,
    path: keyof ParticleEditorPreset,
    description?: string,
    compact = false
  ) => (
    <div key={String(path)} style={{ minWidth: 0, marginBottom: compact ? 0 : 10, padding: compact ? '7px 8px' : '8px 10px', borderRadius: 8, background: '#141a23' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ color: '#9fb0c5', fontSize: 12 }}>{label}</span>
        <span style={{ color: '#cdd6e1', fontSize: 12 }}>{value.toFixed(4)}</span>
      </div>
      {description ? <div style={{ color: '#6f8098', fontSize: 11, marginBottom: 6 }}>{description}</div> : null}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? 'minmax(0, 1fr) 64px' : 'minmax(0, 1fr) 88px', gap: compact ? 5 : 8, alignItems: 'center', minWidth: 0 }}>
        <input
          type="range"
          min={min}
          max={max}
          step={INPUT_STEP}
          value={value}
          onChange={(event) => updatePresetNumber(path, event.target.value, min, max)}
          style={{ width: '100%', minWidth: 0 }}
        />
        <CommitNumberInput
          step={INPUT_STEP}
          min={min}
          max={max}
          value={value}
          onCommit={(value) => updatePresetNumber(path, String(value), min, max)}
          style={{ width: '100%', minWidth: 0 }}
        />
      </div>
    </div>
  );

  const vectorControl = (
    label: string,
    vectorKey: 'direction1' | 'direction2' | 'minEmitBox' | 'maxEmitBox' | 'gravity'
  ) => (
    <div style={{ minWidth: 0, marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: '#141a23' }}>
      <div style={{ color: '#9fb0c5', fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, width: '100%', minWidth: 0 }}>
        {(['x', 'y', 'z'] as const).map((axis) => (
          <label key={`${vectorKey}.${axis}`} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <span style={{ color: '#6f8098', fontSize: 10, textTransform: 'uppercase' }}>{axis}</span>
            <CommitNumberInput
              step={INPUT_STEP}
              value={preset[vectorKey][axis]}
              onCommit={(value) => updatePresetVectorField(vectorKey, axis, String(value))}
              style={{ display: 'block', width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}
            />
          </label>
        ))}
      </div>
    </div>
  );

  const foldStyle: React.CSSProperties = {
    marginBottom: 12,
    padding: '0 10px 10px',
    border: '1px solid #303a4b',
    borderRadius: 9,
    background: '#171c25'
  };
  const summaryStyle: React.CSSProperties = {
    padding: '10px 0',
    color: '#a9bddd',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    userSelect: 'none'
  };

  return (
    <div style={{ padding: 12, height: '100vh', boxSizing: 'border-box', display: 'grid', gridTemplateColumns: 'minmax(240px, 360px) minmax(320px, 1fr) minmax(240px, 360px)', gap: 12 }}>
      <div style={{ gridColumn: 1, minWidth: 0, background: '#1a1f29', borderRadius: 12, padding: 14, overflow: 'auto' }}>
        <h2 style={{ margin: 0, marginBottom: 10 }}>L1 原生粒子特效 Lab</h2>
        <div style={{ color: '#8fa3b8', fontSize: 12, marginBottom: 10 }}>优先使用 GPUParticleSystem，不支持时自动回退到 ParticleSystem</div>
        <p style={{ marginTop: 0, color: '#9fb0c5', fontSize: 13 }}>支持实时测试、写入 config JSON、导出 JSON，并可复用到战斗场景。</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: serverConnected ? '#95d5a6' : '#f0a8a8' }}>
            服务状态：{serverConnected ? `已连接（端口 ${serverPort ?? '-'}）` : '未连接（将自动扫描 4550-4600）'}
          </div>
          <button onClick={retryServerConnection} style={{ padding: '2px 8px', fontSize: 12 }}>手动重连</button>
        </div>
        <div style={{ fontSize: 12, color: '#9fb0c5', marginBottom: 8 }}>{presetSourceLabel}</div>
        <div style={{ fontSize: 12, color: '#9fb0c5', marginBottom: 10 }}>{message}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
          <button onClick={importCurrentLocalPreset}>重新载入当前效果</button>
          <button onClick={saveCurrentPreset}>保存配置</button>
          <button onClick={exportJson}>导出 JSON</button>
          <button onClick={copyCurrentPreset}>复制当前组合配置</button>
          <button onClick={pastePreset}>从剪贴板一键导入</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
          <button onClick={playbackState === 'playing' ? pauseParticle : playbackState === 'paused' ? resumeParticle : playParticle}>
            {playbackState === 'playing' ? '暂停' : '播放'}
          </button>
          <button onClick={stopParticle} disabled={playbackState === 'stopped'}>停止</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
          <button
            onClick={() => setViewMode('2d')}
            style={{ background: viewMode === '2d' ? '#2e3f5e' : undefined }}
          >
            2D 模式
          </button>
          <button
            onClick={() => setViewMode('3d')}
            style={{ background: viewMode === '3d' ? '#2e3f5e' : undefined }}
          >
            3D 模式
          </button>
        </div>


        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <input
            id="particle-is-oneshot"
            type="checkbox"
            checked={preset.isOneShot}
            onChange={(event) => setPreset((prev) => ({ ...prev, isOneShot: event.target.checked }))}
          />
          <label htmlFor="particle-is-oneshot">单次爆发模式</label>
          <input
            id="particle-auto-dispose"
            type="checkbox"
            checked={preset.autoDispose}
            onChange={(event) => setPreset((prev) => ({ ...prev, autoDispose: event.target.checked }))}
          />
          <label htmlFor="particle-auto-dispose">自动释放</label>
        </div>
        <details open style={foldStyle}>
          <summary style={summaryStyle}>预设、纹理与图集</summary>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>选择完整粒子预设</label>
          <select
            value={activePresetKey}
            onChange={(event) => handlePresetSelectionChange(event.target.value)}
            style={{ width: '100%', marginBottom: 8, padding: '8px 10px', borderRadius: 6, border: '1px solid #3a4253', background: '#11151d', color: '#e8edf2' }}
          >
            {presetKeys.map((key) => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
            <button onClick={createEffectPreset}>新建效果预设</button>
            <button onClick={duplicateEffectPreset}>复制效果预设</button>
            <button onClick={renameEffectPreset}>重命名效果 Key</button>
            <button onClick={clearCurrentPreset}>删除效果预设</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
            <label style={{ display: 'grid', gap: 5, minWidth: 0, fontSize: 12 }}>预设 Key
              <input value={preset.presetKey} onChange={(event) => setPreset((prev) => ({ ...prev, presetKey: event.target.value }))} style={{ width: '100%', minWidth: 0 }} />
            </label>
            <label style={{ display: 'grid', gap: 5, minWidth: 0, fontSize: 12 }}>预设名
              <input value={preset.name} onChange={(event) => setPreset((prev) => ({ ...prev, name: event.target.value }))} style={{ width: '100%', minWidth: 0 }} />
            </label>
          </div>

          <div style={{ margin: '12px 0 8px', paddingTop: 12, borderTop: '1px solid #354052', color: '#90b6ff', fontWeight: 700 }}>纹理、颜色与尺寸</div>
          <div style={{ marginBottom: 8, color: '#71849b', fontSize: 11, lineHeight: 1.5 }}>视觉参数已与当前粒子效果一起切换和保存，不需要再单独选择。</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
            <label style={{ display: 'grid', gap: 5, minWidth: 0, fontSize: 12 }}>内部视觉 Key
              <input
                value={visualPreset.presetKey}
                readOnly
                style={{ width: '100%', minWidth: 0 }}
              />
            </label>
            <label style={{ display: 'grid', gap: 5, minWidth: 0, fontSize: 12 }}>视觉名称
              <input value={visualPreset.name} onChange={(event) => setVisualPreset((prev) => ({ ...prev, name: event.target.value }))} style={{ width: '100%', minWidth: 0 }} />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>颜色模式
              <select value={visualPreset.colorMode} onChange={(event) => setVisualPreset((prev) => ({ ...prev, colorMode: event.target.value as 'texture' | 'gradient' }))}>
                <option value="texture">贴图原色</option>
                <option value="gradient">颜色渐变</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>混合模式
              <select value={visualPreset.blendMode} onChange={(event) => setVisualPreset((prev) => ({ ...prev, blendMode: event.target.value as ParticleVisualPreset['blendMode'] }))}>
                <option value="alpha">Alpha 透明</option>
                <option value="add">Add 加色</option>
                <option value="multiply">Multiply 正片叠底</option>
                <option value="overwrite">Overwrite 覆盖（忽略透明度）</option>
              </select>
            </label>
          </div>
          {visualPreset.colorMode === 'texture' ? <div style={{ marginBottom: 10, color: '#8fa3b8', fontSize: 11 }}>贴图原色模式不会应用下方颜色渐变。</div> : null}

          <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>纹理路径（public 相对路径）</label>
          <input
            value={visualPreset.texturePath}
            onChange={(event) => setVisualPreset((prev) => ({ ...prev, texturePath: normalizePublicPath(event.target.value) }))}
            style={{ width: '100%', marginBottom: 8 }}
          />

          <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>纹理资源列表（自动扫描）</label>
          <select
            value={visualPreset.texturePath}
            onChange={(event) => setVisualPreset((prev) => ({ ...prev, texturePath: event.target.value }))}
            style={{ width: '100%', marginBottom: 12, padding: '8px 10px', borderRadius: 6, border: '1px solid #3a4253', background: '#11151d', color: '#e8edf2' }}
          >
            {textureOptions.map((path) => (
              <option key={path} value={path}>{path}</option>
            ))}
          </select>



          <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: '#141a23' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: visualPreset.spriteSheet ? 10 : 0 }}>
              <input
                type="checkbox"
                checked={Boolean(visualPreset.spriteSheet)}
                onChange={(event) => setVisualPreset((prev) => ({
                  ...prev,
                  spriteSheet: event.target.checked ? {
                    cellWidth: 64,
                    cellHeight: 64,
                    startCellID: 0,
                    endCellID: 0,
                    randomStartCell: true,
                    playbackMode: 'random-static',
                    framesPerSecond: 8
                  } : undefined
                }))}
              />
              使用精灵图集
            </label>
            {visualPreset.spriteSheet ? <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>单格宽度 px<input type="number" min="1" step="1" value={visualPreset.spriteSheet.cellWidth} onChange={(event) => updateSpriteSheetNumber('cellWidth', event.target.value)} /></label>
                <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>单格高度 px<input type="number" min="1" step="1" value={visualPreset.spriteSheet.cellHeight} onChange={(event) => updateSpriteSheetNumber('cellHeight', event.target.value)} /></label>
                <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>起始格编号<input type="number" min="0" step="1" value={visualPreset.spriteSheet.startCellID} onChange={(event) => updateSpriteSheetNumber('startCellID', event.target.value)} /></label>
                <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>结束格编号<input type="number" min="0" step="1" value={visualPreset.spriteSheet.endCellID} onChange={(event) => updateSpriteSheetNumber('endCellID', event.target.value)} /></label>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <input
                  type="checkbox"
                  checked={visualPreset.spriteSheet.randomStartCell}
                  onChange={(event) => setVisualPreset((prev) => prev.spriteSheet ? ({ ...prev, spriteSheet: { ...prev.spriteSheet, randomStartCell: event.target.checked } }) : prev)}
                />
                每个粒子使用随机起始帧
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                <label>播放方式
                  <select
                    value={visualPreset.spriteSheet.playbackMode}
                    onChange={(event) => setVisualPreset((prev) => prev.spriteSheet ? ({
                      ...prev,
                      spriteSheet: { ...prev.spriteSheet, playbackMode: event.target.value as 'random-static' | 'loop' }
                    }) : prev)}
                  >
                    <option value="random-static">随机静态帧</option>
                    <option value="loop">循环播放</option>
                  </select>
                </label>
                <label>播放帧率 FPS
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    disabled={visualPreset.spriteSheet.playbackMode !== 'loop'}
                    value={visualPreset.spriteSheet.framesPerSecond}
                    onChange={(event) => {
                      const framesPerSecond = Number(event.target.value);
                      if (!Number.isFinite(framesPerSecond)) return;
                      setVisualPreset((prev) => prev.spriteSheet ? ({ ...prev, spriteSheet: { ...prev.spriteSheet, framesPerSecond: Math.max(0.1, framesPerSecond) } }) : prev);
                    }}
                  />
                </label>
              </div>
              <small style={{ display: 'block', marginTop: 8, color: '#8fa3b8' }}>格子按从左到右、从上到下编号，第一格为 0。</small>
            </> : null}
          </div>
        </details>






        <details open style={foldStyle}>
          <summary style={summaryStyle}>发射与生命周期</summary>
          {renderDragNumberControl('capacity', preset.capacity, 1, 10000, 'capacity')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
            {renderDragNumberControl('minLifeTime', preset.minLifeTime, 0.01, 10, 'minLifeTime', undefined, true)}
            {renderDragNumberControl('maxLifeTime', preset.maxLifeTime, 0.01, 10, 'maxLifeTime', undefined, true)}
          </div>
          {renderDragNumberControl('emitDuration', preset.emitDuration, 0.01, 5, 'emitDuration')}
          {renderDragNumberControl('emitRate', preset.emitRate, 1, 1000, 'emitRate')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
            {renderDragNumberControl('minEmitPower', preset.minEmitPower, 0.01, 30, 'minEmitPower', undefined, true)}
            {renderDragNumberControl('maxEmitPower', preset.maxEmitPower, 0.01, 30, 'maxEmitPower', undefined, true)}
          </div>
          {renderDragNumberControl('updateSpeed', preset.updateSpeed, 0.0001, 0.5, 'updateSpeed')}
          {renderDragNumberControl('启动延迟 ms', preset.startDelayMs, 0, 10000, 'startDelayMs')}

          <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: '#141a23' }}>
            <label style={{ display: 'grid', gap: 6, color: '#9fb0c5', fontSize: 12 }}>发射器形状
              <select value={preset.emitterType} onChange={(event) => setPreset((prev) => ({ ...prev, emitterType: event.target.value as ParticleEditorPreset['emitterType'] }))}>
                <option value="box">盒形 Box</option>
                <option value="point">点 Point</option>
                <option value="sphere">球形 Sphere</option>
                <option value="hemisphere">半球 Hemisphere</option>
                <option value="cylinder">圆柱 Cylinder</option>
                <option value="cone">圆锥 Cone</option>
              </select>
            </label>
          </div>
          {(preset.emitterType === 'box' || preset.emitterType === 'point') ? <>
            {vectorControl('最小发射方向 direction1', 'direction1')}
            {vectorControl('最大发射方向 direction2', 'direction2')}
          </> : null}
          {preset.emitterType === 'box' ? <>
            {vectorControl('盒形最小边界 minEmitBox', 'minEmitBox')}
            {vectorControl('盒形最大边界 maxEmitBox', 'maxEmitBox')}
          </> : null}
          {['sphere', 'hemisphere', 'cylinder', 'cone'].includes(preset.emitterType) ? renderDragNumberControl('发射器半径', preset.emitterRadius, 0.0001, 20, 'emitterRadius') : null}
          {['sphere', 'hemisphere', 'cylinder'].includes(preset.emitterType) ? renderDragNumberControl('半径填充范围', preset.emitterRadiusRange, 0, 1, 'emitterRadiusRange') : null}
          {preset.emitterType === 'cylinder' ? <>
            {renderDragNumberControl('圆柱高度', preset.emitterHeight, 0.0001, 20, 'emitterHeight')}
            {renderDragNumberControl('方向随机度', preset.emitterDirectionRandomizer, 0, 1, 'emitterDirectionRandomizer')}
          </> : null}
          {preset.emitterType === 'cone' ? renderDragNumberControl('圆锥角度 °', preset.emitterAngleDeg, 0.1, 179, 'emitterAngleDeg') : null}
        </details>

      </div>

      <div style={{ gridColumn: 3, minWidth: 0, background: '#1a1f29', borderRadius: 12, padding: 14, overflow: 'auto' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>参数调整</h2>
        <details open style={foldStyle}>
          <summary style={summaryStyle}>运动、旋转与拉伸</summary>
          {vectorControl('重力 gravity', 'gravity')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
            {renderDragNumberControl('最小初始旋转 °', preset.minInitialRotationDeg, -360, 360, 'minInitialRotationDeg', undefined, true)}
            {renderDragNumberControl('最大初始旋转 °', preset.maxInitialRotationDeg, -360, 360, 'maxInitialRotationDeg', undefined, true)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
            {renderDragNumberControl('最小旋转速度 °/s', preset.minAngularSpeedDeg, -1440, 1440, 'minAngularSpeedDeg', undefined, true)}
            {renderDragNumberControl('最大旋转速度 °/s', preset.maxAngularSpeedDeg, -1440, 1440, 'maxAngularSpeedDeg', undefined, true)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
            {renderDragNumberControl('最小横向缩放 X', preset.minScaleX, 0.01, 10, 'minScaleX', undefined, true)}
            {renderDragNumberControl('最大横向缩放 X', preset.maxScaleX, 0.01, 10, 'maxScaleX', undefined, true)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
            {renderDragNumberControl('最小纵向缩放 Y', preset.minScaleY, 0.01, 10, 'minScaleY', undefined, true)}
            {renderDragNumberControl('最大纵向缩放 Y', preset.maxScaleY, 0.01, 10, 'maxScaleY', undefined, true)}
          </div>
        </details>

        <details style={foldStyle}>
          <summary style={summaryStyle}>渲染与预热（高级）</summary>
          <div style={{ display: 'grid', gap: 8, marginBottom: 10, padding: 10, borderRadius: 8, background: '#141a23' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><input type="checkbox" checked={preset.forceDepthWrite} onChange={(event) => setPreset((prev) => ({ ...prev, forceDepthWrite: event.target.checked }))} />强制写入深度</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><input type="checkbox" checked={preset.applyFog} onChange={(event) => setPreset((prev) => ({ ...prev, applyFog: event.target.checked }))} />受场景雾影响</label>
            </div>
            <label style={{ display: 'grid', gap: 6 }}>Billboard 朝向<select value={preset.billboardMode} onChange={(event) => setPreset((prev) => ({ ...prev, billboardMode: event.target.value as ParticleEditorPreset['billboardMode'] }))}><option value="all">始终面向相机</option><option value="y">仅绕 Y 轴</option><option value="stretched">沿速度方向拉伸</option></select></label>
          </div>
          {renderDragNumberControl('预热循环次数', preset.preWarmCycles, 0, 500, 'preWarmCycles')}
          {renderDragNumberControl('预热步长倍率', preset.preWarmStepOffset, 0, 5, 'preWarmStepOffset')}
          {renderDragNumberControl('渲染组 ID', preset.renderingGroupId, 0, 3, 'renderingGroupId')}
        </details>

        <details open style={foldStyle}>
          <summary style={summaryStyle}>基础外观</summary>
          <div style={{ marginBottom: 4, padding: 10, borderRadius: 8, background: '#141a23' }}>
            <div style={{ color: '#9fb0c5', fontSize: 13, fontWeight: 'bold', marginBottom: 10 }}>基础外观</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <label>最小随机尺寸
                <CommitNumberInput
                  min={0.0001}
                  step={INPUT_STEP}
                  value={visualPreset.minSize}
                  onCommit={(value) => setVisualPreset((prev) => {
                    const minSize = Math.max(0.0001, value);
                    const maxSize = Math.max(minSize, prev.maxSize);
                    return { ...prev, minSize, maxSize, baseSize: (minSize + maxSize) / 2 };
                  })}
                />
              </label>
              <label>最大随机尺寸
                <CommitNumberInput
                  min={visualPreset.minSize}
                  step={INPUT_STEP}
                  value={visualPreset.maxSize}
                  onCommit={(value) => setVisualPreset((prev) => {
                    const maxSize = Math.max(prev.minSize, value);
                    return { ...prev, maxSize, baseSize: (prev.minSize + maxSize) / 2 };
                  })}
                />
              </label>
              <label>基础颜色
                <input
                  type="color"
                  value={rgbToHex(visualPreset.baseColor.r, visualPreset.baseColor.g, visualPreset.baseColor.b)}
                  onChange={(event) => {
                    const color = hexToRgb(event.target.value);
                    setVisualPreset((prev) => ({ ...prev, baseColor: { ...prev.baseColor, ...color } }));
                  }}
                  style={{ width: '100%', height: 30, padding: 0 }}
                />
              </label>
              <label style={{ display: 'grid', gap: 5 }}>基础透明度 ({visualPreset.baseColor.a.toFixed(2)})
                <input
                  type="range"
                  min="0"
                  max="1"
                  step={INPUT_STEP}
                  value={visualPreset.baseColor.a}
                  onChange={(event) => setVisualPreset((prev) => ({ ...prev, baseColor: { ...prev.baseColor, a: Number(event.target.value) } }))}
                />
              </label>
            </div>
          </div>
        </details>

        <details open style={foldStyle}>
          <summary style={summaryStyle}>颜色渐变</summary>
          <div style={{ marginBottom: 4, padding: '10px', borderRadius: 8, background: '#141a23' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9fb0c5', fontSize: 13, fontWeight: 'bold' }}>
                <input type="checkbox" checked={visualPreset.colorGradientsEnabled} onChange={(event) => setVisualPreset((prev) => ({ ...prev, colorGradientsEnabled: event.target.checked }))} />
                颜色渐变 (Color Gradients)
              </label>
              <button disabled={!visualPreset.colorGradientsEnabled} onClick={addColorGradient} style={{ padding: '4px 8px', fontSize: 12, background: '#2e3f5e', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer' }}>+ 添加节点</button>
            </div>
            {visualPreset.colorGradientsEnabled ? <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ color: '#6f8098', fontSize: 11, marginBottom: 4 }}>渐变预览</div>
                <div style={{ height: 18, borderRadius: 6, border: '1px solid #364155', background: colorPreviewGradientCss }} />
              </div>
              {colorGradientNodes.map((grad) => (
                <div key={grad.id} style={{ display: 'grid', gap: 8, marginBottom: 8, background: '#1a1f29', padding: '8px', borderRadius: 6 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 10, color: '#6f8098', marginBottom: 4 }}>Offset</span>
                      <input
                        type="range"
                        step={INPUT_STEP}
                        min={0}
                        max={1}
                        value={grad.offset}
                        onChange={(e) => updateColorGradient(grad.id, 'offset', e.target.value)}
                        onMouseUp={sortColorGradientsByOffset}
                        onTouchEnd={sortColorGradientsByOffset}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 10, color: '#6f8098', marginBottom: 4 }}>Offset 数值</span>
                      <CommitNumberInput
                        step={INPUT_STEP}
                        min={0}
                        max={1}
                        value={grad.offset}
                        onCommit={(value) => { updateColorGradient(grad.id, 'offset', String(value)); window.requestAnimationFrame(sortColorGradientsByOffset); }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '52px minmax(0, 1fr) auto', gap: 8, alignItems: 'end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 10, color: '#6f8098', marginBottom: 4 }}>颜色</span>
                      <input
                        type="color"
                        value={rgbToHex(grad.color.r, grad.color.g, grad.color.b)}
                        onChange={(e) => updateColorGradient(grad.id, 'colorHex', e.target.value)}
                        style={{ padding: 0, width: '100%', height: 28, border: 'none', cursor: 'pointer', background: 'transparent' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 10, color: '#6f8098', marginBottom: 4 }}>Alpha ({grad.color.a.toFixed(2)})</span>
                      <input
                        type="range"
                        step={INPUT_STEP}
                        min={0}
                        max={1}
                        value={grad.color.a}
                        onChange={(e) => updateColorGradient(grad.id, 'alpha', e.target.value)}
                      />
                    </div>
                    <button
                      onClick={() => removeColorGradient(grad.id)}
                      style={{ background: 'transparent', border: '1px solid #5e2e2e', color: '#ff6b6b', padding: '4px 8px', borderRadius: 4, height: 28, cursor: 'pointer' }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </> : <small style={{ color: '#6f8098' }}>已关闭，将使用上方的基础颜色和透明度。</small>}
          </div>
        </details>

        <details open style={foldStyle}>
          <summary style={summaryStyle}>尺寸渐变</summary>
          <div style={{ marginBottom: 4, padding: '10px', borderRadius: 8, background: '#141a23' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9fb0c5', fontSize: 13, fontWeight: 'bold' }}>
                <input type="checkbox" checked={visualPreset.sizeGradientsEnabled} onChange={(event) => setVisualPreset((prev) => ({ ...prev, sizeGradientsEnabled: event.target.checked }))} />
                尺寸渐变 (Size Gradients)
              </label>
              <button disabled={!visualPreset.sizeGradientsEnabled} onClick={addSizeGradient} style={{ padding: '4px 8px', fontSize: 12, background: '#2e3f5e', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer' }}>+ 添加节点</button>
            </div>
            {visualPreset.sizeGradientsEnabled ? <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ color: '#6f8098', fontSize: 11, marginBottom: 4 }}>曲线预览</div>
                <svg viewBox="0 0 100 32" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 42, borderRadius: 6, border: '1px solid #364155', background: '#11151d' }}>
                  <line x1="0" y1="16" x2="100" y2="16" stroke="#263246" strokeWidth="0.5" />
                  <polyline
                    points={sizePreviewSamples.map((normalized, index) => `${(index / Math.max(1, sizePreviewSamples.length - 1)) * 100},${29 - normalized * 26}`).join(' ')}
                    fill="none"
                    stroke="#76a7ff"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>
              {sizeGradientNodes.map((grad) => (
                <div key={grad.id} style={{ display: 'grid', gap: 8, marginBottom: 8, background: '#1a1f29', padding: '8px', borderRadius: 6 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 82px', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 10, color: '#6f8098', marginBottom: 4 }}>Offset</span>
                      <input
                        type="range"
                        step={INPUT_STEP}
                        min={0}
                        max={1}
                        value={grad.offset}
                        onChange={(e) => updateSizeGradient(grad.id, 'offset', Number(e.target.value))}
                        onMouseUp={sortSizeGradientsByOffset}
                        onTouchEnd={sortSizeGradientsByOffset}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 10, color: '#6f8098', marginBottom: 4 }}>Offset 数值</span>
                      <CommitNumberInput
                        step={INPUT_STEP}
                        min={0}
                        max={1}
                        value={grad.offset}
                        onCommit={(value) => { updateSizeGradient(grad.id, 'offset', value); window.requestAnimationFrame(sortSizeGradientsByOffset); }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 82px auto', gap: 8, alignItems: 'end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 10, color: '#6f8098', marginBottom: 4 }}>Size</span>
                      <input
                        type="range"
                        step={INPUT_STEP}
                        min={0.0001}
                        max={10}
                        value={grad.size}
                        onChange={(e) => updateSizeGradient(grad.id, 'size', Number(e.target.value))}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 10, color: '#6f8098', marginBottom: 4 }}>Size 数值</span>
                      <CommitNumberInput
                        step={INPUT_STEP}
                        min={0.0001}
                        value={grad.size}
                        onCommit={(value) => updateSizeGradient(grad.id, 'size', value)}
                      />
                    </div>
                    <button
                      onClick={() => removeSizeGradient(grad.id)}
                      style={{ background: 'transparent', border: '1px solid #5e2e2e', color: '#ff6b6b', padding: '4px 8px', borderRadius: 4, height: 28, cursor: 'pointer' }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </> : <small style={{ color: '#6f8098' }}>已关闭，将使用上方的基础尺寸。</small>}
          </div>
        </details>
      </div>

      <div style={{ gridColumn: 2, gridRow: 1, minWidth: 0, background: '#1a1f29', borderRadius: 12, padding: 12, position: 'relative', minHeight: 0 }}>
        <div style={{ marginBottom: 8, color: '#9fb0c5', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span>Babylon 实时预览：当前为 {viewMode.toUpperCase()} 模式，原点球体为发射位置。</span>
          {viewMode === '3d' ? (
            <button onClick={reset3dCameraView}>视角回到原点</button>
          ) : null}
        </div>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: 'calc(100% - 26px)',
            minHeight: 520,
            background: '#0f1319',
            borderRadius: 8,
            display: 'block'
          }}
        />
      </div>
    </div>
  );
};
