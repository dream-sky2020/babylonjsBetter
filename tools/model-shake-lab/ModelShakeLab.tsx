import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ArcRotateCamera, Color3, Color4, DirectionalLight, Engine, GizmoCoordinatesMode,
  GizmoManager, HemisphericLight, MeshBuilder, Quaternion, Scene, StandardMaterial,
  TransformNode, UniversalCamera, Vector3,
} from '@babylonjs/core';
import { parseWeaponProject, proxyTemplates, type Vec3, type WeaponKeyframe, type AnimationProject, type WeaponPresetLibrary, type ProxyShape, type InteractionVolumeShape, type WeaponHand, type WeaponTrack, mirrorWeaponTrack } from '@/core/model/preset/firstPersonWeaponPreset.ts';
import { loadWeaponPresets, readLiveWeaponPresets, saveWeaponPresets } from '@/core/model/preset/firstPersonWeaponPresetApi.ts';
import { useWeaponSlot, type WeaponLabRuntime as Runtime } from './useWeaponSlot.ts';
import { sampleWeaponPoses } from '@/core/model/preset/firstPersonWeaponAnimation.ts';
import { createWeaponAnimationExamples } from '@/core/model/preset/firstPersonWeaponExamples.ts';
import { loadModelAssetManifestByExtension } from '@/core/resources';

type IconName = 'play' | 'pause' | 'stop' | 'restart' | 'skip-back' | 'repeat' | 'plus' | 'upload' | 'download' | 'trash' | 'move' | 'rotate' | 'scale' | 'globe' | 'magnet' | 'eye' | 'eye-off' | 'save';

const rad = Math.PI / 180;
const interactionShapeOptions: Record<InteractionVolumeShape, string> = { box: '盒体', cylinder: '圆柱体', capsule: '胶囊体', sphere: '球体 / 椭球体' };
const makeId = () => `kf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const EXAMPLES = createWeaponAnimationExamples();
const DEFAULT_PROJECT = EXAMPLES['right-hand-slash'];
const HANDS = ['right', 'left'] as const;
const handName = (hand: WeaponHand) => hand === 'right' ? '右手' : '左手';
const cloneProject = (project: AnimationProject): AnimationProject => JSON.parse(JSON.stringify(project)) as AnimationProject;
const applyPose = (node: TransformNode, frame: Pick<WeaponKeyframe, 'position' | 'rotation'>) => {
  node.position.set(frame.position.x, frame.position.y, frame.position.z);
  node.rotationQuaternion = Quaternion.FromEulerAngles(frame.rotation.x * rad, frame.rotation.y * rad, frame.rotation.z * rad);
};

const applyProjectPose = (runtime: Runtime, project: AnimationProject, time: number) => {
  const poses = sampleWeaponPoses(project, time);
  for (const hand of HANDS) applyPose(runtime.slots[hand].weaponPose, poses[hand]);
};

const material = (name: string, scene: Scene, diffuse: Color3, emissive = Color3.Black()) => {
  const result = new StandardMaterial(name, scene); result.diffuseColor = diffuse; result.emissiveColor = emissive;
  result.specularColor = new Color3(0.7, 0.78, 0.88); return result;
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
    {name === 'move' && <><path d="M12 2v20" /><path d="m8 6 4-4 4 4" /><path d="m8 18 4 4 4-4" /><path d="M2 12h20" /><path d="m6 8-4 4 4 4" /><path d="m18 8 4 4-4 4" /></>}
    {name === 'rotate' && <><path d="M21 12a9 9 0 0 1-15.5 6.2" /><path d="M3 12A9 9 0 0 1 18.5 5.8" /><path d="m18 2 .5 3.8-3.8.5" /><path d="m6 22-.5-3.8 3.8-.5" /><circle cx="12" cy="12" r="2.5" /></>}
    {name === 'scale' && <><path d="M8 3H3v5" /><path d="m3 3 6 6" /><path d="M16 21h5v-5" /><path d="m21 21-6-6" /><path d="M16 3h5v5" /><path d="m21 3-6 6" /><path d="M8 21H3v-5" /><path d="m3 21 6-6" /></>}
    {name === 'globe' && <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a15 15 0 0 1 0 18" /><path d="M12 3a15 15 0 0 0 0 18" /></>}
    {name === 'magnet' && <><path d="M6 3v7a6 6 0 0 0 12 0V3" /><path d="M6 7h4" /><path d="M14 7h4" /></>}
    {name === 'eye' && <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>}
    {name === 'eye-off' && <><path d="m3 3 18 18" /><path d="M10.6 6.2A10.6 10.6 0 0 1 12 6c6 0 9.5 6 9.5 6a15.4 15.4 0 0 1-2.2 2.8" /><path d="M6.6 6.6C4 8.3 2.5 12 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 3.1-.5" /><path d="M10.2 10.2a2.5 2.5 0 0 0 3.6 3.6" /></>}
    {name === 'save' && <><path d="M4 3h13l3 3v15H4Z" /><path d="M8 3v6h8V3" /><path d="M8 21v-7h8v7" /></>}
  </svg>;
};

export const ModelShakeLab = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineCanvasRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const gizmoManagerRef = useRef<GizmoManager | null>(null);
  const syncFromGizmoRef = useRef<() => void>(() => undefined);
  const playStateRef = useRef({ playing: false, startedAt: 0, pausedAt: 0 });
  const [rig, setRig] = useState<AnimationProject>(() => cloneProject(DEFAULT_PROJECT)); const projectRef = useRef(rig);
  const [activeHand, setActiveHand] = useState<WeaponHand>('right');
  const project = useMemo(() => ({ ...rig, ...rig.weapons[activeHand] }), [rig, activeHand]);
  const [assets, setAssets] = useState<string[]>([]); const [selectedId, setSelectedId] = useState(project.keyframes[0].id);
  const [currentTime, setCurrentTime] = useState(0); const [playing, setPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<'first-person' | 'orbit'>('first-person'); const [activeTab, setActiveTab] = useState<'pose' | 'asset' | 'project'>('asset');
  const [assetEditTarget, setAssetEditTarget] = useState<'asset' | 'proxy' | 'grip' | 'attack' | 'muzzle'>('asset');
  const [gizmoMode, setGizmoMode] = useState<'position' | 'rotation' | 'scale'>('position');
  const [gizmoSpace, setGizmoSpace] = useState<'local' | 'world'>('local');
  const [gizmoSnap, setGizmoSnap] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [library, setLibrary] = useState<WeaponPresetLibrary>({});
  const [presetKey, setPresetKey] = useState('right-hand-slash');
  const [savedKey, setSavedKey] = useState('right-hand-slash');
  const [saving, setSaving] = useState(false); const [presetsReady, setPresetsReady] = useState(false);
  const [showProxy, setShowProxy] = useState(true); const [showMarkers, setShowMarkers] = useState(true);
  const [status, setStatus] = useState('武器代理体已就绪'); const [savedSnapshot, setSavedSnapshot] = useState('');
  const saved = savedKey === presetKey && savedSnapshot === JSON.stringify(rig);
  const activeWeaponEnabled = rig.weapons[activeHand].enabled;
  const assetTargetName = { asset: '模型安装', proxy: '代理体', grip: '持握体', attack: '攻击体', muzzle: '发射端' }[assetEditTarget];
  const canScale = activeTab === 'asset' && assetEditTarget !== 'muzzle';
  const effectiveGizmoMode = gizmoMode === 'scale' && !canScale ? 'position' : gizmoMode;
  const selectedFrame = useMemo(() => project.keyframes.find((frame) => frame.id === selectedId) ?? project.keyframes[0], [project, selectedId]);
  const orderedFrames = useMemo(() => [...project.keyframes].sort((a, b) => a.time - b.time), [project.keyframes]);

  useEffect(() => { projectRef.current = rig; }, [rig]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const engine = new Engine(canvas, true, { stencil: true, antialias: true }); const scene = new Scene(engine); scene.clearColor = new Color4(0.018, 0.025, 0.031, 1);
    const firstPersonCamera = new UniversalCamera('first-person-camera', new Vector3(0, 1.68, -3.8), scene);
    firstPersonCamera.minZ = 0.03; firstPersonCamera.maxZ = 120; firstPersonCamera.angularSensibility = 2800; firstPersonCamera.inertia = 0.55; firstPersonCamera.attachControl(canvas, true);
    const orbitCamera = new ArcRotateCamera('workbench-camera', -Math.PI / 2.15, Math.PI / 2.35, 2.9, new Vector3(0, 1.3, 0.4), scene); orbitCamera.minZ = 0.02; orbitCamera.wheelPrecision = 55;
    const viewmodelRoot = new TransformNode('first-person-viewmodel', scene); viewmodelRoot.parent = firstPersonCamera;
    const makeSlot = (hand: WeaponHand) => {
      const weaponPose = new TransformNode(hand + '-weapon-animation-pose', scene); weaponPose.parent = viewmodelRoot;
      const weaponAsset = new TransformNode(hand + '-weapon-installation', scene); weaponAsset.parent = weaponPose;
      const proxyAnchor = new TransformNode(hand + '-proxy-body', scene); proxyAnchor.parent = weaponPose;
      const gripAnchor = new TransformNode(hand + '-grip-volume', scene); gripAnchor.parent = weaponPose;
      const attackAnchor = new TransformNode(hand + '-attack-volume', scene); attackAnchor.parent = weaponPose;
      const muzzleAnchor = new TransformNode(hand + '-muzzle-anchor', scene); muzzleAnchor.parent = weaponPose;
      return { weaponPose, weaponAsset, proxyAnchor, gripAnchor, attackAnchor, muzzleAnchor };
    };
    const slots = { right: makeSlot('right'), left: makeSlot('left') };
    const hemi = new HemisphericLight('ambient-light', new Vector3(0.2, 1, 0.1), scene); hemi.intensity = 1.05;
    const key = new DirectionalLight('key-light', new Vector3(-0.35, -0.7, 0.8), scene); key.intensity = 1.8; buildEnvironment(scene);
    runtimeRef.current = { engine, scene, firstPersonCamera, orbitCamera, viewmodelRoot, slots };
    const gizmoManager = new GizmoManager(scene, 1.15);
    gizmoManager.enableAutoPicking = false; gizmoManager.usePointerToAttachGizmos = false; gizmoManager.clearGizmoOnEmptyPointerEvent = false; gizmoManager.scaleRatio = 1.15;
    gizmoManager.positionGizmoEnabled = true; gizmoManager.rotationGizmoEnabled = true; gizmoManager.scaleGizmoEnabled = true; gizmoManager.attachToNode(slots.right.weaponAsset);
    const suspendCamera = () => { firstPersonCamera.detachControl(); orbitCamera.detachControl(); };
    const resumeCamera = () => { const active = scene.activeCamera; if (active === firstPersonCamera) firstPersonCamera.attachControl(canvas, true); else if (active === orbitCamera) orbitCamera.attachControl(canvas, true); };
    const syncTransform = () => syncFromGizmoRef.current();
    const positionGizmo = gizmoManager.gizmos.positionGizmo; const rotationGizmo = gizmoManager.gizmos.rotationGizmo; const scaleGizmo = gizmoManager.gizmos.scaleGizmo;
    positionGizmo?.onDragStartObservable.add(suspendCamera); positionGizmo?.onDragObservable.add(syncTransform); positionGizmo?.onDragEndObservable.add(() => { syncTransform(); resumeCamera(); setStatus('已更新变换'); });
    rotationGizmo?.onDragStartObservable.add(suspendCamera); rotationGizmo?.onDragObservable.add(syncTransform); rotationGizmo?.onDragEndObservable.add(() => { syncTransform(); resumeCamera(); setStatus('已更新旋转'); });
    scaleGizmo?.onDragStartObservable.add(suspendCamera); scaleGizmo?.onDragObservable.add(syncTransform); scaleGizmo?.onDragEndObservable.add(() => { syncTransform(); resumeCamera(); setStatus('已更新尺寸'); });
    gizmoManager.rotationGizmoEnabled = false; gizmoManager.scaleGizmoEnabled = false;
    gizmoManagerRef.current = gizmoManager;
    scene.activeCamera = firstPersonCamera; applyProjectPose(runtimeRef.current, projectRef.current, 0);
    engine.runRenderLoop(() => {
      const runtime = runtimeRef.current; if (!runtime) return; const playState = playStateRef.current;
      if (playState.playing) {
        const current = projectRef.current; const elapsed = ((performance.now() - playState.startedAt) / 1000) * current.playbackSpeed; let time = elapsed;
        if (current.loop) time %= current.duration;
        if (!current.loop && time >= current.duration) { time = current.duration; playState.playing = false; setPlaying(false); setStatus('播放完成 · 可继续调整关键帧'); }
        playState.pausedAt = time; applyProjectPose(runtime, current, time); setCurrentTime(time);
      }
      scene.render();
    });
    const resize = () => engine.resize(); window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); gizmoManager.dispose(); gizmoManagerRef.current = null; scene.dispose(); engine.dispose(); runtimeRef.current = null; };
  }, []);

  useEffect(() => { loadModelAssetManifestByExtension(/\.(glb|gltf)$/i).then(setAssets).catch(() => setStatus('项目模型清单读取失败，请检查项目资源')); }, []);
  useEffect(() => {
    const runtime = runtimeRef.current; if (runtime && !playing) applyProjectPose(runtime, rig, currentTime);
  }, [rig, currentTime, playing]);

  const stopPlayback = (reset = true) => {
    const state = playStateRef.current; state.playing = false; setPlaying(false);
    if (reset) { state.pausedAt = 0; setCurrentTime(0); const runtime = runtimeRef.current; if (runtime) applyProjectPose(runtime, projectRef.current, 0); setStatus('已停止 · 播放头回到起点'); }
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
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.code === 'Space') { event.preventDefault(); if (playStateRef.current.playing) pausePlayback(); else startPlayback(); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => {
    let cancelled = false;
    void loadWeaponPresets().then(entries => {
      if (cancelled) return; setLibrary(entries); setPresetsReady(true);
      const initial = entries['right-hand-slash'];
      if (initial && JSON.stringify(projectRef.current) === JSON.stringify(DEFAULT_PROJECT)) {
        projectRef.current = cloneProject(initial); setRig(projectRef.current); setSelectedId(initial.weapons.right.keyframes[0].id); setSavedSnapshot(JSON.stringify(initial));
      }
    }).catch(error => { if (!cancelled) setStatus(String(error)); });
    return () => { cancelled = true; };
  }, []);
  const rightLoading = useWeaponSlot(runtimeRef, 'right', rig.weapons.right, showProxy, showMarkers, setStatus);
  const leftLoading = useWeaponSlot(runtimeRef, 'left', rig.weapons.left, showProxy, showMarkers, setStatus);
  const loading = rightLoading || leftLoading;
  const loadManifestModel = (path: string) => {
    stopPlayback(false);
    updateAsset({ path, name: path ? decodeURIComponent(path.split('/').pop() ?? path) : '武器代理体', scale: 1, offset: vec(), rotation: vec() });
  };

  const updateTrack = (change: (track: WeaponTrack) => WeaponTrack) => setRig(current => ({ ...current, weapons: { ...current.weapons, [activeHand]: change(current.weapons[activeHand]) } }));
  const updateProject = (patch: Partial<AnimationProject & WeaponTrack>) => {
    const { proxy, asset, keyframes, enabled, ...global } = patch;
    if (patch.playbackSpeed && playStateRef.current.playing) playStateRef.current.startedAt = performance.now() - playStateRef.current.pausedAt / patch.playbackSpeed * 1000;
    setRig(current => ({ ...current, ...global, weapons: { ...current.weapons, [activeHand]: {
      ...current.weapons[activeHand], ...(proxy ? { proxy } : {}), ...(asset ? { asset } : {}), ...(keyframes ? { keyframes } : {}), ...(enabled === undefined ? {} : { enabled }),
    } } }));
  };
  const updateAsset = (patch: Partial<WeaponTrack['asset']>) => updateTrack(current => ({ ...current, asset: { ...current.asset, ...patch } }));
  const updateAssetVec = (channel: 'offset' | 'rotation', axis: keyof Vec3, value: number) => updateTrack(current => ({ ...current, asset: { ...current.asset, [channel]: { ...current.asset[channel], [axis]: value } } }));
  const updateFrame = (patch: Partial<WeaponKeyframe>) => updateTrack(current => ({ ...current, keyframes: current.keyframes.map(frame => frame.id === selectedFrame.id ? { ...frame, ...patch } : frame).sort((a, b) => a.time - b.time) }));
  const selectHand = (hand: WeaponHand) => { setActiveHand(hand); setSelectedId(rig.weapons[hand].keyframes[0].id); };
  const toggleHand = (hand: WeaponHand, enabled: boolean) => {
    if (!enabled && !rig.weapons[hand === 'right' ? 'left' : 'right'].enabled) return setStatus('至少保留一个启用的代理体');
    setRig(current => ({ ...current, weapons: { ...current.weapons, [hand]: { ...current.weapons[hand], enabled } } }));
  };
  const updateFrameVec = (channel: 'position' | 'rotation', axis: keyof Vec3, value: number) => updateFrame({ [channel]: { ...selectedFrame[channel], [axis]: value } });
  const getAssetEditNode = useCallback((runtime: Runtime) => {
    const slot = runtime.slots[activeHand];
    if (assetEditTarget === 'proxy') return slot.proxyAnchor;
    if (assetEditTarget === 'grip') return slot.gripAnchor;
    if (assetEditTarget === 'attack') return slot.attackAnchor;
    if (assetEditTarget === 'muzzle') return slot.muzzleAnchor;
    return slot.weaponAsset;
  }, [activeHand, assetEditTarget]);
  useEffect(() => {
    syncFromGizmoRef.current = () => {
      const runtime = runtimeRef.current; if (!runtime || activeTab === 'project') return;
      const node = activeTab === 'asset' ? getAssetEditNode(runtime) : runtime.slots[activeHand].weaponPose;
      const euler = node.rotationQuaternion?.toEulerAngles() ?? node.rotation;
      const position = { x: Number(node.position.x.toFixed(4)), y: Number(node.position.y.toFixed(4)), z: Number(node.position.z.toFixed(4)) };
      const rotation = { x: Number((euler.x / rad).toFixed(2)), y: Number((euler.y / rad).toFixed(2)), z: Number((euler.z / rad).toFixed(2)) };
      const size = { x: Math.max(.001, Number(Math.abs(node.scaling.x).toFixed(4))), y: Math.max(.001, Number(Math.abs(node.scaling.y).toFixed(4))), z: Math.max(.001, Number(Math.abs(node.scaling.z).toFixed(4))) };
      setRig((current) => {
        const track = current.weapons[activeHand];
        if (activeTab !== 'asset') return { ...current, weapons: { ...current.weapons, [activeHand]: { ...track, keyframes: track.keyframes.map((frame) => frame.id === selectedId ? { ...frame, position, rotation } : frame) } } };
        if (assetEditTarget === 'asset') return { ...current, weapons: { ...current.weapons, [activeHand]: { ...track, asset: { ...track.asset, scale: size.x, offset: position, rotation } } } };
        const proxy = track.proxy;
        if (assetEditTarget === 'proxy') return { ...current, weapons: { ...current.weapons, [activeHand]: { ...track, proxy: { ...proxy, center: position, rotation, size } } } };
        if (assetEditTarget === 'muzzle') return { ...current, weapons: { ...current.weapons, [activeHand]: { ...track, proxy: { ...proxy, muzzle: { ...proxy.muzzle, position, rotation } } } } };
        const field = assetEditTarget === 'grip' ? 'gripVolume' : 'attackVolume';
        return { ...current, weapons: { ...current.weapons, [activeHand]: { ...track, proxy: { ...proxy, [field]: { ...proxy[field], center: position, rotation, size } } } } };
      });
    };
  }, [activeHand, activeTab, assetEditTarget, getAssetEditNode, selectedId]);
  useEffect(() => {
    const manager = gizmoManagerRef.current; const runtime = runtimeRef.current; if (!manager || !runtime) return;
    manager.positionGizmoEnabled = effectiveGizmoMode === 'position'; manager.rotationGizmoEnabled = effectiveGizmoMode === 'rotation'; manager.scaleGizmoEnabled = effectiveGizmoMode === 'scale';
    manager.coordinatesMode = gizmoSpace === 'local' ? GizmoCoordinatesMode.Local : GizmoCoordinatesMode.World;
    manager.scaleRatio = viewMode === 'first-person' ? 0.9 : 1.15;
    if (manager.gizmos.positionGizmo) { manager.gizmos.positionGizmo.snapDistance = gizmoSnap ? 0.01 : 0; manager.gizmos.positionGizmo.planarGizmoEnabled = true; }
    if (manager.gizmos.rotationGizmo) manager.gizmos.rotationGizmo.snapDistance = gizmoSnap ? 5 * rad : 0;
    if (manager.gizmos.scaleGizmo) {
      const uniformOnly = assetEditTarget === 'asset'; const scaleGizmo = manager.gizmos.scaleGizmo;
      scaleGizmo.xGizmo.isEnabled = !uniformOnly; scaleGizmo.yGizmo.isEnabled = !uniformOnly; scaleGizmo.zGizmo.isEnabled = !uniformOnly; scaleGizmo.uniformScaleGizmo.isEnabled = true;
      scaleGizmo.snapDistance = gizmoSnap ? .05 : 0; scaleGizmo.incrementalSnap = true;
    }
    const targetEnabled = activeTab !== 'asset' || assetEditTarget === 'asset' || assetEditTarget === 'proxy' || (assetEditTarget === 'muzzle' ? project.proxy.muzzle.enabled : project.proxy[assetEditTarget === 'grip' ? 'gripVolume' : 'attackVolume'].enabled);
    const visible = !playing && viewMode === 'orbit' && activeTab !== 'project' && activeWeaponEnabled && targetEnabled;
    manager.attachToNode(visible ? (activeTab === 'asset' ? getAssetEditNode(runtime) : runtime.slots[activeHand].weaponPose) : null);
  }, [activeHand, activeTab, activeWeaponEnabled, assetEditTarget, effectiveGizmoMode, getAssetEditNode, gizmoSnap, gizmoSpace, playing, project.proxy, viewMode]);
  const selectFrame = (frame: WeaponKeyframe) => { stopPlayback(false); playStateRef.current.pausedAt = frame.time; setSelectedId(frame.id); setCurrentTime(frame.time); const runtime = runtimeRef.current; if (runtime) applyProjectPose(runtime, projectRef.current, frame.time); };
  const addFrame = () => { stopPlayback(false); const time = clamp(selectedFrame.time + 0.1, 0, project.duration); const frame = { ...selectedFrame, id: makeId(), time, label: '新姿态', position: { ...selectedFrame.position }, rotation: { ...selectedFrame.rotation } }; updateTrack((current) => ({ ...current, keyframes: [...current.keyframes, frame].sort((a, b) => a.time - b.time) })); setSelectedId(frame.id); playStateRef.current.pausedAt = time; setCurrentTime(time); setStatus('已添加关键帧'); };
  const deleteFrame = () => { if (project.keyframes.length <= 2) return setStatus('动画至少需要两个关键帧'); const index = project.keyframes.findIndex((frame) => frame.id === selectedFrame.id); const next = project.keyframes.filter((frame) => frame.id !== selectedFrame.id); const fallback = next[Math.max(0, index - 1)]; updateTrack((current) => ({ ...current, keyframes: next })); selectFrame(fallback); setStatus('已删除关键帧'); };
  const scrub = (time: number) => { stopPlayback(false); playStateRef.current.pausedAt = time; setCurrentTime(time); const runtime = runtimeRef.current; if (runtime) applyProjectPose(runtime, projectRef.current, time); };
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
      updateTrack((current) => ({ ...current, keyframes: current.keyframes.map((item) => item.id === frame.id ? { ...item, time } : item).sort((a, b) => a.time - b.time) }));
      const runtime = runtimeRef.current; if (runtime) applyProjectPose(runtime, projectRef.current, frame.time); setStatus(`正在移动「${frame.label}」· ${time.toFixed(2)}s`);
    };
    const finish = () => { document.body.classList.remove('dragging-keyframe'); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); setStatus(`已更新「${frame.label}」的时间位置`); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish, { once: true });
  };
  const beginTimelineScrub = (event: ReactPointerEvent<HTMLDivElement>) => {
    const timeline = timelineCanvasRef.current; if (!timeline || event.button !== 0) return;
    event.preventDefault(); stopPlayback(false); const bounds = timeline.getBoundingClientRect(); document.body.classList.add('scrubbing-timeline');
    const seek = (clientX: number) => {
      const time = timeFromPointer(clientX, bounds); playStateRef.current.pausedAt = time; setCurrentTime(time);
      const runtime = runtimeRef.current; if (runtime) applyProjectPose(runtime, projectRef.current, time);
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
    else {
      runtime.viewmodelRoot.parent = null; runtime.viewmodelRoot.position.set(0, 1.25, 0); runtime.viewmodelRoot.rotation.set(0, Math.PI, 0);
      let min = new Vector3(Infinity, Infinity, Infinity); let max = new Vector3(-Infinity, -Infinity, -Infinity);
      for (const hand of HANDS) {
        const track = rig.weapons[hand]; if (!track.enabled) continue;
        const { center, size, gripVolume, attackVolume, muzzle } = track.proxy;
        const points = [vec(), gripVolume.center, attackVolume.center, muzzle.position];
        for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) points.push(vec(center.x + x * size.x / 2, center.y + y * size.y / 2, center.z + z * size.z / 2));
        const matrix = runtime.slots[hand].weaponPose.computeWorldMatrix(true);
        for (const point of points) {
          const world = Vector3.TransformCoordinates(new Vector3(point.x, point.y, point.z), matrix);
          min = Vector3.Minimize(min, world); max = Vector3.Maximize(max, world);
        }
      }
      runtime.orbitCamera.setTarget(min.add(max).scale(.5));
      runtime.orbitCamera.radius = Math.max(1.5, Vector3.Distance(min, max) * 1.5);
      runtime.orbitCamera.attachControl(canvas, true); runtime.scene.activeCamera = runtime.orbitCamera;
    }
    setViewMode(mode); setStatus(mode === 'first-person' ? '第一人称预览机位 · 拖动鼠标可调整观察方向' : '工作台视角 · 可环绕检查武器姿态');
  };
  const activateGizmo = (mode: 'position' | 'rotation' | 'scale') => {
    if (mode === 'scale' && !canScale) { setStatus('当前对象没有尺寸属性'); return; }
    stopPlayback(false);
    switchView('orbit');
    const runtime = runtimeRef.current;
    if (runtime) {
      const target = activeTab === 'asset' ? getAssetEditNode(runtime) : runtime.slots[activeHand].weaponPose;
      target.computeWorldMatrix(true);
      runtime.orbitCamera.setTarget(target.getAbsolutePosition());
      const size = rig.weapons[activeHand].proxy.size;
      runtime.orbitCamera.radius = Math.max(1.6, Math.hypot(size.x, size.y, size.z) * 1.35);
    }
    setGizmoMode(mode);
    setStatus(mode === 'position' ? '移动模式 · 拖动红绿蓝箭头调整位置' : mode === 'rotation' ? '旋转模式 · 拖动红绿蓝旋转球调整角度' : assetEditTarget === 'asset' ? '尺寸模式 · 模型使用中央方块进行统一缩放' : '尺寸模式 · 拖动轴向方块调整 XYZ，中央方块等比缩放');
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.code === 'KeyW') activateGizmo('position');
      if (event.code === 'KeyE') activateGizmo('rotation');
      if (event.code === 'KeyR' && canScale) activateGizmo('scale');
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });
  const replaceProject = (next: AnimationProject, message: string) => { const clean = parseWeaponProject(next); projectRef.current = clean; setRig(clean); const hand = clean.weapons.right.enabled ? 'right' : 'left'; setActiveHand(hand); setSelectedId(clean.weapons[hand].keyframes[0].id); setCurrentTime(0); playStateRef.current.pausedAt = 0; stopPlayback(false); setStatus(message); };
  const saveProject = async () => {
    if (!/^[a-zA-Z0-9_-]+$/.test(presetKey)) return setStatus('预设 Key 仅支持英文、数字、下划线和连字符');
    setSaving(true);
    try {
      const clean = parseWeaponProject(rig); const snapshot = JSON.stringify(rig);
      const latest = await readLiveWeaponPresets(); const next = { ...latest, [presetKey]: clean };
      await saveWeaponPresets(next); setLibrary(next); setSavedKey(presetKey); setSavedSnapshot(snapshot); setStatus('已保存到 config/firstPersonWeaponPresets.json');
    } catch (error) { setStatus('保存失败：' + String(error)); } finally { setSaving(false); }
  };
  const reloadPreset = async () => {
    try {
      const entries = import.meta.env.DEV ? await readLiveWeaponPresets() : await loadWeaponPresets();
      setLibrary(entries);
      if (!entries[presetKey]) throw new Error(`未找到预设 ${presetKey}`);
      replaceProject(cloneProject(entries[presetKey]), '已从 config 重新载入：' + presetKey);
      setSavedKey(presetKey); setSavedSnapshot(JSON.stringify(entries[presetKey]));
    } catch (error) { setStatus('读取失败：' + String(error)); }
  };
  const exportProject = () => { const blob = new Blob([JSON.stringify(rig, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${project.name || 'weapon-animation'}.json`; link.click(); URL.revokeObjectURL(url); setStatus('动画 JSON 已导出'); };
  const importProject = async (file: File) => { try { const data = parseWeaponProject(JSON.parse(await file.text())); replaceProject(data, `已载入动画项目：${data.name}`); } catch (error) { setStatus(error instanceof Error ? `项目文件无效：${error.message}` : '项目文件无效'); } };

  return <main className="weapon-lab">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">WS</span><div><h1>Weapon Motion Studio</h1><span>第一人称武器动画工作台</span></div></div>
      <div className="project-name"><span>动画</span><input value={project.name} onChange={(event) => updateProject({ name: event.target.value })} /></div>
      <div className="view-switch" role="group" aria-label="视角模式"><button className={viewMode === 'first-person' ? 'active' : ''} onClick={() => switchView('first-person')}>第一人称预览</button><button className={viewMode === 'orbit' ? 'active' : ''} onClick={() => switchView('orbit')}>工作台</button></div>
      <button className="ghost" disabled={saving || !presetsReady || !import.meta.env.DEV} title="通过当前开发服务器保存到 config；正式构建请导出 JSON" onClick={() => void saveProject()}><span className={`save-dot ${saved ? 'saved' : ''}`} />{saving ? '保存中…' : saved ? '已保存' : '保存预设'}</button>
      <button className="primary icon-label" onClick={playing ? pausePlayback : startPlayback}><SvgIcon name={playing ? 'pause' : 'play'} />{playing ? '暂停' : '播放'}</button>
    </header>
    <section className="viewport-shell">
      <canvas ref={canvasRef} tabIndex={0} /><div className="viewport-top"><span className="mode-badge"><i />{viewMode === 'first-person' ? 'FIRST PERSON PREVIEW' : 'POSE VIEW'}</span><span>{HANDS.filter(hand => rig.weapons[hand].enabled).map(hand => handName(hand) + ' · ' + rig.weapons[hand].asset.name).join(' / ')}</span></div>
      {activeTab !== 'project' && <div className="gizmo-toolbar">
        <div className="gizmo-target"><span>编辑目标</span><strong>{handName(activeHand)} · {activeTab === 'asset' ? assetTargetName : `关键帧「${selectedFrame.label}」`}</strong></div>
        <div className="gizmo-mode" role="group" aria-label="变换工具">
          <button className={`icon-label ${effectiveGizmoMode === 'position' && viewMode === 'orbit' ? 'active' : ''}`} title="移动工具（W）" onClick={() => activateGizmo('position')}><SvgIcon name="move" />移动 <kbd>W</kbd></button>
          <button className={`icon-label ${effectiveGizmoMode === 'rotation' && viewMode === 'orbit' ? 'active' : ''}`} title="旋转工具（E）" onClick={() => activateGizmo('rotation')}><SvgIcon name="rotate" />旋转 <kbd>E</kbd></button>
          {canScale && <button className={`icon-label ${effectiveGizmoMode === 'scale' && viewMode === 'orbit' ? 'active' : ''}`} title="尺寸工具（R）" onClick={() => activateGizmo('scale')}><SvgIcon name="scale" />尺寸 <kbd>R</kbd></button>}
        </div>
        <button className={`gizmo-option icon-label ${gizmoSpace === 'local' ? 'active' : ''}`} title="切换本地/世界坐标" onClick={() => setGizmoSpace((value) => value === 'local' ? 'world' : 'local')}><SvgIcon name="globe" />{gizmoSpace === 'local' ? '本地' : '世界'}</button>
        <button className={`gizmo-option icon-label ${gizmoSnap ? 'active' : ''}`} title="移动吸附 0.01，旋转吸附 5°，尺寸吸附 0.05" onClick={() => setGizmoSnap((value) => !value)}><SvgIcon name="magnet" />吸附</button>
        <button className={`gizmo-option icon-label ${showProxy ? 'active' : ''}`} aria-pressed={showProxy} title={showProxy ? '隐藏半透明代理体' : '显示半透明代理体'} onClick={() => { setShowProxy((value) => !value); setStatus(showProxy ? '已隐藏代理体' : '已显示代理体'); }}><SvgIcon name={showProxy ? 'eye' : 'eye-off'} />代理体</button>
        <div className="axis-legend"><i className="x" />X <i className="y" />Y <i className="z" />Z</div>
      </div>}
      <div className="reticle" aria-hidden="true"><span /><span /></div>
      <div className="viewport-help">{viewMode === 'first-person' ? `第一人称仅预览 · W 移动 / E 旋转${canScale ? ' / R 尺寸' : ''}会进入工作台 · 空格播放/暂停` : `W 移动 · E 旋转${canScale ? ' · R 尺寸' : ''} · 拖动操纵器编辑 · 空白处拖动环绕视角`}</div><div className="status-toast">{loading && <span className="spinner" />}{status}</div>
    </section>
    <aside className="inspector">
      <div className="hand-selector">
        <div className="view-switch" role="group" aria-label="编辑武器挂载位">{HANDS.map(hand => <button key={hand} className={activeHand === hand ? 'active' : ''} onClick={() => selectHand(hand)}>{handName(hand)}{rig.weapons[hand].enabled ? '' : '（停用）'}</button>)}</div>
        <label className="toggle-row"><span>启用{handName(activeHand)}代理体</span><input type="checkbox" checked={project.enabled} onChange={event => toggleHand(activeHand, event.target.checked)} /></label>
        <small>青色：右手 · 紫色：左手。只编辑所选手，播放与擦洗同时驱动两手。</small>
      </div>
      <div className="tabs"><button className={activeTab === 'pose' ? 'active' : ''} onClick={() => setActiveTab('pose')}>姿态</button><button className={activeTab === 'asset' ? 'active' : ''} onClick={() => setActiveTab('asset')}>模型</button><button className={activeTab === 'project' ? 'active' : ''} onClick={() => setActiveTab('project')}>项目</button></div>
      {activeTab === 'pose' && <div className="panel-content">
        <div className="section-heading"><div><span>KEYFRAME</span><h2>{selectedFrame.label}</h2></div><span className="time-readout">{selectedFrame.time.toFixed(2)}s</span></div>
        <label className="wide-field"><span>关键帧名称</span><input value={selectedFrame.label} onChange={(event) => updateFrame({ label: event.target.value })} /></label>
        <label className="wide-field"><span>时间</span><div className="unit-input"><input type="number" min={0} max={project.duration} step={0.01} value={selectedFrame.time} onChange={(event) => updateFrame({ time: clamp(Number(event.target.value), 0, project.duration) })} /><b>秒</b></div></label>
        <VectorEditor title="位置 / CAMERA SPACE" value={selectedFrame.position} step={0.01} onChange={(axis, value) => updateFrameVec('position', axis, value)} />
        <VectorEditor title="旋转 / EULER" value={selectedFrame.rotation} step={1} unit="°" onChange={(axis, value) => updateFrameVec('rotation', axis, value)} />
        <button className="reset-button" onClick={() => { const other = activeHand === 'right' ? 'left' : 'right'; updateTrack(current => ({ ...current, keyframes: mirrorWeaponTrack(rig.weapons[other]).keyframes })); setStatus('已镜像另一手动作；模型安装参数保留'); }}>用另一手的镜像动作替换当前轨道</button>
        <div className="tip"><b>制作提示</b><p>蓄力帧拉开动作方向，命中帧快速穿过屏幕中心，随挥帧负责表现重量。</p></div><div className="split-actions"><button className="icon-label" onClick={addFrame}><SvgIcon name="plus" />复制为新帧</button><button className="danger icon-label" onClick={deleteFrame}><SvgIcon name="trash" />删除</button></div>
      </div>}
      {activeTab === 'asset' && <div className="panel-content">
        <div className="section-heading"><div><span>VIEWMODEL</span><h2>{handName(activeHand)} · 武器模型</h2></div></div>
        <p className="asset-note">持握体和近战攻击体使用实体范围；只有枪口、法杖等发射位置使用点和方向。</p>
        <div className="semantic-targets" role="group" aria-label="编辑对象">
          {([['asset', '模型安装'], ['proxy', '代理体'], ['grip', '持握体'], ['attack', '攻击体'], ['muzzle', '发射端']] as const).map(([target, label]) => <button key={target} className={assetEditTarget === target ? 'active' : ''} onClick={() => { setAssetEditTarget(target); setStatus(`正在编辑${label} · W 移动 / E 旋转${target === 'muzzle' ? '' : ' / R 尺寸'}`); }}>{label}</button>)}
        </div>
        <label className="wide-field"><span>代理体模板</span><select value="" onChange={event => updateProject({ proxy: structuredClone(proxyTemplates[event.target.value]) })}><option value="" disabled>选择模板（替换代理体参数）</option>{Object.keys(proxyTemplates).map(name => <option key={name}>{name}</option>)}</select></label>
        <label className="toggle-row"><span>显示半透明代理体</span><input type="checkbox" checked={showProxy} onChange={event => setShowProxy(event.target.checked)} /></label>
        <label className="toggle-row"><span>显示原点 / 方向 / 挂点</span><input type="checkbox" checked={showMarkers} onChange={event => setShowMarkers(event.target.checked)} /></label>
        {assetEditTarget === 'proxy' && <>
          <label className="wide-field"><span>代理体形状</span><select value={project.proxy.shape} onChange={event => updateProject({ proxy: { ...project.proxy, shape: event.target.value as ProxyShape } })}>{Object.entries({ box: '盒体', gun: '枪械组合盒', cylinder: '圆柱', capsule: '胶囊', sphere: '球体 / 椭球' }).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <VectorEditor title="代理体尺寸 XYZ（Z 为长度）" value={project.proxy.size} step={.01} onChange={(axis, value) => updateProject({ proxy: { ...project.proxy, size: { ...project.proxy.size, [axis]: Math.max(.001, value) } } })} />
          <VectorEditor title="代理体中心" value={project.proxy.center} step={.01} onChange={(axis, value) => updateProject({ proxy: { ...project.proxy, center: { ...project.proxy.center, [axis]: value } } })} />
          <VectorEditor title="代理体旋转" value={project.proxy.rotation} step={1} unit="°" onChange={(axis, value) => updateProject({ proxy: { ...project.proxy, rotation: { ...project.proxy.rotation, [axis]: value } } })} />
        </>}
        {assetEditTarget === 'grip' && <>
          <label className="toggle-row semantic-toggle"><span><b>启用持握体</b><small>橙色范围表示手掌抓握区域</small></span><input type="checkbox" checked={project.proxy.gripVolume.enabled} onChange={event => updateProject({ proxy: { ...project.proxy, gripVolume: { ...project.proxy.gripVolume, enabled: event.target.checked } } })} /></label>
          <label className="wide-field"><span>持握体形状</span><select value={project.proxy.gripVolume.shape} onChange={event => updateProject({ proxy: { ...project.proxy, gripVolume: { ...project.proxy.gripVolume, shape: event.target.value as InteractionVolumeShape } } })}>{Object.entries(interactionShapeOptions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <VectorEditor title="持握体中心" value={project.proxy.gripVolume.center} step={.01} onChange={(axis, value) => updateProject({ proxy: { ...project.proxy, gripVolume: { ...project.proxy.gripVolume, center: { ...project.proxy.gripVolume.center, [axis]: value } } } })} />
          <VectorEditor title="持握体尺寸" value={project.proxy.gripVolume.size} step={.01} onChange={(axis, value) => updateProject({ proxy: { ...project.proxy, gripVolume: { ...project.proxy.gripVolume, size: { ...project.proxy.gripVolume.size, [axis]: Math.max(.001, value) } } } })} />
          <VectorEditor title="持握体旋转" value={project.proxy.gripVolume.rotation} step={1} unit="°" onChange={(axis, value) => updateProject({ proxy: { ...project.proxy, gripVolume: { ...project.proxy.gripVolume, rotation: { ...project.proxy.gripVolume.rotation, [axis]: value } } } })} />
        </>}
        {assetEditTarget === 'attack' && <>
          <label className="toggle-row semantic-toggle"><span><b>启用攻击体</b><small>红色范围表示近战有效伤害区域</small></span><input type="checkbox" checked={project.proxy.attackVolume.enabled} onChange={event => updateProject({ proxy: { ...project.proxy, attackVolume: { ...project.proxy.attackVolume, enabled: event.target.checked } } })} /></label>
          <label className="wide-field"><span>攻击体形状</span><select value={project.proxy.attackVolume.shape} onChange={event => updateProject({ proxy: { ...project.proxy, attackVolume: { ...project.proxy.attackVolume, shape: event.target.value as InteractionVolumeShape } } })}>{Object.entries(interactionShapeOptions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <VectorEditor title="攻击体中心" value={project.proxy.attackVolume.center} step={.01} onChange={(axis, value) => updateProject({ proxy: { ...project.proxy, attackVolume: { ...project.proxy.attackVolume, center: { ...project.proxy.attackVolume.center, [axis]: value } } } })} />
          <VectorEditor title="攻击体尺寸" value={project.proxy.attackVolume.size} step={.01} onChange={(axis, value) => updateProject({ proxy: { ...project.proxy, attackVolume: { ...project.proxy.attackVolume, size: { ...project.proxy.attackVolume.size, [axis]: Math.max(.001, value) } } } })} />
          <VectorEditor title="攻击体旋转" value={project.proxy.attackVolume.rotation} step={1} unit="°" onChange={(axis, value) => updateProject({ proxy: { ...project.proxy, attackVolume: { ...project.proxy.attackVolume, rotation: { ...project.proxy.attackVolume.rotation, [axis]: value } } } })} />
        </>}
        {assetEditTarget === 'muzzle' && <>
          <label className="toggle-row semantic-toggle"><span><b>启用发射端</b><small>粉色点和箭头表示生成位置与 +Z 发射方向</small></span><input type="checkbox" checked={project.proxy.muzzle.enabled} onChange={event => updateProject({ proxy: { ...project.proxy, muzzle: { ...project.proxy.muzzle, enabled: event.target.checked } } })} /></label>
          <VectorEditor title="发射端位置" value={project.proxy.muzzle.position} step={.01} onChange={(axis, value) => updateProject({ proxy: { ...project.proxy, muzzle: { ...project.proxy.muzzle, position: { ...project.proxy.muzzle.position, [axis]: value } } } })} />
          <VectorEditor title="发射方向旋转" value={project.proxy.muzzle.rotation} step={1} unit="°" onChange={(axis, value) => updateProject({ proxy: { ...project.proxy, muzzle: { ...project.proxy.muzzle, rotation: { ...project.proxy.muzzle.rotation, [axis]: value } } } })} />
        </>}
        <label className="wide-field"><span>挂载已规范化的项目模型</span><select value={project.asset.path} onChange={(event) => loadManifestModel(event.target.value)}><option value="">仅代理体</option>{[...new Set([...assets, ...(project.asset.path ? [project.asset.path] : [])])].map(path => <option key={path} value={path}>{decodeURIComponent(path.replace('/resources/', ''))}</option>)}</select></label>
        <p className="asset-note">继承 modelAssetProfiles.json。以下只调整模型相对挂载点的安装变换，不修改资产规范化。更换模型后安装变换归零，可另存为不同预设。</p>
        <NumberField label="安装缩放" value={project.asset.scale} min={0.001} step={0.05} onChange={(value) => updateAsset({ scale: Math.max(.001, value) })} />
        <VectorEditor title="安装位置" value={project.asset.offset} step={0.01} onChange={(axis, value) => updateAssetVec('offset', axis, value)} /><VectorEditor title="安装旋转" value={project.asset.rotation} step={1} unit="°" onChange={(axis, value) => updateAssetVec('rotation', axis, value)} />
        <button className="import-button icon-label" disabled={saving || !presetsReady || !import.meta.env.DEV} onClick={() => void saveProject()}><SvgIcon name="save" />{saving ? '正在写入服务器…' : '保存模型与代理体关系'}</button>
        <button className="reset-button" onClick={() => updateAsset({ scale: 1, offset: vec(), rotation: vec() })}>重置安装变换</button>
      </div>}
      {activeTab === 'project' && <div className="panel-content">
        <div className="section-heading"><div><span>PRESETS / PLAYBACK</span><h2>预设与动画</h2></div></div>
        <label className="wide-field"><span>动画示例（替换双手配置与模型安装）</span><select aria-label="动画示例" value="" onChange={event => { const key = event.target.value; setPresetKey(key); setSavedSnapshot(''); replaceProject(cloneProject(EXAMPLES[key]), '已应用示例：' + EXAMPLES[key].name); }}><option value="">选择攻击 / 射击示例</option>{Object.entries(EXAMPLES).map(([key, entry]) => <option key={key} value={key}>{entry.name}</option>)}</select></label>
        <label className="wide-field"><span>读取 config 预设（替换当前草稿）</span><select value="" disabled={!presetsReady} onChange={event => { const key = event.target.value; setPresetKey(key); setSavedKey(key); replaceProject(cloneProject(library[key]), '已载入预设：' + key); setSavedSnapshot(JSON.stringify(library[key])); }}><option value="">选择预设</option>{Object.entries(library).map(([key, entry]) => <option key={key} value={key}>{key} · {entry.name}</option>)}</select></label>
        <label className="wide-field"><span>保存 Key（新 Key 即另存为）</span><input value={presetKey} onChange={event => { setPresetKey(event.target.value); setSavedSnapshot(''); }} /></label>
        <button className="reset-button" disabled={saving} onClick={() => void reloadPreset()}>从 config 重载当前 Key（替换草稿）</button>
        <p className="asset-note">保存包含左右手代理体、各自的模型安装变换和独立关键帧，共享同一播放时间。修改 Key 可为不同模型保存独立版本。旧浏览器项目不自动迁移。</p>
        <NumberField label="动画时长" value={project.duration} min={0.1} step={0.05} unit="秒" onChange={(duration) => updateProject({ duration: Math.max(0.1, duration, ...HANDS.flatMap(hand => rig.weapons[hand].keyframes.map(frame => frame.time))) })} /><NumberField label="播放速度" value={project.playbackSpeed} min={0.1} step={0.1} unit="×" onChange={(playbackSpeed) => updateProject({ playbackSpeed: Math.max(0.1, playbackSpeed) })} />
        <label className="toggle-row"><span><b>循环播放</b><small>持续检查动作衔接</small></span><input type="checkbox" checked={project.loop} onChange={(event) => updateProject({ loop: event.target.checked })} /></label>
        <div className="project-summary"><div><strong>{project.keyframes.length}</strong><span>关键帧</span></div><div><strong>{project.duration.toFixed(2)}s</strong><span>总时长</span></div><div><strong>{project.asset.path ? 'GLB' : 'PROXY'}</strong><span>模型</span></div></div>
        <button className="import-button icon-label" onClick={exportProject}><SvgIcon name="download" />导出动画 JSON</button><label className="file-button icon-label"><SvgIcon name="upload" />导入动画 JSON<input hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importProject(file); }} /></label><button className="reset-button danger-text icon-label" onClick={() => replaceProject(cloneProject(DEFAULT_PROJECT), '已恢复默认横斩动画')}><SvgIcon name="restart" />恢复示例动画</button>
      </div>}
    </aside>
    <section className="timeline-panel">
      <div className="transport"><button className="icon-only" title="回到起点" aria-label="回到起点" onClick={() => scrub(0)}><SvgIcon name="skip-back" /></button><button className="transport-play icon-only" title={playing ? '暂停' : '播放'} aria-label={playing ? '暂停' : '播放'} onClick={playing ? pausePlayback : startPlayback}><SvgIcon name={playing ? 'pause' : 'play'} /></button><button className="icon-only" title="停止" aria-label="停止" onClick={() => stopPlayback()}><SvgIcon name="stop" /></button><button className="icon-only" title="从头播放" aria-label="从头播放" onClick={replayPlayback}><SvgIcon name="restart" /></button><span className="clock">{currentTime.toFixed(2)} <i>/</i> {project.duration.toFixed(2)}s</span><button className={`loop-button icon-label ${project.loop ? 'active' : ''}`} onClick={() => updateProject({ loop: !project.loop })}><SvgIcon name="repeat" size={14} />循环</button><label>速度<select value={project.playbackSpeed} onChange={(event) => updateProject({ playbackSpeed: Number(event.target.value) })}><option value={0.5}>0.5×</option><option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option><option value={1.5}>1.5×</option></select></label></div>
      <div className="timeline-editor">
        <div className="timeline-toolbar"><div><strong>{handName(activeHand)}关键帧轨道</strong><span>空白区域拖动播放头 · 关键帧可单独拖动</span></div><div className="timeline-tools"><label className="exact-time"><span>当前时间</span><input aria-label="当前时间（秒）" type="number" min={0} max={project.duration} step={0.001} value={Number(currentTime.toFixed(3))} onChange={(event) => scrub(clamp(Number(event.target.value), 0, project.duration))} /><b>s</b></label><button className={snapEnabled ? 'active' : ''} onClick={() => setSnapEnabled((value) => !value)}>关键帧吸附 {snapEnabled ? '0.01s' : '关闭'}</button></div></div>
        <div className="timeline-grid">
          <div className="lane-labels"><span className="ruler-label">时间</span><span><i className="lane-dot pose" />动作片段</span><span><i className="lane-dot position" />右手</span><span><i className="lane-dot rotation" />左手</span></div>
          <div ref={timelineCanvasRef} className="timeline-canvas" onPointerDown={beginTimelineScrub}>
            <div className="timeline-ruler">{Array.from({ length: 9 }, (_, index) => index / 8).map((point) => <span key={point} style={{ left: `${point * 100}%` }}><i />{(project.duration * point).toFixed(2)}s</span>)}</div>
            <div className="timeline-lane overview-lane">
              {orderedFrames.slice(0, -1).map((frame, index) => { const next = orderedFrames[index + 1]; return <div className="clip-segment" key={frame.id} style={{ left: `${(frame.time / project.duration) * 100}%`, width: `${((next.time - frame.time) / project.duration) * 100}%` }}><span>{frame.label}</span></div>; })}
              {orderedFrames.map((frame) => <button key={frame.id} className={`keyframe pose-key ${frame.id === selectedId ? 'active' : ''}`} style={{ left: `${(frame.time / project.duration) * 100}%` }} onPointerDown={(event) => beginKeyframeDrag(event, frame)} onClick={() => selectFrame(frame)} title={`${frame.label} · ${frame.time.toFixed(2)}s`}><i /><span>{frame.label}<b>{frame.time.toFixed(2)}s</b></span></button>)}
            </div>
            {HANDS.map(hand => <div key={hand} className={`timeline-lane hand-lane hand-${hand} ${rig.weapons[hand].enabled ? '' : 'disabled'}`}>
              {rig.weapons[hand].keyframes.map(frame => <button key={frame.id} className={`channel-key ${hand === 'right' ? 'position-key' : 'rotation-key'} ${hand === activeHand && frame.id === selectedFrame.id ? 'active' : ''}`} style={{ left: `${frame.time / rig.duration * 100}%` }} onPointerDown={event => event.stopPropagation()} onClick={() => { selectHand(hand); setSelectedId(frame.id); scrub(frame.time); }} title={`${handName(hand)} · ${frame.label} · ${frame.time.toFixed(3)}s`} aria-label={`${handName(hand)}关键帧 ${frame.label}`}><i /></button>)}
            </div>)}
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
