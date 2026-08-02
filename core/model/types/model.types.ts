import type {
  AbstractMesh,
  AnimationGroup,
  Scene,
  Skeleton,
  TransformNode
} from '@babylonjs/core';

export type ModelFileFormat = 'glb' | 'gltf';

export type CreateModelEntityOptions = {
  name?: string;
  autoPlayAnimation?: boolean | string;
};

export type ModelEntity = {
  root: TransformNode;
  sourcePath: string;
  meshes: AbstractMesh[];
  transformNodes: TransformNode[];
  skeletons: Skeleton[];
  animationGroups: AnimationGroup[];
  playAnimation: (name?: string, loop?: boolean) => AnimationGroup | null;
  stopAnimations: () => void;
  dispose: () => void;
};

export type ModelLoader = (
  scene: Scene,
  sourcePath: string,
  options?: CreateModelEntityOptions
) => Promise<ModelEntity>;
