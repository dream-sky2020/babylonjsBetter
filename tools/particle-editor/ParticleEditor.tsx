import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Color3, MeshBuilder, StandardMaterial, Vector3 } from '@babylonjs/core';
import {
  INPUT_STEP,
  createDefaultParticleBehavior,
  normalizePublicPath,
  type ParticleController,
  type ParticleCommonConfig,
  type ParticleEffectDefinition,
  type ParticleGradientPhaseConfig,
  type BallisticParticleBehavior,
  type PhysicsParticleBehavior,
  type ParticleEffectType,
  type OrbitParticleBehavior
} from '@/core/particle';
import { useClipboardActions } from '@/hooks/particleEditor/useClipboardActions.ts';
import { useBabylonScene } from '@/hooks/particleEditor/useBabylonScene.ts';
import { useExportActions } from '@/hooks/particleEditor/useExportActions.ts';
import { useGradientManagement } from '@/hooks/particleEditor/useGradientManagement.ts';
import { useParticleController } from '@/hooks/particleEditor/useParticleController.ts';
import { useParticleEffectManagement } from '@/hooks/particleEditor/useParticleEffectManagement.ts';
import { rgbToHex } from '@/core/utils/color.ts';
import { clamp, toFixedNumber } from '@/core/utils/math.ts';
import './ParticleEditor.css';

const RESOURCE_IMAGE_MODULES = import.meta.glob('/public/**/*.{png,jpg,jpeg,webp,gif,avif,svg}', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>;

interface LabOrbitDefinition {
  id: string;
  name: string;
  target: { x: number; y: number; z: number };
  centerOffset: { x: number; y: number; z: number };
  radius: number;
  angularSpeed: number;
  followSpeed: number;
  clockwise: boolean;
}

const createLabOrbit = (index: number): LabOrbitDefinition => ({
  id: `lab-orbit-${index}`,
  name: `轨道 ${index}`,
  target: { x: (index - 1.5) * 4, y: 0, z: 0 },
  centerOffset: { x: 0, y: 1, z: 0 },
  radius: 1.5,
  angularSpeed: index % 2 === 0 ? -2 : 2,
  followSpeed: 6,
  clockwise: index % 2 !== 0
});

const LifecycleGradientPhaseEditor: React.FC<{
  title: string;
  phase: 'start' | 'end';
  value: ParticleGradientPhaseConfig;
  setPreset: React.Dispatch<React.SetStateAction<ParticleEffectDefinition>>;
}> = ({ title, phase, value, setPreset }) => {
  const update = (next: ParticleGradientPhaseConfig) => setPreset((previous) => ({
    ...previous,
    particles: { ...previous.particles, lifecycleGradients: { ...previous.particles.lifecycleGradients, [phase]: next } }
  }));
  const timeline = (kind: 'color' | 'size') => {
    const nodes = kind === 'color' ? value.colorGradients : value.sizeGradients;
    return <div style={{ margin: '8px 0 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#718096', fontSize: 10 }}><span>0.00s</span><span>{value.duration.toFixed(2)}s</span></div>
      <div style={{ position: 'relative', height: 28, margin: '2px 8px 0', borderTop: '4px solid #334155' }}>
        {nodes.map((node, index) => <div key={`${kind}-marker-${index}`} title={`${(node.offset * value.duration).toFixed(2)}s`} style={{ position: 'absolute', left: `${node.offset * 100}%`, top: -9, transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: kind === 'color' ? '50%' : 2, border: '2px solid #e2e8f0', background: kind === 'color' ? rgbToHex('color' in node ? node.color.r : 1, 'color' in node ? node.color.g : 1, 'color' in node ? node.color.b : 1) : '#60a5fa', boxShadow: '0 0 0 2px #141a23' }} />)}
      </div>
    </div>;
  };
  return <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, border: `1px solid ${phase === 'start' ? '#276749' : '#7f1d1d'}`, background: '#141a23' }}>
    <div style={{ fontWeight: 700, color: phase === 'start' ? '#86efac' : '#fca5a5', marginBottom: 10 }}>{title}</div>
    <label style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8, alignItems: 'center', marginBottom: 10 }}>
      <span>渐变时间（秒）</span>
      <input type="number" min={0.01} step={0.01} value={value.duration} onChange={(event) => update({ ...value, duration: Math.max(0.01, Number(event.target.value) || 0.01) })} />
    </label>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>颜色时间轴</span><button onClick={() => update({ ...value, colorGradients: [...value.colorGradients, { offset: 1, color: { r: 1, g: 1, b: 1, a: phase === 'start' ? 1 : 0 } }] })}>＋ 添加节点</button></div>
    {timeline('color')}
    {value.colorGradients.map((node, index) => <div key={`fill-${phase}-color-${index}`} style={{ display: 'grid', gridTemplateColumns: '80px 48px 1fr auto', gap: 8, marginBottom: 6 }}>
      <input type="number" min={0} max={1} step={0.01} value={node.offset} title="Offset" onChange={(event) => update({ ...value, colorGradients: value.colorGradients.map((item, itemIndex) => itemIndex === index ? { ...item, offset: clamp(Number(event.target.value), 0, 1) } : item) })} />
      <input type="color" value={rgbToHex(node.color.r, node.color.g, node.color.b)} onChange={(event) => {
        const hex = event.target.value; const r = parseInt(hex.slice(1, 3), 16) / 255; const g = parseInt(hex.slice(3, 5), 16) / 255; const b = parseInt(hex.slice(5, 7), 16) / 255;
        update({ ...value, colorGradients: value.colorGradients.map((item, itemIndex) => itemIndex === index ? { ...item, color: { ...item.color, r, g, b } } : item) });
      }} />
      <input type="range" min={0} max={1} step={0.01} value={node.color.a} title={`Alpha ${node.color.a.toFixed(2)}`} onChange={(event) => update({ ...value, colorGradients: value.colorGradients.map((item, itemIndex) => itemIndex === index ? { ...item, color: { ...item.color, a: Number(event.target.value) } } : item) })} />
      <button onClick={() => update({ ...value, colorGradients: value.colorGradients.filter((_, itemIndex) => itemIndex !== index) })}>删除</button>
    </div>)}
    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0 6px' }}><span>尺寸时间轴</span><button onClick={() => update({ ...value, sizeGradients: [...value.sizeGradients, { offset: 1, size: phase === 'start' ? 0.25 : 0.0001 }] })}>＋ 添加节点</button></div>
    {timeline('size')}
    {value.sizeGradients.map((node, index) => <div key={`fill-${phase}-size-${index}`} style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 8, marginBottom: 6 }}>
      <input type="number" min={0} max={1} step={0.01} value={node.offset} title="Offset" onChange={(event) => update({ ...value, sizeGradients: value.sizeGradients.map((item, itemIndex) => itemIndex === index ? { ...item, offset: clamp(Number(event.target.value), 0, 1) } : item) })} />
      <input type="number" min={0.0001} step={0.01} value={node.size} title="Size" onChange={(event) => update({ ...value, sizeGradients: value.sizeGradients.map((item, itemIndex) => itemIndex === index ? { ...item, size: Math.max(0.0001, Number(event.target.value) || 0.0001) } : item) })} />
      <button onClick={() => update({ ...value, sizeGradients: value.sizeGradients.filter((_, itemIndex) => itemIndex !== index) })}>删除</button>
    </div>)}
  </div>;
};

export const ParticleEditor: React.FC = () => {
  const particleControllerRef = useRef<ParticleController | null>(null);
  const [lifecycleGradientPhase, setLifecycleGradientPhase] = useState<'start' | 'end'>('start');
  const [lifecycleDisplayMode, setLifecycleDisplayMode] = useState<'single' | 'split'>('single');
  const [commandCount, setCommandCount] = useState(20);
  const [runtimeCapacity, setRuntimeCapacityState] = useState(100);
  const [simulationMode, setSimulationMode] = useState<'manual' | 'continuous' | 'fill' | 'maintain' | 'sequence' | 'distance'>('manual');
  const [simulationRate, setSimulationRate] = useState(20);
  const [simulationTarget, setSimulationTarget] = useState(80);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [initialOrbitId, setInitialOrbitId] = useState('');
  const [transferFromOrbitId, setTransferFromOrbitId] = useState('lab-orbit-1');
  const [transferToOrbitId, setTransferToOrbitId] = useState('lab-orbit-2');
  const [transferDuration, setTransferDuration] = useState(0.8);
  const [particleIdText, setParticleIdText] = useState('');
  const [labOrbits, setLabOrbits] = useState<LabOrbitDefinition[]>(() => [createLabOrbit(1), createLabOrbit(2)]);
  const [selectedOrbitId, setSelectedOrbitId] = useState('lab-orbit-1');
  const nextOrbitIndexRef = useRef(3);
  const {
    presetKeys,
    activePresetKey,
    presetSourceLabel,
    message,
    viewMode,
    preset,
    setMessage,
    setViewMode,
    setPreset,
    fallbackPreset,
    loadedPresetVersion,
    serverConnected,
    serverPort,
    retryServerConnection,
    refreshPresetState,
    handlePresetSelectionChange,
    saveCurrentPreset,
    importCurrentLocalPreset,
    clearCurrentPreset
  } = useParticleEffectManagement();
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
    initialPreset: preset,
    setPreset
  });

  useEffect(() => {
    if (loadedPresetVersion > 0) {
      refreshGradientNodes(preset);
    }
  }, [loadedPresetVersion, preset, refreshGradientNodes]);

  const textureOptions = useMemo(() => {
    const scanned = Object.values(RESOURCE_IMAGE_MODULES).map((assetUrl) => normalizePublicPath(assetUrl));
    const merged = new Set<string>([...scanned, preset.particles.texturePath]);
    return [...merged].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [preset.particles.texturePath]);

  const updatePresetNumber = useCallback((key: keyof ParticleCommonConfig, rawValue: string, min?: number, max?: number) => {
    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) return;
    const clamped = min !== undefined && max !== undefined ? clamp(parsed, min, max) : parsed;
    setPreset((prev) => ({ ...prev, particles: { ...prev.particles, [key]: toFixedNumber(clamped) as never } }));
  }, [setPreset]);

  const updatePresetVectorField = useCallback((
    vectorKey: 'direction1' | 'direction2' | 'minEmitBox' | 'maxEmitBox' | 'gravity',
    axis: 'x' | 'y' | 'z',
    rawValue: string
  ) => {
    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) return;
    setPreset((prev) => {
      if (prev.effectType !== 'ballistic' && prev.effectType !== 'physics') return prev;
      const behavior = prev.behavior as BallisticParticleBehavior | PhysicsParticleBehavior;
      return { ...prev, behavior: { ...behavior, [vectorKey]: { ...behavior[vectorKey], [axis]: toFixedNumber(parsed) } } };
    });
  }, [setPreset]);

  const updateBehaviorNumber = useCallback((key: string, rawValue: string) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    setPreset((prev) => ({ ...prev, behavior: { ...prev.behavior, [key]: toFixedNumber(value) } }));
  }, [setPreset]);

  const updateBehaviorAxis = useCallback((axis: 'x' | 'y' | 'z', rawValue: string) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    setPreset((prev) => {
      if (!('rotationAxis' in prev.behavior)) return prev;
      return { ...prev, behavior: { ...prev.behavior, rotationAxis: { ...prev.behavior.rotationAxis, [axis]: toFixedNumber(value) } } };
    });
  }, [setPreset]);

  const { canvasRef, sceneRef, reset3dCameraView } = useBabylonScene({
    viewMode,
    setMessage,
    particleControllerRef
  });

  const { playParticle, pauseParticle, resumeParticle, stopParticle, spawnParticles, retireParticles, retireAllParticles, setRuntimeCapacity, getActiveCount, registerOrbit, unregisterOrbit, transferCount, transferByIds, transitionAll, getParticleIds, playbackState } = useParticleController({
    sceneRef,
    particleControllerRef,
    preset,
    setMessage
  });

  useEffect(() => {
    if (!simulationRunning || simulationMode === 'manual' || simulationMode === 'distance') return;
    const timer = window.setInterval(() => {
      const active = getActiveCount();
      const step = Math.max(1, Math.ceil(simulationRate / 10));
      if (simulationMode === 'continuous') spawnParticles(step, initialOrbitId || undefined);
      if (simulationMode === 'fill' && active < simulationTarget) spawnParticles(Math.min(step, simulationTarget - active), initialOrbitId || undefined);
      if (simulationMode === 'maintain') {
        if (active < simulationTarget) spawnParticles(Math.min(step, simulationTarget - active), initialOrbitId || undefined);
        if (active > simulationTarget) retireParticles(Math.min(step, active - simulationTarget));
      }
      if (simulationMode === 'sequence') spawnParticles(commandCount, initialOrbitId || undefined);
    }, simulationMode === 'sequence' ? 1000 : 100);
    return () => window.clearInterval(timer);
  }, [commandCount, getActiveCount, initialOrbitId, retireParticles, simulationMode, simulationRate, simulationRunning, simulationTarget, spawnParticles]);

  const { exportJson } = useExportActions({ setMessage });
  const { copyCurrentPreset, pastePreset } = useClipboardActions({
    preset,
    activePresetKey,
    fallbackPreset,
    refreshPresetState,
    setMessage
  });

  const updateLabOrbit = (orbitId: string, update: (orbit: LabOrbitDefinition) => LabOrbitDefinition) => {
    setLabOrbits((previous) => previous.map((orbit) => orbit.id === orbitId ? update(orbit) : orbit));
  };

  const registerLabOrbit = (orbit: LabOrbitDefinition) => {
    const base = createDefaultParticleBehavior('orbit') as OrbitParticleBehavior;
    const registered = registerOrbit({
      id: orbit.id,
      target: new Vector3(orbit.target.x, orbit.target.y, orbit.target.z),
      centerOffset: orbit.centerOffset,
      offsetSpace: 'world',
      followSpeed: orbit.followSpeed,
      behaviorType: 'orbit',
      behavior: { ...base, radius: orbit.radius, angularSpeed: orbit.angularSpeed, clockwise: orbit.clockwise }
    });
    setMessage(registered ? `${orbit.name} 已注册或更新` : '请先初始化粒子实例');
  };

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const disposables = labOrbits.flatMap((orbit, index) => {
      const color = orbit.id === initialOrbitId ? new Color3(0.2, 1, 0.45) : Color3.FromHSV((index * 0.19 + 0.72) % 1, 0.7, 1);
      const material = new StandardMaterial(`lab_orbit_material_${orbit.id}`, scene);
      material.emissiveColor = color;
      material.disableLighting = true;
      const center = new Vector3(orbit.target.x + orbit.centerOffset.x, orbit.target.y + orbit.centerOffset.y, orbit.target.z + orbit.centerOffset.z);
      const marker = MeshBuilder.CreateSphere(`lab_orbit_center_${orbit.id}`, { diameter: 0.14 }, scene);
      marker.position.copyFrom(center);
      marker.material = material;
      const ring = MeshBuilder.CreateTorus(`lab_orbit_ring_${orbit.id}`, { diameter: orbit.radius * 2, thickness: 0.025, tessellation: 72 }, scene);
      ring.position.copyFrom(center);
      ring.material = material;
      return [marker, ring, material];
    });
    return () => disposables.forEach((item) => item.dispose());
  }, [initialOrbitId, labOrbits, playbackState, sceneRef]);

  const renderDragNumberControl = (
    label: string,
    value: number,
    min: number,
    max: number,
    path: keyof ParticleCommonConfig,
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
        <input
          type="number"
          step={INPUT_STEP}
          min={min}
          max={max}
          value={value}
          onChange={(event) => updatePresetNumber(path, event.target.value, min, max)}
        />
      </div>
    </div>
  );

  const vectorControl = (
    label: string,
    vectorKey: 'direction1' | 'direction2' | 'minEmitBox' | 'maxEmitBox' | 'gravity'
  ) => (
    <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: '#141a23' }}>
      <div style={{ color: '#9fb0c5', fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {(['x', 'y', 'z'] as const).map((axis) => (
          <input
            key={`${vectorKey}.${axis}`}
            type="number"
            step={INPUT_STEP}
            value={preset.effectType === 'ballistic' || preset.effectType === 'physics' ? (preset.behavior as BallisticParticleBehavior | PhysicsParticleBehavior)[vectorKey][axis] : 0}
            onChange={(event) => updatePresetVectorField(vectorKey, axis, event.target.value)}
            placeholder={axis}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="particle-editor-shell">
      <div className="particle-editor-sidebar">
        <h2 style={{ margin: 0, marginBottom: 10 }}>Particle 粒子编辑器</h2>
        <p style={{ marginTop: 0, color: '#9fb0c5', fontSize: 13 }}>支持实时测试、写入 config JSON、导出 JSON，并可复用到战斗场景。</p>
        <details open className="particle-editor-section">
          <summary>特效资源与配置文件</summary>
          <div className="particle-editor-section__body particle-editor-field-stack">
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

        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>预设 Key</label>
        <input
          value={preset.effectKey}
          onChange={(event) => setPreset((prev) => ({ ...prev, effectKey: event.target.value }))}
          style={{ width: '100%', marginBottom: 8 }}
        />

        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>预设名</label>
        <input
          value={preset.name}
          onChange={(event) => setPreset((prev) => ({ ...prev, name: event.target.value }))}
          style={{ width: '100%', marginBottom: 8 }}
        />

        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>特效类型（由 core 代码实现）</label>
        <select
          value={preset.effectType}
          onChange={(event) => {
            const effectType = event.target.value as ParticleEffectType;
            setPreset((prev) => ({ ...prev, effectType, behavior: createDefaultParticleBehavior(effectType) }));
          }}
          style={{ width: '100%', marginBottom: 12, padding: '8px 10px', borderRadius: 6, border: '1px solid #3a4253', background: '#11151d', color: '#e8edf2' }}
        >
          <option value="ballistic">抛射运动 ballistic</option>
          <option value="physics">物理运动 physics</option>
          <option value="orbit">环绕 orbit</option>
          <option value="spiral">螺旋 spiral</option>
          <option value="vortex">漩涡 vortex</option>
        </select>

        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>纹理路径（public 相对路径）</label>
        <input
          value={preset.particles.texturePath}
          onChange={(event) => setPreset((prev) => ({ ...prev, particles: { ...prev.particles, texturePath: normalizePublicPath(event.target.value) } }))}
          style={{ width: '100%', marginBottom: 8 }}
        />

        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>纹理资源列表（自动扫描）</label>
        <select
          value={preset.particles.texturePath}
          onChange={(event) => setPreset((prev) => ({ ...prev, particles: { ...prev.particles, texturePath: event.target.value } }))}
          style={{ width: '100%', marginBottom: 12, padding: '8px 10px', borderRadius: 6, border: '1px solid #3a4253', background: '#11151d', color: '#e8edf2' }}
        >
          {textureOptions.map((path) => (
            <option key={path} value={path}>{path}</option>
          ))}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <label style={{ fontSize: 12 }}>颜色模式
            <select value={preset.particles.colorMode} onChange={(event) => setPreset((prev) => ({ ...prev, particles: { ...prev.particles, colorMode: event.target.value as ParticleCommonConfig['colorMode'] } }))} style={{ width: '100%' }}>
              <option value="texture">保持纹理原色</option>
              <option value="tinted">颜色渐变乘色</option>
            </select>
          </label>
          <label style={{ fontSize: 12 }}>混合模式
            <select value={preset.particles.blendMode} onChange={(event) => setPreset((prev) => ({ ...prev, particles: { ...prev.particles, blendMode: event.target.value as ParticleCommonConfig['blendMode'] } }))} style={{ width: '100%' }}>
              <option value="alpha">标准透明混合</option>
              <option value="additive">加色发光</option>
            </select>
          </label>
        </div>

        <details className="particle-editor-section">
          <summary>配置文件操作</summary>
          <div className="particle-editor-section__body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <button onClick={importCurrentLocalPreset}>导入配置文件</button>
          <button onClick={saveCurrentPreset}>保存到配置文件</button>
          <button onClick={clearCurrentPreset}>从配置文件删除</button>
          <button onClick={exportJson}>导出 JSON</button>
          <button onClick={copyCurrentPreset}>复制配置</button>
          <button onClick={pastePreset}>粘贴配置</button>
        </div>
          </div>
        </details>

        <details open className="particle-editor-section">
          <summary>运行实例与外部生成命令</summary>
          <div className="particle-editor-section__body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
          <button onClick={() => { playParticle(); labOrbits.forEach(registerLabOrbit); }}>初始化/重建实例</button>
          <button onClick={pauseParticle} disabled={playbackState !== 'playing'}>暂停</button>
          <button onClick={resumeParticle} disabled={playbackState !== 'paused'}>继续</button>
          <button onClick={stopParticle} disabled={playbackState === 'stopped'}>停止并全部退出</button>
        </div>

        <div style={{ padding: 10, marginBottom: 12, border: '1px solid #3b82f6', borderRadius: 8, background: '#101827' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><strong>外部生成命令模拟器</strong><span style={{ fontSize: 11, color: '#93c5fd' }}>不会保存到 JSON</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <label style={{ fontSize: 11 }}>命令数量<input type="number" min={1} value={commandCount} onChange={(event) => setCommandCount(Math.max(1, Number(event.target.value) || 1))} style={{ width: '100%' }} /></label>
            <label style={{ fontSize: 11 }}>运行容量<input type="number" min={0} max={preset.particles.capacity.hardLimit} value={runtimeCapacity} onChange={(event) => setRuntimeCapacityState(Math.max(0, Number(event.target.value) || 0))} onBlur={() => setRuntimeCapacity(runtimeCapacity)} style={{ width: '100%' }} /></label>
          </div>
          <label style={{ display: 'block', fontSize: 11, marginBottom: 8 }}>新粒子初始轨道
            <select value={initialOrbitId} onChange={(event) => setInitialOrbitId(event.target.value)} style={{ width: '100%' }}>
              <option value="">默认行为</option>
              {labOrbits.map((orbit) => <option key={orbit.id} value={orbit.id}>{orbit.name}</option>)}
            </select>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
            <button onClick={() => spawnParticles(commandCount, initialOrbitId || undefined)}>生成</button>
            <button onClick={() => retireParticles(commandCount)}>退出</button>
            <button onClick={retireAllParticles}>全部退出</button>
          </div>
          <label style={{ display: 'block', fontSize: 11, marginBottom: 6 }}>Lab 调度策略
            <select value={simulationMode} onChange={(event) => { setSimulationMode(event.target.value as typeof simulationMode); setSimulationRunning(false); }} style={{ width: '100%' }}>
              <option value="manual">burst / event / 手动命令</option>
              <option value="continuous">continuous / 持续生成</option>
              <option value="fill">fill / 填充到目标</option>
              <option value="maintain">maintain / 维持目标数量</option>
              <option value="sequence">sequence / 定时批次</option>
              <option value="distance">distance / 模拟移动触发</option>
            </select>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <label style={{ fontSize: 11 }}>速率/秒<input type="number" min={1} value={simulationRate} onChange={(event) => setSimulationRate(Math.max(1, Number(event.target.value) || 1))} style={{ width: '100%' }} /></label>
            <label style={{ fontSize: 11 }}>目标数量<input type="number" min={0} value={simulationTarget} onChange={(event) => setSimulationTarget(Math.max(0, Number(event.target.value) || 0))} style={{ width: '100%' }} /></label>
          </div>
          {simulationMode === 'distance' ? <button onClick={() => spawnParticles(commandCount, initialOrbitId || undefined)} style={{ width: '100%' }}>模拟移动一步并生成</button> : <button onClick={() => setSimulationRunning((value) => !value)} disabled={simulationMode === 'manual'} style={{ width: '100%', background: simulationRunning ? '#7f1d1d' : '#1d4ed8' }}>{simulationRunning ? '停止调度模拟' : '启动调度模拟'}</button>}
        </div>
          </div>
        </details>

        <details open className="particle-editor-section">
          <summary>轨道管理器（{labOrbits.length}）</summary>
          <div className="particle-editor-section__body">
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 5 }}><button onClick={() => labOrbits.forEach(registerLabOrbit)}>全部应用</button><button onClick={() => {
              const orbit = createLabOrbit(nextOrbitIndexRef.current++);
              setLabOrbits((previous) => [...previous, orbit]);
              setSelectedOrbitId(orbit.id);
            }}>＋ 新增轨道</button></div>
          </div>
          <div className="particle-editor-orbit-cards">
              {labOrbits.map((orbit) => <button className="particle-editor-orbit-card" key={orbit.id} onClick={() => setSelectedOrbitId(orbit.id)} style={{ background: selectedOrbitId === orbit.id ? '#5b21b6' : '#241938' }}>
                <div>{orbit.name}</div><small>{orbit.id}</small><small>半径 {orbit.radius.toFixed(2)} · 角速度 {orbit.angularSpeed.toFixed(2)}</small>
              </button>)}
          </div>
            {labOrbits.find((orbit) => orbit.id === selectedOrbitId) ? (() => {
              const orbit = labOrbits.find((item) => item.id === selectedOrbitId)!;
              const vectorEditor = (key: 'target' | 'centerOffset', label: string) => <div><div style={{ fontSize: 10, color: '#c4b5fd', marginBottom: 4 }}>{label}</div><div className="particle-editor-orbit-vector">{(['x', 'y', 'z'] as const).map((axis) => <label key={axis} style={{ fontSize: 10 }}>{axis.toUpperCase()}<input type="number" step={0.1} value={orbit[key][axis]} onChange={(event) => updateLabOrbit(orbit.id, (current) => ({ ...current, [key]: { ...current[key], [axis]: Number(event.target.value) || 0 } }))} /></label>)}</div></div>;
              return <div className="particle-editor-orbit-detail">
                <input value={orbit.name} onChange={(event) => updateLabOrbit(orbit.id, (current) => ({ ...current, name: event.target.value }))} style={{ width: '100%', marginBottom: 7 }} />
                {vectorEditor('target', '目标位置 X / Y / Z')}
                {vectorEditor('centerOffset', '轨道中心偏移 X / Y / Z')}
                <div className="particle-editor-waterfall">
                  <label style={{ fontSize: 10 }}>半径<input type="number" min={0} step={0.1} value={orbit.radius} onChange={(event) => updateLabOrbit(orbit.id, (current) => ({ ...current, radius: Math.max(0, Number(event.target.value) || 0) }))} style={{ width: '100%' }} /></label>
                  <label style={{ fontSize: 10 }}>角速度<input type="number" step={0.1} value={orbit.angularSpeed} onChange={(event) => updateLabOrbit(orbit.id, (current) => ({ ...current, angularSpeed: Number(event.target.value) || 0 }))} style={{ width: '100%' }} /></label>
                  <label style={{ fontSize: 10 }}>跟随速度<input type="number" min={0} step={0.1} value={orbit.followSpeed} onChange={(event) => updateLabOrbit(orbit.id, (current) => ({ ...current, followSpeed: Math.max(0, Number(event.target.value) || 0) }))} style={{ width: '100%' }} /></label>
                  <label style={{ fontSize: 10, display: 'flex', alignItems: 'end', gap: 5 }}><input type="checkbox" checked={orbit.clockwise} onChange={(event) => updateLabOrbit(orbit.id, (current) => ({ ...current, clockwise: event.target.checked }))} />顺时针</label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 8 }}>
                  <button onClick={() => registerLabOrbit(orbit)}>应用到运行实例</button>
                  <button disabled={labOrbits.length <= 1} onClick={() => {
                    unregisterOrbit(orbit.id, labOrbits.find((item) => item.id !== orbit.id)?.id);
                    const remaining = labOrbits.filter((item) => item.id !== orbit.id);
                    setLabOrbits(remaining); setSelectedOrbitId(remaining[0]?.id ?? '');
                    if (initialOrbitId === orbit.id) setInitialOrbitId('');
                  }}>删除轨道</button>
                </div>
              </div>;
            })() : <div style={{ color: '#94a3b8' }}>暂无轨道</div>}
          <div style={{ borderTop: '1px solid #4c1d95', marginTop: 10, paddingTop: 8 }}>
            <div className="particle-editor-waterfall" style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11 }}>来源轨道<select value={transferFromOrbitId} onChange={(event) => setTransferFromOrbitId(event.target.value)} style={{ width: '100%' }}><option value="">全部粒子</option>{labOrbits.map((orbit) => <option key={orbit.id} value={orbit.id}>{orbit.name}</option>)}</select></label>
              <label style={{ fontSize: 11 }}>目标轨道<select value={transferToOrbitId} onChange={(event) => setTransferToOrbitId(event.target.value)} style={{ width: '100%' }}>{labOrbits.map((orbit) => <option key={orbit.id} value={orbit.id}>{orbit.name}</option>)}</select></label>
              <label style={{ fontSize: 11 }}>转移数量<input type="number" min={1} value={commandCount} onChange={(event) => setCommandCount(Math.max(1, Number(event.target.value) || 1))} style={{ width: '100%' }} /></label>
              <label style={{ fontSize: 11 }}>过渡时间<input type="number" min={0.01} step={0.05} value={transferDuration} onChange={(event) => setTransferDuration(Math.max(0.01, Number(event.target.value) || 0.01))} style={{ width: '100%' }} /></label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}><button onClick={() => setMessage(`已转移 ${transferCount(commandCount, transferFromOrbitId || undefined, transferToOrbitId, transferDuration)} 个粒子`)}>按数量转移</button><button onClick={() => setMessage(`已切换 ${transitionAll(transferToOrbitId, transferDuration)} 个粒子`)}>全部切换</button></div>
            <input value={particleIdText} onChange={(event) => setParticleIdText(event.target.value)} placeholder="粒子 ID，例如 1,2,3" style={{ width: '100%', marginBottom: 6 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}><button onClick={() => setParticleIdText(getParticleIds(transferFromOrbitId || undefined).join(','))}>读取当前 ID</button><button onClick={() => { const ids = particleIdText.split(',').map(Number).filter((id) => Number.isInteger(id) && id > 0); setMessage(`已按 ID 转移 ${transferByIds(ids, transferToOrbitId, transferDuration)} 个粒子`); }}>按 ID 转移</button></div>
          </div>
          </div>
        </details>

        <details className="particle-editor-section">
          <summary>粒子容量、寿命与运动参数</summary>
          <div className="particle-editor-section__body">
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
          {(['initial', 'hardLimit', 'growthStep'] as const).map((key) => <label key={key} style={{ fontSize: 11 }}>{key}
            <input type="number" min={1} value={preset.particles.capacity[key]} onChange={(event) => setPreset((previous) => {
              const value = Math.max(1, Math.floor(Number(event.target.value) || 1));
              const capacity = { ...previous.particles.capacity, [key]: value };
              capacity.hardLimit = Math.max(capacity.initial, capacity.hardLimit);
              return { ...previous, particles: { ...previous.particles, capacity } };
            })} style={{ width: '100%' }} />
          </label>)}
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>生命周期
          <select value={preset.particles.lifetimeMode} onChange={(event) => setPreset((previous) => ({ ...previous, particles: { ...previous.particles, lifetimeMode: event.target.value as ParticleCommonConfig['lifetimeMode'] } }))}>
            <option value="finite">有限寿命（自然退出）</option>
            <option value="persistent">永久存活（外部命令退出）</option>
          </select>
        </label>
        {renderDragNumberControl('minLifeTime', preset.particles.minLifeTime, 0.01, 10, 'minLifeTime')}
        {renderDragNumberControl('maxLifeTime', preset.particles.maxLifeTime, 0.01, 10, 'maxLifeTime')}
        {renderDragNumberControl('minEmitPower', preset.particles.minEmitPower, 0.0001, 30, 'minEmitPower')}
        {renderDragNumberControl('maxEmitPower', preset.particles.maxEmitPower, 0.0001, 30, 'maxEmitPower')}
        {renderDragNumberControl('updateSpeed', preset.particles.updateSpeed, 0.0001, 0.5, 'updateSpeed')}
        {preset.effectType === 'ballistic' || preset.effectType === 'physics' ? <>
          {vectorControl('gravity', 'gravity')}
          {vectorControl('direction1', 'direction1')}
          {vectorControl('direction2', 'direction2')}
          {vectorControl('minEmitBox', 'minEmitBox')}
          {vectorControl('maxEmitBox', 'maxEmitBox')}
          {preset.effectType === 'physics' ? <div style={{ padding: 10, marginBottom: 10, border: '1px solid #475569', borderRadius: 8 }}>
            <div style={{ marginBottom: 8, color: '#93c5fd', fontWeight: 700 }}>物理运动参数</div>
            <label style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8, marginBottom: 8 }}>摩擦系数
              <input type="number" min={0} step={0.01} value={(preset.behavior as PhysicsParticleBehavior).friction} onChange={(event) => updateBehaviorNumber('friction', event.target.value)} />
            </label>
            <label style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8 }}>最大速度
              <input type="number" min={0.0001} step={0.1} value={(preset.behavior as PhysicsParticleBehavior).maxSpeed} onChange={(event) => updateBehaviorNumber('maxSpeed', event.target.value)} />
            </label>
          </div> : null}
        </> : (() => {
          const behavior = preset.behavior as OrbitParticleBehavior & { verticalSpeed?: number; inwardSpeed?: number; endRadius?: number };
          const numberField = (key: keyof typeof behavior, label: string, min: number, max: number, step = INPUT_STEP) => (
            <div key={String(key)} style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: '#141a23' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#9fb0c5' }}><span>{label}</span><span>{Number(behavior[key]).toFixed(3)}</span></div>
              <input type="range" min={min} max={max} step={step} value={Number(behavior[key])} onChange={(event) => updateBehaviorNumber(String(key), event.target.value)} style={{ width: '100%' }} />
            </div>
          );
          return <div style={{ padding: 10, marginBottom: 12, border: '1px solid #334155', borderRadius: 8 }}>
            <div style={{ marginBottom: 10, fontWeight: 700, color: '#93c5fd' }}>{preset.effectType} 专属行为参数</div>
            {numberField('radius', '轨道半径', 0, 20, 0.01)}
            {numberField('radiusRandomness', '半径随机量', 0, 5, 0.01)}
            {numberField('angularSpeed', '角速度（弧度/秒）', -20, 20, 0.01)}
            {numberField('angularSpeedRandomness', '角速度随机量', 0, 10, 0.01)}
            {numberField('height', '轴向高度', -10, 10, 0.01)}
            {numberField('heightRandomness', '高度随机量', 0, 10, 0.01)}
            {numberField('radialSpeed', '径向速度', -10, 10, 0.01)}
            {numberField('phaseRandomness', '初相位随机度', 0, 1, 0.01)}
            {preset.effectType === 'spiral' ? numberField('verticalSpeed', '螺旋上升速度', -10, 10, 0.01) : null}
            {preset.effectType === 'vortex' ? <>{numberField('inwardSpeed', '向心速度', 0, 20, 0.01)}{numberField('endRadius', '终止半径', 0, 10, 0.01)}</> : null}
            <div style={{ marginBottom: 8, color: '#9fb0c5', fontSize: 12 }}>旋转轴</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>{(['x', 'y', 'z'] as const).map((axis) => <input key={axis} type="number" step={0.01} value={behavior.rotationAxis[axis]} onChange={(event) => updateBehaviorAxis(axis, event.target.value)} />)}</div>
            <label style={{ display: 'flex', gap: 8, marginBottom: 8 }}><input type="checkbox" checked={behavior.clockwise} onChange={(event) => setPreset((prev) => ({ ...prev, behavior: { ...prev.behavior, clockwise: event.target.checked } }))} />顺时针</label>
            <label style={{ display: 'flex', gap: 8 }}><input type="checkbox" checked={behavior.followEmitter} onChange={(event) => setPreset((prev) => ({ ...prev, behavior: { ...prev.behavior, followEmitter: event.target.checked } }))} />跟随发射点</label>
          </div>;
        })()}
          </div>
        </details>
          </div>
        </details>

        <details open className="particle-editor-section">
          <summary>粒子生命周期时间轴</summary>
          <div className="particle-editor-section__body">
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>粒子生命周期时间轴</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#86efac', fontSize: 11 }}>所有发射模式均生效</span>
              <button onClick={() => setLifecycleDisplayMode('single')} style={{ padding: '3px 8px', background: lifecycleDisplayMode === 'single' ? '#334155' : '#1e293b' }}>单栏</button>
              <button onClick={() => setLifecycleDisplayMode('split')} style={{ padding: '3px 8px', background: lifecycleDisplayMode === 'split' ? '#334155' : '#1e293b' }}>并列</button>
            </div>
          </div>
          <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 10 }}>每个粒子出生后播放开始渐变，在自然销毁前播放结束渐变；fill 粒子在停止时播放结束渐变。</div>
          <div style={{ display: lifecycleDisplayMode === 'single' ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
            <button onClick={() => setLifecycleGradientPhase('start')} style={{ background: lifecycleGradientPhase === 'start' ? '#166534' : '#1e293b', border: '1px solid #276749' }}>创建后渐变</button>
            <button onClick={() => setLifecycleGradientPhase('end')} style={{ background: lifecycleGradientPhase === 'end' ? '#991b1b' : '#1e293b', border: '1px solid #7f1d1d' }}>销毁前渐变</button>
          </div>
          {lifecycleDisplayMode === 'split' ? <div className="particle-editor-lifecycle-split">
            <LifecycleGradientPhaseEditor title="创建后渐变（出生 → 稳定）" phase="start" value={preset.particles.lifecycleGradients.start} setPreset={setPreset} />
            <LifecycleGradientPhaseEditor title="销毁前渐变（稳定 → 消失）" phase="end" value={preset.particles.lifecycleGradients.end} setPreset={setPreset} />
          </div> : lifecycleGradientPhase === 'start'
            ? <LifecycleGradientPhaseEditor title="创建后渐变（出生 → 稳定）" phase="start" value={preset.particles.lifecycleGradients.start} setPreset={setPreset} />
            : <LifecycleGradientPhaseEditor title="销毁前渐变（稳定 → 消失）" phase="end" value={preset.particles.lifecycleGradients.end} setPreset={setPreset} />}
        </div>

        <div style={{ display: 'none', marginBottom: 16, padding: '10px', borderRadius: 8, background: '#141a23' }}>
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
                  <input
                    type="number"
                    step={INPUT_STEP}
                    min={0}
                    max={1}
                    value={grad.offset}
                    onChange={(e) => updateColorGradient(grad.id, 'offset', e.target.value)}
                    onBlur={sortColorGradientsByOffset}
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

        <div style={{ display: 'none', marginBottom: 16, padding: '10px', borderRadius: 8, background: '#141a23' }}>
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
                  <input
                    type="number"
                    step={INPUT_STEP}
                    min={0}
                    max={1}
                    value={grad.offset}
                    onChange={(e) => updateSizeGradient(grad.id, 'offset', Number(e.target.value))}
                    onBlur={sortSizeGradientsByOffset}
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
                  <input
                    type="number"
                    step={INPUT_STEP}
                    min={0.0001}
                    value={grad.size}
                    onChange={(e) => updateSizeGradient(grad.id, 'size', Number(e.target.value))}
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
        </details>
      </div>

      <div className="particle-editor-preview" style={{ position: 'relative' }}>
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
