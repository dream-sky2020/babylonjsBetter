import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  SolidParticleSystem,
  StandardMaterial,
  Vector3
} from '@babylonjs/core';
import {
  createDefaultMotionParameters,
  getParticleMotionDefinition,
  particleMotionDefinitions,
  type MotionParameterDefinition,
  type MotionParameterValues,
  type ParticleMotionDefinition,
  type ParticleMotionRuntimeConfig
} from '@/core/particle-motion';

const DEFAULT_MODE_ID = particleMotionDefinitions[0]?.id ?? 'vortex';

const createRuntime = (): ParticleMotionRuntimeConfig => ({
  capacity: 5000,
  activeCount: 5000,
  timeScale: 1,
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

export const ParticleMotionLab: React.FC = () => {
  const initialDefinition = getParticleMotionDefinition(DEFAULT_MODE_ID);
  const initialRuntime = createRuntime();
  const initialParameters = createDefaultMotionParameters(initialDefinition.parameters);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef(initialRuntime);
  const definitionRef = useRef(initialDefinition);
  const parametersRef = useRef(initialParameters);
  const rebuildRef = useRef<() => void>(() => undefined);
  const pausedRef = useRef(false);

  const [runtime, setRuntime] = useState(initialRuntime);
  const [modeId, setModeId] = useState(initialDefinition.id);
  const [parameters, setParameters] = useState(initialParameters);
  const [fps, setFps] = useState(0);
  const [paused, setPaused] = useState(false);

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
    window.requestAnimationFrame(() => rebuildRef.current());
  };

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
    let elapsedSeconds = 0;
    let random = createSeededRandom(runtimeRef.current.seed);

    const rebuild = () => {
      sps?.dispose();
      const currentRuntime = runtimeRef.current;
      const currentDefinition = definitionRef.current;
      random = createSeededRandom(currentRuntime.seed);
      elapsedSeconds = 0;

      const shape = MeshBuilder.CreatePolyhedron('particle-shape', { type: 1, size: 0.055 }, scene);
      const next = new SolidParticleSystem('controlled-particles', scene, { updatable: true });
      next.addShape(shape, currentRuntime.capacity);
      shape.dispose();

      const material = new StandardMaterial('controlled-particle-material', scene);
      material.emissiveColor = new Color3(0.2, 0.8, 1);
      material.disableLighting = true;
      next.buildMesh().material = material;

      const createContext = { random, runtime: currentRuntime };
      particleStates = Array.from(
        { length: currentRuntime.capacity },
        () => currentDefinition.createState(createContext, parametersRef.current)
      );
      next.initParticles = () => {
        next.particles.forEach((particle, index) => {
          currentDefinition.initialize(
            particle,
            particleStates[index],
            createContext,
            parametersRef.current
          );
          particle.color = new Color4(
            0.15 + random() * 0.25,
            0.65 + random() * 0.3,
            1,
            index < currentRuntime.activeCount ? 0.9 : 0
          );
        });
      };
      next.initParticles();
      next.setParticles();
      sps = next;
    };

    rebuildRef.current = rebuild;
    rebuild();

    let lastFpsUpdate = 0;
    engine.runRenderLoop(() => {
      const deltaSeconds = Math.min(engine.getDeltaTime() / 1000, 0.05) * runtimeRef.current.timeScale;
      if (!pausedRef.current && sps) {
        elapsedSeconds += deltaSeconds;
        const currentDefinition = definitionRef.current;
        const updateContext = {
          random,
          runtime: runtimeRef.current,
          deltaSeconds,
          elapsedSeconds
        };
        sps.updateParticle = (particle) => {
          if (particle.idx < runtimeRef.current.activeCount) {
            currentDefinition.update(
              particle,
              particleStates[particle.idx],
              updateContext,
              parametersRef.current
            );
            if (particle.color) particle.color.a = 0.9;
          } else if (particle.color) particle.color.a = 0;
          return particle;
        };
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
      return <label key={key}>{parameter.label}<output>{Number(value).toFixed(2)}</output><input type="range" min={parameter.min} max={parameter.max} step={parameter.step} value={Number(value)} onChange={(event) => updateParameter(key, Number(event.target.value))} />{parameter.description && <small>{parameter.description}</small>}</label>;
    }
    if (parameter.type === 'boolean') {
      return <label className="checkbox-field" key={key}><input type="checkbox" checked={Boolean(value)} onChange={(event) => updateParameter(key, event.target.checked)} />{parameter.label}</label>;
    }
    if (parameter.type === 'select') {
      return <label key={key}>{parameter.label}<select value={String(value)} onChange={(event) => updateParameter(key, event.target.value)}>{parameter.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>;
    }
    const vector = value as { x: number; y: number; z: number };
    return <fieldset className="vector-field" key={key}><legend>{parameter.label}</legend>{(['x', 'y', 'z'] as const).map((axis) => <label key={axis}>{axis.toUpperCase()}<input type="number" value={vector[axis]} min={parameter.min} max={parameter.max} step={parameter.step ?? 0.1} onChange={(event) => updateParameter(key, { ...vector, [axis]: Number(event.target.value) })} /></label>)}</fieldset>;
  };

  const togglePaused = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  };

  return (
    <main className="motion-lab">
      <header>
        <div><h1>粒子运动接管 Lab</h1><p>自动扫描运动插件 · CPU 模拟 · SPS 批量渲染</p></div>
        <div className="metrics"><strong>{fps} FPS</strong><span>{runtime.activeCount.toLocaleString()} / {runtime.capacity.toLocaleString()} 粒子</span></div>
      </header>
      <aside>
        <section className="panel-section">
          <h2>运动模式</h2>
          <label>模式<select value={modeId} onChange={(event) => selectMode(event.target.value)}>{particleMotionDefinitions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <p className="mode-description">{definition.description}</p>
          <span className="mode-version">{definition.id} · v{definition.version}</span>
        </section>

        <section className="panel-section">
          <h2>运行参数</h2>
          <label>容量<input type="number" min="100" max="50000" step="100" value={runtime.capacity} onChange={(event) => { const capacity = Math.max(100, Math.min(50000, Number(event.target.value) || 100)); updateRuntime({ capacity, activeCount: Math.min(runtime.activeCount, capacity) }); }} /></label>
          <label>活跃数量<input type="number" min="0" max={runtime.capacity} step="100" value={runtime.activeCount} onChange={(event) => updateRuntime({ activeCount: Math.max(0, Math.min(runtime.capacity, Number(event.target.value) || 0)) })} /></label>
          <label>时间速度 <output>{runtime.timeScale.toFixed(2)}</output><input type="range" min="0.1" max="3" step="0.05" value={runtime.timeScale} onChange={(event) => updateRuntime({ timeScale: Number(event.target.value) })} /></label>
          <label>场半径 <output>{runtime.fieldRadius.toFixed(1)}</output><input type="range" min="2" max="12" step="0.5" value={runtime.fieldRadius} onChange={(event) => updateRuntime({ fieldRadius: Number(event.target.value) })} /></label>
          <label>随机种子<input type="number" value={runtime.seed} onChange={(event) => updateRuntime({ seed: Math.trunc(Number(event.target.value) || 0) })} /></label>
          <button onClick={() => rebuildRef.current()}>重新生成粒子</button>
        </section>

        {parameterGroups.map(([group, entries]) => <section className="panel-section" key={group}><h2>{group}</h2>{entries.map(([key, parameter]) => renderParameter(key, parameter))}</section>)}

        <button className="secondary" onClick={togglePaused}>{paused ? '继续模拟' : '暂停模拟'}</button>
        <p className="note">新增模式只需在 core/particle-motion/modes 下创建目录并默认导出定义，Lab 会自动发现。</p>
      </aside>
      <section className="viewport"><canvas ref={canvasRef} /></section>
    </main>
  );
};
