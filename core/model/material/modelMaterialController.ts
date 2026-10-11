import { Material, MultiMaterial, PBRMaterial, Texture, type AbstractMesh, type BaseTexture, type Scene } from '@babylonjs/core';
import { applyModelMaterialPolicy, type ModelTransparencyPolicy } from './applyModelMaterialPolicy.ts';
import { parseModelMaterialBindings, type ModelMaterialBindings, type ModelTextureSlot } from './modelMaterialBindings.ts';
import { acquireModelTexture } from './modelTextureCache.ts';
import { resolvePublicResourceUrl } from '../../resources/appAssetUrl.ts';
const slots = { baseColor: 'albedoTexture', normal: 'bumpTexture', metallicRoughness: 'metallicTexture', occlusion: 'ambientTexture', emissive: 'emissiveTexture' } as const;
export type PreparedModelMaterials = { validate(): void; commit(): void; rollback(): void; finalize(): void; dispose(): void };
export function createModelMaterialController(scene: Scene, meshes: readonly AbstractMesh[], policy: ModelTransparencyPolicy | undefined, changed: (apply: () => void) => void) {
  const sources = meshes.map(m => m.material);
  const indices = new Map<Material, number>();
  const visit = (m: Material | null) => {
    if (m instanceof MultiMaterial) m.subMaterials.forEach(visit);
    else if (m) {
      const pointers: string[] = m._internalMetadata?.gltf?.pointers ?? [];
      const pointer = pointers.find(p => /^\/materials\/\d+$/.test(p));
      if (pointer) indices.set(m, Number(pointer.split('/')[2]));
    }
  }; sources.forEach(visit);
  let disposed = false, generation = 0;
  let active: { materials: Set<Material>; textures: Set<BaseTexture> } | undefined;
  const destroy = (state: typeof active) => { state?.materials.forEach(m => m.dispose(false,false)); state?.textures.forEach(t => t.dispose()); };
  const describe = () => [...new Map([...indices].map(([material,index]) => [index,material]))].map(([index,material]) => ({ gltfMaterialIndex: index, name: material.name,
    textures: Object.fromEntries(Object.entries(slots).map(([slot,key]) => [slot, material instanceof PBRMaterial ? material[key]?.name ?? null : null])) }));
  const prepare = async (raw?: ModelMaterialBindings, signal?: AbortSignal): Promise<PreparedModelMaterials> => {
    const token = ++generation; const bindings = parseModelMaterialBindings(raw) ?? [];
    const check = () => { signal?.throwIfAborted(); if (disposed || token !== generation) throw new Error('材质更新已过期'); };
    check(); const state = { materials: new Set<Material>(), textures: new Set<BaseTexture>() }; const map = new Map<Material,Material>();
    const clone = (source: Material | null): Material | null => {
      if (!source) return null; if (map.has(source)) return map.get(source)!;
      const material = source instanceof MultiMaterial ? new MultiMaterial(`${source.name}:instance`,scene) : source.clone(`${source.name}:instance`);
      if (!material) throw new Error(`材质不能克隆：${source.name}`);
      map.set(source,material); state.materials.add(material);
      if (source instanceof MultiMaterial) (material as MultiMaterial).subMaterials = source.subMaterials.map(clone);
      else { const originals = new Set(source.getActiveTextures()); material.getActiveTextures().forEach(t => { if (!originals.has(t)) state.textures.add(t); }); }
      return material;
    };
    try {
      const roots = sources.map(clone);
      applyModelMaterialPolicy(roots.map(material => ({ material }) as AbstractMesh),policy);
      for (const binding of bindings) {
        const targets = [...indices].filter(([,i]) => i === binding.selector.gltfMaterialIndex);
        if (!targets.length) throw new Error(`未找到 glTF 材质 ${binding.selector.gltfMaterialIndex}`);
        for (const [source] of targets) {
          const m = map.get(source); if (!(m instanceof PBRMaterial)) throw new Error('材质覆盖仅支持 glTF PBR 材质');
          for (const [slot, spec] of Object.entries(binding.textures ?? {})) {
            const key = slots[slot as ModelTextureSlot]; const original = (source as PBRMaterial)[key];
            if (spec === null) { m[key] = null; continue; }
            const old = original instanceof Texture ? original : null;
            if (spec.uvSet !== undefined) {
              const uses = (material: Material | null): boolean => material === source || (material instanceof MultiMaterial && material.subMaterials.some(uses));
              const kind = spec.uvSet === 0 ? 'uv' : `uv${spec.uvSet + 1}`;
              if (meshes.some((mesh,i) => uses(sources[i]) && mesh.getTotalVertices() > 0 && !mesh.isVerticesDataPresent(kind))) throw new Error(`材质 ${binding.selector.gltfMaterialIndex} 缺少 UV 通道 ${spec.uvSet}`);
            }
            const gamma = slot === 'baseColor' || slot === 'emissive';
            const t = await acquireModelTexture(scene,resolvePublicResourceUrl(spec.path), { gamma,
              noMipmap: spec.noMipmap ?? old?.noMipmap ?? false, samplingMode: spec.samplingMode ?? old?.samplingMode ?? Texture.TRILINEAR_SAMPLINGMODE,
              wrapU: spec.wrapU ?? old?.wrapU ?? Texture.WRAP_ADDRESSMODE, wrapV: spec.wrapV ?? old?.wrapV ?? Texture.WRAP_ADDRESSMODE, useSRGBBuffer: gamma },signal);
            state.textures.add(t); check();
            t.coordinatesIndex = spec.uvSet ?? old?.coordinatesIndex ?? 0;
            t.uOffset = spec.offset?.[0] ?? old?.uOffset ?? 0; t.vOffset = spec.offset?.[1] ?? old?.vOffset ?? 0;
            t.uScale = spec.scale?.[0] ?? old?.uScale ?? 1; t.vScale = spec.scale?.[1] ?? old?.vScale ?? 1;
            t.uAng = old?.uAng ?? 0; t.vAng = old?.vAng ?? 0; t.wAng = spec.rotation === undefined ? old?.wAng ?? 0 : -spec.rotation;
            t.uRotationCenter = old?.uRotationCenter ?? 0; t.vRotationCenter = old?.vRotationCenter ?? 0;
            t.level = spec.level ?? old?.level ?? 1; t.hasAlpha = original?.hasAlpha ?? slot === 'baseColor'; m[key] = t;
            if (slot === 'normal' && !old) { m.invertNormalMapX = !scene.useRightHandedSystem; m.invertNormalMapY = scene.useRightHandedSystem; }
            if (slot === 'metallicRoughness') { m.useRoughnessFromMetallicTextureAlpha = false; m.useRoughnessFromMetallicTextureGreen = true; m.useMetallnessFromMetallicTextureBlue = true; }
            if (slot === 'occlusion') m.useAmbientInGrayScale = true;
          }
          if (binding.alphaMode) { m.transparencyMode = { OPAQUE: Material.MATERIAL_OPAQUE, MASK: Material.MATERIAL_ALPHATEST, BLEND: Material.MATERIAL_ALPHABLEND }[binding.alphaMode]; m.forceDepthWrite = false; m.useAlphaFromAlbedoTexture = binding.alphaMode !== 'OPAQUE'; if (m.albedoTexture) m.albedoTexture.hasAlpha = binding.alphaMode !== 'OPAQUE'; }
          if (binding.alphaCutoff !== undefined) m.alphaCutOff = binding.alphaCutoff;
        }
      }
      check(); let phase: 'prepared' | 'committed' | 'finished' = 'prepared';
      let previousState: typeof active;
      let previousMaterials: (Material | null)[] = [];
      const finalize = () => { if (phase !== 'committed') return; phase = 'finished'; destroy(previousState); previousState = undefined; };
      return { validate() { if (phase !== 'prepared') throw new Error('材质事务已结束'); check(); }, commit() { if (phase !== 'prepared') throw new Error('材质事务已结束'); check();
        const previous = meshes.map(m => m.material);
        try { changed(() => { meshes.forEach((m,i) => { m.material = roots[i]; }); }); }
        catch (error) { changed(() => { meshes.forEach((m,i) => { m.material = previous[i]; }); }); throw error; }
        previousMaterials = previous; previousState = active; active = state; phase = 'committed'; },
        rollback() {
          if (phase !== 'committed') return;
          try { changed(() => { meshes.forEach((m,i) => { m.material = previousMaterials[i]; }); }); }
          finally { active = previousState; previousState = undefined; phase = 'finished'; destroy(state); }
        }, finalize,
        dispose() { if (phase === 'prepared') { phase = 'finished'; destroy(state); } else finalize(); } };
    } catch (error) { destroy(state); throw error; }
  };
  return { describe, prepare, async update(bindings?: ModelMaterialBindings, signal?: AbortSignal) { const prepared = await prepare(bindings,signal); try { prepared.commit(); prepared.finalize(); } finally { prepared.dispose(); } },
    dispose() { if (disposed) return; disposed = true; generation++; destroy(active); active = undefined; } };
}
