import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import {
  ArcRotateCamera, Color3, Color4, DirectionalLight, Engine, GizmoCoordinatesMode,
  GizmoManager, HemisphericLight, MeshBuilder, PointerEventTypes, Scene, StandardMaterial,
  Vector3, type TransformNode,
} from '@babylonjs/core';
import { openCommandMenuAtPoint, openCommandMenuFromElement, type CommandMenuEntry } from '@/core/ui/menu';
import { createModelEntity, type ModelEntity } from '@/core/model';
import { loadModelAssetManifestByExtension } from '@/core/resources';
import { createWeaponAnimationExamples } from '@/core/model/preset/firstPersonWeaponExamples.ts';
import { loadWeaponPresets } from '@/core/model/preset/firstPersonWeaponPresetApi.ts';
import { loadAnimationScenePresets, migrateFirstPersonWeaponPreset, saveAnimationScenePresets, type AnimationScenePresetLibrary } from '@/core/animation/preset';
import {
  createDefaultAnimationWorkspace, parseAnimationWorkspace, scenePresetToWorkspace, workspaceToScenePreset,
  type AnimationObjectRecord, type AnimationWorkspace, type WorkbenchVec3,
} from './animationWorkspace.ts';
import { animationObjectFactories, animationObjectFactoryById, type AnimationObjectLayer, type AnimationObjectProperty } from './animationObjectRegistry.ts';
import { SignalWorkspace } from './SignalWorkspace.tsx';
import { recordTransformKey, type TransformPropertyPath, type TransformRecordMode } from './transformRecording.ts';
import { useWorkspaceHistory } from './useWorkspaceHistory.ts';
import type { SignalGraphEvaluation } from '@/core/animation/signal';
import type { NumericContributionMix } from '@/core/animation/contribution';

type GizmoMode = 'position' | 'rotation' | 'scale';
type Runtime = {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  gizmo: GizmoManager;
  nodes: Map<string, TransformNode>;
  previewSignatures: Map<string, string>;
  assetEntities: Map<string, { path: string; entity: ModelEntity }>;
  assetLoadTokens: Map<string, string>;
};

const STORAGE_KEY = 'babylonjsBetter:animation-workbench:workspace:v1';
const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `object_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const round = (value: number) => Number(value.toFixed(4));
const factoryLabel = (typeId: string) => animationObjectFactoryById.get(typeId)?.label ?? typeId;

const setNodeComponent = (node: TransformNode, path: string, value: number) => {
  const [group, axis] = path.split('.') as ['position' | 'rotation' | 'scaling', 'x' | 'y' | 'z'];
  if (!['position', 'rotation', 'scaling'].includes(group) || !['x', 'y', 'z'].includes(axis)) return;
  node[group][axis] = group === 'rotation' ? value * RAD : value;
};

const configureGizmo = (gizmo: GizmoManager, mode: GizmoMode, localSpace: boolean, node: TransformNode | null) => {
  gizmo.positionGizmoEnabled = mode === 'position';
  gizmo.rotationGizmoEnabled = mode === 'rotation';
  gizmo.scaleGizmoEnabled = mode === 'scale';
  gizmo.coordinatesMode = localSpace ? GizmoCoordinatesMode.Local : GizmoCoordinatesMode.World;
  gizmo.attachToNode(node);
};

const loadInitialWorkspace = (): AnimationWorkspace => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseAnimationWorkspace(JSON.parse(raw) as unknown) : createDefaultAnimationWorkspace();
  } catch {
    return createDefaultAnimationWorkspace();
  }
};

const Icon = ({ name }: { name: 'add' | 'save' | 'load' | 'download' | 'upload' | 'undo' | 'redo' | 'move' | 'rotate' | 'scale' | 'more' | 'trash' | 'object' | 'empty' | 'weapon' | 'volume' | 'socket' | 'model' }) => <svg viewBox="0 0 24 24" aria-hidden="true">
  {name === 'add' && <><path d="M12 5v14M5 12h14" /></>}
  {name === 'save' && <><path d="M4 3h13l3 3v15H4zM8 3v6h8V3M8 21v-7h8v7" /></>}
  {name === 'load' && <><path d="M4 5h6l2 2h8v12H4z" /><path d="m9 13 3 3 3-3M12 9v7" /></>}
  {name === 'download' && <><path d="M12 3v13m-5-5 5 5 5-5M5 21h14" /></>}
  {name === 'upload' && <><path d="M12 16V3m-5 5 5-5 5 5M5 21h14" /></>}
  {name === 'undo' && <><path d="m9 7-5 5 5 5" /><path d="M5 12h8a6 6 0 0 1 6 6" /></>}
  {name === 'redo' && <><path d="m15 7 5 5-5 5" /><path d="M19 12h-8a6 6 0 0 0-6 6" /></>}
  {name === 'move' && <><path d="M12 2v20M2 12h20m-6-6-4-4-4 4m8 12-4 4-4-4M6 8l-4 4 4 4m12-8 4 4-4 4" /></>}
  {name === 'rotate' && <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 8A7 7 0 0 1 19 12M5 12a7 7 0 0 0 12.9 4" /></>}
  {name === 'scale' && <><path d="M9 3H3v6m12 12h6v-6M3 3l7 7m11 11-7-7" /></>}
  {name === 'more' && <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>}
  {name === 'trash' && <><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7M10 11v6m4-6v6" /></>}
  {name === 'object' && <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9" /></>}
  {name === 'empty' && <><circle cx="6" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 6h4a4 4 0 0 1 4 4v6M6 8v10h10" /></>}
  {name === 'weapon' && <><path d="m4 20 5-5m-2 2 3 3m-1-5L19 5l1-3-3 1L7 13z" /><path d="m4 17 3 3" /></>}
  {name === 'volume' && <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9" /><path d="M8 5.3 16 10v8.7" opacity=".45" /></>}
  {name === 'socket' && <><path d="m12 5 4 7-4 7-4-7zM12 2v20M2 12h20" /></>}
  {name === 'model' && <><path d="M4 4h16v16H4zM4 15l4-4 3 3 3-4 6 6" /><circle cx="15.5" cy="8" r="1.5" /></>}
</svg>;

const VectorEditor = ({ label, value, min, onChange, onEditStart, onEditEnd }: { label: string; value: WorkbenchVec3; min?: number; onChange: (value: WorkbenchVec3) => void; onEditStart(): void; onEditEnd(): void }) => {
  const update = (axis: keyof WorkbenchVec3, raw: string) => {
    const number = Number(raw);
    if (!Number.isFinite(number)) return;
    onChange({ ...value, [axis]: min === undefined ? number : Math.max(min, number) });
  };
  return <div className="awb-vector-row">
    <span>{label}</span>
    {(['x', 'y', 'z'] as const).map(axis => <label key={axis} data-axis={axis}><b>{axis.toUpperCase()}</b><input type="number" step="0.01" value={value[axis]} onFocus={onEditStart} onBlur={onEditEnd} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} onChange={event => update(axis, event.target.value)} /></label>)}
  </div>;
};

export function AnimationWorkbenchLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const initialWorkspace = useMemo(() => loadInitialWorkspace(), []);
  const { workspace, setWorkspace, undo, redo, beginTransaction, endTransaction, canUndo, canRedo } = useWorkspaceHistory(initialWorkspace);
  const workspaceRef = useRef<AnimationWorkspace>(workspace);
  const selectedIdRef = useRef<string | null>('preview-object');
  const syncFromGizmoRef = useRef<() => void>(() => undefined);
  const [selectedId, setSelectedId] = useState<string | null>('preview-object');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['workspace-root', 'first-person-rig', 'right-hand-socket']));
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('position');
  const [localSpace, setLocalSpace] = useState(true);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [status, setStatus] = useState('动画对象工作区已就绪');
  const [modelAssets, setModelAssets] = useState<string[]>([]);
  const [visibleLayers, setVisibleLayers] = useState<Record<AnimationObjectLayer, boolean>>({ visual: true, semantic: true, helper: true });
  const [presetLibrary, setPresetLibrary] = useState<AnimationScenePresetLibrary>({});
  const [migratedLibrary, setMigratedLibrary] = useState<AnimationScenePresetLibrary>({});
  const [selectedPreset, setSelectedPreset] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [recordMode, setRecordMode] = useState<TransformRecordMode>('off');
  const currentTimeRef = useRef(0);
  const recordModeRef = useRef<TransformRecordMode>('off');
  const gizmoModeRef = useRef<GizmoMode>('position');

  useEffect(() => { void loadModelAssetManifestByExtension(/\.(glb|gltf)$/i).then(setModelAssets).catch(() => setStatus('模型资源清单读取失败')); }, []);
  useEffect(() => {
    void Promise.all([
      loadAnimationScenePresets().catch(() => ({})),
      loadWeaponPresets().catch(() => createWeaponAnimationExamples()),
    ]).then(([saved, legacy]) => {
      const pendingMigrations = Object.entries(legacy).filter(([key]) => !saved[key]);
      setPresetLibrary(saved);
      setMigratedLibrary(Object.fromEntries(pendingMigrations.map(([key, project]) => [key, migrateFirstPersonWeaponPreset(project, key)])));
      setStatus(`已读取 ${Object.keys(saved).length} 个动画场景预设${pendingMigrations.length ? `，另有 ${pendingMigrations.length} 个待迁移动作` : ''}`);
    });
  }, []);

  useEffect(() => { workspaceRef.current = workspace; }, [workspace]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { recordModeRef.current = recordMode; }, [recordMode]);
  useEffect(() => { gizmoModeRef.current = gizmoMode; }, [gizmoMode]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      else if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);
  useEffect(() => {
    syncFromGizmoRef.current = () => {
      const runtime = runtimeRef.current; const id = selectedIdRef.current; if (!runtime || !id) return;
      const node = runtime.nodes.get(id); if (!node) return;
      const group = gizmoModeRef.current === 'scale' ? 'scaling' : gizmoModeRef.current;
      const value = group === 'position'
        ? { x: round(node.position.x), y: round(node.position.y), z: round(node.position.z) }
        : group === 'rotation'
          ? { x: round(node.rotation.x * DEG), y: round(node.rotation.y * DEG), z: round(node.rotation.z * DEG) }
          : { x: round(node.scaling.x), y: round(node.scaling.y), z: round(node.scaling.z) };
      setWorkspace(current => {
        const source = current.objects.find(object => object.id === id); if (!source) return current;
        let next: AnimationWorkspace = { ...current, objects: current.objects.map(object => object.id === id ? { ...object, [group]: value } : object) };
        (['x', 'y', 'z'] as const).forEach(axis => {
          if (Math.abs(source[group][axis] - value[axis]) < .00001) return;
          next = recordTransformKey(next, id, `${group}.${axis}` as TransformPropertyPath, value[axis], source[group][axis], currentTimeRef.current, recordModeRef.current);
        });
        return next;
      });
    };
    return () => { syncFromGizmoRef.current = () => undefined; };
  }, [setWorkspace]);
  const selectedObject = useMemo(() => workspace.objects.find(object => object.id === selectedId) ?? null, [workspace.objects, selectedId]);
  const selectedFactory = selectedObject ? animationObjectFactoryById.get(selectedObject.factoryTypeId) : undefined;
  const selectedConfig = selectedObject && selectedFactory ? { ...selectedFactory.defaultConfig, ...selectedObject.config } : {};

  const replaceWorkspace = (next: AnimationWorkspace, message: string) => {
    const clean = parseAnimationWorkspace(next);
    workspaceRef.current = clean;
    setWorkspace(clean);
    const nextSelected = clean.objects[0]?.id ?? null;
    selectedIdRef.current = nextSelected;
    setSelectedId(nextSelected);
    setExpanded(new Set(clean.objects.filter(object => clean.objects.some(child => child.parentId === object.id)).map(object => object.id)));
    setStatus(message);
  };

  const updateObject = (id: string, patch: Partial<AnimationObjectRecord>) => {
    setWorkspace(current => ({ ...current, objects: current.objects.map(object => object.id === id ? { ...object, ...patch } : object) }));
  };
  const updateAnimatedVector = (id: string, group: 'position' | 'rotation' | 'scaling', value: WorkbenchVec3) => {
    setWorkspace(current => {
      const source = current.objects.find(object => object.id === id); if (!source) return current;
      let next: AnimationWorkspace = { ...current, objects: current.objects.map(object => object.id === id ? { ...object, [group]: value } : object) };
      (['x', 'y', 'z'] as const).forEach(axis => {
        if (Math.abs(source[group][axis] - value[axis]) < .00001) return;
        next = recordTransformKey(next, id, `${group}.${axis}`, value[axis], source[group][axis], currentTime, recordMode);
      });
      return next;
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine(canvas, true, { antialias: true, stencil: true });
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.075, 0.078, 0.085, 1);
    const camera = new ArcRotateCamera('animation-workbench-camera', -Math.PI / 3.8, Math.PI / 3.15, 7, new Vector3(0, 0.8, 0), scene);
    camera.lowerRadiusLimit = 1.2; camera.upperRadiusLimit = 40; camera.wheelPrecision = 45; camera.attachControl(canvas, true);
    const ambient = new HemisphericLight('animation-workbench-ambient', new Vector3(0.2, 1, -0.2), scene); ambient.intensity = 0.88;
    const key = new DirectionalLight('animation-workbench-key', new Vector3(-0.45, -0.8, 0.5), scene); key.intensity = 1.35;
    const ground = MeshBuilder.CreateGround('animation-workbench-grid', { width: 20, height: 20, subdivisions: 20 }, scene);
    const groundMaterial = new StandardMaterial('animation-workbench-grid-material', scene);
    groundMaterial.diffuseColor = new Color3(0.12, 0.125, 0.135); groundMaterial.specularColor = Color3.Black(); groundMaterial.wireframe = true;
    ground.material = groundMaterial; ground.isPickable = false;
    const axisX = MeshBuilder.CreateLines('axis-x', { points: [new Vector3(-10, 0.006, 0), new Vector3(10, 0.006, 0)] }, scene); axisX.color = new Color3(0.55, 0.16, 0.18); axisX.isPickable = false;
    const axisZ = MeshBuilder.CreateLines('axis-z', { points: [new Vector3(0, 0.006, -10), new Vector3(0, 0.006, 10)] }, scene); axisZ.color = new Color3(0.15, 0.38, 0.68); axisZ.isPickable = false;

    const gizmo = new GizmoManager(scene, 1.05);
    gizmo.enableAutoPicking = false; gizmo.usePointerToAttachGizmos = false; gizmo.clearGizmoOnEmptyPointerEvent = false;
    gizmo.positionGizmoEnabled = true;
    const suspendCamera = () => { beginTransaction(); camera.detachControl(); };
    const resumeCamera = () => camera.attachControl(canvas, true);
    const sync = () => syncFromGizmoRef.current();
    const bindGizmo = (gizmoPart: { onDragStartObservable: { add(callback: () => void): unknown }; onDragObservable: { add(callback: () => void): unknown }; onDragEndObservable: { add(callback: () => void): unknown } } | null | undefined) => {
      gizmoPart?.onDragStartObservable.add(suspendCamera);
      gizmoPart?.onDragObservable.add(sync);
      gizmoPart?.onDragEndObservable.add(() => { sync(); endTransaction(); resumeCamera(); setStatus(recordModeRef.current === 'off' ? '已通过 Gizmo 更新对象变换' : `已在 ${currentTimeRef.current.toFixed(3)}s 记录关键帧`); });
    };
    bindGizmo(gizmo.gizmos.positionGizmo); bindGizmo(gizmo.gizmos.rotationGizmo); bindGizmo(gizmo.gizmos.scaleGizmo);
    scene.onPointerObservable.add(pointer => {
      if (pointer.type !== PointerEventTypes.POINTERDOWN) return;
      const objectId = pointer.pickInfo?.pickedMesh?.metadata?.animationWorkbenchObjectId;
      if (typeof objectId === 'string') setSelectedId(objectId);
    });
    const runtime: Runtime = { engine, scene, camera, gizmo, nodes: new Map(), previewSignatures: new Map(), assetEntities: new Map(), assetLoadTokens: new Map() };
    runtimeRef.current = runtime;
    setRuntimeReady(true);
    engine.runRenderLoop(() => scene.render());
    const resize = () => engine.resize(); window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize); setRuntimeReady(false); runtime.assetEntities.forEach(entry => entry.entity.dispose()); runtimeRef.current = null;
      gizmo.dispose(); scene.dispose(); engine.dispose();
    };
  }, [beginTransaction, endTransaction, setWorkspace]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !runtimeReady) return;
    const liveIds = new Set(workspace.objects.map(object => object.id));
    runtime.nodes.forEach((node, id) => {
      if (!liveIds.has(id)) { node.dispose(false, true); runtime.nodes.delete(id); runtime.previewSignatures.delete(id); runtime.assetLoadTokens.delete(id); }
    });
    workspace.objects.forEach(object => {
      const factory = animationObjectFactoryById.get(object.factoryTypeId);
      if (!factory) return;
      const config = { ...factory.defaultConfig, ...object.config };
      const signature = factory.previewSignature?.(config) ?? JSON.stringify(config);
      const currentNode = runtime.nodes.get(object.id);
      if (currentNode && runtime.previewSignatures.get(object.id) !== signature) {
        runtime.nodes.forEach(candidate => { if (candidate.parent === currentNode) candidate.parent = null; });
        currentNode.dispose(false, true); runtime.nodes.delete(object.id);
      }
      if (runtime.nodes.has(object.id)) return;
      const node = factory.create(runtime.scene, object.name, config);
      node.metadata = { ...(node.metadata ?? {}), animationWorkbenchObjectId: object.id };
      node.getChildMeshes(false).forEach(mesh => { mesh.metadata = { ...(mesh.metadata ?? {}), animationWorkbenchObjectId: object.id, animationWorkbenchOwnerId: object.id }; });
      runtime.nodes.set(object.id, node);
      runtime.previewSignatures.set(object.id, signature);
    });
    workspace.objects.forEach(object => {
      const node = runtime.nodes.get(object.id); if (!node) return;
      node.name = object.name;
      node.position.set(object.position.x, object.position.y, object.position.z);
      node.rotation.set(object.rotation.x * RAD, object.rotation.y * RAD, object.rotation.z * RAD);
      node.scaling.set(object.scaling.x, object.scaling.y, object.scaling.z);
      node.setEnabled(object.enabled);
      const layer = animationObjectFactoryById.get(object.factoryTypeId)?.layer ?? 'visual';
      runtime.scene.meshes.filter(mesh => mesh.metadata?.animationWorkbenchOwnerId === object.id).forEach(mesh => mesh.setEnabled(visibleLayers[layer]));
    });
    workspace.objects.forEach(object => {
      const node = runtime.nodes.get(object.id); if (!node) return;
      node.parent = object.parentId ? runtime.nodes.get(object.parentId) ?? null : null;
    });
    runtime.gizmo.attachToNode(selectedId ? runtime.nodes.get(selectedId) ?? null : null);
  }, [workspace, selectedId, runtimeReady, visibleLayers]);

  useEffect(() => {
    const runtime = runtimeRef.current; if (!runtime || !runtimeReady) return;
    const modelObjects = workspace.objects.filter(object => object.factoryTypeId === 'asset.model');
    const liveIds = new Set(modelObjects.map(object => object.id));
    runtime.assetEntities.forEach((entry, id) => { if (!liveIds.has(id)) { entry.entity.dispose(); runtime.assetEntities.delete(id); runtime.assetLoadTokens.delete(id); } });
    modelObjects.forEach(object => {
      const path = typeof object.config.path === 'string' ? object.config.path : '';
      const node = runtime.nodes.get(object.id); if (!node) return;
      const existing = runtime.assetEntities.get(object.id);
      if (existing?.path === path) return;
      if (existing) { existing.entity.dispose(); runtime.assetEntities.delete(object.id); }
      node.getChildMeshes(false).filter(mesh => mesh.name.endsWith('-placeholder')).forEach(mesh => mesh.setEnabled(!path && visibleLayers.visual));
      const token = makeId(); runtime.assetLoadTokens.set(object.id, token); if (!path) return;
      void createModelEntity(runtime.scene, path).then(entity => {
        if (runtimeRef.current !== runtime || runtime.assetLoadTokens.get(object.id) !== token || !runtime.nodes.has(object.id)) { entity.dispose(); return; }
        entity.root.parent = runtime.nodes.get(object.id)!; entity.stopAnimations();
        entity.root.getChildMeshes(false).forEach(mesh => { mesh.metadata = { ...(mesh.metadata ?? {}), animationWorkbenchObjectId: object.id, animationWorkbenchOwnerId: object.id }; mesh.setEnabled(visibleLayers.visual); });
        runtime.assetEntities.set(object.id, { path, entity }); setStatus(`模型已载入：${decodeURIComponent(path.split('/').pop() ?? path)}`);
      }).catch(error => { if (runtime.assetLoadTokens.get(object.id) === token) setStatus(`模型加载失败：${error instanceof Error ? error.message : String(error)}`); });
    });
  }, [workspace.objects, runtimeReady, visibleLayers.visual]);

  useEffect(() => {
    const runtime = runtimeRef.current; if (!runtime) return;
    configureGizmo(runtime.gizmo, gizmoMode, localSpace, selectedId ? runtime.nodes.get(selectedId) ?? null : null);
  }, [gizmoMode, localSpace, selectedId, runtimeReady]);

  const createObject = (factoryTypeId: string, parentId = selectedId) => {
    const factory = animationObjectFactoryById.get(factoryTypeId); if (!factory) return;
    const id = makeId();
    const sameTypeCount = workspace.objects.filter(object => object.factoryTypeId === factoryTypeId).length;
    const semanticScale = factoryTypeId === 'semantic.proxy' ? { x: .18, y: .12, z: 1.2 } : factoryTypeId === 'semantic.grip' ? { x: .16, y: .16, z: .3 } : factoryTypeId === 'semantic.attack' ? { x: .16, y: .12, z: 1 } : null;
    const object: AnimationObjectRecord = {
      id, parentId, name: `${factory.label} ${sameTypeCount + 1}`, factoryTypeId, enabled: true,
      position: { x: 0, y: factoryTypeId === 'core.empty' ? 0 : 0.5, z: 0 },
      rotation: { x: 0, y: 0, z: 0 }, scaling: semanticScale ?? { x: 1, y: 1, z: 1 }, config: structuredClone(factory.defaultConfig),
    };
    setWorkspace(current => ({ ...current, objects: [...current.objects, object] }));
    if (parentId) setExpanded(current => new Set(current).add(parentId));
    setSelectedId(id); setStatus(`已创建${factory.label}`);
  };

  const deleteObject = (id: string) => {
    if (id === 'workspace-root') return setStatus('工作区根节点不能删除');
    const removed = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      workspace.objects.forEach(object => { if (object.parentId && removed.has(object.parentId) && !removed.has(object.id)) { removed.add(object.id); changed = true; } });
    }
    setWorkspace(current => ({ ...current, objects: current.objects.filter(object => !removed.has(object.id)), previewBindings: current.previewBindings.filter(binding => !removed.has(binding.objectId)), mountPoints: current.mountPoints.filter(mount => !removed.has(mount.objectId)) }));
    setSelectedId(workspace.objects.find(object => object.id === id)?.parentId ?? 'workspace-root');
    setStatus(`已删除 ${removed.size} 个动画对象`);
  };

  const duplicateObject = (id: string) => {
    const source = workspace.objects.find(object => object.id === id); if (!source) return;
    const copy = { ...structuredClone(source), id: makeId(), name: `${source.name} 副本` };
    setWorkspace(current => ({ ...current, objects: [...current.objects, copy] }));
    setSelectedId(copy.id); setStatus(`已复制“${source.name}”`);
  };

  const factoryMenuEntries = (parentId?: string | null): CommandMenuEntry[] => {
    const categories = new Map<string, CommandMenuEntry[]>();
    animationObjectFactories.forEach(factory => { const entries = categories.get(factory.category) ?? []; entries.push({ id: `${parentId ?? 'root'}-${factory.typeId}`, label: factory.label, action: () => createObject(factory.typeId, parentId) }); categories.set(factory.category, entries); });
    return [...categories].map(([category, children]) => ({ id: `${parentId ?? 'root'}-${category}`, label: category, children }));
  };

  const objectMenuItems = (object: AnimationObjectRecord): CommandMenuEntry[] => [
    { id: 'create-child', label: '创建子对象', icon: 'layout', children: factoryMenuEntries(object.id) },
    { type: 'separator' },
    { id: 'duplicate', label: '复制对象', icon: 'copy', action: () => duplicateObject(object.id) },
    { id: 'toggle-enabled', label: object.enabled ? '隐藏对象' : '显示对象', checked: object.enabled, action: () => updateObject(object.id, { enabled: !object.enabled }) },
    { type: 'separator' },
    { id: 'delete', label: '删除对象', danger: true, disabled: object.id === 'workspace-root', action: () => deleteObject(object.id) },
  ];

  const openCreateMenu = (event: ReactPointerEvent<HTMLButtonElement>) => {
    openCommandMenuFromElement(event.currentTarget, factoryMenuEntries(selectedId), { ariaLabel: '创建动画对象' });
  };

  const renderObject = (object: AnimationObjectRecord, depth = 0): ReactNode => {
    const children = workspace.objects.filter(child => child.parentId === object.id);
    const open = expanded.has(object.id);
    return <div className="awb-tree-branch" key={object.id}>
      <div className={`awb-tree-row ${selectedId === object.id ? 'selected' : ''} ${object.enabled ? '' : 'disabled'}`} style={{ paddingLeft: 6 + depth * 14 }} onClick={() => setSelectedId(object.id)} onContextMenu={event => { event.preventDefault(); setSelectedId(object.id); openCommandMenuAtPoint(event.clientX, event.clientY, objectMenuItems(object), `${object.name} 操作`); }}>
        <button className={`awb-tree-chevron ${children.length ? '' : 'empty'} ${open ? 'open' : ''}`} aria-label={open ? '收起' : '展开'} onClick={event => { event.stopPropagation(); setExpanded(current => { const next = new Set(current); if (next.has(object.id)) next.delete(object.id); else next.add(object.id); return next; }); }}><svg viewBox="0 0 16 16"><path d="m5 3 5 5-5 5" /></svg></button>
        <span className="awb-object-icon"><Icon name={animationObjectFactoryById.get(object.factoryTypeId)?.icon ?? 'object'} /></span>
        <span>{object.name}</span><small>{factoryLabel(object.factoryTypeId)}</small>
      </div>
      {open && children.map(child => renderObject(child, depth + 1))}
    </div>;
  };

  const saveLocal = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace)); setStatus('工作区已保存到当前浏览器');
  };
  const reloadLocal = () => {
    const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return setStatus('当前浏览器还没有已保存的工作区');
    try { replaceWorkspace(parseAnimationWorkspace(JSON.parse(raw) as unknown), '已重新载入浏览器工作区'); } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  };
  const loadSelectedPreset = () => {
    const [source, key] = selectedPreset.split(':', 2);
    const preset = source === 'saved' ? presetLibrary[key] : migratedLibrary[key];
    if (!preset) return setStatus('请先选择动画场景预设');
    replaceWorkspace(scenePresetToWorkspace(preset), source === 'legacy' ? `已迁移并载入“${preset.name}”` : `已载入“${preset.name}”`);
  };
  const saveCurrentPreset = async (saveAs = false) => {
    const selectedKey = selectedPreset.startsWith('saved:') && !saveAs ? selectedPreset.slice(6) : '';
    const suggested = selectedPreset.includes(':') ? selectedPreset.split(':', 2)[1] : workspace.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '');
    const key = selectedKey || window.prompt('动画场景预设 Key（英文、数字、-、_）', suggested || 'animation-preset');
    if (!key) return;
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) return setStatus('预设 Key 只能包含英文、数字、-、_');
    const next = { ...presetLibrary, [key]: workspaceToScenePreset(workspace, `由 Animation Workbench 保存`, ['workbench']) };
    try {
      await saveAnimationScenePresets(next); setPresetLibrary(next); setSelectedPreset(`saved:${key}`); setStatus(`动画场景预设“${workspace.name}”已保存到服务器`);
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  };
  const exportWorkspace = () => {
    const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'animation-workspace.json'; link.click(); URL.revokeObjectURL(url); setStatus('动画工作区 JSON 已导出');
  };
  const importWorkspace = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try { replaceWorkspace(parseAnimationWorkspace(JSON.parse(await file.text()) as unknown), `已导入“${file.name}”`); } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  };

  const applySignalPreview = (_evaluation: SignalGraphEvaluation, contributionMix: NumericContributionMix) => {
    const runtime = runtimeRef.current; if (!runtime) return;
    contributionMix.values.forEach((value, targetKey) => {
      const separator = targetKey.indexOf(':'); if (separator < 1) return;
      const objectId = targetKey.slice(0, separator); const path = targetKey.slice(separator + 1); const node = runtime.nodes.get(objectId);
      if (node) setNodeComponent(node, path, value);
    });
  };

  const updateSelectedConfig = (key: string, value: unknown) => {
    if (!selectedObject) return;
    updateObject(selectedObject.id, { config: { ...selectedObject.config, [key]: value } });
  };
  const renderObjectProperty = (property: AnimationObjectProperty) => {
    const value = selectedConfig[property.key];
    if (property.type === 'asset') return <label className="awb-config-row" key={property.key}><span>{property.label}</span><select value={typeof value === 'string' ? value : ''} onChange={event => updateSelectedConfig(property.key, event.target.value)}><option value="">未选择（显示占位框）</option>{modelAssets.map(path => <option key={path} value={path}>{decodeURIComponent(path.replace('/resources/', ''))}</option>)}</select></label>;
    if (property.type === 'select') return <label className="awb-config-row" key={property.key}><span>{property.label}</span><select value={typeof value === 'string' ? value : ''} onChange={event => updateSelectedConfig(property.key, event.target.value)}>{property.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
    if (property.type === 'color') return <label className="awb-config-row awb-color-row" key={property.key}><span>{property.label}</span><div><input type="color" value={typeof value === 'string' ? value : '#ffffff'} onChange={event => updateSelectedConfig(property.key, event.target.value)} /><code>{typeof value === 'string' ? value.toUpperCase() : '#FFFFFF'}</code></div></label>;
    return <label className="awb-config-row" key={property.key}><span>{property.label}</span><input type="number" min={property.min} max={property.max} step={property.step ?? .01} value={typeof value === 'number' ? value : 0} onChange={event => updateSelectedConfig(property.key, Number(event.target.value))} /></label>;
  };

  const rootObjects = workspace.objects.filter(object => object.parentId === null);
  return <main className="awb-shell">
    <header className="awb-topbar">
      <div className="awb-brand"><strong>ANIMATION WORKBENCH</strong><span>动态值动画创作工作台</span></div>
      <div className="awb-document"><input value={workspace.name} aria-label="工作区名称" onChange={event => setWorkspace(current => ({ ...current, name: event.target.value }))} /><select aria-label="动画场景预设" value={selectedPreset} onChange={event => setSelectedPreset(event.target.value)}><option value="">选择预设…</option>{Object.keys(presetLibrary).length > 0 && <optgroup label="动画场景预设">{Object.entries(presetLibrary).map(([key, preset]) => <option key={`saved:${key}`} value={`saved:${key}`}>{preset.name}</option>)}</optgroup>}{Object.keys(migratedLibrary).length > 0 && <optgroup label="待迁移的 model-shake-lab 动作">{Object.entries(migratedLibrary).map(([key, preset]) => <option key={`legacy:${key}`} value={`legacy:${key}`}>{preset.name}</option>)}</optgroup>}</select><button onClick={loadSelectedPreset}>载入</button><i>{workspace.objects.length} objects</i></div>
      <div className="awb-actions">
        <button onClick={undo} disabled={!canUndo} title="撤回 Ctrl+Z"><Icon name="undo" /></button>
        <button onClick={redo} disabled={!canRedo} title="重做 Ctrl+Y / Ctrl+Shift+Z"><Icon name="redo" /></button>
        <button onClick={() => void saveCurrentPreset(false)} title="保存动画场景预设到服务器"><Icon name="save" /><span>保存预设</span></button>
        <button onClick={() => void saveCurrentPreset(true)} title="另存为动画场景预设">另存</button>
        <button onClick={saveLocal} title="保存浏览器草稿"><span>草稿</span></button>
        <button onClick={reloadLocal} title="重新载入"><Icon name="load" /></button>
        <button onClick={exportWorkspace} title="导出 JSON"><Icon name="download" /></button>
        <button onClick={() => importRef.current?.click()} title="导入 JSON"><Icon name="upload" /></button>
        <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={importWorkspace} />
      </div>
    </header>
    <aside className="awb-hierarchy">
      <div className="awb-panel-heading"><div><b>ANIMATION OBJECTS</b><span>预览对象与绑定层级</span></div><button onPointerDown={event => event.stopPropagation()} onClick={openCreateMenu} title="创建对象"><Icon name="add" /></button></div>
      <div className="awb-tree">{rootObjects.map(object => renderObject(object))}</div>
      <footer>{workspace.objects.length} 个动画对象</footer>
    </aside>
    <section className="awb-viewport">
      <canvas ref={canvasRef} />
      <div className="awb-gizmo-toolbar">
        {(['position', 'rotation', 'scale'] as const).map(mode => <button key={mode} className={gizmoMode === mode ? 'active' : ''} onClick={() => setGizmoMode(mode)} title={{ position: '移动', rotation: '旋转', scale: '缩放' }[mode]}><Icon name={{ position: 'move', rotation: 'rotate', scale: 'scale' }[mode]} /></button>)}
        <span />
        <button className={localSpace ? 'active text' : 'text'} onClick={() => setLocalSpace(value => !value)}>{localSpace ? 'LOCAL' : 'WORLD'}</button>
      </div>
      <div className="awb-layer-toolbar"><span>LAYERS</span>{([['visual','模型'],['semantic','语义体'],['helper','辅助']] as const).map(([layer, label]) => <button key={layer} className={visibleLayers[layer] ? 'active' : ''} onClick={() => setVisibleLayers(current => ({ ...current, [layer]: !current[layer] }))}><i />{label}</button>)}</div>
      <div className="awb-stage-label"><b>PREVIEW STAGE</b><span>固定舞台，不写入动画资产</span></div>
    </section>
    <aside className="awb-inspector">
      <div className="awb-panel-heading"><div><b>INSPECTOR</b><span>{selectedObject ? factoryLabel(selectedObject.factoryTypeId) : '未选择对象'}</span></div>{selectedObject && <button title="更多操作" onClick={event => openCommandMenuFromElement(event.currentTarget, objectMenuItems(selectedObject), { align: 'end', ariaLabel: `${selectedObject.name} 操作` })}><Icon name="more" /></button>}</div>
      {selectedObject ? <div className="awb-inspector-scroll">
        <section className="awb-object-summary"><span className="awb-large-object-icon"><Icon name={selectedFactory?.icon ?? 'object'} /></span><div><input value={selectedObject.name} onChange={event => updateObject(selectedObject.id, { name: event.target.value })} /><small>{selectedObject.id}</small></div></section>
        <section className="awb-component open"><header><svg viewBox="0 0 16 16"><path d="m5 3 5 5-5 5" /></svg><strong>Object</strong><em>{selectedFactory?.category}</em></header><div className="awb-component-body"><label className="awb-check"><span>Enabled</span><input type="checkbox" checked={selectedObject.enabled} onChange={event => updateObject(selectedObject.id, { enabled: event.target.checked })} /></label><label className="awb-readonly"><span>Factory</span><code>{selectedObject.factoryTypeId}</code></label><label className="awb-readonly"><span>Layer</span><code>{selectedFactory?.layer ?? 'unknown'}</code></label><label className="awb-check"><span>可挂载外部对象</span><input type="checkbox" checked={workspace.mountPoints.some(mount => mount.objectId === selectedObject.id)} onChange={event => setWorkspace(current => ({ ...current, mountPoints: event.target.checked ? [...current.mountPoints, { id: `mount-${selectedObject.id}`, name: selectedObject.name, objectId: selectedObject.id, role: 'item', tags: [] }] : current.mountPoints.filter(mount => mount.objectId !== selectedObject.id) }))} /></label></div></section>
        <section className="awb-component open"><header><svg viewBox="0 0 16 16"><path d="m5 3 5 5-5 5" /></svg><strong>Transform</strong><em>{recordMode === 'off' ? '基础值' : `${recordMode.toUpperCase()} · ${currentTime.toFixed(3)}s`}</em></header><div className="awb-component-body"><VectorEditor label="Position" value={selectedObject.position} onEditStart={beginTransaction} onEditEnd={endTransaction} onChange={position => updateAnimatedVector(selectedObject.id, 'position', position)} /><VectorEditor label="Rotation" value={selectedObject.rotation} onEditStart={beginTransaction} onEditEnd={endTransaction} onChange={rotation => updateAnimatedVector(selectedObject.id, 'rotation', rotation)} /><VectorEditor label="Scale" value={selectedObject.scaling} min={0.001} onEditStart={beginTransaction} onEditEnd={endTransaction} onChange={scaling => updateAnimatedVector(selectedObject.id, 'scaling', scaling)} /></div></section>
        {selectedFactory && selectedFactory.properties.length > 0 && <section className="awb-component open"><header><svg viewBox="0 0 16 16"><path d="m5 3 5 5-5 5" /></svg><strong>{selectedFactory.layer === 'semantic' ? 'Semantic Visual' : selectedObject.factoryTypeId === 'asset.model' ? 'Model Asset' : 'Appearance'}</strong><em>对象专属配置</em></header><div className="awb-component-body">{selectedFactory.properties.map(renderObjectProperty)}</div></section>}
        <button className="awb-delete" disabled={selectedObject.id === 'workspace-root'} onClick={() => deleteObject(selectedObject.id)}><Icon name="trash" />删除对象</button>
      </div> : <div className="awb-empty">从左侧选择一个动画对象</div>}
    </aside>
    <SignalWorkspace graph={workspace.signalGraph} bindings={workspace.previewBindings} objects={workspace.objects} selectedObjectId={selectedId} transport={workspace.transport} events={workspace.events} time={currentTime} recordMode={recordMode} onTimeChange={setCurrentTime} onRecordModeChange={setRecordMode} onBeginEdit={beginTransaction} onEndEdit={endTransaction} onGraphChange={signalGraph => setWorkspace(current => ({ ...current, signalGraph }))} onBindingsChange={previewBindings => setWorkspace(current => ({ ...current, previewBindings }))} onTransportChange={transport => setWorkspace(current => ({ ...current, transport }))} onEventsChange={events => setWorkspace(current => ({ ...current, events }))} onEvaluate={applySignalPreview} />
    <footer className="awb-status"><span>{status}</span><code>WORKSPACE v{workspace.version} · SIGNAL GRAPH v{workspace.signalGraph.version}</code></footer>
  </main>;
}
