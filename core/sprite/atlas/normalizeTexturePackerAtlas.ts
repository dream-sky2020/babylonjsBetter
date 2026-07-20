import type { TexturePackerAtlas, TexturePackerFrameRaw } from '@/core/sprite/editor/spriteAnchorEditorHelpers.ts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toFrameRaw = (value: unknown): TexturePackerFrameRaw | null => {
  if (!isRecord(value)) return null;
  const frame = value.frame;
  const spriteSourceSize = value.spriteSourceSize;
  const sourceSize = value.sourceSize;
  if (!isRecord(frame) || !isRecord(spriteSourceSize) || !isRecord(sourceSize)) return null;

  const num = (obj: Record<string, unknown>, key: string): number | null => {
    const v = obj[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };

  const fx = num(frame, 'x');
  const fy = num(frame, 'y');
  const fw = num(frame, 'w');
  const fh = num(frame, 'h');
  const sx = num(spriteSourceSize, 'x');
  const sy = num(spriteSourceSize, 'y');
  const sw = num(spriteSourceSize, 'w');
  const sh = num(spriteSourceSize, 'h');
  const sow = num(sourceSize, 'w');
  const soh = num(sourceSize, 'h');
  if (
    fx === null ||
    fy === null ||
    fw === null ||
    fh === null ||
    sx === null ||
    sy === null ||
    sw === null ||
    sh === null ||
    sow === null ||
    soh === null
  ) {
    return null;
  }

  return {
    frame: { x: fx, y: fy, w: fw, h: fh },
    rotated: Boolean(value.rotated),
    trimmed: Boolean(value.trimmed),
    spriteSourceSize: { x: sx, y: sy, w: sw, h: sh },
    sourceSize: { w: sow, h: soh }
  };
};

/**
 * 将 TexturePacker 的 hash / array 两种 frames 格式统一为 Record。
 */
export const normalizeTexturePackerAtlas = (raw: unknown): TexturePackerAtlas | null => {
  if (!isRecord(raw)) return null;
  const meta = raw.meta;
  if (!isRecord(meta) || !isRecord(meta.size)) return null;
  const sizeW = meta.size.w;
  const sizeH = meta.size.h;
  if (typeof sizeW !== 'number' || typeof sizeH !== 'number') return null;
  if (typeof meta.image !== 'string' || !meta.image.trim()) return null;

  const frames: Record<string, TexturePackerFrameRaw> = {};
  const framesRaw = raw.frames;

  if (Array.isArray(framesRaw)) {
    for (const item of framesRaw) {
      if (!isRecord(item)) continue;
      const name =
        (typeof item.filename === 'string' && item.filename) ||
        (typeof item.name === 'string' && item.name) ||
        '';
      if (!name) continue;
      const frame = toFrameRaw(item);
      if (!frame) continue;
      frames[name] = frame;
    }
  } else if (isRecord(framesRaw)) {
    for (const [name, item] of Object.entries(framesRaw)) {
      const frame = toFrameRaw(item);
      if (!frame) continue;
      frames[name] = frame;
    }
  } else {
    return null;
  }

  if (Object.keys(frames).length === 0) return null;

  return {
    frames,
    meta: {
      image: meta.image,
      size: { w: sizeW, h: sizeH }
    }
  };
};

export const loadTexturePackerAtlas = async (atlasJsonPath: string): Promise<TexturePackerAtlas> => {
  const normalized = atlasJsonPath.replace(/^\/+/, '');
  const response = await fetch(encodeURI(`/${normalized}?t=${Date.now()}`), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`图集加载失败（HTTP ${response.status}）：${normalized}`);
  }
  const json = (await response.json()) as unknown;
  const atlas = normalizeTexturePackerAtlas(json);
  if (!atlas) {
    throw new Error(`图集格式无效：${normalized}`);
  }
  return atlas;
};
