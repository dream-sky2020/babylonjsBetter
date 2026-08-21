import { baseSpriteModule } from '../modules/baseSprite.module.ts';
import { stripeModule } from '../modules/stripe.module.ts';
import { colorOverlayModule } from '../modules/colorOverlay.module.ts';
import { noiseErodeModule } from '../modules/noiseErode.module.ts';
import type { SpriteShaderRecipe } from '../composer/shaderModule.types.ts';

/** Monster 基础材质使用此 Recipe；noiseErode 常驻，平时由 enabled=0 关闭。 */
export const stripedSpriteRecipe: SpriteShaderRecipe = {
  id: 'striped-sprite',
  modules: [baseSpriteModule, stripeModule, colorOverlayModule, noiseErodeModule]
};
