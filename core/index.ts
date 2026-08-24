/**
 * Core entry.
 * 跨 feature 能力从这里导出；精灵 / 粒子请分别用 `@/core/sprite`、`@/core/particle`，
 * 避免 star-export 同名符号冲突。
 */
export * from './tracking/cameraUtils';
export * from './tracking/UiTracker';
export * from './tracking/UiTrackerManager';
export * from './scene/createSpriteAnchorEditorScene';
export * from './scene/createParticleEditorScene';
export * from './scene/createBattleScene';
export * from './scene/createCameraLabScene';
export * from './camera/battleCamera.core.ts';
export * from './camera/cameraLabController.ts';
export * from './types/battle.types';
export * from './effects';
export * from './ui';
export * from './effects';
export * from './special-status';
export * from './battlefield';
export * from './map';
