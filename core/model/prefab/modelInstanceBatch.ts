import { AssetContainer, AbstractMesh, Mesh, MultiMaterial, Vector4, type Material, type Scene, type BaseTexture } from '@babylonjs/core';
import { applyModelMaterialPolicy, type ModelTransparencyPolicy } from '../material/applyModelMaterialPolicy.ts';

export const deformationInstanceAttributes = ['vdDeform0', 'vdDeform1', 'vdDeform2', 'vdDeform3'] as const;
export const supportsModelInstanceBatch = (container: AssetContainer) => !container.skeletons.length && !container.animationGroups.length
  && container.meshes.every(mesh => !mesh.morphTargetManager && !mesh.getVertexBuffer('position')?.isUpdatable());

/** Hidden masters own shared materials; authored model roots and instance transforms remain independent. */
export function createModelInstanceBatch(scene: Scene, original: AssetContainer, policy: ModelTransparencyPolicy | undefined, receiveShadows: boolean) {
  const masters = original.instantiateModelsToScene(name => `batch:${name}`, false, { doNotInstantiate: true });
  const nodes = masters.rootNodes.flatMap(root => [root, ...root.getDescendants(false)]);
  // Babylon's AssetContainer constructor installs a scene-dispose observer that
  // AssetContainer.dispose() does not remove. Track our container's observer so
  // retiring a batch also releases the closure retaining its source meshes.
  const previousObservers = new Set(scene.onDisposeObservable.observers);
  const source = new AssetContainer(scene);
  const sourceDisposeObservers = scene.onDisposeObservable.observers.filter(observer => !previousObservers.has(observer));
  source.rootNodes = masters.rootNodes;
  source.meshes = nodes.filter((node): node is AbstractMesh => node instanceof AbstractMesh);
  source.transformNodes = nodes.filter(node => node.getClassName() === 'TransformNode') as AssetContainer['transformNodes'];
  const materials = new Map<Material, Material>(), textures = new Set<BaseTexture>();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    sourceDisposeObservers.forEach(observer => scene.onDisposeObservable.remove(observer));
    source.dispose();
    materials.forEach(material => material.dispose(false, false));
    textures.forEach(texture => texture.dispose());
  };
  const clone = (material: Material | null): Material | null => {
    if (!material) return null;
    const cached = materials.get(material); if (cached) return cached;
    const copy = material instanceof MultiMaterial ? new MultiMaterial(`${material.name}:batch`, scene) : material.clone(`${material.name}:batch`);
    if (!copy) throw new Error(`材质不能克隆：${material.name}`);
    copy._internalMetadata = material._internalMetadata;
    materials.set(material, copy);
    if (material instanceof MultiMaterial) (copy as MultiMaterial).subMaterials = material.subMaterials.map(clone);
    else { const originals = new Set(material.getActiveTextures()); copy.getActiveTextures().forEach(texture => { if (!originals.has(texture)) textures.add(texture); }); }
    return copy;
  };
  try {
    for (const mesh of source.meshes) {
      mesh.material = clone(mesh.material); mesh.receiveShadows = receiveShadows;
      if (mesh instanceof Mesh && mesh.getTotalVertices()) {
        deformationInstanceAttributes.forEach((name, index) => {
          mesh.registerInstancedBuffer(name, 4);
          mesh.instancedBuffers[name] = new Vector4(index === 0 ? 1 : 0, index === 1 ? 1 : 0, index === 2 ? 1 : 0, index === 3 ? 1 : 0);
        });
      }
    }
    applyModelMaterialPolicy(source.meshes, policy);
    // Instances read lightSources from their master. Keep masters in scene.meshes so
    // staged light activation, replacement and disposal update Babylon's lighting cache.
    // Invisible masters draw only their visible instances and cannot be picked themselves.
    source.meshes.forEach(mesh => { mesh.isVisible = false; mesh.isPickable = false; });
    return { source, dispose };
  } catch (error) { dispose(); throw error; }
}
