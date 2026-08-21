import { SPRITE_PROGRESS_GLSL } from '@/core/sprite/progress/spriteProgress.glsl.ts';
import type { SpriteShaderModule } from '../composer/shaderModule.types.ts';

export const stripeModule: SpriteShaderModule = {
  id: 'stripe',
  requires: ['base-sprite'],
  samplers: ['uStripeTexture'],
  uniforms: [
    'uSolidColor','uSolidAlpha','uBackgroundColor','uBackgroundAlpha','uUseSolid','uAngleRad','uSpeed','uPatternPeriodPx',
    'uProgressEnabled','uProgress','uProgressShape','uProgressDirection','uProgressAngleRad','uProgressStartAngleRad','uProgressSweepAngleRad','uProgressInnerRadius','uProgressOuterRadius','uProgressSoftness','uProgressCenterOffsetPx','uProgressAxisScale','uFilledUseTexture','uFilledColor','uFilledOpacity','uUnfilledUseTexture','uUnfilledColor','uUnfilledOpacity',
    'uLayerProgressEnabled','uStripeProgressEnabled','uStripeProgress','uStripeProgressShape','uStripeProgressDirection','uStripeProgressAngleRad','uStripeProgressStartAngleRad','uStripeProgressSweepAngleRad','uStripeProgressInnerRadius','uStripeProgressOuterRadius','uStripeProgressSoftness','uStripeProgressCenterOffsetPx','uStripeProgressAxisScale','uStripeFilledUseTexture','uStripeFilledColor','uStripeFilledOpacity','uStripeUnfilledUseTexture','uStripeUnfilledColor','uStripeUnfilledOpacity',
    'uBackgroundProgressEnabled','uBackgroundProgress','uBackgroundProgressShape','uBackgroundProgressDirection','uBackgroundProgressAngleRad','uBackgroundProgressStartAngleRad','uBackgroundProgressSweepAngleRad','uBackgroundProgressInnerRadius','uBackgroundProgressOuterRadius','uBackgroundProgressSoftness','uBackgroundProgressCenterOffsetPx','uBackgroundProgressAxisScale','uBackgroundFilledUseTexture','uBackgroundFilledColor','uBackgroundFilledOpacity','uBackgroundUnfilledUseTexture','uBackgroundUnfilledColor','uBackgroundUnfilledOpacity'
  ],
  fragment: {
    declarations: '#include<mySpriteStripeMask>',
    functions: SPRITE_PROGRESS_GLSL
  }
};
