import { baseSpriteModule } from '../modules/baseSprite.module.ts';
import { stripeModule } from '../modules/stripe.module.ts';
import { colorOverlayModule } from '../modules/colorOverlay.module.ts';
import type { SpriteShaderRecipe } from '../composer/shaderModule.types.ts';

export const normalSpriteRecipe: SpriteShaderRecipe = {
  id: 'normal-sprite',
  modules: [baseSpriteModule, stripeModule, colorOverlayModule]
};
