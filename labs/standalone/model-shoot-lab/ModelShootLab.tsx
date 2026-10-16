import { useEffect, useRef, useState } from 'react';
import { ArcRotateCamera, Color3, Color4, Engine, HemisphericLight, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import { createModelEntity, type ModelEntity } from '@/core/model';
import { CONFIG_READ_ONLY_MESSAGE, downloadConfigJson, isConfigWritable, loadConfig } from '@/core/config';
import { loadModelAssetManifestByExtension } from '@/core/resources';
import { requestDevServer } from '@/core/network/devServerPortResolver.ts';

type ShootConfig = { modelPath: string; fireIntervalMs: number; recoilAngleDeg: number };
const defaults = (modelPath = ''): ShootConfig => ({ modelPath, fireIntervalMs: 250, recoilAngleDeg: -8 });
const configUrl = '/config/modelShootConfigs.json';
const apiUrl = '/api/model-shoot-configs';

export const ModelShootLab = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const modelRef = useRef<ModelEntity | null>(null);
  const baseRotationRef = useRef(new Vector3());
  const configsRef = useRef<Record<string, ShootConfig>>({});
  const [assets, setAssets] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState('');
  const [config, setConfig] = useState(defaults());
  const [status, setStatus] = useState('正在初始化…');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const engine = new Engine(canvas, true, { stencil: true });
    const scene = new Scene(engine); sceneRef.current = scene; scene.clearColor = new Color4(0.025, 0.035, 0.052, 1);
    const camera = new ArcRotateCamera('shoot_camera', -Math.PI / 2, Math.PI / 2.5, 6, Vector3.Zero(), scene); camera.attachControl(canvas, true);
    new HemisphericLight('shoot_light', new Vector3(0.4, 1, 0.25), scene).intensity = 1.5;
    const ground = MeshBuilder.CreateGround('shoot_ground', { width: 30, height: 30 }, scene);
    const material = new StandardMaterial('shoot_ground_mat', scene); material.diffuseColor = new Color3(0.07, 0.095, 0.14); ground.material = material;
    engine.runRenderLoop(() => scene.render());
    return () => { modelRef.current?.dispose(); scene.dispose(); engine.dispose(); };
  }, []);

  useEffect(() => {
    void loadConfig<unknown>(configUrl).then((raw) => { if (raw && typeof raw === 'object') configsRef.current = raw as Record<string, ShootConfig>; }).catch(() => undefined);
    void loadModelAssetManifestByExtension(/\.(glb|gltf)$/i).then((models) => {
      setAssets(models); if (models[0]) selectModel(models[0]);
    });
  }, []);

  function selectModel(path: string) {
    const next = { ...defaults(path), ...configsRef.current[path], modelPath: path };
    setSelectedPath(path); setConfig(next); setStatus(`准备开火：${decodeURIComponent(path.split('/').pop() ?? path)}`); setLoading(true);
    modelRef.current?.dispose();
    if (sceneRef.current) void createModelEntity(sceneRef.current, path, { autoPlayAnimation: true }).then((model) => {
      model.root.rotationQuaternion = null; modelRef.current = model; baseRotationRef.current.copyFrom(model.root.rotation); setLoading(false);
    });
  }

  const update = (patch: Partial<ShootConfig>) => { const next = { ...config, ...patch, modelPath: selectedPath }; setConfig(next); configsRef.current[selectedPath] = next; };
  const fire = () => {
    const model = modelRef.current; if (!model) return;
    model.root.rotation.copyFrom(baseRotationRef.current); model.root.rotation.z += config.recoilAngleDeg * Math.PI / 180;
    window.setTimeout(() => modelRef.current?.root.rotation.copyFrom(baseRotationRef.current), Math.min(config.fireIntervalMs, 400));
    setStatus('已播放开火动作（粒子特效暂未接入）');
  };
  const save = async () => {
    if (!isConfigWritable()) { downloadConfigJson('modelShootConfigs.json', configsRef.current); setStatus(CONFIG_READ_ONLY_MESSAGE); return; }
    setSaving(true);
    try { const response = await requestDevServer(apiUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(configsRef.current) }); if (!response.ok) throw new Error('保存失败'); setStatus(`已保存 ${Object.keys(configsRef.current).length} 个模型的开火配置`); } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); } finally { setSaving(false); }
  };

  return <main className="shoot-lab"><header><div><h1>3D 模型射击动画 Lab</h1><span>{status}</span></div><select aria-label="选择模型" value={selectedPath} onChange={(event) => selectModel(event.target.value)}><option value="">选择模型…</option>{assets.map((path) => <option key={path} value={path}>{decodeURIComponent(path.replace('/resources/', ''))}</option>)}</select><button onClick={fire} disabled={loading || !selectedPath}>开火预览</button><button onClick={() => void save()} disabled={saving}>保存 Config</button></header><section className="viewport"><canvas ref={canvasRef} /></section><aside><h2>开火参数</h2><NumberControl label="开火间隔 ms" value={config.fireIntervalMs} min={1} max={60000} onChange={(fireIntervalMs) => update({ fireIntervalMs })} /><NumberControl label="后坐角度" value={config.recoilAngleDeg} min={-180} max={180} onChange={(recoilAngleDeg) => update({ recoilAngleDeg })} /><small>开火粒子特效暂时移除，等待统一特效模块接入。</small></aside></main>;
};

const NumberControl = ({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) => <label><span>{label}</span><input aria-label={label} type="number" value={value} min={min} max={max} step="0.1" onChange={(event) => onChange(Number(event.target.value))} /></label>;
