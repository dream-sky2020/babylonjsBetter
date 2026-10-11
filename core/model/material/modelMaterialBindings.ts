export const MODEL_TEXTURE_SLOTS = ['baseColor', 'normal', 'metallicRoughness', 'occlusion', 'emissive'] as const;
export type ModelTextureSlot = typeof MODEL_TEXTURE_SLOTS[number];
export type ModelTextureBinding = {
  path: string; uvSet?: number; offset?: [number, number]; scale?: [number, number]; rotation?: number;
  wrapU?: number; wrapV?: number; samplingMode?: number; noMipmap?: boolean; level?: number;
};
export type ModelMaterialBinding = {
  selector: { gltfMaterialIndex: number };
  textures?: Partial<Record<ModelTextureSlot, ModelTextureBinding | null>>;
  alphaMode?: 'OPAQUE' | 'MASK' | 'BLEND'; alphaCutoff?: number;
};
export type ModelMaterialBindings = ModelMaterialBinding[];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function parseModelMaterialBindings(value: unknown): ModelMaterialBindings | undefined {
  if (value === undefined) return undefined;
  const fail = (): never => { throw new Error('材质覆盖无效：需要唯一 glTF 材质索引、合法贴图槽及 resources 路径'); };
  if (!Array.isArray(value)) return fail();
  const seen = new Set<number>();
  for (const b of value) {
    if (!record(b) || Object.keys(b).some(k => !['selector','textures','alphaMode','alphaCutoff'].includes(k)) || !record(b.selector) || Object.keys(b.selector).length !== 1) return fail();
    const index = b.selector.gltfMaterialIndex;
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || seen.has(index)) return fail(); seen.add(index);
    if (b.alphaMode !== undefined && !['OPAQUE','MASK','BLEND'].includes(String(b.alphaMode))) return fail();
    if (b.alphaCutoff !== undefined && (typeof b.alphaCutoff !== 'number' || !Number.isFinite(b.alphaCutoff) || b.alphaCutoff < 0 || b.alphaCutoff > 1)) return fail();
    if (b.textures !== undefined) {
      if (!record(b.textures)) return fail();
      for (const [slot,t] of Object.entries(b.textures)) {
        if (!MODEL_TEXTURE_SLOTS.includes(slot as ModelTextureSlot)) return fail();
        if (t === null) continue;
        if (!record(t) || Object.keys(t).some(k => !['path','uvSet','offset','scale','rotation','wrapU','wrapV','samplingMode','noMipmap','level'].includes(k))) return fail();
        if (typeof t.path !== 'string' || !/^\/?resources\/.+\.(png|jpe?g|webp)$/i.test(t.path) || /[\\%?#]|(?:^|\/)\.\.(?:\/|$)/.test(t.path)) return fail();
        for (const k of ['uvSet','wrapU','wrapV','samplingMode']) if (t[k] !== undefined && (typeof t[k] !== 'number' || !Number.isInteger(t[k]) || t[k] < (k === 'samplingMode' ? 1 : 0) || t[k] > (k === 'uvSet' ? 5 : k === 'samplingMode' ? 12 : 2))) return fail();
        for (const k of ['offset','scale']) if (t[k] !== undefined && (!Array.isArray(t[k]) || t[k].length !== 2 || t[k].some(n => typeof n !== 'number' || !Number.isFinite(n)))) return fail();
        for (const k of ['rotation','level']) if (t[k] !== undefined && (typeof t[k] !== 'number' || !Number.isFinite(t[k]))) return fail();
        if (t.noMipmap !== undefined && typeof t.noMipmap !== 'boolean') return fail();
      }
    }
  }
  return structuredClone(value) as ModelMaterialBindings;
}
