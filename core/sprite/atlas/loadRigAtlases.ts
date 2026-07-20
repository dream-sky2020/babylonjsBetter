import type { TexturePackerAtlas } from '@/core/sprite/editor/spriteAnchorEditorHelpers.ts';
import type { AtlasBundle } from '@/core/sprite/composition/createCompositeSprite.ts';
import { collectRigAtlasJsonPaths } from '@/core/sprite/composition/resolvePartAtlas.ts';
import { loadTexturePackerAtlas } from '@/core/sprite/atlas/normalizeTexturePackerAtlas.ts';
import type { SpriteRigDef } from '@/core/sprite/types/sprite-animation.types.ts';

export const loadRigAtlases = async (rig: SpriteRigDef): Promise<AtlasBundle> => {
  const paths = collectRigAtlasJsonPaths(rig);
  if (paths.length === 0) {
    throw new Error(`Rig ${rig.rigId} 未配置任何图集`);
  }
  const entries = await Promise.all(
    paths.map(async (path) => {
      const atlas = await loadTexturePackerAtlas(path);
      return [path, atlas] as const;
    })
  );
  const bundle: AtlasBundle = {};
  for (const [path, atlas] of entries) {
    bundle[path] = atlas;
  }
  return bundle;
};

export const getAtlasFrameNames = (atlas: TexturePackerAtlas | undefined): string[] => {
  if (!atlas) return [];
  return Object.keys(atlas.frames).sort((a, b) => a.localeCompare(b, 'zh-CN'));
};
