import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  Material,
  MeshBuilder,
  Scene,
  SolidParticleSystem,
  StandardMaterial,
  Texture,
  Vector3
} from '@babylonjs/core';
import {
  getAllParticlePresets,
  getParticlePreset,
  getParticleVisualPreset,
  hydrateParticlePresetStorage,
  hydrateParticleVisualPresetStorage,
  reloadParticlePresetStorage,
  reloadParticleVisualPresetStorage,
  normalizePublicPath,
  type ParticleVisualPreset
} from '@/core/particle';
import {
  createDefaultMotionParameters,
  getParticleMotionDefinition,
  particleMotionDefinitions,
  type MotionParameterDefinition,
  type MotionParameterValues,
  type ParticleMotionDefinition,
  type ParticleMotionRuntimeConfig
} from '@/core/particle-motion';
import { CommitNumberInput } from '@/core/ui/CommitNumberInput.tsx';

const DEFAULT_MODE_ID = particleMotionDefinitions[0]?.id ?? 'vortex';

const createRuntime = (): ParticleMotionRuntimeConfig => ({
  capacity: 5000,
  activeCount: 5000,
  timeScale: 1,
  sizeScale: 1,
  fieldRadius: 6,
  seed: 12345
});

const createSeededRandom = (initialSeed: number) => {
  let seed = initialSeed >>> 0;
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const groupParameters = (definition: ParticleMotionDefinition) => {
  const groups = new Map<string, Array<[string, MotionParameterDefinition]>>();
  Object.entries(definition.parameters).forEach(([key, parameter]) => {
    const group = parameter.group ?? '参数';
    groups.set(group, [...(groups.get(group) ?? []), [key, parameter]]);
  });
  return [...groups.entries()];
};

type RangeNumberControlProps = {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};

const RangeNumberControl: React.FC<RangeNumberControlProps> = ({ value, min, max, step, onChange }) => {
  const updateValue = (nextValue: number) => onChange(Math.max(min, Math.min(max, nextValue)));
  return (
    <div className="range-number-control">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => updateValue(Number(event.target.value))}
      />
      <CommitNumberInput
        min={min}
        max={max}
        step={step}
        value={value}
        onCommit={updateValue}
      />
    </div>
  );
};

const sampleSize = (preset: ParticleVisualPreset, time: number) => {
  if (!preset.sizeGradientsEnabled) return preset.baseSize;
  const gradients = [...preset.sizeGradients].sort((left, right) => left.offset - right.offset);
  if (gradients.length === 0) return preset.baseSize;
  const rightIndex = gradients.findIndex((entry) => entry.offset >= time);
  if (rightIndex === -1) return gradients[gradients.length - 1].size;
  if (rightIndex <= 0) return gradients[Math.max(0, rightIndex)].size;
  const left = gradients[rightIndex - 1];
  const right = gradients[rightIndex];
  const local = (time - left.offset) / Math.max(0.0001, right.offset - left.offset);
  return left.size + (right.size - left.size) * local;
};

const sampleColor = (preset: ParticleVisualPreset, time: number) => {
  const base = preset.baseColor;
  if (!preset.colorGradientsEnabled || preset.colorMode === 'texture' || preset.colorGradients.length === 0) {
    return new Color4(base.r, base.g, base.b, base.a);
  }
  const gradients = [...preset.colorGradients].sort((left, right) => left.offset - right.offset);
  const rightIndex = gradients.findIndex((entry) => entry.offset >= time);
  if (rightIndex === -1) {
    const color = gradients[gradients.length - 1].color;
    return new Color4(color.r, color.g, color.b, color.a);
  }
  const selectedIndex = Math.max(0, rightIndex);
  if (rightIndex <= 0) {
    const color = gradients[selectedIndex].color;
    return new Color4(color.r, color.g, color.b, color.a);
  }
  const left = gradients[rightIndex - 1];
  const right = gradients[rightIndex];
  const local = (time - left.offset) / Math.max(0.0001, right.offset - left.offset);
  return new Color4(
    left.color.r + (right.color.r - left.color.r) * local,
    left.color.g + (right.color.g - left.color.g) * local,
    left.color.b + (right.color.b - left.color.b) * local,
    left.color.a + (right.color.a - left.color.a) * local
  );
};

export const ParticleMotionLab: React.FC = () => {
  const initialDefinition = getParticleMotionDefinition(DEFAULT_MODE_ID);
  const initialRuntime = createRuntime();
  const initialParameters = createDefaultMotionParameters(initialDefinition.parameters);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef(initialRuntime);
  const definitionRef = useRef(initialDefinition);
  const parametersRef = useRef(initialParameters);
  const initialVisualPreset = getParticleVisualPreset('spark-visual');
  const visualPresetRef = useRef(initialVisualPreset);
  const rebuildRef = useRef<() => void>(() => undefined);
  const pausedRef = useRef(false);

  const [runtime, setRuntime] = useState(initialRuntime);
  const [modeId, setModeId] = useState(initialDefinition.id);
  const [parameters, setParameters] = useState(initialParameters);
  const [fps, setFps] = useState(0);
  const [paused, setPaused] = useState(false);
  const [clipboardMessage, setClipboardMessage] = useState('');
  const [particlePresetKeys, setParticlePresetKeys] = useState<string[]>(() => Object.keys(getAllParticlePresets()).sort());
  const [selectedParticlePresetKey, setSelectedParticlePresetKey] = useState('spark');
  const [visualPreset, setVisualPreset] = useState(initialVisualPreset);

  const definition = getParticleMotionDefinition(modeId);
  const parameterGroups = useMemo(() => groupParameters(definition), [definition]);

  const updateRuntime = (next: Partial<ParticleMotionRuntimeConfig>) => {
    setRuntime((current) => {
      const value = { ...current, ...next };
      runtimeRef.current = value;
      return value;
    });
  };

  const updateParameter = (key: string, value: MotionParameterValues[string]) => {
    setParameters((current) => {
      const next = { ...current, [key]: value };
      parametersRef.current = next;
      return next;
    });
  };

  const selectMode = (nextModeId: string) => {
    const nextDefinition = getParticleMotionDefinition(nextModeId);
    const nextParameters = createDefaultMotionParameters(nextDefinition.parameters);
    definitionRef.current = nextDefinition;
    parametersRef.current = nextParameters;
    setModeId(nextModeId);
    setParameters(nextParameters);
    rebuildRef.current();
  };

  const selectParticlePreset = (particlePresetKey: string) => {
    const particlePreset = getParticlePreset(particlePresetKey);
    const next = getParticleVisualPreset(particlePreset.visualPresetKey);
    setSelectedParticlePresetKey(particlePreset.presetKey);
    visualPresetRef.current = next;
    setVisualPreset(next);
    rebuildRef.current();
  };

  const refreshVisualPresets = async () => {
    try {
      await Promise.all([reloadParticlePresetStorage(), reloadParticleVisualPresetStorage()]);
      const all = getAllParticlePresets();
      const keys = Object.keys(all).sort();
      const nextParticleKey = keys.includes(selectedParticlePresetKey) ? selectedParticlePresetKey : keys[0];
      const nextParticle = getParticlePreset(nextParticleKey);
      const next = getParticleVisualPreset(nextParticle.visualPresetKey);
      setParticlePresetKeys(keys);
      setSelectedParticlePresetKey(nextParticle.presetKey);
      visualPresetRef.current = next;
      setVisualPreset(next);
      rebuildRef.current();
      setClipboardMessage(`已刷新完整粒子预设：${nextParticle.presetKey}`);
    } catch (error) {
      setClipboardMessage(`刷新视觉配置失败：${String(error)}`);
    }
  };

  const importFromClipboard = async () => {
    try {
      const raw = await navigator.clipboard.readText();
      if (!raw.trim()) throw new Error('剪贴板为空');
      const bundle = JSON.parse(raw) as { visual?: Partial<ParticleVisualPreset>; motion?: { modeId?: string; runtime?: Partial<ParticleMotionRuntimeConfig>; parameters?: MotionParameterValues } };
      if (!bundle.visual && !bundle.motion) throw new Error('不是 particle-lab-preset 组合配置');
      if (bundle.visual) {
        const nextVisual = { ...visualPresetRef.current, ...bundle.visual, presetKey: bundle.visual.presetKey || visualPresetRef.current.presetKey } as ParticleVisualPreset;
        visualPresetRef.current = nextVisual;
        setVisualPreset(nextVisual);
      }
      if (bundle.motion) {
        const nextDefinition = getParticleMotionDefinition(bundle.motion.modeId || modeId);
        const defaults = createDefaultMotionParameters(nextDefinition.parameters);
        const importedParameters = bundle.motion.parameters ?? {};
        const nextParameters = Object.fromEntries(Object.keys(defaults).map((key) => [key, importedParameters[key] ?? defaults[key]]));
        const requestedRuntime = { ...runtimeRef.current, ...bundle.motion.runtime };
        const nextRuntime = { capacity: Math.max(100, Math.min(50000, Math.round(Number(requestedRuntime.capacity) || 100))), activeCount: 0, timeScale: Math.max(0.1, Math.min(3, Number(requestedRuntime.timeScale) || 1)), sizeScale: Math.max(0.01, Math.min(20, Number(requestedRuntime.sizeScale) || 1)), fieldRadius: Math.max(2, Math.min(12, Number(requestedRuntime.fieldRadius) || 6)), seed: Math.trunc(Number(requestedRuntime.seed) || 0) };
        nextRuntime.activeCount = Math.max(0, Math.min(nextRuntime.capacity, Math.round(Number(requestedRuntime.activeCount) || 0)));
        definitionRef.current = nextDefinition; parametersRef.current = nextParameters; runtimeRef.current = nextRuntime;
        setModeId(nextDefinition.id); setParameters(nextParameters); setRuntime(nextRuntime);
      }
      rebuildRef.current();
      setClipboardMessage('已从剪贴板导入视觉和运动配置。');
    } catch (error) { setClipboardMessage(`导入失败：${String(error)}`); }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ format: 'particle-lab-preset', version: 1, visual: visualPreset, motion: { modeId, runtime, parameters } }, null, 2));
      setClipboardMessage('已复制视觉和运动配置。');
    } catch (error) { setClipboardMessage(`复制失败：${String(error)}`); }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.all([hydrateParticlePresetStorage(), hydrateParticleVisualPresetStorage()]);
      if (cancelled) return;
      const all = getAllParticlePresets();
      const keys = Object.keys(all).sort();
      setParticlePresetKeys(keys);
      const selectedKey = keys.includes(selectedParticlePresetKey) ? selectedParticlePresetKey : keys[0];
      const particlePreset = getParticlePreset(selectedKey);
      const next = getParticleVisualPreset(particlePreset.visualPresetKey);
      setSelectedParticlePresetKey(particlePreset.presetKey);
      visualPresetRef.current = next;
      setVisualPreset(next);
      rebuildRef.current();
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas, true);
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.025, 0.035, 0.06, 1);
    const camera = new ArcRotateCamera('motion-camera', -Math.PI / 2, Math.PI / 2.7, 15, Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 4;
    camera.upperRadiusLimit = 35;
    new HemisphericLight('motion-light', new Vector3(0, 1, 0), scene).intensity = 0.9;

    const guide = MeshBuilder.CreateTorus('field-guide', { diameter: 12, thickness: 0.025, tessellation: 96 }, scene);
    const guideMaterial = new StandardMaterial('field-guide-material', scene);
    guideMaterial.emissiveColor = new Color3(0.1, 0.35, 0.55);
    guideMaterial.alpha = 0.35;
    guide.material = guideMaterial;

    let sps: SolidParticleSystem | null = null;
    let particleStates: unknown[] = [];
    let particleSizeFactors: number[] = [];
    let elapsedSeconds = 0;
    let random = createSeededRandom(runtimeRef.current.seed);
    let updateAtlasUvs: (() => void) | null = null;
    let activeDefinition = definitionRef.current;

    const rebuild = () => {
      sps?.dispose();
      updateAtlasUvs = null;
      const currentRuntime = runtimeRef.current;
      const currentDefinition = definitionRef.current;
      const currentParameters = parametersRef.current;
      const currentVisual = visualPresetRef.current;
      activeDefinition = currentDefinition;
      random = createSeededRandom(currentRuntime.seed);
      elapsedSeconds = 0;

      const shape = MeshBuilder.CreatePlane('particle-shape', { size: 1 }, scene);
      const next = new SolidParticleSystem('controlled-particles', scene, { updatable: true });
      next.billboard = true;
      next.addShape(shape, currentRuntime.capacity);
      shape.dispose();

      const material = new StandardMaterial('controlled-particle-material', scene);
      const texturePath = encodeURI(`/${normalizePublicPath(currentVisual.texturePath).replace(/^public\//, '')}`);
      const texture = new Texture(texturePath, scene);
      texture.hasAlpha = true;
      material.diffuseTexture = texture;
      material.emissiveTexture = texture;
      material.useAlphaFromDiffuseTexture = true;
      material.emissiveColor = Color3.White();
      material.diffuseColor = Color3.White();
      material.disableLighting = true;
      material.backFaceCulling = false;
      material.alphaMode = currentVisual.blendMode === 'overwrite'
        ? Engine.ALPHA_DISABLE
        : currentVisual.blendMode === 'add'
          ? Engine.ALPHA_ADD
          : currentVisual.blendMode === 'multiply'
            ? Engine.ALPHA_MULTIPLY
            : Engine.ALPHA_COMBINE;
      if (currentVisual.blendMode === 'overwrite') {
        material.useAlphaFromDiffuseTexture = false;
        material.transparencyMode = Material.MATERIAL_OPAQUE;
      }
      next.buildMesh().material = material;

      const createContext = { random, runtime: currentRuntime };
      particleStates = Array.from(
        { length: currentRuntime.capacity },
        () => currentDefinition.createState(createContext, currentParameters)
      );
      const sizeRandom = createSeededRandom(currentRuntime.seed ^ 0x73697a65);
      const baseSize = Math.max(0.0001, currentVisual.baseSize);
      particleSizeFactors = Array.from({ length: currentRuntime.capacity }, () => {
        const randomSize = currentVisual.minSize + sizeRandom() * (currentVisual.maxSize - currentVisual.minSize);
        return randomSize / baseSize;
      });
      const atlasRandom = createSeededRandom(currentRuntime.seed ^ 0x51f15e);
      const atlasCellIds = Array.from({ length: currentRuntime.capacity }, () => {
        const sheet = currentVisual.spriteSheet;
        if (!sheet) return 0;
        const count = Math.max(1, sheet.endCellID - sheet.startCellID + 1);
        return sheet.randomStartCell
          ? sheet.startCellID + Math.floor(atlasRandom() * count)
          : sheet.startCellID;
      });
      const applyAtlasUvs = () => {
        const sheet = currentVisual.spriteSheet;
        if (!sheet) return;
        const textureSize = texture.getSize();
        const columns = Math.max(1, Math.floor(textureSize.width / sheet.cellWidth));
        const rows = Math.max(1, Math.floor(textureSize.height / sheet.cellHeight));
        const lastCell = columns * rows - 1;
        const configuredCellCount = Math.max(1, sheet.endCellID - sheet.startCellID + 1);
        const animationFrame = sheet.playbackMode === 'loop'
          ? Math.floor(elapsedSeconds * sheet.framesPerSecond)
          : 0;
        next.particles.forEach((particle, index) => {
          const initialOffset = atlasCellIds[index] - sheet.startCellID;
          const configuredCell = sheet.startCellID + (initialOffset + animationFrame) % configuredCellCount;
          const cell = Math.min(lastCell, Math.max(0, configuredCell));
          const column = cell % columns;
          const row = Math.floor(cell / columns);
          particle.uvs.set(column / columns, row / rows, (column + 1) / columns, (row + 1) / rows);
        });
      };
      next.initParticles = () => {
        next.particles.forEach((particle, index) => {
          currentDefinition.initialize(
            particle,
            particleStates[index],
            createContext,
            currentParameters
          );
          const visualTime = (index * 0.013) % 1;
          particle.color = sampleColor(currentVisual, visualTime);
          particle.scaling.setAll(sampleSize(currentVisual, visualTime) * particleSizeFactors[index] * currentRuntime.sizeScale);
          if (index >= currentRuntime.activeCount) particle.color.a = 0;
        });
      };
      next.initParticles();
      next.setParticles();
      if (currentVisual.spriteSheet) {
        if (currentVisual.spriteSheet.playbackMode === 'loop') updateAtlasUvs = applyAtlasUvs;
        if (texture.isReady()) { applyAtlasUvs(); next.setParticles(); }
        else texture.onLoadObservable.addOnce(() => { applyAtlasUvs(); next.setParticles(); });
      }
      sps = next;
    };

    rebuildRef.current = rebuild;
    rebuild();

    let lastFpsUpdate = 0;
    engine.runRenderLoop(() => {
      const deltaSeconds = Math.min(engine.getDeltaTime() / 1000, 0.05) * runtimeRef.current.timeScale;
      if (!pausedRef.current && sps) {
        elapsedSeconds += deltaSeconds;
        const updateContext = {
          random,
          runtime: runtimeRef.current,
          deltaSeconds,
          elapsedSeconds
        };
        sps.updateParticle = (particle) => {
          if (particle.idx < runtimeRef.current.activeCount) {
            activeDefinition.update(
              particle,
              particleStates[particle.idx],
              updateContext,
              parametersRef.current
            );
            const visualTime = (elapsedSeconds * 0.5 + particle.idx * 0.013) % 1;
            particle.color = sampleColor(visualPresetRef.current, visualTime);
            particle.scaling.setAll(sampleSize(visualPresetRef.current, visualTime) * particleSizeFactors[particle.idx] * runtimeRef.current.sizeScale);
          } else if (particle.color) particle.color.a = 0;
          return particle;
        };
        updateAtlasUvs?.();
        sps.setParticles();
      }
      scene.render();
      const now = performance.now();
      if (now - lastFpsUpdate > 400) {
        setFps(Math.round(engine.getFps()));
        lastFpsUpdate = now;
      }
    });

    const resize = () => engine.resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      rebuildRef.current = () => undefined;
      scene.dispose();
      engine.dispose();
    };
  }, []);

  const renderParameter = (key: string, parameter: MotionParameterDefinition) => {
    const value = parameters[key];
    if (parameter.type === 'number') {
      return <label key={key}>{parameter.label}<RangeNumberControl min={parameter.min} max={parameter.max} step={parameter.step} value={Number(value)} onChange={(nextValue) => updateParameter(key, nextValue)} />{parameter.description && <small>{parameter.description}</small>}</label>;
    }
    if (parameter.type === 'boolean') {
      return <label className="checkbox-field" key={key}><input type="checkbox" checked={Boolean(value)} onChange={(event) => updateParameter(key, event.target.checked)} />{parameter.label}</label>;
    }
    if (parameter.type === 'select') {
      return <label key={key}>{parameter.label}<select value={String(value)} onChange={(event) => updateParameter(key, event.target.value)}>{parameter.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>;
    }
    const vector = value as { x: number; y: number; z: number };
    return <fieldset className="vector-field" key={key}><legend>{parameter.label}</legend>{(['x', 'y', 'z'] as const).map((axis) => <label key={axis}>{axis.toUpperCase()}<CommitNumberInput value={vector[axis]} min={parameter.min} max={parameter.max} step={parameter.step ?? 0.1} onCommit={(value) => updateParameter(key, { ...vector, [axis]: value })} /></label>)}</fieldset>;
  };

  const setSimulationPaused = (nextPaused: boolean) => {
    pausedRef.current = nextPaused;
    setPaused(nextPaused);
  };

  return (
    <main className="motion-lab">
      <header>
        <div><h1>粒子运动接管 Lab</h1><p>自动扫描运动插件 · CPU 模拟 · SPS 批量渲染</p></div>
        <div className="metrics"><strong>{fps} FPS</strong><span>{runtime.activeCount.toLocaleString()} / {runtime.capacity.toLocaleString()} 粒子</span></div>
      </header>
      <aside>
        <section className="panel-section">
          <h2>剪贴板配置</h2>
          <button onClick={() => void importFromClipboard()}>从剪贴板一键导入</button>
          <button className="secondary" onClick={() => void copyToClipboard()}>复制当前组合配置</button>
          {clipboardMessage ? <p className="note">{clipboardMessage}</p> : null}
        </section>
        <section className="panel-section">
          <h2>播放控制</h2>
          <div className="playback-controls">
            <button onClick={() => setSimulationPaused(!paused)}>
              {paused ? '播放' : '暂停'}
            </button>
          </div>
        </section>
        <section className="panel-section">
          <h2>完整粒子预设</h2>
          <label>预设
            <select value={selectedParticlePresetKey} onChange={(event) => selectParticlePreset(event.target.value)}>
              {particlePresetKeys.map((key) => <option value={key} key={key}>{key}</option>)}
            </select>
          </label>
          <p className="mode-description">{visualPreset.name}</p>
          <span className="mode-version">{visualPreset.colorMode} · {visualPreset.blendMode}</span>
          <span className="mode-version"> · 随机尺寸 {visualPreset.minSize.toFixed(3)}–{visualPreset.maxSize.toFixed(3)}</span>
          {visualPreset.spriteSheet ? <span className="mode-version">图集 {visualPreset.spriteSheet.cellWidth}×{visualPreset.spriteSheet.cellHeight}px · 格 {visualPreset.spriteSheet.startCellID}–{visualPreset.spriteSheet.endCellID} · {visualPreset.spriteSheet.playbackMode === 'loop' ? `${visualPreset.spriteSheet.framesPerSecond} FPS 循环` : '静态帧'} · {visualPreset.spriteSheet.randomStartCell ? '随机起始' : '统一起始'}</span> : null}
          <button className="secondary refresh-visual-button" onClick={() => void refreshVisualPresets()}>刷新视觉配置</button>
          <a className="editor-link" href="/tools/particle-editor/index.html">在 Particle Editor 中编辑视觉</a>
        </section>
        <section className="panel-section">
          <h2>运动模式</h2>
          <label>模式<select value={modeId} onChange={(event) => selectMode(event.target.value)}>{particleMotionDefinitions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <p className="mode-description">{definition.description}</p>
          <span className="mode-version">{definition.id} · v{definition.version}</span>
        </section>

        <section className="panel-section">
          <h2>运行参数</h2>
          <label>容量<CommitNumberInput min="100" max="50000" step="100" value={runtime.capacity} onCommit={(value) => { const capacity = Math.max(100, Math.min(50000, Math.round(value))); updateRuntime({ capacity, activeCount: Math.min(runtime.activeCount, capacity) }); }} /></label>
          <label>活跃数量<CommitNumberInput min="0" max={runtime.capacity} step="100" value={runtime.activeCount} onCommit={(value) => updateRuntime({ activeCount: Math.max(0, Math.min(runtime.capacity, Math.round(value))) })} /></label>
          <label>时间速度<RangeNumberControl min={0.1} max={3} step={0.05} value={runtime.timeScale} onChange={(timeScale) => updateRuntime({ timeScale })} /></label>
          <label>尺寸倍率<RangeNumberControl min={0.05} max={10} step={0.05} value={runtime.sizeScale} onChange={(sizeScale) => updateRuntime({ sizeScale })} /></label>
          <label>场半径<RangeNumberControl min={2} max={12} step={0.5} value={runtime.fieldRadius} onChange={(fieldRadius) => updateRuntime({ fieldRadius })} /></label>
          <label>随机种子<CommitNumberInput value={runtime.seed} onCommit={(value) => updateRuntime({ seed: Math.trunc(value) })} /></label>
          <button onClick={() => rebuildRef.current()}>重新生成粒子</button>
        </section>

        {parameterGroups.map(([group, entries]) => <section className="panel-section" key={group}><h2>{group}</h2>{entries.map(([key, parameter]) => renderParameter(key, parameter))}</section>)}

        <p className="note">新增模式只需在 core/particle-motion/modes 下创建目录并默认导出定义，Lab 会自动发现。</p>
      </aside>
      <section className="viewport"><canvas ref={canvasRef} /></section>
    </main>
  );
};
