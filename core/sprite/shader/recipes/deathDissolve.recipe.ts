import { baseSpriteModule } from '../modules/baseSprite.module.ts';
import { stripeModule } from '../modules/stripe.module.ts';
import { colorOverlayModule } from '../modules/colorOverlay.module.ts';
import { noiseErodeModule } from '../modules/noiseErode.module.ts';
import type { SpriteShaderRecipe } from '../composer/shaderModule.types.ts';

/** 供独立死亡预览使用；Monster 不会在死亡瞬间切换到此 Recipe。 */
export const deathDissolveRecipe: SpriteShaderRecipe = {
  id: 'death-dissolve',
  modules: [baseSpriteModule, stripeModule, colorOverlayModule, noiseErodeModule]
};
