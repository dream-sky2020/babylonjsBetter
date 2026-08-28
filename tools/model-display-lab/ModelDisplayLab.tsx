import { useEffect, useRef, useState } from 'react';
import { ArcRotateCamera, Color3, Color4, Engine, HemisphericLight, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import {
  createDefaultModelDisplayConfig,
  createModelEntity,
  loadModelDisplayConfigLibrary,
  saveModelDisplayConfigLibrary,
  type ModelDisplayConfig,
  type ModelDisplayConfigLibrary,
  type ModelEntity
} from '@/core/model';
import { loadModelAssetManifestByExtension } from '@/core/resources';

const degreesToRadians = Math.PI / 180;

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
  camera.radius = size * 2.2;
  camera.minZ = Math.max(size / 1000, 0.0001);
  camera.maxZ = Math.max(size * 1000, 100);
};

export const ModelDisplayLab = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const modelRef = useRef<ModelEntity | null>(null);
  const settingsRef = useRef<ModelDisplayConfig>(createDefaultModelDisplayConfig(''));
  const libraryRef = useRef<ModelDisplayConfigLibrary>({});
  const spinRef = useRef(0);
  const [assets, setAssets] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState('');
  const [settings, setSettings] = useState<ModelDisplayConfig>(createDefaultModelDisplayConfig(''));
  const [status, setStatus] = useState('正在初始化…');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine(canvas, true, { stencil: true });
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.025, 0.035, 0.052, 1);
    const camera = new ArcRotateCamera('model_display_camera', -Math.PI / 2, Math.PI / 2.5, 6, Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.wheelPrecision = 35;
    const light = new HemisphericLight('model_display_light', new Vector3(0.4, 1, 0.25), scene);
    light.intensity = 1.45;
    const ground = MeshBuilder.CreateGround('model_display_ground', { width: 30, height: 30 }, scene);
    const material = new StandardMaterial('model_display_ground_material', scene);
    material.diffuseColor = new Color3(0.07, 0.095, 0.14);
    material.specularColor = Color3.Black();
    ground.material = material;
    sceneRef.current = scene;
    cameraRef.current = camera;
    engine.runRenderLoop(() => {
      const model = modelRef.current;
      const current = settingsRef.current;
      if (model) {
        spinRef.current += current.rotationSpeedDegPerSec * engine.getDeltaTime() / 1000;
        model.root.rotation.set(
          current.rotationDeg.x * degreesToRadians,
          (current.rotationDeg.y + spinRef.current) * degreesToRadians,
          current.rotationDeg.z * degreesToRadians
        );
        model.root.scaling.setAll(current.scale);
        camera.radius = current.cameraDistance;
      }
      scene.render();
    });
    const resize = () => engine.resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      modelRef.current?.dispose();
      scene.dispose();
      engine.dispose();
    };
  }, []);

  useEffect(() => {
    void loadModelDisplayConfigLibrary().then((loadedLibrary) => {
      libraryRef.current = loadedLibrary;
      const currentPath = settingsRef.current.modelPath;
      if (currentPath && loadedLibrary[currentPath]) {
        settingsRef.current = loadedLibrary[currentPath];
        setSettings(loadedLibrary[currentPath]);
      }
    }).catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error)));
  }, []);

  useEffect(() => {
    loadModelAssetManifestByExtension(/\.(glb|gltf)$/i).then((paths) => {
      const firstPath = paths[0] ?? '';
      const firstSettings = libraryRef.current[firstPath] ?? createDefaultModelDisplayConfig(firstPath);
      setAssets(paths);
      setSelectedPath(firstPath);
      setSettings(firstSettings);
      settingsRef.current = firstSettings;
      setStatus(paths.length ? `发现 ${paths.length} 个可配置模型` : '没有发现 GLB/GLTF 模型');
    }).catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error)));
  }, []);

  useEffect(() => {
    if (!selectedPath || !sceneRef.current || !cameraRef.current) return;
    let cancelled = false;
    setLoading(true);
    modelRef.current?.dispose();
    modelRef.current = null;
    void createModelEntity(sceneRef.current, selectedPath, { autoPlayAnimation: true }).then((model) => {
      if (cancelled) return model.dispose();
      model.root.rotationQuaternion = null;
      modelRef.current = model;
      focusModel(cameraRef.current!, model);
      cameraRef.current!.radius = settingsRef.current.cameraDistance;
      setStatus(`正在展览：${decodeURIComponent(selectedPath.split('/').pop() ?? selectedPath)}`);
    }).catch((error: unknown) => setStatus(error instanceof Error ? `加载失败：${error.message}` : String(error)))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedPath]);

  const selectModel = (modelPath: string) => {
    const next = libraryRef.current[modelPath] ?? createDefaultModelDisplayConfig(modelPath);
    spinRef.current = 0;
    settingsRef.current = next;
    setSettings(next);
    setSelectedPath(modelPath);
  };

  const updateSettings = (patch: Partial<Omit<ModelDisplayConfig, 'modelPath'>>) => {
    const next = { ...settings, ...patch, modelPath: selectedPath };
    spinRef.current = 0;
    settingsRef.current = next;
    setSettings(next);
    libraryRef.current = { ...libraryRef.current, [selectedPath]: next };
  };

  const updateRotation = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!Number.isFinite(value)) return;
    updateSettings({ rotationDeg: { ...settings.rotationDeg, [axis]: value } });
  };

  const save = async () => {
    if (!selectedPath || saving) return;
    const nextLibrary = { ...libraryRef.current, [selectedPath]: settingsRef.current };
    setSaving(true);
    try {
      await saveModelDisplayConfigLibrary(nextLibrary);
      libraryRef.current = nextLibrary;
      setStatus(`已保存 ${Object.keys(nextLibrary).length} 个模型的展览配置`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally { setSaving(false); }
  };

  const reset = () => {
    const next = createDefaultModelDisplayConfig(selectedPath);
    spinRef.current = 0;
    settingsRef.current = next;
    setSettings(next);
    libraryRef.current = { ...libraryRef.current, [selectedPath]: next };
  };

  return <main className="model-display-lab">
    <header><div><h1>3D 模型展览配置 Lab</h1><span>{status}</span></div><select aria-label="选择模型" value={selectedPath} onChange={(event) => selectModel(event.target.value)}><option value="">选择 GLB/GLTF 模型…</option>{assets.map((path) => <option key={path} value={path}>{decodeURIComponent(path.replace('/resources/', ''))}</option>)}</select><button disabled={!selectedPath || saving} onClick={() => void save()}>{saving ? '保存中…' : '保存 Config'}</button></header>
    <section className="viewport"><canvas ref={canvasRef} /><div>左键旋转视角 · 右键平移 · 滚轮缩放</div></section>
    <aside><h2>默认展览参数</h2><p>{loading ? '正在加载模型…' : decodeURIComponent(selectedPath.replace('/resources/', ''))}</p><NumberControl label="角度 X" unit="°" value={settings.rotationDeg.x} min={-360} max={360} step={1} onChange={(value) => updateRotation('x', value)} /><NumberControl label="角度 Y" unit="°" value={settings.rotationDeg.y} min={-360} max={360} step={1} onChange={(value) => updateRotation('y', value)} /><NumberControl label="角度 Z" unit="°" value={settings.rotationDeg.z} min={-360} max={360} step={1} onChange={(value) => updateRotation('z', value)} /><NumberControl label="缩放大小" value={settings.scale} min={0.001} max={1000} step={0.05} onChange={(scale) => updateSettings({ scale })} /><NumberControl label="摄像机距离" value={settings.cameraDistance} min={0.01} max={100000} step={0.1} onChange={(cameraDistance) => updateSettings({ cameraDistance })} /><NumberControl label="旋转速度" unit="°/s" value={settings.rotationSpeedDegPerSec} min={-720} max={720} step={1} onChange={(rotationSpeedDegPerSec) => updateSettings({ rotationSpeedDegPerSec })} /><small>摄像机距离是模型中心到摄像机的精确半径；速度为 0 时停止旋转，负数反向旋转。</small><button className="reset" disabled={!selectedPath} onClick={reset}>恢复该模型默认值</button></aside>
  </main>;
};

const NumberControl = ({ label, unit, value, min, max, step, onChange }: { label: string; unit?: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) => <label><span>{label}</span><input aria-label={label} type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />{unit && <small>{unit}</small>}</label>;
