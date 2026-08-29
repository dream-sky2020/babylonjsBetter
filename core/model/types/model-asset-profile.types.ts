import type { ModelTransparencyPolicy } from '../material/applyModelMaterialPolicy';

export type ModelAssetVector3 = { x: number; y: number; z: number };
export type ModelAssetProfile = {
  modelPath: string;
  uniformScale: number;
  rotationDeg: ModelAssetVector3;
  positionOffset: ModelAssetVector3;
  transparencyPolicy: ModelTransparencyPolicy;
  measuredBounds?: { size: ModelAssetVector3; center: ModelAssetVector3 };
};
export type ModelAssetProfileLibrary = Record<string, ModelAssetProfile>;
