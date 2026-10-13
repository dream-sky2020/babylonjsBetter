import type { ModelEntity } from '@/core/model';

export type UvRegion = { uv: ArrayLike<number>; indices: ArrayLike<number> | null; start: number; count: number; matrix: number[]; wrapU: number; wrapV: number };
export type UvTexture = { name: string; pixels: number; regions: UvRegion[]; reason?: string };
export type UvCoverage = { percent: number | null; detail: string };

export function modelUvTextures(entity: ModelEntity): UvTexture[] {
  const textures = new Map<object, UvTexture>();
  for (const mesh of entity.meshes) {
    const indices = mesh.getIndices();
    const parts = mesh.subMeshes?.length ? mesh.subMeshes.map(part => ({ material: part.getMaterial(), start: indices ? part.indexStart : part.verticesStart, count: indices ? part.indexCount : part.verticesCount }))
      : [{ material: mesh.material, start: 0, count: indices?.length ?? mesh.getTotalVertices() }];
    for (const part of parts) for (const texture of part.material?.getActiveTextures() ?? []) {
      const internal = texture.getInternalTexture(), key = internal ?? texture, size = texture.getSize();
      let entry = textures.get(key);
      if (!entry) { entry = { name: texture.name || '未命名纹理', pixels: size.width * size.height, regions: [] }; textures.set(key, entry); }
      if (texture.isCube || texture.is3D || texture.is2DArray || texture.isRenderTarget || texture.coordinatesMode !== 0 || !texture.isReady()) {
        entry.reason = '非普通二维 UV 纹理或资源未就绪'; continue;
      }
      const uv = mesh.getVerticesData(texture.coordinatesIndex ? `uv${texture.coordinatesIndex + 1}` : 'uv');
      if (!uv || !part.count) { entry.reason = '缺少 UV 或三角形数据'; continue; }
      entry.regions.push({ uv, indices, start: part.start, count: part.count, matrix: Array.from(texture.getTextureMatrix().m), wrapU: texture.wrapU, wrapV: texture.wrapV });
    }
  }
  return [...textures.values()];
}

const GRID = 128;
function fold(value: number, wrap: number): number {
  if (wrap === 0) return Math.max(0, Math.min(GRID - 1, value));
  const period = wrap === 2 ? GRID * 2 : GRID;
  const folded = ((value % period) + period) % period;
  return folded >= GRID ? period - 1 - folded : folded;
}

export function textureUvCoverage(texture: UvTexture): number | null {
  if (texture.reason || !texture.regions.length || texture.pixels <= 0) return null;
  const mask = new Uint8Array(GRID * GRID);
  let work = 0;
  for (const region of texture.regions) {
    const { uv, indices, matrix: m } = region;
    for (let i = region.start; i + 2 < region.start + region.count; i += 3) {
      const points = [0, 1, 2].map(offset => {
        const index = indices ? indices[i + offset] : i + offset, u = uv[index * 2], v = uv[index * 2 + 1];
        return [(u * m[0] + v * m[4] + m[8]) * GRID, (u * m[1] + v * m[5] + m[9]) * GRID];
      });
      if (points.some(point => point.some(value => !Number.isFinite(value) || Math.abs(value) > 1e8))) return null;
      const minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]));
      const firstY = Math.max(Math.ceil(minY - 0.5), region.wrapV === 0 ? 0 : -Infinity);
      const lastY = Math.min(Math.ceil(maxY - 0.5) - 1, region.wrapV === 0 ? GRID - 1 : Infinity);
      if (lastY - firstY > 8192) return null;
      for (let y = firstY; y <= lastY; y++) {
        if (++work > 2000000) return null;
        const intersections: number[] = [], scan = y + 0.5;
        for (let edge = 0; edge < 3; edge++) {
          const a = points[edge], b = points[(edge + 1) % 3];
          if (scan >= Math.min(a[1], b[1]) && scan < Math.max(a[1], b[1])) intersections.push(a[0] + (scan - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
        if (intersections.length !== 2) continue;
        const firstX = Math.max(Math.ceil(Math.min(...intersections) - 0.5), region.wrapU === 0 ? 0 : -Infinity);
        const lastX = Math.min(Math.ceil(Math.max(...intersections) - 0.5) - 1, region.wrapU === 0 ? GRID - 1 : Infinity);
        if (lastX - firstX > 8192 || (work += Math.max(0, lastX - firstX + 1)) > 2000000) return null;
        const row = fold(y, region.wrapV) * GRID;
        for (let x = firstX; x <= lastX; x++) mask[row + fold(x, region.wrapU)] = 1;
      }
    }
  }
  return mask.reduce((total, occupied) => total + occupied, 0) / mask.length * 100;
}

export function modelUvCoverage(textures: UvTexture[]): UvCoverage {
  if (!textures.length) return { percent: null, detail: '此模型未引用纹理' };
  let area = 0, pixels = 0, unknown = false;
  const details = textures.map(texture => {
    const percent = textureUvCoverage(texture);
    if (percent === null) unknown = true;
    else { area += percent * texture.pixels; pixels += texture.pixels; }
    return `${texture.name}: ${percent === null ? texture.reason ?? '数据超出分析范围' : `${percent.toFixed(1)}%`}`;
  });
  return { percent: unknown || !pixels ? null : area / pixels, detail: `UV 区域覆盖率估算（128×128 网格），重叠去重，多纹理按像素面积加权；支持 UV 通道、纹理变换和重复/镜像平铺。\n${details.join('\n')}` };
}
