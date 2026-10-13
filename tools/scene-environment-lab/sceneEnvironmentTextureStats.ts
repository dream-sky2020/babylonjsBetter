import type { BaseTexture } from '@babylonjs/core';
import type { InternalTexture } from '@babylonjs/core/Materials/Textures/internalTexture';
import type { SceneEnvironmentInstance } from '@/core/scene/sceneEnvironment.types';

export type EnvironmentTextureInfo = { name: string; resolution: string; bytes: number | null; mipmaps: boolean };
export type EnvironmentTextureStats = { textures: EnvironmentTextureInfo[]; bytes: number; unknown: number };

// Block sizes refer to the GPU format after transcoding, not the source file format.
function storageLayout(format: number, type: number): [number, number, number] | null {
  if ([33776, 33777, 35916, 35917, 36196, 37492, 37493, 37494, 37495, 36283, 36284, 37488, 37489].includes(format)) return [4, 4, 8];
  if ([33778, 33779, 35918, 35919, 36492, 36493, 36494, 36495, 36285, 36286, 37490, 37491, 37496, 37497].includes(format)) return [4, 4, 16];
  const astc = [[4, 4], [5, 4], [5, 5], [6, 5], [6, 6], [8, 5], [8, 6], [8, 8], [10, 5], [10, 6], [10, 8], [10, 10], [12, 10], [12, 12]];
  const astcIndex = format >= 37840 ? format - 37840 : format - 37808;
  if (astcIndex >= 0 && astcIndex < astc.length) return [...astc[astcIndex], 16] as [number, number, number];
  const channels: Record<number, number> = { 0: 1, 1: 1, 2: 2, 4: 3, 5: 4, 6: 1, 7: 2, 8: 1, 9: 2, 10: 3, 11: 4, 12: 4 };
  if (!(format in channels)) return null;
  const packed: Record<number, number> = { 8: 2, 9: 2, 10: 2, 11: 4, 12: 4, 13: 4, 14: 4, 15: 8 };
  const component: Record<number, number> = { 0: 1, 1: 4, 2: 2, 3: 1, 4: 2, 5: 2, 6: 4, 7: 4 };
  const bytes = packed[type] ?? (component[type] ? channels[format] * component[type] : undefined);
  return bytes === undefined ? null : [1, 1, bytes];
}

export function estimateTextureBytes(texture: Pick<InternalTexture, 'width' | 'height' | 'depth' | 'format' | 'type' | 'isCube' | 'is3D' | 'is2DArray' | 'generateMipMaps' | '_compression'>): number | null {
  const layout = storageLayout(texture.format, texture.type);
  if (!layout || texture.width < 1 || texture.height < 1) return null;
  // An unidentified compressed format must not be reported as ordinary RGBA.
  if (texture._compression && layout[0] === 1) return null;
  let width = texture.width, height = texture.height, depth = Math.max(1, texture.depth), bytes = 0;
  do {
    bytes += Math.ceil(width / layout[0]) * Math.ceil(height / layout[1]) * layout[2] * depth * (texture.isCube ? 6 : 1);
    if (!texture.generateMipMaps || (width === 1 && height === 1 && (!texture.is3D || depth === 1))) break;
    width = Math.max(1, Math.floor(width / 2)); height = Math.max(1, Math.floor(height / 2));
    if (texture.is3D) depth = Math.max(1, Math.floor(depth / 2));
  } while (true);
  return bytes;
}

export function summarizeTextures(textures: readonly BaseTexture[]): EnvironmentTextureStats {
  const unique = new Map<object, BaseTexture>();
  for (const texture of textures) unique.set(texture.getInternalTexture() ?? texture, texture);
  const entries = [...unique.values()].map(texture => {
    const internal = texture.getInternalTexture(), size = texture.getSize();
    return {
      name: texture.name || internal?.url || '未命名纹理',
      resolution: `${size.width} × ${size.height}${internal?.isCube ? ' × 6 面' : internal?.depth && internal.depth > 1 ? ` × ${internal.depth}` : ''}`,
      bytes: internal && texture.isReady() && !texture.isRenderTarget ? estimateTextureBytes(internal) : null,
      mipmaps: internal?.generateMipMaps ?? false,
    };
  });
  return { textures: entries, bytes: entries.reduce((total, entry) => total + (entry.bytes ?? 0), 0), unknown: entries.filter(entry => entry.bytes === null).length };
}

export function collectModelTextureStats(instance: SceneEnvironmentInstance) {
  const all: BaseTexture[] = [], models = new Map<string, EnvironmentTextureStats>();
  for (const { definition, entity } of instance.models) {
    const textures = entity.meshes.flatMap(mesh => mesh.material?.getActiveTextures() ?? []);
    models.set(`model:${definition.id}`, summarizeTextures(textures)); all.push(...textures);
  }
  return { models, summary: summarizeTextures(all) };
}

export const formatTextureBytes = (bytes: number) => bytes >= 1024 * 1024
  ? `${(bytes / (1024 * 1024)).toLocaleString(undefined, { maximumFractionDigits: 2 })} MiB`
  : `${(bytes / 1024).toLocaleString(undefined, { maximumFractionDigits: 2 })} KiB`;
