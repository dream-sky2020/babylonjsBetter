import type { AbstractMesh, Material } from '@babylonjs/core';
import type { SceneEnvironmentInstance } from '@/core/scene/sceneEnvironment.types';
import { summarizeTextures, type EnvironmentTextureStats } from './sceneEnvironmentTextureStats.ts';

export type EnvironmentMaterialEntry = { id: string; name: string; kind: string; objectIds: string[]; modelCount: number; geometryCount: number; textures: EnvironmentTextureStats };
export function collectEnvironmentMaterials(instance: SceneEnvironmentInstance): EnvironmentMaterialEntry[] {
  const records = new Map<Material, { ids: Set<string>; material: Material }>();
  const add = (id: string, meshes: readonly AbstractMesh[]) => {
    for (const mesh of meshes) {
      if (!mesh.getTotalVertices()) continue;
      const materials = mesh.subMeshes?.length ? mesh.subMeshes.map(part => part.getMaterial()) : [mesh.material];
      for (const material of materials) {
        if (!material) continue;
        let record = records.get(material);
        if (!record) { record = { ids: new Set(), material }; records.set(material, record); }
        record.ids.add(id);
      }
    }
  };
  for (const { definition, entity } of instance.models) add(`model:${definition.id}`, entity.meshes);
  for (const [id, mesh] of instance.groundMeshes ?? []) add(id, [mesh]);
  return [...records.values()].map(({ ids, material }) => ({
    id: `material:${material.uniqueId}`, name: material.name || '未命名材质', kind: material.getClassName(), objectIds: [...ids],
    modelCount: [...ids].filter(id => id.startsWith('model:')).length,
    geometryCount: [...ids].filter(id => id.startsWith('object:')).length,
    textures: summarizeTextures(material.getActiveTextures()),
  }));
}
