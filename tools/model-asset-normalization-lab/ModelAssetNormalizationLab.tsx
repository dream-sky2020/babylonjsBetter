import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import {
  applyModelAssetProfile,
  applyModelMaterialPolicy,
  createDefaultModelAssetProfile,
  createModelEntity,
  loadModelAssetProfileLibrary,
  normalizeModelAssetProfilePath,
  sanitizeModelAssetProfile,
  saveModelAssetProfileLibrary,
  type ModelAssetProfile,
  type ModelAssetProfileLibrary,
  type ModelAssetVector3,
  type ModelEntity,
} from '@/core/model';
import { loadModelAssetManifest } from '@/core/resources';
import { downloadConfigJson, isConfigWritable } from '@/core/config';

type Bounds = { size: ModelAssetVector3; center: ModelAssetVector3; min: ModelAssetVector3; max: ModelAssetVector3 };
type ComparisonTransform = { position: ModelAssetVector3; rotationDeg: ModelAssetVector3; scale: number };
type LoadedModel = { id: number; path: string; entity: ModelEntity; rawBounds: Bounds; comparison: ComparisonTransform };

const ZERO = { x: 0, y: 0, z: 0 };
const toPlain = (value: Vector3): ModelAssetVector3 => ({ x: value.x, y: value.y, z: value.z });
const emptyBounds = (): Bounds => ({ size: { ...ZERO }, center: { ...ZERO }, min: { ...ZERO }, max: { ...ZERO } });

const measureEntity = (entity: ModelEntity): Bounds => {
  const meshes = entity.meshes.filter((mesh) => mesh.getTotalVertices() > 0);
  if (!meshes.length) return emptyBounds();
  let min = new Vector3(Infinity, Infinity, Infinity);
  let max = new Vector3(-Infinity, -Infinity, -Infinity);
  meshes.forEach((mesh) => {
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    min = Vector3.Minimize(min, box.minimumWorld);
    max = Vector3.Maximize(max, box.maximumWorld);
  });
  return { size: toPlain(max.subtract(min)), center: toPlain(min.add(max).scale(0.5)), min: toPlain(min), max: toPlain(max) };
};

const applyComparison = (item: LoadedModel) => {
  const radians = Math.PI / 180;
  item.entity.root.position.set(item.comparison.position.x, item.comparison.position.y, item.comparison.position.z);
  item.entity.root.rotation.set(
    item.comparison.rotationDeg.x * radians,
    item.comparison.rotationDeg.y * radians,
    item.comparison.rotationDeg.z * radians,
  );
  item.entity.root.scaling.setAll(item.comparison.scale);
};

const NumericInput = ({ value, onChange, step = 0.01 }: { value: number; onChange: (value: number) => void; step?: number }) => (
  <input type="number" value={Number.isFinite(value) ? value : 0} step={step} onChange={(event) => onChange(Number(event.target.value))} />
);

const VectorEditor = ({ value, onChange, step = 0.01 }: { value: ModelAssetVector3; onChange: (value: ModelAssetVector3) => void; step?: number }) => (
  <div className="vector-editor">
    {(['x', 'y', 'z'] as const).map((axis) => <label key={axis}><span>{axis.toUpperCase()}</span><NumericInput value={value[axis]} step={step} onChange={(number) => onChange({ ...value, [axis]: number })} /></label>)}
  </div>
);

export function ModelAssetNormalizationLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const loadedRef = useRef<LoadedModel[]>([]);
  const libraryRef = useRef<ModelAssetProfileLibrary>({});
  const nextId = useRef(1);
  const [assets, setAssets] = useState<string[]>([]);
  const [assetPath, setAssetPath] = useState('');
  const [loaded, setLoaded] = useState<LoadedModel[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [library, setLibrary] = useState<ModelAssetProfileLibrary>({});
  const [targetSize, setTargetSize] = useState(2);
  const [status, setStatus] = useState('正在读取模型清单…');

  useEffect(() => { loadedRef.current = loaded; }, [loaded]);
  useEffect(() => { libraryRef.current = library; }, [library]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.035, 0.045, 0.06, 1);
    const camera = new ArcRotateCamera('normalization-camera', -Math.PI / 2, Math.PI / 2.7, 10, new Vector3(0, 1, 0), scene);
    camera.attachControl(canvas, true);
    camera.wheelPrecision = 30;
    camera.minZ = 0.01;
    new HemisphericLight('ambient', new Vector3(0.4, 1, 0.2), scene).intensity = 1.15;
    const ground = MeshBuilder.CreateGround('meter-grid-ground', { width: 40, height: 40, subdivisions: 40 }, scene);
    const groundMaterial = new StandardMaterial('ground-material', scene);
    groundMaterial.diffuseColor = new Color3(0.12, 0.14, 0.18);
    groundMaterial.specularColor = Color3.Black();
    ground.material = groundMaterial;
    const reference = MeshBuilder.CreateBox('one-meter-reference', { width: 1, height: 1, depth: 1 }, scene);
    reference.position.set(-2, 0.5, 0);
    const referenceMaterial = new StandardMaterial('reference-material', scene);
    referenceMaterial.diffuseColor = new Color3(0.12, 0.55, 0.82);
    referenceMaterial.alpha = 0.28;
    reference.material = referenceMaterial;
    sceneRef.current = scene;
    cameraRef.current = camera;
    engine.runRenderLoop(() => scene.render());
    const resize = () => engine.resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      loadedRef.current.forEach((item) => item.entity.dispose());
      scene.dispose(); engine.dispose();
      sceneRef.current = null; cameraRef.current = null;
    };
  }, []);

  useEffect(() => {
    Promise.all([loadModelAssetManifest(), loadModelAssetProfileLibrary()]).then(([paths, profiles]) => {
      const supported = paths.filter((path) => /\.(glb|gltf)$/i.test(path)).map(normalizeModelAssetProfilePath);
      setAssets(supported); setAssetPath(supported[0] ?? ''); setLibrary(profiles);
      setStatus(supported.length ? `已发现 ${supported.length} 个可校准模型` : '没有找到 GLB/GLTF 模型');
    }).catch((error) => setStatus(`读取失败：${error instanceof Error ? error.message : String(error)}`));
  }, []);

  const selected = useMemo(() => loaded.find((item) => item.id === selectedId) ?? null, [loaded, selectedId]);
  const selectedProfile = selected ? library[selected.path] ?? createDefaultModelAssetProfile(selected.path) : null;

  const updateProfile = (next: ModelAssetProfile) => {
    if (!selected) return;
    const profile = sanitizeModelAssetProfile(next, selected.path);
    setLibrary((current) => ({ ...current, [selected.path]: profile }));
    loadedRef.current.filter((item) => item.path === selected.path).forEach((item) => {
      applyModelAssetProfile(item.entity, profile);
      applyModelMaterialPolicy(item.entity.meshes, profile.transparencyPolicy);
    });
    setStatus('参数已应用，尚未保存');
  };

  const addModel = async () => {
    const scene = sceneRef.current;
    if (!scene || !assetPath) return;
    setStatus(`正在加载 ${assetPath.split('/').pop()}…`);
    try {
      const path = normalizeModelAssetProfilePath(assetPath);
      const entity = await createModelEntity(scene, path, { applyAssetProfile: false, autoPlayAnimation: true });
      const rawBounds = measureEntity(entity);
      const profile = libraryRef.current[path] ?? {
        ...createDefaultModelAssetProfile(path),
        measuredBounds: { size: rawBounds.size, center: rawBounds.center },
      };
      applyModelAssetProfile(entity, profile);
      applyModelMaterialPolicy(entity.meshes, profile.transparencyPolicy);
      const index = loadedRef.current.length;
      const item: LoadedModel = {
        id: nextId.current++, path, entity, rawBounds,
        comparison: { position: { x: index * 2.5, y: 0, z: 0 }, rotationDeg: { ...ZERO }, scale: 1 },
      };
      applyComparison(item);
      setLibrary((current) => current[path] ? current : ({ ...current, [path]: profile }));
      setLoaded((current) => [...current, item]); setSelectedId(item.id);
      setStatus(`已加入 ${path.split('/').pop()}；可继续加入其他模型对比`);
    } catch (error) {
      setStatus(`加载失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const removeModel = (id: number) => {
    const item = loadedRef.current.find((entry) => entry.id === id);
    item?.entity.dispose();
    setLoaded((current) => current.filter((entry) => entry.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const updateComparison = (next: ComparisonTransform) => {
    if (!selected) return;
    const updated = { ...selected, comparison: next };
    applyComparison(updated);
    setLoaded((current) => current.map((item) => item.id === updated.id ? updated : item));
  };

  const fitAll = () => {
    const camera = cameraRef.current;
    if (!camera || !loadedRef.current.length) return;
    const all = loadedRef.current.map((item) => measureEntity(item.entity));
    const min = new Vector3(Math.min(...all.map((b) => b.min.x)), Math.min(...all.map((b) => b.min.y)), Math.min(...all.map((b) => b.min.z)));
    const max = new Vector3(Math.max(...all.map((b) => b.max.x)), Math.max(...all.map((b) => b.max.y)), Math.max(...all.map((b) => b.max.z)));
    camera.setTarget(min.add(max).scale(0.5));
    camera.radius = Math.max(Vector3.Distance(min, max) * 1.4, 3);
  };

  const bottomCenter = () => {
    if (!selected || !selectedProfile) return;
    const root = selected.entity.root;
    const savedPosition = root.position.clone(), savedRotation = root.rotation.clone(), savedScale = root.scaling.clone();
    root.position.setAll(0); root.rotation.setAll(0); root.scaling.setAll(1);
    applyModelAssetProfile(selected.entity, { ...selectedProfile, positionOffset: { ...ZERO } });
    const bounds = measureEntity(selected.entity);
    root.position.copyFrom(savedPosition); root.rotation.copyFrom(savedRotation); root.scaling.copyFrom(savedScale);
    updateProfile({ ...selectedProfile, positionOffset: { x: -bounds.center.x, y: -bounds.min.y, z: -bounds.center.z } });
  };

  const save = async () => {
    if (!isConfigWritable()) {
      downloadConfigJson('modelAssetProfiles.json', libraryRef.current);
      setStatus('正式构建为只读模式，已导出 modelAssetProfiles.json');
      return;
    }
    setStatus('正在保存全局模型标准化配置…');
    try { await saveModelAssetProfileLibrary(libraryRef.current); setStatus('已保存到 config/modelAssetProfiles.json'); }
    catch (error) { setStatus(`保存失败：${error instanceof Error ? error.message : String(error)}`); }
  };

  return <main className="normalization-lab">
    <header>
      <div><h1>模型资产标准化 Lab</h1><p>手动校准是主流程；自动按钮只填写建议值。蓝色半透明盒子为 1m 参照物。</p></div>
      <div className="toolbar">
        <select value={assetPath} onChange={(event) => setAssetPath(event.target.value)}>{assets.map((path) => <option key={path} value={path}>{path}</option>)}</select>
        <button onClick={addModel} disabled={!assetPath}>加入对比</button>
        <button onClick={fitAll} disabled={!loaded.length}>查看全部</button>
        <button className="primary" onClick={save}>{isConfigWritable() ? '保存配置' : '导出配置'}</button>
      </div>
      <output>{status}</output>
    </header>
    <section className="workspace">
      <aside className="model-list"><h2>对比模型（{loaded.length}）</h2>{loaded.map((item) => <div className={`model-item ${item.id === selectedId ? 'selected' : ''}`} key={item.id} onClick={() => setSelectedId(item.id)}><button className="model-name">{item.path.split('/').pop()}</button><small>实例 #{item.id}</small><button className="remove" onClick={(event) => { event.stopPropagation(); removeModel(item.id); }}>移除</button></div>)}</aside>
      <div className="viewport"><canvas ref={canvasRef} /></div>
      <aside className="inspector">{selected && selectedProfile ? <>
        <h2>{selected.path.split('/').pop()}</h2><code>{selected.path}</code>
        <h3>全局标准化（会保存）</h3>
        <label className="field"><span>统一缩放</span><NumericInput value={selectedProfile.uniformScale} step={0.001} onChange={(uniformScale) => updateProfile({ ...selectedProfile, uniformScale })} /></label>
        <label className="field"><span>材质透明策略</span><select value={selectedProfile.transparencyPolicy} onChange={(event) => updateProfile({ ...selectedProfile, transparencyPolicy: event.target.value as ModelAssetProfile['transparencyPolicy'] })}><option value="depth-safe-cutout">深度安全裁切</option><option value="source">保留模型原始透明</option></select></label>
        <label>旋转（度）</label><VectorEditor value={selectedProfile.rotationDeg} step={1} onChange={(rotationDeg) => updateProfile({ ...selectedProfile, rotationDeg })} />
        <label>原点偏移</label><VectorEditor value={selectedProfile.positionOffset} onChange={(positionOffset) => updateProfile({ ...selectedProfile, positionOffset })} />
        <div className="assist"><h3>自动辅助</h3><div className="inline"><NumericInput value={targetSize} step={0.1} onChange={setTargetSize} /><span>m 最长边</span><button onClick={() => { const maxSize = Math.max(selected.rawBounds.size.x, selected.rawBounds.size.y, selected.rawBounds.size.z); if (maxSize > 0) updateProfile({ ...selectedProfile, uniformScale: targetSize / maxSize }); }}>生成缩放建议</button></div><button onClick={bottomCenter}>按旋转后包围盒底部居中</button></div>
        <p className="bounds">原始尺寸：{selected.rawBounds.size.x.toFixed(3)} × {selected.rawBounds.size.y.toFixed(3)} × {selected.rawBounds.size.z.toFixed(3)}</p>
        <h3>对比实例（不会保存）</h3>
        <label>位置</label><VectorEditor value={selected.comparison.position} onChange={(position) => updateComparison({ ...selected.comparison, position })} />
        <label>旋转（度）</label><VectorEditor value={selected.comparison.rotationDeg} step={1} onChange={(rotationDeg) => updateComparison({ ...selected.comparison, rotationDeg })} />
        <label className="field"><span>临时缩放</span><NumericInput value={selected.comparison.scale} onChange={(scale) => updateComparison({ ...selected.comparison, scale })} /></label>
      </> : <p className="empty">从顶部选择模型并加入对比，然后在左侧选择一个实例。</p>}</aside>
    </section>
  </main>;
}
