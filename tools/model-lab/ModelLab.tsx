import { useEffect, useRef, useState } from 'react';
import {
  ArcRotateCamera,
  Color4,
  Engine,
  HemisphericLight,
  Scene,
  Vector3
} from '@babylonjs/core';
import { createModelEntity, type ModelEntity } from '@/core/model';
import { loadModelAssetManifest, resolvePublicResourceUrl } from '@/core/resources';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

type PreviewSession = { dispose: () => void };

const isFbx = (path: string) => path.split(/[?#]/, 1)[0].toLowerCase().endsWith('.fbx');

const fitBabylonCamera = (camera: ArcRotateCamera, entity: ModelEntity) => {
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
  const radius = Math.max(Vector3.Distance(minimum, maximum) * 0.7, 0.2);
  camera.setTarget(center);
  camera.radius = radius * 2.4;
  camera.minZ = Math.max(radius / 1000, 0.001);
  camera.maxZ = Math.max(radius * 100, 100);
};

const createBabylonPreview = async (host: HTMLElement, sourcePath: string): Promise<PreviewSession> => {
  const canvas = document.createElement('canvas');
  canvas.className = 'model-canvas';
  host.replaceChildren(canvas);
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.035, 0.045, 0.065, 1);
  const camera = new ArcRotateCamera('model_lab_camera', -Math.PI / 2, Math.PI / 2.4, 5, Vector3.Zero(), scene);
  camera.attachControl(canvas, true);
  camera.wheelPrecision = 35;
  const light = new HemisphericLight('model_lab_light', new Vector3(0.4, 1, 0.3), scene);
  light.intensity = 1.35;
  const entity = await createModelEntity(scene, sourcePath, { autoPlayAnimation: true });
  fitBabylonCamera(camera, entity);
  engine.runRenderLoop(() => scene.render());
  const resize = () => engine.resize();
  window.addEventListener('resize', resize);
  return {
    dispose: () => {
      window.removeEventListener('resize', resize);
      entity.dispose();
      scene.dispose();
      engine.dispose();
      canvas.remove();
    }
  };
};

const createFbxPreview = async (host: HTMLElement, sourcePath: string): Promise<PreviewSession> => {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x090c12);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'model-canvas';
  host.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x304060, 2.2));
  const directional = new THREE.DirectionalLight(0xffffff, 2.5);
  directional.position.set(4, 7, 5);
  scene.add(directional);
  scene.add(new THREE.GridHelper(20, 20, 0x51647c, 0x243044));
  const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 100000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const object = await new FBXLoader().loadAsync(resolvePublicResourceUrl(sourcePath));
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      material.side = THREE.DoubleSide;
      material.needsUpdate = true;
    });
  });
  scene.add(object);
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const radius = Math.max(size.length() * 0.5, 0.1);
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(radius * 1.4, radius * 0.9, radius * 1.8));
  camera.near = Math.max(radius / 1000, 0.001);
  camera.far = Math.max(radius * 100, 100);
  camera.updateProjectionMatrix();

  const mixer = object.animations.length > 0 ? new THREE.AnimationMixer(object) : null;
  if (mixer) mixer.clipAction(object.animations[0]).play();
  const clock = new THREE.Clock();
  let frame = 0;
  const resize = () => {
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const render = () => {
    frame = requestAnimationFrame(render);
    mixer?.update(clock.getDelta());
    controls.update();
    renderer.render(scene, camera);
  };
  resize();
  window.addEventListener('resize', resize);
  render();

  return {
    dispose: () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      controls.dispose();
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => material.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
};

export const ModelLab = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<PreviewSession | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [assets, setAssets] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState('');
  const [status, setStatus] = useState('正在扫描 public/resources…');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadModelAssetManifest()
      .then((paths) => {
        setAssets(paths);
        setSelectedPath(paths[0] ?? '');
        setStatus(paths.length > 0 ? `发现 ${paths.length} 个模型文件` : '没有发现 GLB 或 FBX 文件');
      })
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error)));
    return () => {
      sessionRef.current?.dispose();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const openModel = async (path = selectedPath, format: 'glb' | 'fbx' = isFbx(path) ? 'fbx' : 'glb') => {
    const host = hostRef.current;
    if (!host || !path || loading) return;
    setLoading(true);
    setStatus(`正在加载 ${decodeURIComponent(path.split('/').pop() ?? path)}…`);
    sessionRef.current?.dispose();
    sessionRef.current = null;
    try {
      sessionRef.current = format === 'fbx'
        ? await createFbxPreview(host, path)
        : await createBabylonPreview(host, path);
      setStatus(format === 'fbx'
        ? 'FBX 双面预览（Three.js 兼容模式）'
        : 'GLB 深度遮挡预览（Babylon.js core/model）');
    } catch (error) {
      host.replaceChildren();
      setStatus(error instanceof Error ? `加载失败：${error.message}` : `加载失败：${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const openLocalFile = (file: File | undefined) => {
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setSelectedPath(url);
    void openModel(url, file.name.toLowerCase().endsWith('.fbx') ? 'fbx' : 'glb');
  };

  return (
    <main className="model-lab">
      <header className="toolbar">
        <div className="title-block">
          <h1>3D Model Lab</h1>
          <span>{status}</span>
        </div>
        <select value={selectedPath} onChange={(event) => setSelectedPath(event.target.value)}>
          <option value="">选择 public/resources 中的模型…</option>
          {assets.map((path) => <option value={path} key={path}>{decodeURIComponent(path.replace('/resources/', ''))}</option>)}
        </select>
        <button type="button" disabled={!selectedPath || loading} onClick={() => void openModel()}>
          {loading ? '加载中…' : '打开模型'}
        </button>
        <label className="file-button">
          打开本地文件
          <input type="file" accept=".glb,.fbx" onChange={(event) => openLocalFile(event.target.files?.[0])} />
        </label>
      </header>
      <section className="viewport" ref={hostRef}>
        <div className="empty-state">选择 GLB 或 FBX 文件开始预览<br /><small>左键旋转 · 右键平移 · 滚轮缩放</small></div>
      </section>
    </main>
  );
};
