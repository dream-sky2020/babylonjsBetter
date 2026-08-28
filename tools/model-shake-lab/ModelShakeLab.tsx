import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3
} from '@babylonjs/core';
import {
  createModelEntity,
  createModelShakeController,
  createDefaultModelShakePreset,
  DEFAULT_MODEL_SHAKE_CONTROLS,
  loadModelShakePresetLibrary,
  sanitizeModelShakeControls,
  saveModelShakePresetLibrary,
  type ModelEntity,
  type ModelShakeController,
  type ModelShakePresetControls,
  type ModelShakePresetLibrary
} from '@/core/model';
import { loadModelAssetManifestByExtension } from '@/core/resources';

type LabRuntime = { engine: Engine; scene: Scene; camera: ArcRotateCamera };
type ShakeSettings = ModelShakePresetControls;
type ShakeEnabledContextValue = {
  settings: ShakeSettings;
  setEnabled: (key: 'positionEnabled' | 'rotationEnabled' | 'scaleEnabled', value: boolean) => void;
  setMode: (mode: ShakeSettings['mode']) => void;
};
const ShakeEnabledContext = createContext<ShakeEnabledContextValue | null>(null);
const makePresetKey = () => `model_shake_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
const randomRange = (min: number, max: number) => min + Math.random() * (max - min);
const roundTo = (value: number, digits: number) => Number(value.toFixed(digits));

const focusModel = (camera: ArcRotateCamera, model: ModelEntity) => {
  const meshes = model.meshes.filter((mesh) => mesh.getTotalVertices() > 0);
  if (meshes.length === 0) return;
  let minimum = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  let maximum = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    minimum = Vector3.Minimize(minimum, box.minimumWorld);
    maximum = Vector3.Maximize(maximum, box.maximumWorld);
  }
  const center = minimum.add(maximum).scale(0.5);
  const size = Math.max(Vector3.Distance(minimum, maximum), 0.05);
  camera.setTarget(center);
  camera.radius = size * 2.3;
  camera.minZ = Math.max(size / 1000, 0.0001);
  camera.maxZ = Math.max(size * 1000, 100);
};

export const ModelShakeLab = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<LabRuntime | null>(null);
  const modelRef = useRef<ModelEntity | null>(null);
  const shakeRef = useRef<ModelShakeController | null>(null);
  const completionTimerRef = useRef<number | null>(null);
  const [assets, setAssets] = useState<string[]>([]);
  const [modelPath, setModelPath] = useState('');
  const [settings, setSettings] = useState<ShakeSettings>({ ...DEFAULT_MODEL_SHAKE_CONTROLS });
  const [presets, setPresets] = useState<ModelShakePresetLibrary>({});
  const [activePresetKey, setActivePresetKey] = useState('model_shake_default');
  const [presetName, setPresetName] = useState('默认模型抖动');
  const [status, setStatus] = useState('正在初始化…');
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine(canvas, true, { stencil: true });
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.025, 0.035, 0.052, 1);
    const camera = new ArcRotateCamera('shake_lab_camera', -Math.PI / 2, Math.PI / 2.5, 6, Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.wheelPrecision = 35;
    const light = new HemisphericLight('shake_lab_light', new Vector3(0.4, 1, 0.25), scene);
    light.intensity = 1.45;
    const ground = MeshBuilder.CreateGround('shake_lab_ground', { width: 30, height: 30 }, scene);
    const material = new StandardMaterial('shake_lab_ground_material', scene);
    material.diffuseColor = new Color3(0.07, 0.095, 0.14);
    material.specularColor = Color3.Black();
    ground.material = material;
    runtimeRef.current = { engine, scene, camera };
    const resize = () => engine.resize();
    window.addEventListener('resize', resize);
    engine.runRenderLoop(() => scene.render());
    setStatus('请选择一个 GLB 模型');
    return () => {
      if (completionTimerRef.current !== null) window.clearTimeout(completionTimerRef.current);
      shakeRef.current?.dispose();
      modelRef.current?.dispose();
      window.removeEventListener('resize', resize);
      scene.dispose();
      engine.dispose();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    void loadModelShakePresetLibrary().then((loaded) => {
      const library = Object.keys(loaded).length > 0
        ? loaded
        : { model_shake_default: createDefaultModelShakePreset() };
      const first = Object.values(library)[0];
      setPresets(library);
      setActivePresetKey(first.presetKey);
      setPresetName(first.name);
      setSettings({ ...first.controls });
    }).catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error)));
  }, []);

  useEffect(() => {
    loadModelAssetManifestByExtension(/\.(glb|gltf)$/i).then((glbPaths) => {
      setAssets(glbPaths);
      setModelPath(glbPaths[0] ?? '');
    }).catch(() => setStatus('模型资源列表读取失败'));
  }, []);

  useEffect(() => {
    shakeRef.current?.setOptions({
      durationMs: settings.durationMs,
      frequencyHz: settings.frequencyHz,
      mode: settings.mode,
      positionEnabled: settings.positionEnabled,
      rotationEnabled: settings.rotationEnabled,
      scaleEnabled: settings.scaleEnabled,
      positionRange: {
        min: new Vector3(settings.positionXMin, settings.positionYMin, settings.positionZMin),
        max: new Vector3(settings.positionXMax, settings.positionYMax, settings.positionZMax)
      },
      rotationRangeDeg: {
        min: new Vector3(settings.rotationXMin, settings.rotationYMin, settings.rotationZMin),
        max: new Vector3(settings.rotationXMax, settings.rotationYMax, settings.rotationZMax)
      },
      scaleAmplitude: 0,
      scaleRange: {
        min: new Vector3(settings.scaleXMin, settings.scaleYMin, settings.scaleZMin),
        max: new Vector3(settings.scaleXMax, settings.scaleYMax, settings.scaleZMax)
      }
    });
  }, [settings]);

  const loadModel = async () => {
    const runtime = runtimeRef.current;
    if (!runtime || !modelPath || loading) return;
    if (completionTimerRef.current !== null) {
      window.clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
    setLoading(true);
    setPlaying(false);
    setModelLoaded(false);
    shakeRef.current?.dispose();
    shakeRef.current = null;
    modelRef.current?.dispose();
    modelRef.current = null;
    try {
      const model = await createModelEntity(runtime.scene, modelPath, { autoPlayAnimation: true });
      const shake = createModelShakeController(runtime.scene, model.root, {
        durationMs: settings.durationMs,
        frequencyHz: settings.frequencyHz,
        mode: settings.mode,
        positionEnabled: settings.positionEnabled,
        rotationEnabled: settings.rotationEnabled,
        scaleEnabled: settings.scaleEnabled,
        positionRange: {
          min: new Vector3(settings.positionXMin, settings.positionYMin, settings.positionZMin),
          max: new Vector3(settings.positionXMax, settings.positionYMax, settings.positionZMax)
        },
        rotationRangeDeg: {
          min: new Vector3(settings.rotationXMin, settings.rotationYMin, settings.rotationZMin),
          max: new Vector3(settings.rotationXMax, settings.rotationYMax, settings.rotationZMax)
        },
        scaleAmplitude: 0,
        scaleRange: {
          min: new Vector3(settings.scaleXMin, settings.scaleYMin, settings.scaleZMin),
          max: new Vector3(settings.scaleXMax, settings.scaleYMax, settings.scaleZMax)
        }
      });
      modelRef.current = model;
      shakeRef.current = shake;
      setModelLoaded(true);
      focusModel(runtime.camera, model);
      setStatus(`已加载：${decodeURIComponent(modelPath.split('/').pop() ?? modelPath)}`);
    } catch (error) {
      setStatus(error instanceof Error ? `加载失败：${error.message}` : String(error));
    } finally {
      setLoading(false);
    }
  };

  const playShake = () => {
    const shake = shakeRef.current;
    if (!shake) return setStatus('请先加载模型');
    if (completionTimerRef.current !== null) window.clearTimeout(completionTimerRef.current);
    shake.play();
    setPlaying(true);
    setStatus('正在播放抖动动画');
    completionTimerRef.current = window.setTimeout(() => {
      setPlaying(false);
      setStatus('抖动播放完成，模型已恢复原始变换');
      completionTimerRef.current = null;
    }, Math.max(1, settings.durationMs) + 30);
  };

  const stopShake = () => {
    if (completionTimerRef.current !== null) window.clearTimeout(completionTimerRef.current);
    completionTimerRef.current = null;
    shakeRef.current?.stop();
    setPlaying(false);
    setStatus('已停止并恢复模型变换');
  };

  const setNumber = (key: keyof ShakeSettings, value: number) => {
    if (!Number.isFinite(value)) return;
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const setEnabled = (key: 'positionEnabled' | 'rotationEnabled' | 'scaleEnabled', value: boolean) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const setMode = (mode: ShakeSettings['mode']) => {
    setSettings((current) => ({ ...current, mode }));
  };

  const selectPreset = (key: string) => {
    const preset = presets[key];
    if (!preset) return;
    setActivePresetKey(key);
    setPresetName(preset.name);
    setSettings({ ...preset.controls });
    setStatus(`已载入抖动预设：${preset.name}`);
  };

  const newPreset = () => {
    const key = makePresetKey();
    setActivePresetKey(key);
    setPresetName('新的模型抖动');
    setSettings({ ...DEFAULT_MODEL_SHAKE_CONTROLS });
    setStatus('已新建预设，点击保存后写入 Config');
  };

  const duplicatePreset = () => {
    const key = makePresetKey();
    setActivePresetKey(key);
    setPresetName(`${presetName} 副本`);
    setSettings({ ...settings });
    setStatus('已复制预设，点击保存后写入 Config');
  };

  const deletePreset = () => {
    const next = { ...presets };
    delete next[activePresetKey];
    const fallback = Object.values(next)[0] ?? createDefaultModelShakePreset();
    setPresets(Object.keys(next).length > 0 ? next : { [fallback.presetKey]: fallback });
    setActivePresetKey(fallback.presetKey);
    setPresetName(fallback.name);
    setSettings({ ...fallback.controls });
    setStatus('已删除当前预设，点击保存后写入 Config');
  };

  const savePresets = async () => {
    const normalizedSettings = sanitizeModelShakeControls(settings);
    const preset = {
      presetKey: activePresetKey,
      name: presetName.trim() || activePresetKey,
      controls: normalizedSettings
    };
    const next = { ...presets, [activePresetKey]: preset };
    setLoading(true);
    try {
      await saveModelShakePresetLibrary(next);
      setPresets(next);
      setSettings(normalizedSettings);
      setPresetName(preset.name);
      setStatus(`已保存 ${Object.keys(next).length} 个抖动预设到 Config`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  const randomizeSettings = () => {
    const pair = (limit: number, digits: number): [number, number] => [
      -roundTo(randomRange(0, limit), digits),
      roundTo(randomRange(0, limit), digits)
    ];
    const px = pair(0.2, 3); const py = pair(0.1, 3); const pz = pair(0.1, 3);
    const rx = pair(6, 1); const ry = pair(6, 1); const rz = pair(10, 1);
    const sx = pair(0.09, 3); const sy = pair(0.14, 3); const sz = pair(0.09, 3);
    setSettings((current) => ({
      durationMs: Math.round(randomRange(180, 1000) / 10) * 10,
      frequencyHz: Math.round(randomRange(10, 45)),
      mode: current.mode,
      positionEnabled: current.positionEnabled,
      rotationEnabled: current.rotationEnabled,
      scaleEnabled: current.scaleEnabled,
      positionXMin: px[0], positionXMax: px[1], positionYMin: py[0], positionYMax: py[1], positionZMin: pz[0], positionZMax: pz[1],
      rotationXMin: rx[0], rotationXMax: rx[1], rotationYMin: ry[0], rotationYMax: ry[1], rotationZMin: rz[0], rotationZMax: rz[1],
      scaleXMin: sx[0], scaleXMax: sx[1], scaleYMin: sy[0], scaleYMax: sy[1], scaleZMin: sz[0], scaleZMax: sz[1]
    }));
    setStatus('已生成随机抖动参数');
  };

  return (
    <ShakeEnabledContext.Provider value={{ settings, setEnabled, setMode }}>
    <main className="shake-lab">
      <header><div><h1>3D Model Shake Lab</h1><span>{status}</span></div><select value={modelPath} onChange={(event) => setModelPath(event.target.value)}><option value="">选择 GLB 模型…</option>{assets.map((path) => <option value={path} key={path}>{decodeURIComponent(path.replace('/resources/', ''))}</option>)}</select><button disabled={!modelPath || loading} onClick={() => void loadModel()}>{loading ? '加载中…' : '加载模型'}</button><button className="play" disabled={!modelLoaded || playing} onClick={playShake}>播放抖动</button><button disabled={!modelLoaded} onClick={stopShake}>停止</button></header>
      <section className="viewport"><canvas ref={canvasRef} /><div>左键旋转 · 右键平移 · 滚轮缩放</div></section>
      <aside><h2>抖动预设</h2><select className="preset-select" value={activePresetKey} onChange={(event) => selectPreset(event.target.value)}><option value={activePresetKey}>{presets[activePresetKey]?.name ?? presetName}</option>{Object.values(presets).filter((preset) => preset.presetKey !== activePresetKey).map((preset) => <option value={preset.presetKey} key={preset.presetKey}>{preset.name}</option>)}</select><label className="preset-name"><span>名称</span><input value={presetName} onChange={(event) => setPresetName(event.target.value)} /></label><div className="preset-actions"><button onClick={newPreset}>新建</button><button onClick={duplicatePreset}>复制</button><button className="danger" onClick={deletePreset}>删除</button><button className="save" disabled={loading} onClick={() => void savePresets()}>保存 Config</button></div><button className="random" onClick={randomizeSettings}>随机参数</button><h2 className="parameter-title">抖动参数</h2><Control label="时长" unit="ms" value={settings.durationMs} min={50} step={50} onChange={(value) => setNumber('durationMs', value)} /><Control label="频率" unit="Hz" value={settings.frequencyHz} min={1} step={1} onChange={(value) => setNumber('frequencyHz', value)} /><h3>位置变化范围</h3><RangeControl axis="X" minValue={settings.positionXMin} maxValue={settings.positionXMax} step={0.01} onMin={(value) => setNumber('positionXMin', value)} onMax={(value) => setNumber('positionXMax', value)} /><RangeControl axis="Y" minValue={settings.positionYMin} maxValue={settings.positionYMax} step={0.01} onMin={(value) => setNumber('positionYMin', value)} onMax={(value) => setNumber('positionYMax', value)} /><RangeControl axis="Z" minValue={settings.positionZMin} maxValue={settings.positionZMax} step={0.01} onMin={(value) => setNumber('positionZMin', value)} onMax={(value) => setNumber('positionZMax', value)} /><h3>旋转变化范围（度）</h3><RangeControl axis="X" minValue={settings.rotationXMin} maxValue={settings.rotationXMax} step={0.5} onMin={(value) => setNumber('rotationXMin', value)} onMax={(value) => setNumber('rotationXMax', value)} /><RangeControl axis="Y" minValue={settings.rotationYMin} maxValue={settings.rotationYMax} step={0.5} onMin={(value) => setNumber('rotationYMin', value)} onMax={(value) => setNumber('rotationYMax', value)} /><RangeControl axis="Z" minValue={settings.rotationZMin} maxValue={settings.rotationZMax} step={0.5} onMin={(value) => setNumber('rotationZMin', value)} onMax={(value) => setNumber('rotationZMax', value)} /><h3>挤压拉伸范围</h3><RangeControl axis="水平 X" minValue={settings.scaleXMin} maxValue={settings.scaleXMax} step={0.005} onMin={(value) => setNumber('scaleXMin', value)} onMax={(value) => setNumber('scaleXMax', value)} /><RangeControl axis="垂直 Y" minValue={settings.scaleYMin} maxValue={settings.scaleYMax} step={0.005} onMin={(value) => setNumber('scaleYMin', value)} onMax={(value) => setNumber('scaleYMax', value)} /><RangeControl axis="深度 Z" minValue={settings.scaleZMin} maxValue={settings.scaleZMax} step={0.005} onMin={(value) => setNumber('scaleZMin', value)} onMax={(value) => setNumber('scaleZMax', value)} /><button className="reset" onClick={() => setSettings({ ...DEFAULT_MODEL_SHAKE_CONTROLS })}>恢复默认参数</button></aside>
    </main>
    </ShakeEnabledContext.Provider>
  );
};

const Control = ({ label, unit, value, min, step, onChange }: { label: string; unit?: string; value: number; min: number; step: number; onChange: (value: number) => void }) => {
  const context = useContext(ShakeEnabledContext);
  return <>
    <label><span>{label}</span><input type="number" aria-label={`${label}${unit ? ` ${unit}` : ''}`} value={value} min={min} step={step} onChange={(event) => onChange(Number(event.target.value))} />{unit && <small>{unit}</small>}</label>
    {unit === 'Hz' && context && <label className="mode-control"><span>模式</span><select aria-label="抖动模式" value={context.settings.mode} onChange={(event) => context.setMode(event.target.value as ShakeSettings['mode'])}><option value="wave">波形模式</option><option value="random">随机模式</option></select></label>}
  </>;
};

const ChannelHeading = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) => (
  <h3 className="channel-heading"><span>{label}</span><label><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />启用</label></h3>
);

const RangeControl = ({ axis, minValue, maxValue, step, onMin, onMax }: { axis: string; minValue: number; maxValue: number; step: number; onMin: (value: number) => void; onMax: (value: number) => void }) => (
  <RangeControlWithHeading axis={axis} minValue={minValue} maxValue={maxValue} step={step} onMin={onMin} onMax={onMax} />
);

const RangeControlWithHeading = ({ axis, minValue, maxValue, step, onMin, onMax }: { axis: string; minValue: number; maxValue: number; step: number; onMin: (value: number) => void; onMax: (value: number) => void }) => {
  const context = useContext(ShakeEnabledContext);
  const channel = step === 0.01 ? 'position' : step === 0.5 ? 'rotation' : 'scale';
  const isFirstAxis = axis === 'X' || axis === '水平 X';
  const enabledKey = `${channel}Enabled` as 'positionEnabled' | 'rotationEnabled' | 'scaleEnabled';
  const label = channel === 'position' ? '位置变化范围' : channel === 'rotation' ? '旋转变化范围（度）' : '挤压拉伸范围';
  return <>
    {isFirstAxis && context && <ChannelHeading label={label} checked={context.settings[enabledKey]} onChange={(value) => context.setEnabled(enabledKey, value)} />}
    <div className="range-control"><b>{axis}</b><label><span>最小</span><input aria-label={`${axis} 最小`} type="number" value={minValue} step={step} onChange={(event) => onMin(Number(event.target.value))} /></label><label><span>最大</span><input aria-label={`${axis} 最大`} type="number" value={maxValue} step={step} onChange={(event) => onMax(Number(event.target.value))} /></label></div>
  </>;
};
