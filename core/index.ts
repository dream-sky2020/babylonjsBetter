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
export * from './camera/battleCamera.core.ts';
export * from './types/battle.types';
export * from './ui';
