import type {
  AbstractMesh,
  AnimationGroup,
  Scene,
  Skeleton,
  TransformNode
} from '@babylonjs/core';
import type { ModelTransparencyPolicy } from '@/core/model/material/applyModelMaterialPolicy.ts';
import type { ModelAssetProfile } from '@/core/model/types/model-asset-profile.types.ts';

export type ModelFileFormat = 'glb' | 'gltf';

export type CreateModelEntityOptions = {
  name?: string;
  autoPlayAnimation?: boolean | string;
  /** 默认使用深度安全的裁切透明；真正的玻璃/半透明模型可指定 source。 */
  transparencyPolicy?: ModelTransparencyPolicy;
  /** 默认读取全局模型资产配置；校准 Lab 可关闭以测量原始模型。 */
  applyAssetProfile?: boolean;
  /** 显式覆盖全局模型资产配置。 */
  assetProfile?: ModelAssetProfile;
};

export type ModelEntity = {
  root: TransformNode;
  /** 位于实例 root 下，仅承载模型资产级的统一缩放、旋转与原点修正。 */
  normalizationRoot: TransformNode;
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
