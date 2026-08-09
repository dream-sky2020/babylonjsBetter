import { useEffect, useRef, useState } from 'react';
import { ArcRotateCamera, Color3, Color4, Engine, HemisphericLight, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';

type BulletConfig = { bulletKey: string; shape: 'sphere' | 'box' | 'cylinder'; scale: number; speed: number };
const defaults = (key = 'bullet_default'): BulletConfig => ({ bulletKey: key, shape: 'sphere', scale: 0.18, speed: 2.5 });

export const BulletConfigLab = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const bulletRef = useRef<Mesh | null>(null);
  const configRef = useRef(defaults());
  const configsRef = useRef<Record<string, BulletConfig>>({});
  const [config, setConfig] = useState(defaults());
  const [status, setStatus] = useState('正在初始化…');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const engine = new Engine(canvas, true, { stencil: true });
    const scene = new Scene(engine); sceneRef.current = scene; scene.clearColor = new Color4(0.025, 0.035, 0.052, 1);
    const camera = new ArcRotateCamera('bullet_camera', -Math.PI / 2, Math.PI / 2.4, 5, Vector3.Zero(), scene); camera.attachControl(canvas, true);
    new HemisphericLight('bullet_light', new Vector3(0.4, 1, 0.25), scene).intensity = 1.5;
    const ground = MeshBuilder.CreateGround('bullet_ground', { width: 30, height: 30 }, scene);
    const groundMaterial = new StandardMaterial('bullet_ground_mat', scene); groundMaterial.diffuseColor = new Color3(0.07, 0.095, 0.14); ground.material = groundMaterial;
    let elapsed = 0;
    engine.runRenderLoop(() => { elapsed += engine.getDeltaTime() / 1000; if (bulletRef.current) bulletRef.current.position.z = Math.sin(elapsed * configRef.current.speed) * 2; scene.render(); });
    return () => { bulletRef.current?.dispose(); scene.dispose(); engine.dispose(); };
  }, []);

  useEffect(() => { void fetch('/config/bulletConfigs.json').then((response) => response.ok ? response.json() : {}).then((raw) => {
    if (!raw || typeof raw !== 'object') return;
    configsRef.current = raw as Record<string, BulletConfig>;
    const saved = configsRef.current[configRef.current.bulletKey];
    if (saved) { const normalized = { ...defaults(saved.bulletKey), ...saved }; configRef.current = normalized; setConfig(normalized); }
  }); }, []);

  useEffect(() => {
    const scene = sceneRef.current; if (!scene) return;
    bulletRef.current?.dispose();
    const current = configRef.current;
    bulletRef.current = current.shape === 'box'
      ? MeshBuilder.CreateBox('bullet_preview', { size: current.scale }, scene)
      : current.shape === 'cylinder'
        ? MeshBuilder.CreateCylinder('bullet_preview', { height: current.scale * 2, diameter: current.scale }, scene)
        : MeshBuilder.CreateSphere('bullet_preview', { diameter: current.scale }, scene);
    const material = new StandardMaterial('bullet_preview_mat', scene); material.diffuseColor = new Color3(0.9, 0.25, 0.08); bulletRef.current.material = material;
    setStatus(`预览子弹：${current.bulletKey}`);
  }, [config.shape, config.scale]);

  const update = (patch: Partial<BulletConfig>) => { const next = { ...config, ...patch }; configRef.current = next; configsRef.current[next.bulletKey] = next; setConfig(next); };
  const save = async () => { setSaving(true); try { const response = await fetch('/api/bullet-configs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(configsRef.current) }); if (!response.ok) throw new Error('保存失败'); setStatus(`已保存 ${Object.keys(configsRef.current).length} 个子弹配置`); } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); } finally { setSaving(false); } };

  return <main className="bullet-lab"><header><div><h1>子弹配置 Lab</h1><span>{status}</span></div><input aria-label="子弹 Key" value={config.bulletKey} onChange={(event) => update({ bulletKey: event.target.value })} /><button onClick={() => void save()} disabled={saving}>保存 Config</button></header><section className="viewport"><canvas ref={canvasRef} /></section><aside><h2>子弹参数</h2><label><span>形状</span><select aria-label="子弹形状" value={config.shape} onChange={(event) => update({ shape: event.target.value as BulletConfig['shape'] })}><option value="sphere">球体</option><option value="box">方块</option><option value="cylinder">圆柱</option></select></label><NumberControl label="缩放" value={config.scale} min={0.01} max={100} step={0.01} onChange={(scale) => update({ scale })} /><NumberControl label="速度" value={config.speed} min={0.01} max={1000} step={0.1} onChange={(speed) => update({ speed })} /><small>粒子拖尾暂时移除，等待统一特效模块接入。</small></aside></main>;
};

const NumberControl = ({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) => <label><span>{label}</span><input aria-label={label} type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
