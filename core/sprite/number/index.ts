export type {
  NumberSprite,
  NumberSpriteAlignment,
  NumberSpriteGlyphSource,
  NumberSpritePreset,
  NumberSpritePresetMap
} from './numberSprite.types.ts';
export { createNumberSprite } from './createNumberSprite.ts';
export {
  NUMBER_SPRITE_CONFIG_URL,
  getNumberSpritePreset,
  getNumberSpritePresets,
  loadNumberSpritePresets,
  normalizeNumberSpritePresets
} from './numberSpriteRepository.ts';
