/**
 * Sprite feature 唯一导出入口。
 * 业务层请统一：import { ... } from '@/core/sprite'
 */

// types
export type {
  SpriteFrameRegion,
  IconPlaneController
} from '@/core/sprite/types/sprite.types.ts';
export type {
  NormalizedUv,
  SpriteBodyBounds,
  SpriteAnchorPoints,
  SpriteAtlasFrameMeta,
  SpriteAnchorPreset,
  SpriteAnchorPresetMap,
  SpritePresetSource
} from '@/core/sprite/types/sprite-anchors.types.ts';

// entity
export type { SpriteEntity } from '@/core/sprite/entity/createSpriteEntity.ts';
export { createSpriteEntity } from '@/core/sprite/entity/createSpriteEntity.ts';
export {
  uvToNormalizedAnchor,
  getBodyAxisAlignedAnchorUv,
  uvToPlaneLocal
} from '@/core/sprite/entity/anchors.ts';

// types — animation
export type {
  SpriteTransform2D,
  SpritePartPose,
  SpritePartDef,
  SpriteRigDef,
  SpriteAnimKeyframe,
  SpriteAnimClip,
  SpriteAnimationLibrary,
  CurveChannel
} from '@/core/sprite/types/sprite-animation.types.ts';
export { DEFAULT_SPRITE_TRANSFORM } from '@/core/sprite/types/sprite-animation.types.ts';

// render
export { createAtlasSpritePlane } from '@/core/sprite/render/createAtlasSpritePlane.ts';
export type { CreateAtlasSpritePlaneOptions } from '@/core/sprite/render/createAtlasSpritePlane.ts';
export {
  acquireSharedAtlasTexture,
  releaseSharedAtlasTexture,
  clearSharedAtlasTextureCache
} from '@/core/sprite/render/sharedAtlasTexture.ts';

// atlas
export {
  normalizeTexturePackerAtlas,
  loadTexturePackerAtlas
} from '@/core/sprite/atlas/normalizeTexturePackerAtlas.ts';

// composition
export type {
  AtlasBundle,
  CompositeSprite,
  CompositeSpritePart,
  CreateCompositeSpriteOptions
} from '@/core/sprite/composition/createCompositeSprite.ts';
export { createCompositeSprite } from '@/core/sprite/composition/createCompositeSprite.ts';
export type { ResolvedPartAtlas } from '@/core/sprite/composition/resolvePartAtlas.ts';
export {
  resolvePartAtlas,
  collectRigAtlasJsonPaths
} from '@/core/sprite/composition/resolvePartAtlas.ts';
export { loadRigAtlases, getAtlasFrameNames } from '@/core/sprite/atlas/loadRigAtlases.ts';

// animation runtime
export {
  evaluateSpriteAnimClip,
  getClipDuration
} from '@/core/sprite/animation/evaluateSpriteAnimClip.ts';
export type { SpriteAnimPlayer, SpriteAnimPlayerState } from '@/core/sprite/animation/createSpriteAnimPlayer.ts';
export { createSpriteAnimPlayer } from '@/core/sprite/animation/createSpriteAnimPlayer.ts';

// onion skin
export type {
  OnionSkinMode,
  OnionSkinSettings,
  OnionSkinSample
} from '@/core/sprite/animation/onionSkinSamples.ts';
export {
  DEFAULT_ONION_SKIN_SETTINGS,
  computeOnionSkinSamples
} from '@/core/sprite/animation/onionSkinSamples.ts';
export type { OnionSkinController } from '@/core/sprite/animation/createOnionSkinController.ts';
export { createOnionSkinController } from '@/core/sprite/animation/createOnionSkinController.ts';

// animation library
export type { SpriteAnimationValidationReport } from '@/core/sprite/animation/spriteAnimationValidation.ts';
export {
  sanitizeAnimationLibrary,
  validateAnimationLibrary,
  createEmptyAnimationLibrary,
  createDefaultDemoRig,
  createDefaultDemoClip,
  sanitizeRig,
  sanitizeClip
} from '@/core/sprite/animation/spriteAnimationValidation.ts';
export {
  fetchSpriteAnimationServerConnection,
  fetchSpriteAnimationValidationReport
} from '@/core/sprite/animation/spriteAnimationApi.ts';
export {
  hydrateSpriteAnimationLibrary,
  reloadSpriteAnimationLibrary,
  getSpriteAnimationLibrary,
  getSpriteRig,
  getSpriteAnimClip,
  listSpriteRigs,
  listSpriteAnimClips,
  saveSpriteAnimationLibrary,
  saveSpriteRig,
  saveSpriteAnimClip,
  removeSpriteRig,
  removeSpriteAnimClip
} from '@/core/sprite/animation/spriteAnimationRepository.ts';

// debug
export { drawSpriteDebugOverlay } from '@/core/sprite/debug/drawSpriteDebugOverlay.ts';

// preset keys
export {
  normalizeTexturePath,
  parseSpritePresetKey,
  toSpritePresetKey,
  resolvePresetIdentity
} from '@/core/sprite/preset/spritePresetKeys.ts';

// preset validation
export type { SpritePresetValidationReport } from '@/core/sprite/preset/spritePresetValidation.ts';

// preset api
export {
  fetchSpritePresetServerConnection,
  fetchSpritePresetValidationReport
} from '@/core/sprite/preset/spritePresetApi.ts';

// preset repository
export {
  hydrateSpriteAnchorPresetStorage,
  reloadSpriteAnchorPresetStorage,
  saveSpriteAnchorPreset,
  removeSpriteAnchorPreset,
  getLocalSpriteAnchorPreset,
  hasLocalSpriteAnchorPreset,
  getAllSpriteAnchorPresets,
  getSpriteAnchorPreset
} from '@/core/sprite/preset/spritePresetRepository.ts';

// editor helpers（锚点编辑器专用；INPUT_STEP / normalizePublicPath 仅从此域使用）
export type {
  DragTarget,
  TexturePackerFrameRaw,
  TexturePackerAtlas
} from '@/core/sprite/editor/spriteAnchorEditorHelpers.ts';
export {
  RESOURCE_IMAGE_MODULES,
  RESOURCE_ATLAS_PATHS,
  LAST_ATLAS_JSON_STORAGE_KEY,
  LAST_EDITOR_MODE_STORAGE_KEY,
  DEFAULT_ORTHO_SIZE,
  MIN_ORTHO_SIZE,
  MAX_ORTHO_SIZE,
  ZOOM_STEP,
  DRAG_HIT_RADIUS_UV,
  DEFAULT_ATLAS_JSON_PATH,
  INPUT_STEP,
  ANCHOR_MIN,
  ANCHOR_MAX,
  BOUNDS_MIN,
  BOUNDS_MAX,
  normalizePublicPath,
  DEFAULT_SCANNED_ATLAS_OPTIONS,
  clamp01,
  clamp,
  toFixedNumber,
  joinPublicPath,
  getLastAtlasJsonPath,
  saveLastAtlasJsonPath,
  getLastEditorMode,
  saveLastEditorMode,
  toFrameRegion,
  createEditablePreset,
  getPresetSourceLabel
} from '@/core/sprite/editor/spriteAnchorEditorHelpers.ts';

// editor helpers — animation
export {
  SPRITE_ANIM_LAST_RIG_KEY,
  SPRITE_ANIM_LAST_CLIP_KEY,
  SPRITE_ANIM_DEFAULT_ORTHO_SIZE,
  SPRITE_ANIM_MIN_ORTHO_SIZE,
  SPRITE_ANIM_MAX_ORTHO_SIZE,
  SPRITE_ANIM_ZOOM_STEP,
  getLastAnimRigId,
  saveLastAnimRigId,
  getLastAnimClipId,
  saveLastAnimClipId,
  createEmptyPart,
  createEmptyRig,
  createEmptyClip,
  upsertKeyframe,
  removeKeyframeAt,
  removeKeyframesAt,
  moveKeyframeTime,
  shiftKeyframesTime,
  samplePoseFromKeyframe,
  upsertPoseChannel
} from '@/core/sprite/editor/spriteAnimationEditorHelpers.ts';
