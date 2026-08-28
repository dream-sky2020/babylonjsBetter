import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  GizmoManager,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3
} from '@babylonjs/core';
import {
  createDefaultModelTransform,
  createModelEntity,
  getModelPrefabCacheStats,
  loadModelScenePresetLibrary,
  saveModelScenePresetLibrary,
  type ModelEntity,
  type ModelSceneInstance,
  type ModelScenePreset,
  type ModelScenePresetLibrary,
  type ModelTransform
} from '@/core/model';
import { loadModelAssetManifestByExtension } from '@/core/resources';

type GizmoMode = 'position' | 'rotation' | 'scale';
type Runtime = { engine: Engine; scene: Scene; camera: ArcRotateCamera; gizmos: GizmoManager };

const radians = (degrees: number) => degrees * Math.PI / 180;
const degrees = (value: number) => value * 180 / Math.PI;
const round = (value: number) => Math.round(value * 1000) / 1000;
const fileName = (path: string) => decodeURIComponent(path.split('/').pop() ?? path).replace(/\.(glb|gltf)$/i, '');
const makeId = (prefix = 'model') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const applyTransform = (entity: ModelEntity, transform: ModelTransform) => {
  entity.root.position.set(...transform.position);
  entity.root.rotationQuaternion = null;
  entity.root.rotation.set(...transform.rotationDeg.map(radians) as [number, number, number]);
  entity.root.scaling.set(...transform.scaling);
};

const readTransform = (entity: ModelEntity): ModelTransform => ({
  position: [round(entity.root.position.x), round(entity.root.position.y), round(entity.root.position.z)],
  rotationDeg: [round(degrees(entity.root.rotation.x)), round(degrees(entity.root.rotation.y)), round(degrees(entity.root.rotation.z))],
  scaling: [round(entity.root.scaling.x), round(entity.root.scaling.y), round(entity.root.scaling.z)]
});

const focusEntity = (camera: ArcRotateCamera, entity: ModelEntity) => {
  const meshes = entity.meshes.filter((mesh) => mesh.getTotalVertices() > 0);
  if (meshes.length === 0) return;
  let minimum = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  let maximum = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    const bounds = mesh.getBoundingInfo().boundingBox;
    minimum = Vector3.Minimize(minimum, bounds.minimumWorld);
    maximum = Vector3.Maximize(maximum, bounds.maximumWorld);
  }
  const center = minimum.add(maximum).scale(0.5);
  const size = Math.max(Vector3.Distance(minimum, maximum), 0.05);
  camera.setTarget(center);
  camera.radius = size * 2.2;
  camera.minZ = Math.max(size / 1000, 0.0001);
  camera.maxZ = Math.max(size * 1000, 100);
};

const newPreset = (id = 'scene_default'): ModelScenePreset => ({ id, name: '新的 3D 场景', instances: [] });

export const ModelSceneLab = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const entitiesRef = useRef(new Map<string, ModelEntity>());
  const instancesRef = useRef<ModelSceneInstance[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [assets, setAssets] = useState<string[]>([]);
  const [assetPath, setAssetPath] = useState('');
  const [library, setLibrary] = useState<ModelScenePresetLibrary>({});
  const [presetId, setPresetId] = useState('scene_default');
  const [presetName, setPresetName] = useState('新的 3D 场景');
  const [instances, setInstances] = useState<ModelSceneInstance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('position');
  const [status, setStatus] = useState('正在初始化场景…');
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => instances.find((item) => item.id === selectedId) ?? null, [instances, selectedId]);

  const cacheSummary = () => {
    const scene = runtimeRef.current?.scene;
    if (!scene) return '';
    const stats = getModelPrefabCacheStats(scene);
    return `预制体 ${stats.prefabCount} · 活跃实例 ${stats.activeInstanceCount} · 实际加载 ${stats.loadCount}`;
  };

  useEffect(() => { instancesRef.current = instances; }, [instances]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  const syncSelectionFromScene = useCallback(() => {
    const id = selectedIdRef.current;
    if (!id) return;
    const entity = entitiesRef.current.get(id);
    if (!entity) return;
    const transform = readTransform(entity);
    setInstances((current) => current.map((item) => item.id === id ? { ...item, transform } : item));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine(canvas, true, { stencil: true });
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.025, 0.035, 0.055, 1);
    const camera = new ArcRotateCamera('scene_lab_camera', -Math.PI / 3, Math.PI / 3, 18, new Vector3(0, 1, 0), scene);
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 0.2;
    camera.upperRadiusLimit = 500;
    camera.wheelPrecision = 30;
    const light = new HemisphericLight('scene_lab_light', new Vector3(0.3, 1, 0.2), scene);
    light.intensity = 1.4;
    const ground = MeshBuilder.CreateGround('scene_lab_ground', { width: 100, height: 100, subdivisions: 2 }, scene);
    ground.isPickable = true;
    const groundMaterial = new StandardMaterial('scene_lab_ground_material', scene);
    groundMaterial.diffuseColor = new Color3(0.08, 0.11, 0.16);
    groundMaterial.specularColor = Color3.Black();
    ground.material = groundMaterial;
    const gizmos = new GizmoManager(scene);
    gizmos.usePointerToAttachGizmos = false;
    gizmos.clearGizmoOnEmptyPointerEvent = false;
    runtimeRef.current = { engine, scene, camera, gizmos };
    const sceneEntities = entitiesRef.current;

    scene.onPointerDown = (_event, pick) => {
      const instanceId = pick?.pickedMesh?.metadata?.modelSceneInstanceId;
      if (typeof instanceId === 'string') setSelectedId(instanceId);
      else if (pick?.pickedMesh === ground) setSelectedId(null);
    };
    const pointerUp = () => syncSelectionFromScene();
    canvas.addEventListener('pointerup', pointerUp);
    const resize = () => engine.resize();
    window.addEventListener('resize', resize);
    engine.runRenderLoop(() => scene.render());
    setReady(true);
    setStatus('场景已就绪');
    return () => {
      setReady(false);
      canvas.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('resize', resize);
      sceneEntities.forEach((entity) => entity.dispose());
      sceneEntities.clear();
      gizmos.dispose();
      scene.dispose();
      engine.dispose();
      runtimeRef.current = null;
    };
  }, [syncSelectionFromScene]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.gizmos.positionGizmoEnabled = gizmoMode === 'position';
    runtime.gizmos.rotationGizmoEnabled = gizmoMode === 'rotation';
    runtime.gizmos.scaleGizmoEnabled = gizmoMode === 'scale';
    runtime.gizmos.attachToNode(selectedId ? entitiesRef.current.get(selectedId)?.root ?? null : null);
  }, [gizmoMode, selectedId]);

  useEffect(() => {
    loadModelAssetManifestByExtension(/\.(glb|gltf)$/i).then((glbAssets) => {
      setAssets(glbAssets);
      setAssetPath(glbAssets[0] ?? '');
    }).catch(() => setStatus('模型资源列表读取失败'));
    void loadModelScenePresetLibrary().then((loaded) => {
      setLibrary(loaded);
      const first = Object.values(loaded)[0];
      if (first) {
        setPresetId(first.id);
        setPresetName(first.name);
        setInstances(first.instances);
      }
    });
  }, []);

  const createEntity = useCallback(async (instance: ModelSceneInstance) => {
    const scene = runtimeRef.current?.scene;
    if (!scene) throw new Error('Babylon 场景尚未就绪');
    const entity = await createModelEntity(scene, instance.modelPath, { name: instance.id, autoPlayAnimation: true });
    applyTransform(entity, instance.transform);
    entity.meshes.forEach((mesh) => {
      mesh.isPickable = true;
      mesh.metadata = { ...(mesh.metadata ?? {}), modelSceneInstanceId: instance.id };
    });
    entitiesRef.current.set(instance.id, entity);
    return entity;
  }, []);

  const clearScene = useCallback(() => {
    runtimeRef.current?.gizmos.attachToNode(null);
    entitiesRef.current.forEach((entity) => entity.dispose());
    entitiesRef.current.clear();
    setSelectedId(null);
  }, []);

  const stageInstances = useCallback(async (next: ModelSceneInstance[]) => {
    clearScene();
    setInstances(next);
    setBusy(true);
    try {
      for (const instance of next) await createEntity(instance);
      setStatus(`已加载 ${next.length} 个模型实例`);
    } catch (error) {
      setStatus(error instanceof Error ? `模型加载失败：${error.message}` : String(error));
    } finally {
      setBusy(false);
    }
  }, [clearScene, createEntity]);

  useEffect(() => {
    if (!ready || busy || instances.length === 0 || entitiesRef.current.size > 0) return;
    void stageInstances(instancesRef.current);
  }, [busy, instances, ready, stageInstances]);

  const addModel = async () => {
    if (!assetPath || busy) return;
    const instance: ModelSceneInstance = {
      id: makeId('model'),
      name: fileName(assetPath),
      modelPath: assetPath,
      transform: createDefaultModelTransform()
    };
    setBusy(true);
    try {
      await createEntity(instance);
      const entity = entitiesRef.current.get(instance.id);
      if (entity && runtimeRef.current) focusEntity(runtimeRef.current.camera, entity);
      setInstances((current) => [...current, instance]);
      setSelectedId(instance.id);
      setStatus(`已添加：${instance.name} · ${cacheSummary()}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const updateInstance = (id: string, patch: Partial<ModelSceneInstance>) => {
    setInstances((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
    if (patch.transform) {
      const entity = entitiesRef.current.get(id);
      if (entity) applyTransform(entity, patch.transform);
    }
  };

  const updateTransformValue = (group: keyof ModelTransform, axis: number, value: number) => {
    if (!selected || !Number.isFinite(value)) return;
    const tuple = [...selected.transform[group]] as [number, number, number];
    tuple[axis] = value;
    updateInstance(selected.id, { transform: { ...selected.transform, [group]: tuple } });
  };

  const duplicateSelected = async () => {
    if (!selected || busy) return;
    const copy: ModelSceneInstance = {
      ...selected,
      id: makeId('model'),
      name: `${selected.name} 副本`,
      transform: {
        ...selected.transform,
        position: [selected.transform.position[0] + 1, selected.transform.position[1], selected.transform.position[2] + 1]
      }
    };
    setBusy(true);
    try {
      await createEntity(copy);
      setInstances((current) => [...current, copy]);
      setSelectedId(copy.id);
      setStatus(`已复制模型 · ${cacheSummary()}`);
    } finally {
      setBusy(false);
    }
  };

  const deleteSelected = () => {
    if (!selected) return;
    entitiesRef.current.get(selected.id)?.dispose();
    entitiesRef.current.delete(selected.id);
    setInstances((current) => current.filter((item) => item.id !== selected.id));
    setSelectedId(null);
    setStatus(`已删除模型 · ${cacheSummary()}`);
  };

  const focusSelected = () => {
    if (!selected || !runtimeRef.current) return;
    const entity = entitiesRef.current.get(selected.id);
    if (entity) focusEntity(runtimeRef.current.camera, entity);
  };

  const selectPreset = (id: string) => {
    const preset = library[id];
    if (!preset) return;
    setPresetId(preset.id);
    setPresetName(preset.name);
    void stageInstances(preset.instances);
  };

  const createPreset = () => {
    const id = makeId('scene');
    const preset = newPreset(id);
    setPresetId(id);
    setPresetName(preset.name);
    void stageInstances([]);
    setStatus('已新建场景预设，保存后写入配置');
  };

  const duplicatePreset = () => {
    const id = makeId('scene');
    setPresetId(id);
    setPresetName(`${presetName} 副本`);
    setStatus('已复制为新的场景预设，保存后写入配置');
  };

  const deletePreset = () => {
    const next = { ...library };
    delete next[presetId];
    setLibrary(next);
    const first = Object.values(next)[0] ?? newPreset();
    setPresetId(first.id);
    setPresetName(first.name);
    void stageInstances(first.instances);
    setStatus('预设已从内存删除，点击保存后写入配置');
  };

  const savePreset = async () => {
    const id = presetId.trim();
    if (!id) return setStatus('预设 ID 不能为空');
    const savedInstances = instancesRef.current.map((item) => {
      const entity = entitiesRef.current.get(item.id);
      return entity ? { ...item, transform: readTransform(entity) } : item;
    });
    setInstances(savedInstances);
    const preset: ModelScenePreset = { id, name: presetName.trim() || id, instances: savedInstances };
    const next = { ...library };
    for (const key of Object.keys(next)) if (next[key].id === presetId && key !== id) delete next[key];
    next[id] = preset;
    setBusy(true);
    try {
      await saveModelScenePresetLibrary(next);
      setLibrary(next);
      setPresetId(id);
      setStatus(`已保存到 config/modelScenePresets.json（${preset.instances.length} 个实例）`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="scene-lab">
      <header className="topbar">
        <div><h1>3D 场景布置 Lab</h1><span>{status}</span></div>
        <select value={presetId} onChange={(event) => selectPreset(event.target.value)}>
          <option value={presetId}>{library[presetId]?.name ?? presetName}</option>
          {Object.values(library).filter((preset) => preset.id !== presetId).map((preset) => <option value={preset.id} key={preset.id}>{preset.name}</option>)}
        </select>
        <button onClick={createPreset}>新建预设</button>
        <button onClick={duplicatePreset}>复制预设</button>
        <button className="danger" onClick={deletePreset}>删除预设</button>
        <button className="primary" disabled={busy} onClick={() => void savePreset()}>保存到 Config</button>
      </header>
      <aside className="sidebar left-panel">
        <section><h2>场景预设</h2><label>ID<input value={presetId} disabled /></label><label>名称<input value={presetName} onChange={(event) => setPresetName(event.target.value)} /></label></section>
        <section><h2>添加模型</h2><select value={assetPath} onChange={(event) => setAssetPath(event.target.value)}><option value="">选择 GLB 模型…</option>{assets.map((path) => <option value={path} key={path}>{decodeURIComponent(path.replace('/resources/', ''))}</option>)}</select><button className="primary full" disabled={!assetPath || busy} onClick={() => void addModel()}>添加到场景</button></section>
        <section className="instance-section"><h2>场景实例 <small>{instances.length}</small></h2><div className="instance-list">{instances.map((item) => <button className={item.id === selectedId ? 'instance active' : 'instance'} onClick={() => setSelectedId(item.id)} key={item.id}><b>{item.name}</b><span>{item.modelPath.replace('/resources/', '')}</span></button>)}</div></section>
      </aside>
      <section className="viewport"><canvas ref={canvasRef} /><div className="viewport-help">点击模型选择 · 左键旋转视角 · 右键平移 · 滚轮缩放</div><div className="gizmo-switch">{(['position', 'rotation', 'scale'] as GizmoMode[]).map((mode) => <button className={gizmoMode === mode ? 'active' : ''} onClick={() => setGizmoMode(mode)} key={mode}>{mode === 'position' ? '移动' : mode === 'rotation' ? '旋转' : '缩放'}</button>)}</div></section>
      <aside className="sidebar right-panel">
        <section><h2>实例属性</h2>{selected ? <><button className="full" onClick={focusSelected}>聚焦选中模型</button><label>名称<input value={selected.name} onChange={(event) => updateInstance(selected.id, { name: event.target.value })} /></label><label>实例 ID<input value={selected.id} disabled /></label><label>模型路径<textarea value={selected.modelPath} readOnly /></label>{(['position', 'rotationDeg', 'scaling'] as const).map((group) => <div className="vector" key={group}><h3>{group === 'position' ? '位置' : group === 'rotationDeg' ? '旋转（度）' : '缩放'}</h3>{(['X', 'Y', 'Z'] as const).map((axis, index) => <label key={axis}>{axis}<input type="number" step={group === 'rotationDeg' ? 1 : 0.1} value={selected.transform[group][index]} onChange={(event) => updateTransformValue(group, index, Number(event.target.value))} /></label>)}</div>)}<div className="button-row"><button onClick={() => void duplicateSelected()}>复制</button><button className="danger" onClick={deleteSelected}>删除</button></div></> : <p className="empty">在视口或左侧列表中选择一个模型。</p>}</section>
      </aside>
    </main>
  );
};
