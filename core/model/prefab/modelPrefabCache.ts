import {
  AbstractMesh,
  LoadAssetContainerAsync,
  TransformNode,
  type AssetContainer,
  type InstantiatedEntries,
  type Scene
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { GLTFLoaderAnimationStartMode } from '@babylonjs/loaders/glTF/glTFFileLoader';
import '../material/sharedTextureLoader.ts';
import { resolveModelDependencyUrl } from '../material/modelTextureCache.ts';
import { resolvePublicResourceUrl } from '@/core/resources/appAssetUrl.ts';

export type ModelPrefabInstance = {
  entries: InstantiatedEntries;
  meshes: AbstractMesh[];
  transformNodes: TransformNode[];
  release: () => void;
};

export type ModelPrefabCacheStats = {
  prefabCount: number;
  loadCount: number;
  activeInstanceCount: number;
  paths: string[];
};

type PrefabEntry = {
  containerPromise: Promise<AssetContainer>;
  activeInstances: number;
  retired?: boolean;
};

type ScenePrefabCache = {
  entries: Map<string, PrefabEntry>;
  loadCount: number;
  disposed: boolean;
};

const sceneCaches = new WeakMap<Scene, ScenePrefabCache>();

const normalizeModelPath = (sourcePath: string): string => {
  return resolvePublicResourceUrl(sourcePath);
};

const getSceneCache = (scene: Scene): ScenePrefabCache => {
  const existing = sceneCaches.get(scene);
  if (existing) return existing;
  const cache: ScenePrefabCache = { entries: new Map(), loadCount: 0, disposed: false };
  sceneCaches.set(scene, cache);
  scene.onDisposeObservable.addOnce(() => clearModelPrefabCache(scene));
  return cache;
};

const loadPrefab = (scene: Scene, sourcePath: string, cache: ScenePrefabCache): PrefabEntry => {
  cache.loadCount += 1;
  const entry: PrefabEntry = {
    activeInstances: 0,
    // Cached source nodes must stay in their authored pose. Playback belongs to
    // each instance's autoPlayAnimation/playAnimation, never the hidden prefab.
    containerPromise: LoadAssetContainerAsync(sourcePath, scene, { pluginOptions: { gltf: {
      preprocessUrlAsync: resolveModelDependencyUrl, animationStartMode: GLTFLoaderAnimationStartMode.NONE
    } } }).catch((error: unknown) => {
      if (cache.entries.get(sourcePath) === entry) cache.entries.delete(sourcePath);
      throw error;
    })
  };
  cache.entries.set(sourcePath, entry);
  return entry;
};

export const instantiateModelPrefab = async (
  scene: Scene,
  sourcePath: string,
  instanceName: string
): Promise<ModelPrefabInstance> => {
  const normalizedPath = normalizeModelPath(sourcePath);
  const cache = getSceneCache(scene);
  if (cache.disposed) throw new Error('无法在已销毁的 Scene 中实例化模型');
  const prefab = cache.entries.get(normalizedPath) ?? loadPrefab(scene, normalizedPath, cache);
  const container = await prefab.containerPromise;
  if (cache.disposed) throw new Error('模型加载完成前 Scene 已被销毁');
  const entries = container.instantiateModelsToScene(
    (sourceName) => `${instanceName}:${sourceName}`,
    false
  );
  const descendants = entries.rootNodes.flatMap((node) => [node, ...node.getDescendants(false)]);
  const meshes = descendants.filter((node): node is AbstractMesh => node instanceof AbstractMesh);
  const transformNodes = descendants.filter(
    (node): node is TransformNode => node instanceof TransformNode && !(node instanceof AbstractMesh)
  );
  prefab.activeInstances += 1;
  let released = false;
  return {
    entries,
    meshes,
    transformNodes,
    release: () => {
      if (released) return;
      released = true;
      prefab.activeInstances = Math.max(0, prefab.activeInstances - 1);
      entries.dispose();
      if (prefab.retired && prefab.activeInstances === 0) container.dispose();
    }
  };
};

export const getModelPrefabCacheStats = (scene: Scene): ModelPrefabCacheStats => {
  const cache = sceneCaches.get(scene);
  if (!cache) return { prefabCount: 0, loadCount: 0, activeInstanceCount: 0, paths: [] };
  return {
    prefabCount: cache.entries.size,
    loadCount: cache.loadCount,
    activeInstanceCount: [...cache.entries.values()].reduce((total, entry) => total + entry.activeInstances, 0),
    paths: [...cache.entries.keys()]
  };
};

export const clearModelPrefabCache = (scene: Scene): void => {
  const cache = sceneCaches.get(scene);
  if (!cache || cache.disposed) return;
  cache.disposed = true;
  for (const entry of cache.entries.values()) {
    entry.retired = true;
    if (scene.isDisposed || entry.activeInstances === 0) void entry.containerPromise.then((container) => container.dispose()).catch(() => undefined);
  }
  cache.entries.clear();
  sceneCaches.delete(scene);
};
