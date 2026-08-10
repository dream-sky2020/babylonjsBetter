import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  INPUT_STEP,
  normalizePublicPath,
  type ParticleController,
  type ParticleEditorPreset
} from '@/core/particle';
import { useClipboardActions } from '@/hooks/particleEditor/useClipboardActions.ts';
import { useBabylonScene } from '@/hooks/particleEditor/useBabylonScene.ts';
import { useExportActions } from '@/hooks/particleEditor/useExportActions.ts';
import { useGradientManagement } from '@/hooks/particleEditor/useGradientManagement.ts';
import { useParticleController } from '@/hooks/particleEditor/useParticleController.ts';
import { usePresetManagement } from '@/hooks/particleEditor/usePresetManagement.ts';
import { rgbToHex } from '@/core/utils/color.ts';
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
    visualPresetKeys,
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
    handleVisualPresetSelectionChange,
    saveCurrentPreset,
    importCurrentLocalPreset,
    clearCurrentPreset,
    createEffectPreset,
    duplicateEffectPreset,
    renameEffectPreset,
    createVisualPreset,
    duplicateVisualPreset,
    renameVisualPreset,
    deleteVisualPreset
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
    vectorKey: 'direction1' | 'direction2' | 'minEmitBox' | 'maxEmitBox',
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
    description?: string
  ) => (
    <div key={String(path)} style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: '#141a23' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ color: '#9fb0c5', fontSize: 12 }}>{label}</span>
        <span style={{ color: '#cdd6e1', fontSize: 12 }}>{value.toFixed(4)}</span>
      </div>
      {description ? <div style={{ color: '#6f8098', fontSize: 11, marginBottom: 6 }}>{description}</div> : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 88px', gap: 8, alignItems: 'center' }}>
        <input
          type="range"
          min={min}
          max={max}
          step={INPUT_STEP}
          value={value}
          onChange={(event) => updatePresetNumber(path, event.target.value, min, max)}
        />
        <CommitNumberInput
          step={INPUT_STEP}
          min={min}
          max={max}
          value={value}
          onCommit={(value) => updatePresetNumber(path, String(value), min, max)}
        />
      </div>
    </div>
  );

  const vectorControl = (
    label: string,
    vectorKey: 'direction1' | 'direction2' | 'minEmitBox' | 'maxEmitBox'
  ) => (
    <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: '#141a23' }}>
      <div style={{ color: '#9fb0c5', fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {(['x', 'y', 'z'] as const).map((axis) => (
          <CommitNumberInput
            key={`${vectorKey}.${axis}`}
            step={INPUT_STEP}
            value={preset[vectorKey][axis]}
            onCommit={(value) => updatePresetVectorField(vectorKey, axis, String(value))}
            placeholder={axis}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ padding: 16, height: '100vh', boxSizing: 'border-box', display: 'grid', gridTemplateColumns: '430px 1fr', gap: 16 }}>
      <div style={{ background: '#1a1f29', borderRadius: 12, padding: 14, overflow: 'auto' }}>
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

        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>快速选择预设</label>
        <select
          value={activePresetKey}
          onChange={(event) => handlePresetSelectionChange(event.target.value)}
          style={{ width: '100%', marginBottom: 8, padding: '8px 10px', borderRadius: 6, border: '1px solid #3a4253', background: '#11151d', color: '#e8edf2' }}
        >
          {presetKeys.map((key) => (
            <option key={key} value={key}>{key}</option>
          ))}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 10 }}>
          <button onClick={createEffectPreset}>新建效果预设</button>
          <button onClick={duplicateEffectPreset}>复制效果预设</button>
          <button onClick={renameEffectPreset}>重命名效果 Key</button>
          <button onClick={clearCurrentPreset}>删除效果预设</button>
        </div>

        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>预设 Key</label>
        <input
          value={preset.presetKey}
          onChange={(event) => setPreset((prev) => ({ ...prev, presetKey: event.target.value }))}
          style={{ width: '100%', marginBottom: 8 }}
        />

        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>预设名</label>
        <input
          value={preset.name}
          onChange={(event) => setPreset((prev) => ({ ...prev, name: event.target.value }))}
          style={{ width: '100%', marginBottom: 8 }}
        />

        <div style={{ margin: '12px 0 8px', paddingTop: 12, borderTop: '1px solid #354052', color: '#90b6ff', fontWeight: 700 }}>共享视觉预设</div>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>当前效果引用的视觉</label>
        <select
          value={preset.visualPresetKey}
          onChange={(event) => handleVisualPresetSelectionChange(event.target.value)}
          style={{ width: '100%', marginBottom: 8, padding: '8px 10px', borderRadius: 6, border: '1px solid #3a4253', background: '#11151d', color: '#e8edf2' }}
        >
          {visualPresetKeys.map((key) => <option key={key} value={key}>{key}</option>)}
        </select>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>视觉 Key</label>
        <input
          value={visualPreset.presetKey}
          onChange={(event) => {
            const visualPresetKey = event.target.value;
            setVisualPreset((prev) => ({ ...prev, presetKey: visualPresetKey }));
            setPreset((prev) => ({ ...prev, visualPresetKey }));
          }}
          style={{ width: '100%', marginBottom: 8 }}
        />
        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>视觉名称</label>
        <input value={visualPreset.name} onChange={(event) => setVisualPreset((prev) => ({ ...prev, name: event.target.value }))} style={{ width: '100%', marginBottom: 8 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
          <button onClick={createVisualPreset}>新建视觉预设</button>
          <button onClick={duplicateVisualPreset}>复制视觉预设</button>
          <button onClick={renameVisualPreset}>重命名视觉 Key</button>
          <button onClick={deleteVisualPreset}>删除视觉预设</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>颜色模式
            <select value={visualPreset.colorMode} onChange={(event) => setVisualPreset((prev) => ({ ...prev, colorMode: event.target.value as 'texture' | 'gradient' }))}>
              <option value="texture">贴图原色</option>
              <option value="gradient">颜色渐变</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>混合模式
            <select value={visualPreset.blendMode} onChange={(event) => setVisualPreset((prev) => ({ ...prev, blendMode: event.target.value as 'alpha' | 'add' | 'multiply' }))}>
              <option value="alpha">Alpha 透明</option>
              <option value="add">Add 加色</option>
              <option value="multiply">Multiply 正片叠底</option>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <button onClick={importCurrentLocalPreset}>导入配置文件</button>
          <button onClick={saveCurrentPreset}>保存到配置文件</button>
          <button onClick={exportJson}>导出 JSON</button>
          <button onClick={copyCurrentPreset}>复制当前组合配置</button>
          <button onClick={pastePreset}>从剪贴板一键导入</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
          <button onClick={playbackState === 'paused' ? resumeParticle : playParticle} disabled={playbackState === 'playing'}>播放</button>
          <button onClick={pauseParticle} disabled={playbackState !== 'playing'}>暂停</button>
          <button onClick={stopParticle} disabled={playbackState === 'stopped'}>停止</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
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

        {renderDragNumberControl('capacity', preset.capacity, 1, 1000, 'capacity')}
        {renderDragNumberControl('minLifeTime', preset.minLifeTime, 0.01, 10, 'minLifeTime')}
        {renderDragNumberControl('maxLifeTime', preset.maxLifeTime, 0.01, 10, 'maxLifeTime')}
        {renderDragNumberControl('emitDuration', preset.emitDuration, 0.01, 5, 'emitDuration')}
        {renderDragNumberControl('emitRate', preset.emitRate, 1, 1000, 'emitRate')}
        {renderDragNumberControl('minEmitPower', preset.minEmitPower, 0.01, 30, 'minEmitPower')}
        {renderDragNumberControl('maxEmitPower', preset.maxEmitPower, 0.01, 30, 'maxEmitPower')}
        {renderDragNumberControl('updateSpeed', preset.updateSpeed, 0.0001, 0.5, 'updateSpeed')}
        {renderDragNumberControl('gravityY', preset.gravityY, -30, 30, 'gravityY')}

        {vectorControl('direction1', 'direction1')}
        {vectorControl('direction2', 'direction2')}
        {vectorControl('minEmitBox', 'minEmitBox')}
        {vectorControl('maxEmitBox', 'maxEmitBox')}

        <div style={{ marginBottom: 16, padding: '10px', borderRadius: 8, background: '#141a23' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ color: '#9fb0c5', fontSize: 13, fontWeight: 'bold' }}>颜色渐变 (Color Gradients)</span>
            <button onClick={addColorGradient} style={{ padding: '4px 8px', fontSize: 12, background: '#2e3f5e', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer' }}>+ 添加节点</button>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ color: '#6f8098', fontSize: 11, marginBottom: 4 }}>渐变预览</div>
            <div style={{ height: 18, borderRadius: 6, border: '1px solid #364155', background: colorPreviewGradientCss }} />
          </div>
          {colorGradientNodes.map((grad) => (
            <div key={grad.id} style={{ display: 'grid', gap: 8, marginBottom: 8, background: '#1a1f29', padding: '8px', borderRadius: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr auto', gap: 8, alignItems: 'end' }}>
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
        </div>

        <div style={{ marginBottom: 16, padding: '10px', borderRadius: 8, background: '#141a23' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ color: '#9fb0c5', fontSize: 13, fontWeight: 'bold' }}>尺寸渐变 (Size Gradients)</span>
            <button onClick={addSizeGradient} style={{ padding: '4px 8px', fontSize: 12, background: '#2e3f5e', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer' }}>+ 添加节点</button>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ color: '#6f8098', fontSize: 11, marginBottom: 4 }}>曲线预览</div>
            <div style={{ height: 28, borderRadius: 6, border: '1px solid #364155', background: '#11151d', display: 'flex', alignItems: 'flex-end', padding: '2px', gap: 1 }}>
              {sizePreviewSamples.map((normalized, index) => (
                <div
                  key={`size-preview-${index}`}
                  style={{
                    flex: 1,
                    height: `${Math.max(8, normalized * 100)}%`,
                    borderRadius: 2,
                    background: 'linear-gradient(180deg, #90b6ff 0%, #4d7ed8 100%)'
                  }}
                />
              ))}
            </div>
          </div>
          {sizeGradientNodes.map((grad) => (
            <div key={grad.id} style={{ display: 'grid', gap: 8, marginBottom: 8, background: '#1a1f29', padding: '8px', borderRadius: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 8 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px auto', gap: 8, alignItems: 'end' }}>
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
        </div>
      </div>

      <div style={{ background: '#1a1f29', borderRadius: 12, padding: 12, position: 'relative', minHeight: 0 }}>
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
