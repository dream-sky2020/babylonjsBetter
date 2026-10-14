import type { BaseTexture } from '@babylonjs/core';
import type { SceneEnvironmentInstance } from '@/core/scene/sceneEnvironment.types';
import { environmentTextureId, summarizeTextures, type EnvironmentTextureInfo } from './sceneEnvironmentTextureStats.ts';
export type EnvironmentTextureEntry = EnvironmentTextureInfo & { id: string; preview?: string; ownedPreview?: boolean; image?: HTMLImageElement | ImageBitmap; materialIds: string[]; objectIds: string[]; usages: string[] };
const slots: Record<string, string> = { albedoTexture: '底色', diffuseTexture: '底色', bumpTexture: '法线', metallicTexture: '金属度／粗糙度', metallicReflectanceTexture: '金属反射', ambientTexture: '遮蔽', emissiveTexture: '自发光', opacityTexture: '透明度', reflectionTexture: '反射', reflectivityTexture: '反射率', lightmapTexture: '光照图' };
export function collectEnvironmentTextures(instance: SceneEnvironmentInstance): EnvironmentTextureEntry[] {
  const records = new Map<string, { texture: BaseTexture; materials: Set<string>; objects: Set<string>; usages: Set<string> }>();
  const objects = [...instance.models.map(model => ({ id: `model:${model.definition.id}`, meshes: model.entity.meshes })), ...[...(instance.groundMeshes ?? [])].map(([id, mesh]) => ({ id, meshes: [mesh] }))];
  for (const object of objects) for (const mesh of object.meshes) {
    if (!mesh.getTotalVertices()) continue;
    const materials = mesh.subMeshes?.length ? mesh.subMeshes.map(part => part.getMaterial()) : [mesh.material];
    for (const material of materials) for (const texture of material?.getActiveTextures() ?? []) {
      const id = environmentTextureId(texture); let entry = records.get(id);
      if (!entry) { entry = { texture, materials: new Set(), objects: new Set(), usages: new Set() }; records.set(id, entry); }
      entry.objects.add(object.id); entry.materials.add(`material:${material!.uniqueId}`);
      const values = material as unknown as Record<string, unknown>;
      const matched = Object.entries(slots).filter(([key]) => values[key] === texture);
      for (const [, label] of matched) entry.usages.add(label);
      if (!matched.length) entry.usages.add('其他材质纹理');
    }
  }
  return [...records].map(([id, entry]) => {
    const url = ('url' in entry.texture && typeof entry.texture.url === 'string' ? entry.texture.url : entry.texture.getInternalTexture()?.url) ?? '';
    const buffer = entry.texture.getInternalTexture()?._buffer;
    const image = (typeof HTMLImageElement !== 'undefined' && buffer instanceof HTMLImageElement) || (typeof ImageBitmap !== 'undefined' && buffer instanceof ImageBitmap) ? buffer as HTMLImageElement | ImageBitmap : undefined;
    let preview = /^(blob:|data:image\/|https?:|\/)/i.test(url) ? url : undefined, ownedPreview = false;
    if (!image && !preview && typeof URL.createObjectURL === 'function') {
      const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : ArrayBuffer.isView(buffer) ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) : null;
      const mime = bytes && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 ? 'image/png'
        : bytes && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg'
        : bytes && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP' ? 'image/webp' : null;
      if (bytes && mime) { preview = URL.createObjectURL(new Blob([Uint8Array.from(bytes).buffer], { type: mime })); ownedPreview = true; }
      else if (typeof Blob !== 'undefined' && buffer instanceof Blob && buffer.type.startsWith('image/')) { preview = URL.createObjectURL(buffer); ownedPreview = true; }
    }
    return { ...summarizeTextures([entry.texture]).textures[0], id, image, preview, ownedPreview, materialIds: [...entry.materials], objectIds: [...entry.objects], usages: [...entry.usages] };
  });
}
export function releaseTexturePreviews(entries: readonly EnvironmentTextureEntry[]) { for (const entry of entries) if (entry.ownedPreview && entry.preview) URL.revokeObjectURL(entry.preview); }
