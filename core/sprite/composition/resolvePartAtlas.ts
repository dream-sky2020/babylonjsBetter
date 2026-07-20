import type { SpritePartDef, SpriteRigDef } from '@/core/sprite/types/sprite-animation.types.ts';
import { normalizePublicPath } from '@/core/sprite/editor/spriteAnchorEditorHelpers.ts';

export type ResolvedPartAtlas = {
  atlasJsonPath: string;
  atlasImagePath: string;
};

/** 解析部件实际使用的图集路径（部件覆盖 > rig 默认） */
export const resolvePartAtlas = (rig: SpriteRigDef, part: SpritePartDef): ResolvedPartAtlas => {
  const atlasJsonPath = normalizePublicPath(part.atlasJsonPath || rig.atlasJsonPath || '');
  const atlasImagePath = normalizePublicPath(part.atlasImagePath || rig.atlasImagePath || '');
  return { atlasJsonPath, atlasImagePath };
};

/** 收集 rig 及其部件引用到的全部图集 JSON 路径 */
export const collectRigAtlasJsonPaths = (rig: SpriteRigDef): string[] => {
  const paths = new Set<string>();
  const root = normalizePublicPath(rig.atlasJsonPath || '');
  if (root) paths.add(root);
  for (const part of rig.parts) {
    const resolved = resolvePartAtlas(rig, part);
    if (resolved.atlasJsonPath) paths.add(resolved.atlasJsonPath);
  }
  return [...paths];
};
