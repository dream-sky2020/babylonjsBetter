import type {
  SpriteAnimClip,
  SpriteAnimationLibrary,
  SpriteRigDef
} from '@/core/sprite/types/sprite-animation.types.ts';
import {
  readAnimationLibraryConfigJson,
  writeAnimationLibraryConfigJsonInDevServer
} from '@/core/sprite/animation/spriteAnimationApi.ts';
import {
  createDefaultDemoClip,
  createDefaultDemoRig,
  createEmptyAnimationLibrary,
  sanitizeAnimationLibrary,
  sanitizeClip,
  sanitizeRig,
  validateAnimationLibrary
} from '@/core/sprite/animation/spriteAnimationValidation.ts';

let libraryCache: SpriteAnimationLibrary = createEmptyAnimationLibrary();
let hydrated = false;

export const hydrateSpriteAnimationLibrary = async (): Promise<void> => {
  if (hydrated) return;
  libraryCache = await readAnimationLibraryConfigJson();
  hydrated = true;
};

export const reloadSpriteAnimationLibrary = async (): Promise<void> => {
  libraryCache = await readAnimationLibraryConfigJson();
  hydrated = true;
};

export const getSpriteAnimationLibrary = (): SpriteAnimationLibrary => {
  const sanitized = sanitizeAnimationLibrary(libraryCache);
  if (Object.keys(sanitized.rigs).length === 0) {
    const demoRig = createDefaultDemoRig();
    const demoClip = createDefaultDemoClip(demoRig.rigId);
    sanitized.rigs[demoRig.rigId] = demoRig;
    sanitized.clips[demoClip.clipId] = demoClip;
  }
  return sanitized;
};

export const getSpriteRig = (rigId: string): SpriteRigDef | null => {
  return getSpriteAnimationLibrary().rigs[rigId] ?? null;
};

export const getSpriteAnimClip = (clipId: string): SpriteAnimClip | null => {
  return getSpriteAnimationLibrary().clips[clipId] ?? null;
};

export const listSpriteRigs = (): SpriteRigDef[] => Object.values(getSpriteAnimationLibrary().rigs);

export const listSpriteAnimClips = (rigId?: string): SpriteAnimClip[] => {
  const clips = Object.values(getSpriteAnimationLibrary().clips);
  return rigId ? clips.filter((clip) => clip.rigId === rigId) : clips;
};

export const saveSpriteAnimationLibrary = async (
  library: SpriteAnimationLibrary
): Promise<void> => {
  if (!hydrated) await hydrateSpriteAnimationLibrary();
  const sanitized = sanitizeAnimationLibrary(library);
  const errors = validateAnimationLibrary(sanitized);
  if (errors.length > 0) {
    throw new Error(`配置校验失败：${errors[0]}`);
  }
  libraryCache = sanitized;
  await writeAnimationLibraryConfigJsonInDevServer(sanitized);
};

export const saveSpriteRig = async (rig: SpriteRigDef): Promise<void> => {
  const library = getSpriteAnimationLibrary();
  const next = sanitizeRig(rig, rig.rigId);
  library.rigs[next.rigId] = next;
  await saveSpriteAnimationLibrary(library);
};

export const saveSpriteAnimClip = async (clip: SpriteAnimClip): Promise<void> => {
  const library = getSpriteAnimationLibrary();
  const next = sanitizeClip(clip, clip.clipId);
  library.clips[next.clipId] = next;
  await saveSpriteAnimationLibrary(library);
};

export const removeSpriteRig = async (rigId: string): Promise<void> => {
  const library = getSpriteAnimationLibrary();
  delete library.rigs[rigId];
  for (const [clipId, clip] of Object.entries(library.clips)) {
    if (clip.rigId === rigId) delete library.clips[clipId];
  }
  await saveSpriteAnimationLibrary(library);
};

export const removeSpriteAnimClip = async (clipId: string): Promise<void> => {
  const library = getSpriteAnimationLibrary();
  delete library.clips[clipId];
  await saveSpriteAnimationLibrary(library);
};
