import {
  TransformNode,
  type AnimationGroup,
  type Scene
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import type {
  CreateModelEntityOptions,
  ModelEntity,
  ModelFileFormat
} from '@/core/model/types/model.types.ts';
import { instantiateModelPrefab } from '@/core/model/prefab/modelPrefabCache.ts';

const getModelFormat = (sourcePath: string): ModelFileFormat => {
  const pathname = sourcePath.split(/[?#]/, 1)[0].toLowerCase();
  if (pathname.endsWith('.glb')) return 'glb';
  if (pathname.endsWith('.gltf')) return 'gltf';
  throw new Error(`不支持的 Babylon 模型格式：${sourcePath}。core/model 当前支持 .glb 和 .gltf。`);
};

const findAnimation = (groups: AnimationGroup[], name?: string): AnimationGroup | null => {
  if (groups.length === 0) return null;
  if (!name) return groups[0];
  const normalizedName = name.toLocaleLowerCase();
  return groups.find((group) => group.name.toLocaleLowerCase() === normalizedName) ?? null;
};

export const createModelEntity = async (
  scene: Scene,
  sourcePath: string,
  options: CreateModelEntityOptions = {}
): Promise<ModelEntity> => {
  getModelFormat(sourcePath);
  const fileName = sourcePath.split('/').pop() ?? sourcePath;
  const root = new TransformNode(options.name ?? `model:${fileName}`, scene);
  const prefabInstance = await instantiateModelPrefab(scene, sourcePath, root.name);

  for (const node of prefabInstance.entries.rootNodes) {
    if (!node.parent) node.parent = root;
  }
  const animationGroups = prefabInstance.entries.animationGroups;
  const skeletons = prefabInstance.entries.skeletons;

  let disposed = false;
  const entity: ModelEntity = {
    root,
    sourcePath,
    meshes: prefabInstance.meshes,
    transformNodes: prefabInstance.transformNodes,
    skeletons,
    animationGroups,
    playAnimation: (name?: string, loop = true) => {
      const animation = findAnimation(animationGroups, name);
      if (!animation) return null;
      animation.start(loop);
      return animation;
    },
    stopAnimations: () => {
      animationGroups.forEach((animation) => animation.stop());
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      prefabInstance.release();
      root.dispose();
    }
  };

  if (options.autoPlayAnimation) {
    entity.playAnimation(typeof options.autoPlayAnimation === 'string'
      ? options.autoPlayAnimation
      : undefined);
  }

  return entity;
};
