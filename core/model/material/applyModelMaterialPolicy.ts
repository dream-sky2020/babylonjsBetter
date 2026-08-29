import {
  Material,
  MultiMaterial,
  PBRMaterial,
  type AbstractMesh,
} from '@babylonjs/core';

/**
 * source：完全遵循 glTF 材质。
 * depth-safe-cutout：将 BLEND 裁切贴图改成 Alpha Test，避免内部结构穿透外壁。
 */
export type ModelTransparencyPolicy = 'source' | 'depth-safe-cutout';

export const DEFAULT_MODEL_TRANSPARENCY_POLICY: ModelTransparencyPolicy = 'depth-safe-cutout';

export const applyModelMaterialPolicy = (
  meshes: readonly AbstractMesh[],
  policy: ModelTransparencyPolicy = DEFAULT_MODEL_TRANSPARENCY_POLICY,
): void => {
  if (policy === 'source') return;
  const materials = new Set<Material>();
  meshes.forEach((mesh) => {
    const material = mesh.material;
    if (material instanceof MultiMaterial) {
      material.subMaterials.forEach((subMaterial) => {
        if (subMaterial) materials.add(subMaterial);
      });
    } else if (material) {
      materials.add(material);
    }
  });
  materials.forEach((material) => {
    material.separateCullingPass = false;
    if (material instanceof PBRMaterial && material.transparencyMode === Material.MATERIAL_ALPHABLEND) {
      material.transparencyMode = Material.MATERIAL_ALPHATEST;
      material.alphaCutOff = 0.5;
      material.forceDepthWrite = true;
    }
  });
};
