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

// render
export { createAtlasSpritePlane } from '@/core/sprite/render/createAtlasSpritePlane.ts';

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
