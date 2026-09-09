import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ArcRotateCamera, Color3, Color4, DirectionalLight, Engine, HemisphericLight,
  Mesh, MeshBuilder, PBRMaterial, Quaternion, Scene, SceneLoader, StandardMaterial,
  TransformNode, UniversalCamera, Vector3, VertexData, type AbstractMesh,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { createModelEntity, type ModelEntity } from '@/core/model';
import { loadModelAssetManifestByExtension } from '@/core/resources';

type Vec3 = { x: number; y: number; z: number };
type WeaponKeyframe = { id: string; time: number; label: string; position: Vec3; rotation: Vec3 };
type AnimationProject = {
  name: string; duration: number; loop: boolean; playbackSpeed: number;
  asset: { path: string; name: string; scale: number; offset: Vec3; rotation: Vec3 };
  keyframes: WeaponKeyframe[];
};
type Runtime = {
  engine: Engine; scene: Scene; firstPersonCamera: UniversalCamera; orbitCamera: ArcRotateCamera;
  viewmodelRoot: TransformNode; weaponPose: TransformNode; weaponAsset: TransformNode;
  disposeWeapon: (() => void) | null;
};
type IconName = 'play' | 'pause' | 'stop' | 'restart' | 'skip-back' | 'repeat' | 'plus' | 'upload' | 'download' | 'trash';

const rad = Math.PI / 180;
const STORAGE_KEY = 'model-shake-lab:first-person-weapon-project:v2';
const makeId = () => `kf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const mix = (a: number, b: number, amount: number) => a + (b - a) * amount;
const mixVec = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), z: mix(a.z, b.z, t) });
const ease = (value: number) => value * value * (3 - 2 * value);

const DEFAULT_PROJECT: AnimationProject = {
  name: '右手横斩', duration: 0.82, loop: false, playbackSpeed: 1,
  asset: { path: '', name: '内置精制长剑', scale: 1, offset: vec(), rotation: vec() },
  keyframes: [
    { id: 'ready', time: 0, label: '预备', position: vec(0.43, -0.38, 0.82), rotation: vec(-12, 8, -7) },
    { id: 'windup', time: 0.18, label: '蓄力', position: vec(0.54, -0.30, 0.72), rotation: vec(-25, 35, 25) },
    { id: 'contact', time: 0.40, label: '命中', position: vec(-0.18, -0.19, 0.64), rotation: vec(12, -52, -64) },
    { id: 'follow', time: 0.56, label: '随挥', position: vec(-0.42, -0.34, 0.78), rotation: vec(24, -70, -82) },
    { id: 'recover', time: 0.82, label: '复位', position: vec(0.43, -0.38, 0.82), rotation: vec(-12, 8, -7) },
  ],
};

const cloneProject = (project: AnimationProject): AnimationProject => JSON.parse(JSON.stringify(project)) as AnimationProject;
const readStoredProject = (): AnimationProject => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as AnimationProject;
    if (Array.isArray(parsed.keyframes) && parsed.keyframes.length >= 2) {
      if (!parsed.asset.path) parsed.asset.name = '内置精制长剑';
      return parsed;
    }
    return cloneProject(DEFAULT_PROJECT);
  } catch { return cloneProject(DEFAULT_PROJECT); }
};

const sampleAnimation = (frames: WeaponKeyframe[], time: number) => {
  const sorted = [...frames].sort((a, b) => a.time - b.time);
  if (time <= sorted[0].time) return sorted[0];
  const last = sorted[sorted.length - 1];
  if (time >= last.time) return last;
  const rightIndex = sorted.findIndex((frame) => frame.time >= time);
  const left = sorted[rightIndex - 1]; const right = sorted[rightIndex];
  const amount = ease((time - left.time) / Math.max(0.0001, right.time - left.time));
  return { ...left, position: mixVec(left.position, right.position, amount), rotation: mixVec(left.rotation, right.rotation, amount) };
};

const applyPose = (node: TransformNode, frame: Pick<WeaponKeyframe, 'position' | 'rotation'>) => {
  node.position.set(frame.position.x, frame.position.y, frame.position.z);
  node.rotationQuaternion = Quaternion.FromEulerAngles(frame.rotation.x * rad, frame.rotation.y * rad, frame.rotation.z * rad);
};

const material = (name: string, scene: Scene, diffuse: Color3, emissive = Color3.Black()) => {
  const result = new StandardMaterial(name, scene); result.diffuseColor = diffuse; result.emissiveColor = emissive;
  result.specularColor = new Color3(0.7, 0.78, 0.88); return result;
};

const createPbr = (name: string, scene: Scene, color: Color3, metallic: number, roughness: number) => {
  const result = new PBRMaterial(name, scene); result.albedoColor = color; result.metallic = metallic; result.roughness = roughness; result.environmentIntensity = 1.15; return result;
};

const createFacetedBlade = (scene: Scene) => {
  const blade = new Mesh('editor-longsword-blade', scene);
  const sections = [
    { z: 0, width: 0.078, thickness: 0.024 },
    { z: 1.08, width: 0.066, thickness: 0.020 },
    { z: 1.30, width: 0.044, thickness: 0.014 },
    { z: 1.46, width: 0.003, thickness: 0.003 },
  ];
  const positions: number[] = []; const indices: number[] = [];
  sections.forEach(({ z, width, thickness }) => positions.push(-width, 0, z, 0, thickness, z, width, 0, z, 0, -thickness, z));
  for (let section = 0; section < sections.length - 1; section += 1) {
    for (let side = 0; side < 4; side += 1) {
      const a = section * 4 + side; const b = section * 4 + (side + 1) % 4; const c = (section + 1) * 4 + side; const d = (section + 1) * 4 + (side + 1) % 4;
      indices.push(a, c, b, b, c, d);
    }
  }
  indices.push(0, 1, 2, 0, 2, 3); const tip = (sections.length - 1) * 4; indices.push(tip, tip + 2, tip + 1, tip, tip + 3, tip + 2);
  const normals: number[] = []; VertexData.ComputeNormals(positions, indices, normals);
  const data = new VertexData(); data.positions = positions; data.indices = indices; data.normals = normals; data.applyToMesh(blade); blade.convertToFlatShadedMesh(); return blade;
};

const createEditorLongsword = (scene: Scene, parent: TransformNode) => {
  const steel = createPbr('longsword-steel', scene, new Color3(0.52, 0.61, 0.66), 0.92, 0.19);
  const edgeSteel = createPbr('longsword-edge', scene, new Color3(0.82, 0.89, 0.91), 1, 0.11);
  const darkSteel = createPbr('longsword-dark-steel', scene, new Color3(0.10, 0.13, 0.14), 0.86, 0.28);
  const bronze = createPbr('longsword-bronze', scene, new Color3(0.34, 0.20, 0.075), 0.82, 0.24);
  const leather = createPbr('longsword-leather', scene, new Color3(0.075, 0.025, 0.018), 0.05, 0.82);
  const blade = createFacetedBlade(scene); blade.material = steel;
  const ridge = MeshBuilder.CreateBox('blade-central-ridge', { width: 0.014, height: 0.009, depth: 1.19 }, scene); ridge.position.set(0, 0.017, 0.62); ridge.material = edgeSteel;
  const collar = MeshBuilder.CreateCylinder('blade-collar', { height: 0.10, diameterTop: 0.105, diameterBottom: 0.12, tessellation: 24 }, scene); collar.rotation.x = Math.PI / 2; collar.position.z = -0.025; collar.material = darkSteel;
  const guardHub = MeshBuilder.CreateCylinder('guard-hub', { height: 0.13, diameter: 0.17, tessellation: 24 }, scene); guardHub.rotation.x = Math.PI / 2; guardHub.position.z = -0.065; guardHub.material = bronze;
  const quillonLeft = MeshBuilder.CreateCylinder('guard-left', { height: 0.37, diameterTop: 0.045, diameterBottom: 0.075, tessellation: 18 }, scene); quillonLeft.rotation.z = Math.PI / 2; quillonLeft.position.set(-0.20, 0, -0.055); quillonLeft.material = darkSteel;
  const quillonRight = MeshBuilder.CreateCylinder('guard-right', { height: 0.37, diameterTop: 0.075, diameterBottom: 0.045, tessellation: 18 }, scene); quillonRight.rotation.z = Math.PI / 2; quillonRight.position.set(0.20, 0, -0.055); quillonRight.material = darkSteel;
  const leftTip = MeshBuilder.CreateSphere('guard-left-tip', { diameter: 0.075, segments: 16 }, scene); leftTip.position.set(-0.395, 0, -0.055); leftTip.scaling.set(0.8, 1.25, 0.8); leftTip.material = bronze;
  const rightTip = MeshBuilder.CreateSphere('guard-right-tip', { diameter: 0.075, segments: 16 }, scene); rightTip.position.set(0.395, 0, -0.055); rightTip.scaling.set(0.8, 1.25, 0.8); rightTip.material = bronze;
  const grip = MeshBuilder.CreateCylinder('leather-grip', { height: 0.38, diameterTop: 0.095, diameterBottom: 0.11, tessellation: 24 }, scene); grip.rotation.x = Math.PI / 2; grip.position.z = -0.30; grip.material = leather;
  const wraps = Array.from({ length: 8 }, (_, index) => { const wrap = MeshBuilder.CreateTorus(`grip-wrap-${index}`, { diameter: 0.105 + index * 0.0015, thickness: 0.012, tessellation: 18 }, scene); wrap.rotation.x = Math.PI / 2; wrap.position.z = -0.14 - index * 0.046; wrap.material = bronze; return wrap; });
  const pommelNeck = MeshBuilder.CreateCylinder('pommel-neck', { height: 0.07, diameter: 0.10, tessellation: 20 }, scene); pommelNeck.rotation.x = Math.PI / 2; pommelNeck.position.z = -0.52; pommelNeck.material = darkSteel;
  const pommel = MeshBuilder.CreateSphere('faceted-pommel', { diameter: 0.16, segments: 12 }, scene); pommel.position.z = -0.59; pommel.scaling.set(0.82, 0.82, 1.12); pommel.material = bronze; pommel.convertToFlatShadedMesh();
  const endCap = MeshBuilder.CreateCylinder('pommel-cap', { height: 0.035, diameterTop: 0.035, diameterBottom: 0.085, tessellation: 16 }, scene); endCap.rotation.x = Math.PI / 2; endCap.position.z = -0.685; endCap.material = darkSteel;
  const meshes = [blade, ridge, collar, guardHub, quillonLeft, quillonRight, leftTip, rightTip, grip, ...wraps, pommelNeck, pommel, endCap];
  meshes.forEach((mesh) => { mesh.parent = parent; mesh.isPickable = false; });
  const materials = [steel, edgeSteel, darkSteel, bronze, leather];
  return () => { meshes.forEach((mesh) => mesh.dispose()); materials.forEach((entry) => entry.dispose()); };
};

const normalizeImportedModel = (meshes: AbstractMesh[], root: TransformNode) => {
  const renderable = meshes.filter((mesh) => mesh.getTotalVertices() > 0); if (!renderable.length) return;
  let min = new Vector3(Infinity, Infinity, Infinity); let max = new Vector3(-Infinity, -Infinity, -Infinity);
  renderable.forEach((mesh) => { mesh.computeWorldMatrix(true); const box = mesh.getBoundingInfo().boundingBox; min = Vector3.Minimize(min, box.minimumWorld); max = Vector3.Maximize(max, box.maximumWorld); });
  const center = min.add(max).scale(0.5); const size = Math.max(max.x - min.x, max.y - min.y, max.z - min.z, 0.001); const scale = 1.45 / size;
  root.scaling.setAll(scale); root.position.copyFrom(center.scale(-scale));
};

const buildEnvironment = (scene: Scene) => {
  const floorMat = material('floor-material', scene, new Color3(0.055, 0.07, 0.085));
  const wallMat = material('wall-material', scene, new Color3(0.075, 0.09, 0.105));
  const accent = material('accent-material', scene, new Color3(0.06, 0.18, 0.17), new Color3(0.01, 0.055, 0.05));
  const floor = MeshBuilder.CreateGround('editor-floor', { width: 36, height: 36, subdivisions: 12 }, scene); floor.material = floorMat;
  for (let i = 0; i < 10; i += 1) { const line = MeshBuilder.CreateBox(`floor-line-${i}`, { width: 0.025, height: 0.006, depth: 24 }, scene); line.position.set(-9 + i * 2, 0.004, 2); line.material = accent; }
  const back = MeshBuilder.CreateBox('editor-backdrop', { width: 24, height: 5, depth: 0.25 }, scene); back.position.set(0, 2.5, 10); back.material = wallMat;
};

// Stroke geometry follows the Lucide icon language (ISC): 24px viewBox, round caps and joins.
const SvgIcon = ({ name, size = 16 }: { name: IconName; size?: number }) => {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return <svg className="ui-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...common}>
    {name === 'play' && <path d="m7 4 13 8-13 8Z" />}
    {name === 'pause' && <><path d="M8 5v14" /><path d="M16 5v14" /></>}
    {name === 'stop' && <rect x="6" y="6" width="12" height="12" rx="1.5" />}
    {name === 'restart' && <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>}
    {name === 'skip-back' && <><path d="M6 5v14" /><path d="m18 6-9 6 9 6Z" /></>}
    {name === 'repeat' && <><path d="m17 1 4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="m7 23-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>}
    {name === 'plus' && <><path d="M12 5v14" /><path d="M5 12h14" /></>}
    {name === 'upload' && <><path d="M12 16V3" /><path d="m7 8 5-5 5 5" /><path d="M5 21h14" /></>}
    {name === 'download' && <><path d="M12 3v13" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" /></>}
    {name === 'trash' && <><path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="m6 7 1 14h10l1-14" /><path d="M9 7V4h6v3" /></>}
  </svg>;
};

export const ModelShakeLab = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null); const fileRef = useRef<HTMLInputElement>(null);
  const timelineCanvasRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<Runtime | null>(null); const modelEntityRef = useRef<ModelEntity | null>(null);
  const playStateRef = useRef({ playing: false, startedAt: 0, pausedAt: 0 });
  const [project, setProject] = useState<AnimationProject>(() => readStoredProject()); const projectRef = useRef(project);
  const [assets, setAssets] = useState<string[]>([]); const [selectedId, setSelectedId] = useState(project.keyframes[0].id);
  const [currentTime, setCurrentTime] = useState(0); const [playing, setPlaying] = useState(false); const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'first-person' | 'orbit'>('first-person'); const [activeTab, setActiveTab] = useState<'pose' | 'asset' | 'project'>('pose');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [status, setStatus] = useState('内置精制长剑已就绪'); const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(project));
  const saved = savedSnapshot === JSON.stringify(project);
  const selectedFrame = useMemo(() => project.keyframes.find((frame) => frame.id === selectedId) ?? project.keyframes[0], [project, selectedId]);
  const orderedFrames = useMemo(() => [...project.keyframes].sort((a, b) => a.time - b.time), [project.keyframes]);

  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const engine = new Engine(canvas, true, { stencil: true, antialias: true }); const scene = new Scene(engine); scene.clearColor = new Color4(0.018, 0.025, 0.031, 1);
    const firstPersonCamera = new UniversalCamera('first-person-camera', new Vector3(0, 1.68, -3.8), scene);
    firstPersonCamera.minZ = 0.03; firstPersonCamera.maxZ = 120; firstPersonCamera.angularSensibility = 2800; firstPersonCamera.inertia = 0.55; firstPersonCamera.attachControl(canvas, true);
    const orbitCamera = new ArcRotateCamera('workbench-camera', -Math.PI / 2.15, Math.PI / 2.35, 2.9, new Vector3(0, 1.3, 0.4), scene); orbitCamera.minZ = 0.02; orbitCamera.wheelPrecision = 55;
    const viewmodelRoot = new TransformNode('first-person-viewmodel', scene); viewmodelRoot.parent = firstPersonCamera;
    const weaponPose = new TransformNode('weapon-animation-pose', scene); weaponPose.parent = viewmodelRoot;
    const weaponAsset = new TransformNode('weapon-asset-adjustment', scene); weaponAsset.parent = weaponPose;
    const hemi = new HemisphericLight('ambient-light', new Vector3(0.2, 1, 0.1), scene); hemi.intensity = 1.05;
    const key = new DirectionalLight('key-light', new Vector3(-0.35, -0.7, 0.8), scene); key.intensity = 1.8; buildEnvironment(scene);
    const disposeWeapon = createEditorLongsword(scene, weaponAsset); runtimeRef.current = { engine, scene, firstPersonCamera, orbitCamera, viewmodelRoot, weaponPose, weaponAsset, disposeWeapon };
    scene.activeCamera = firstPersonCamera; applyPose(weaponPose, projectRef.current.keyframes[0]);
    engine.runRenderLoop(() => {
      const runtime = runtimeRef.current; if (!runtime) return; const playState = playStateRef.current;
      if (playState.playing) {
        const current = projectRef.current; const elapsed = ((performance.now() - playState.startedAt) / 1000) * current.playbackSpeed; let time = elapsed;
        if (current.loop) time %= current.duration;
        if (!current.loop && time >= current.duration) { time = current.duration; playState.playing = false; setPlaying(false); setStatus('播放完成 · 可继续调整关键帧'); }
        playState.pausedAt = time; applyPose(runtime.weaponPose, sampleAnimation(current.keyframes, time)); setCurrentTime(time);
      }
      scene.render();
    });
    const resize = () => engine.resize(); window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); runtimeRef.current?.disposeWeapon?.(); modelEntityRef.current?.dispose(); scene.dispose(); engine.dispose(); runtimeRef.current = null; };
  }, []);

  useEffect(() => { loadModelAssetManifestByExtension(/\.(glb|gltf)$/i).then(setAssets).catch(() => setStatus('项目模型清单读取失败，仍可导入本地 GLB')); }, []);
  useEffect(() => {
    const runtime = runtimeRef.current; if (!runtime) return; const { asset } = project;
    runtime.weaponAsset.scaling.setAll(asset.scale); runtime.weaponAsset.position.set(asset.offset.x, asset.offset.y, asset.offset.z);
    runtime.weaponAsset.rotationQuaternion = Quaternion.FromEulerAngles(asset.rotation.x * rad, asset.rotation.y * rad, asset.rotation.z * rad);
    if (!playing) applyPose(runtime.weaponPose, sampleAnimation(project.keyframes, currentTime));
  }, [project, currentTime, playing]);

  const stopPlayback = (reset = true) => {
    const state = playStateRef.current; state.playing = false; setPlaying(false);
    if (reset) { state.pausedAt = 0; setCurrentTime(0); const runtime = runtimeRef.current; if (runtime) applyPose(runtime.weaponPose, sampleAnimation(projectRef.current.keyframes, 0)); setStatus('已停止 · 播放头回到起点'); }
  };
  const pausePlayback = () => { stopPlayback(false); setStatus('已暂停播放'); };
  const startPlayback = () => {
    const state = playStateRef.current;
    if (state.pausedAt >= project.duration - 0.001) { state.pausedAt = 0; setCurrentTime(0); }
    state.playing = true; state.startedAt = performance.now() - (state.pausedAt / project.playbackSpeed) * 1000;
    setPlaying(true); setStatus(project.loop ? '正在循环播放动画' : '正在播放动画');
  };
  const replayPlayback = () => { playStateRef.current.pausedAt = 0; setCurrentTime(0); startPlayback(); setStatus('正在从头播放动画'); };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.code === 'Space' && event.target === document.body) { event.preventDefault(); if (playStateRef.current.playing) pausePlayback(); else startPlayback(); } };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });

  const disposeCurrentWeapon = () => {
    const runtime = runtimeRef.current; if (!runtime) return; runtime.disposeWeapon?.(); runtime.disposeWeapon = null;
    modelEntityRef.current?.dispose(); modelEntityRef.current = null; [...runtime.weaponAsset.getChildren()].forEach((node) => node.dispose());
  };
  const loadBuiltInWeapon = () => { const runtime = runtimeRef.current; if (!runtime) return; disposeCurrentWeapon(); runtime.disposeWeapon = createEditorLongsword(runtime.scene, runtime.weaponAsset); setProject((current) => ({ ...current, asset: { ...current.asset, path: '', name: '内置精制长剑' } })); setStatus('已切换到内置精制长剑'); };
  const loadManifestModel = async (path: string) => {
    const runtime = runtimeRef.current; if (!runtime || !path) return loadBuiltInWeapon(); setLoading(true); stopPlayback(false);
    try { disposeCurrentWeapon(); const entity = await createModelEntity(runtime.scene, path, { applyAssetProfile: true }); entity.root.parent = runtime.weaponAsset; normalizeImportedModel(entity.meshes, entity.root); modelEntityRef.current = entity; const name = decodeURIComponent(path.split('/').pop() ?? path); setProject((current) => ({ ...current, asset: { ...current.asset, path, name } })); setStatus(`已装配 ${name}`); }
    catch (error) { loadBuiltInWeapon(); setStatus(error instanceof Error ? `模型加载失败：${error.message}` : String(error)); } finally { setLoading(false); }
  };
  const loadLocalModel = async (file: File) => {
    const runtime = runtimeRef.current; if (!runtime) return; if (!file.name.toLowerCase().endsWith('.glb')) return setStatus('本地导入请使用单文件 .glb 格式'); setLoading(true); stopPlayback(false);
    try {
      disposeCurrentWeapon(); const result = await SceneLoader.ImportMeshAsync(null, '', file, runtime.scene, undefined, '.glb'); const root = new TransformNode(`local:${file.name}`, runtime.scene);
      result.meshes.filter((mesh) => !mesh.parent).forEach((mesh) => { mesh.parent = root; }); root.parent = runtime.weaponAsset; normalizeImportedModel(result.meshes, root);
      runtime.disposeWeapon = () => { result.animationGroups.forEach((group) => group.dispose()); result.meshes.forEach((mesh) => mesh.dispose(false, true)); root.dispose(); };
      setProject((current) => ({ ...current, asset: { ...current.asset, path: `local:${file.name}`, name: file.name } })); setStatus(`已导入 ${file.name} · 本地模型不会写入项目资源目录`);
    } catch (error) { loadBuiltInWeapon(); setStatus(error instanceof Error ? `本地 GLB 读取失败：${error.message}` : String(error)); }
    finally { setLoading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const updateProject = (patch: Partial<AnimationProject>) => setProject((current) => ({ ...current, ...patch }));
  const updateAsset = (patch: Partial<AnimationProject['asset']>) => setProject((current) => ({ ...current, asset: { ...current.asset, ...patch } }));
  const updateAssetVec = (channel: 'offset' | 'rotation', axis: keyof Vec3, value: number) => setProject((current) => ({ ...current, asset: { ...current.asset, [channel]: { ...current.asset[channel], [axis]: value } } }));
  const updateFrame = (patch: Partial<WeaponKeyframe>) => setProject((current) => ({ ...current, keyframes: current.keyframes.map((frame) => frame.id === selectedId ? { ...frame, ...patch } : frame).sort((a, b) => a.time - b.time) }));
  const updateFrameVec = (channel: 'position' | 'rotation', axis: keyof Vec3, value: number) => updateFrame({ [channel]: { ...selectedFrame[channel], [axis]: value } });
  const selectFrame = (frame: WeaponKeyframe) => { stopPlayback(false); setSelectedId(frame.id); setCurrentTime(frame.time); const runtime = runtimeRef.current; if (runtime) applyPose(runtime.weaponPose, frame); };
  const addFrame = () => { const time = clamp(selectedFrame.time + 0.1, 0, project.duration); const frame = { ...selectedFrame, id: makeId(), time, label: '新姿态', position: { ...selectedFrame.position }, rotation: { ...selectedFrame.rotation } }; setProject((current) => ({ ...current, keyframes: [...current.keyframes, frame].sort((a, b) => a.time - b.time) })); setSelectedId(frame.id); setCurrentTime(time); setStatus('已添加关键帧'); };
  const deleteFrame = () => { if (project.keyframes.length <= 2) return setStatus('动画至少需要两个关键帧'); const index = project.keyframes.findIndex((frame) => frame.id === selectedId); const next = project.keyframes.filter((frame) => frame.id !== selectedId); const fallback = next[Math.max(0, index - 1)]; setProject((current) => ({ ...current, keyframes: next })); selectFrame(fallback); setStatus('已删除关键帧'); };
  const scrub = (time: number) => { stopPlayback(false); playStateRef.current.pausedAt = time; setCurrentTime(time); const runtime = runtimeRef.current; if (runtime) applyPose(runtime.weaponPose, sampleAnimation(project.keyframes, time)); };
  const timeFromPointer = (clientX: number, bounds: DOMRect, useSnap = false) => {
    const raw = clamp(((clientX - bounds.left) / Math.max(1, bounds.width)) * project.duration, 0, project.duration);
    const step = useSnap && snapEnabled ? 0.01 : 0.001;
    return Number((Math.round(raw / step) * step).toFixed(3));
  };
  const beginKeyframeDrag = (event: ReactPointerEvent<HTMLButtonElement>, frame: WeaponKeyframe) => {
    const timeline = timelineCanvasRef.current; if (!timeline) return; event.preventDefault(); event.stopPropagation(); stopPlayback(false);
    const bounds = timeline.getBoundingClientRect(); setSelectedId(frame.id); document.body.classList.add('dragging-keyframe');
    const move = (pointerEvent: PointerEvent) => {
      const time = timeFromPointer(pointerEvent.clientX, bounds, true); playStateRef.current.pausedAt = time; setCurrentTime(time);
      setProject((current) => ({ ...current, keyframes: current.keyframes.map((item) => item.id === frame.id ? { ...item, time } : item).sort((a, b) => a.time - b.time) }));
      const runtime = runtimeRef.current; if (runtime) applyPose(runtime.weaponPose, frame); setStatus(`正在移动「${frame.label}」· ${time.toFixed(2)}s`);
    };
    const finish = () => { document.body.classList.remove('dragging-keyframe'); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); setStatus(`已更新「${frame.label}」的时间位置`); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish, { once: true });
  };
  const beginTimelineScrub = (event: ReactPointerEvent<HTMLDivElement>) => {
    const timeline = timelineCanvasRef.current; if (!timeline || event.button !== 0) return;
    event.preventDefault(); stopPlayback(false); const bounds = timeline.getBoundingClientRect(); document.body.classList.add('scrubbing-timeline');
    const seek = (clientX: number) => {
      const time = timeFromPointer(clientX, bounds); playStateRef.current.pausedAt = time; setCurrentTime(time);
      const runtime = runtimeRef.current; if (runtime) applyPose(runtime.weaponPose, sampleAnimation(projectRef.current.keyframes, time));
      setStatus(`正在擦洗动画 · ${time.toFixed(3)}s`);
    };
    seek(event.clientX);
    const move = (pointerEvent: PointerEvent) => seek(pointerEvent.clientX);
    const finish = () => { document.body.classList.remove('scrubbing-timeline'); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); setStatus('已定位播放头'); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish, { once: true });
  };
  const switchView = (mode: 'first-person' | 'orbit') => {
    const runtime = runtimeRef.current; const canvas = canvasRef.current; if (!runtime || !canvas) return; runtime.firstPersonCamera.detachControl(); runtime.orbitCamera.detachControl();
    if (mode === 'first-person') { runtime.viewmodelRoot.parent = runtime.firstPersonCamera; runtime.viewmodelRoot.position.setAll(0); runtime.viewmodelRoot.rotation.setAll(0); runtime.firstPersonCamera.attachControl(canvas, true); runtime.scene.activeCamera = runtime.firstPersonCamera; }
    else { runtime.viewmodelRoot.parent = null; runtime.viewmodelRoot.position.set(0, 1.25, 0); runtime.viewmodelRoot.rotation.set(0, Math.PI, 0); runtime.orbitCamera.attachControl(canvas, true); runtime.scene.activeCamera = runtime.orbitCamera; }
    setViewMode(mode); setStatus(mode === 'first-person' ? '第一人称预览机位 · 拖动鼠标可调整观察方向' : '工作台视角 · 可环绕检查武器姿态');
  };
  const replaceProject = (next: AnimationProject, message: string) => { const clean = { ...next, keyframes: [...next.keyframes].sort((a, b) => a.time - b.time) }; projectRef.current = clean; setProject(clean); setSelectedId(clean.keyframes[0].id); setCurrentTime(0); stopPlayback(false); setStatus(message); };
  const saveProject = () => { const snapshot = JSON.stringify(project); localStorage.setItem(STORAGE_KEY, snapshot); setSavedSnapshot(snapshot); setStatus('项目已保存到当前浏览器'); };
  const exportProject = () => { const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${project.name || 'weapon-animation'}.json`; link.click(); URL.revokeObjectURL(url); setStatus('动画 JSON 已导出'); };
  const importProject = async (file: File) => { try { const data = JSON.parse(await file.text()) as AnimationProject; if (!Array.isArray(data.keyframes) || data.keyframes.length < 2) throw new Error('关键帧不足'); replaceProject(data, `已载入动画项目：${data.name}`); } catch (error) { setStatus(error instanceof Error ? `项目文件无效：${error.message}` : '项目文件无效'); } };

  return <main className="weapon-lab">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">WS</span><div><h1>Weapon Motion Studio</h1><span>第一人称武器动画工作台</span></div></div>
      <div className="project-name"><span>动画</span><input value={project.name} onChange={(event) => updateProject({ name: event.target.value })} /></div>
      <div className="view-switch" role="group" aria-label="视角模式"><button className={viewMode === 'first-person' ? 'active' : ''} onClick={() => switchView('first-person')}>第一人称预览</button><button className={viewMode === 'orbit' ? 'active' : ''} onClick={() => switchView('orbit')}>工作台</button></div>
      <button className="ghost" onClick={saveProject}><span className={`save-dot ${saved ? 'saved' : ''}`} />{saved ? '已保存' : '保存项目'}</button>
      <button className="primary icon-label" onClick={playing ? pausePlayback : startPlayback}><SvgIcon name={playing ? 'pause' : 'play'} />{playing ? '暂停' : '播放'}</button>
    </header>
    <section className="viewport-shell">
      <canvas ref={canvasRef} tabIndex={0} /><div className="viewport-top"><span className="mode-badge"><i />{viewMode === 'first-person' ? 'FIRST PERSON PREVIEW' : 'POSE VIEW'}</span><span>{project.asset.name}</span></div>
      <div className="reticle" aria-hidden="true"><span /><span /></div>
      <div className="viewport-help">{viewMode === 'first-person' ? '拖动鼠标调整预览方向 · 空格播放/暂停' : '左键旋转 · 右键平移 · 滚轮缩放'}</div><div className="status-toast">{loading && <span className="spinner" />}{status}</div>
    </section>
    <aside className="inspector">
      <div className="tabs"><button className={activeTab === 'pose' ? 'active' : ''} onClick={() => setActiveTab('pose')}>姿态</button><button className={activeTab === 'asset' ? 'active' : ''} onClick={() => setActiveTab('asset')}>模型</button><button className={activeTab === 'project' ? 'active' : ''} onClick={() => setActiveTab('project')}>项目</button></div>
      {activeTab === 'pose' && <div className="panel-content">
        <div className="section-heading"><div><span>KEYFRAME</span><h2>{selectedFrame.label}</h2></div><span className="time-readout">{selectedFrame.time.toFixed(2)}s</span></div>
        <label className="wide-field"><span>关键帧名称</span><input value={selectedFrame.label} onChange={(event) => updateFrame({ label: event.target.value })} /></label>
        <label className="wide-field"><span>时间</span><div className="unit-input"><input type="number" min={0} max={project.duration} step={0.01} value={selectedFrame.time} onChange={(event) => updateFrame({ time: clamp(Number(event.target.value), 0, project.duration) })} /><b>秒</b></div></label>
        <VectorEditor title="位置 / CAMERA SPACE" value={selectedFrame.position} step={0.01} onChange={(axis, value) => updateFrameVec('position', axis, value)} />
        <VectorEditor title="旋转 / EULER" value={selectedFrame.rotation} step={1} unit="°" onChange={(axis, value) => updateFrameVec('rotation', axis, value)} />
        <div className="tip"><b>制作提示</b><p>蓄力帧拉开动作方向，命中帧快速穿过屏幕中心，随挥帧负责表现重量。</p></div><div className="split-actions"><button className="icon-label" onClick={addFrame}><SvgIcon name="plus" />复制为新帧</button><button className="danger icon-label" onClick={deleteFrame}><SvgIcon name="trash" />删除</button></div>
      </div>}
      {activeTab === 'asset' && <div className="panel-content">
        <div className="section-heading"><div><span>VIEWMODEL</span><h2>武器模型</h2></div></div>
        <label className="wide-field"><span>项目资源</span><select value={project.asset.path.startsWith('local:') ? '' : project.asset.path} onChange={(event) => void loadManifestModel(event.target.value)}><option value="">内置精制长剑</option>{assets.map((path) => <option key={path} value={path}>{decodeURIComponent(path.replace('/resources/', ''))}</option>)}</select></label>
        <input ref={fileRef} hidden type="file" accept=".glb,model/gltf-binary" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadLocalModel(file); }} /><button className="import-button icon-label" disabled={loading} onClick={() => fileRef.current?.click()}><SvgIcon name="upload" />导入本地 GLB</button>
        <p className="asset-note">GLB 会自动适配为第一人称武器尺寸。模型朝向不一致时，在下方校正。</p><NumberField label="显示缩放" value={project.asset.scale} min={0.05} step={0.05} onChange={(value) => updateAsset({ scale: value })} />
        <VectorEditor title="模型原点偏移" value={project.asset.offset} step={0.01} onChange={(axis, value) => updateAssetVec('offset', axis, value)} /><VectorEditor title="模型朝向校正" value={project.asset.rotation} step={1} unit="°" onChange={(axis, value) => updateAssetVec('rotation', axis, value)} /><button className="reset-button" onClick={() => updateAsset({ scale: 1, offset: vec(), rotation: vec() })}>重置模型校正</button>
      </div>}
      {activeTab === 'project' && <div className="panel-content">
        <div className="section-heading"><div><span>PLAYBACK</span><h2>动画设置</h2></div></div>
        <NumberField label="动画时长" value={project.duration} min={0.1} step={0.05} unit="秒" onChange={(duration) => updateProject({ duration: Math.max(0.1, duration) })} /><NumberField label="播放速度" value={project.playbackSpeed} min={0.1} step={0.1} unit="×" onChange={(playbackSpeed) => updateProject({ playbackSpeed: Math.max(0.1, playbackSpeed) })} />
        <label className="toggle-row"><span><b>循环播放</b><small>持续检查动作衔接</small></span><input type="checkbox" checked={project.loop} onChange={(event) => updateProject({ loop: event.target.checked })} /></label>
        <div className="project-summary"><div><strong>{project.keyframes.length}</strong><span>关键帧</span></div><div><strong>{project.duration.toFixed(2)}s</strong><span>总时长</span></div><div><strong>{project.asset.path ? 'GLB' : 'BUILT-IN'}</strong><span>模型</span></div></div>
        <button className="import-button icon-label" onClick={exportProject}><SvgIcon name="download" />导出动画 JSON</button><label className="file-button icon-label"><SvgIcon name="upload" />导入动画 JSON<input hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importProject(file); }} /></label><button className="reset-button danger-text icon-label" onClick={() => replaceProject(cloneProject(DEFAULT_PROJECT), '已恢复默认横斩动画')}><SvgIcon name="restart" />恢复示例动画</button>
      </div>}
    </aside>
    <section className="timeline-panel">
      <div className="transport"><button className="icon-only" title="回到起点" aria-label="回到起点" onClick={() => scrub(0)}><SvgIcon name="skip-back" /></button><button className="transport-play icon-only" title={playing ? '暂停' : '播放'} aria-label={playing ? '暂停' : '播放'} onClick={playing ? pausePlayback : startPlayback}><SvgIcon name={playing ? 'pause' : 'play'} /></button><button className="icon-only" title="停止" aria-label="停止" onClick={() => stopPlayback()}><SvgIcon name="stop" /></button><button className="icon-only" title="从头播放" aria-label="从头播放" onClick={replayPlayback}><SvgIcon name="restart" /></button><span className="clock">{currentTime.toFixed(2)} <i>/</i> {project.duration.toFixed(2)}s</span><button className={`loop-button icon-label ${project.loop ? 'active' : ''}`} onClick={() => updateProject({ loop: !project.loop })}><SvgIcon name="repeat" size={14} />循环</button><label>速度<select value={project.playbackSpeed} onChange={(event) => updateProject({ playbackSpeed: Number(event.target.value) })}><option value={0.5}>0.5×</option><option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option><option value={1.5}>1.5×</option></select></label></div>
      <div className="timeline-editor">
        <div className="timeline-toolbar"><div><strong>关键帧轨道</strong><span>空白区域拖动播放头 · 关键帧可单独拖动</span></div><div className="timeline-tools"><label className="exact-time"><span>当前时间</span><input aria-label="当前时间（秒）" type="number" min={0} max={project.duration} step={0.001} value={Number(currentTime.toFixed(3))} onChange={(event) => scrub(clamp(Number(event.target.value), 0, project.duration))} /><b>s</b></label><button className={snapEnabled ? 'active' : ''} onClick={() => setSnapEnabled((value) => !value)}>关键帧吸附 {snapEnabled ? '0.01s' : '关闭'}</button></div></div>
        <div className="timeline-grid">
          <div className="lane-labels"><span className="ruler-label">时间</span><span><i className="lane-dot pose" />动作片段</span><span><i className="lane-dot position" />位置</span><span><i className="lane-dot rotation" />旋转</span></div>
          <div ref={timelineCanvasRef} className="timeline-canvas" onPointerDown={beginTimelineScrub}>
            <div className="timeline-ruler">{Array.from({ length: 9 }, (_, index) => index / 8).map((point) => <span key={point} style={{ left: `${point * 100}%` }}><i />{(project.duration * point).toFixed(2)}s</span>)}</div>
            <div className="timeline-lane overview-lane">
              {orderedFrames.slice(0, -1).map((frame, index) => { const next = orderedFrames[index + 1]; return <div className="clip-segment" key={frame.id} style={{ left: `${(frame.time / project.duration) * 100}%`, width: `${((next.time - frame.time) / project.duration) * 100}%` }}><span>{frame.label}</span></div>; })}
              {orderedFrames.map((frame) => <button key={frame.id} className={`keyframe pose-key ${frame.id === selectedId ? 'active' : ''}`} style={{ left: `${(frame.time / project.duration) * 100}%` }} onPointerDown={(event) => beginKeyframeDrag(event, frame)} onClick={() => selectFrame(frame)} title={`${frame.label} · ${frame.time.toFixed(2)}s`}><i /><span>{frame.label}<b>{frame.time.toFixed(2)}s</b></span></button>)}
            </div>
            <div className="timeline-lane position-lane">{orderedFrames.map((frame) => <button key={frame.id} className={`channel-key position-key ${frame.id === selectedId ? 'active' : ''}`} style={{ left: `${(frame.time / project.duration) * 100}%` }} onPointerDown={(event) => beginKeyframeDrag(event, frame)} onClick={() => selectFrame(frame)} aria-label={`位置关键帧 ${frame.label}`}><i /></button>)}</div>
            <div className="timeline-lane rotation-lane">{orderedFrames.map((frame) => <button key={frame.id} className={`channel-key rotation-key ${frame.id === selectedId ? 'active' : ''}`} style={{ left: `${(frame.time / project.duration) * 100}%` }} onPointerDown={(event) => beginKeyframeDrag(event, frame)} onClick={() => selectFrame(frame)} aria-label={`旋转关键帧 ${frame.label}`}><i /></button>)}</div>
            <div className="playhead" style={{ left: `${(currentTime / project.duration) * 100}%` }}><i /><span>{currentTime.toFixed(2)}s</span></div>
          </div>
        </div>
      </div>
      <button className="add-key icon-label" onClick={addFrame}><SvgIcon name="plus" />添加关键帧</button>
    </section>
  </main>;
};

const NumberField = ({ label, value, min, step, unit, onChange }: { label: string; value: number; min?: number; step?: number; unit?: string; onChange: (value: number) => void }) => <label className="number-field"><span>{label}</span><div className="unit-input"><input type="number" value={Number(value.toFixed(3))} min={min} step={step} onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) onChange(next); }} />{unit && <b>{unit}</b>}</div></label>;
const VectorEditor = ({ title, value, step, unit, onChange }: { title: string; value: Vec3; step: number; unit?: string; onChange: (axis: keyof Vec3, value: number) => void }) => <section className="vector-editor"><h3>{title}</h3><div>{(['x', 'y', 'z'] as const).map((axis) => <label key={axis} className={`axis axis-${axis}`}><span>{axis.toUpperCase()}</span><input type="number" step={step} value={Number(value[axis].toFixed(3))} onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) onChange(axis, next); }} />{unit && <b>{unit}</b>}</label>)}</div></section>;
