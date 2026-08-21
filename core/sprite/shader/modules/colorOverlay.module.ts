import type { SpriteShaderModule } from '../composer/shaderModule.types.ts';

export const colorOverlayModule: SpriteShaderModule = {
  id: 'color-overlay',
  requires: ['base-sprite', 'stripe'],
  uniforms: ['uMySpriteOverlayColor', 'uMySpriteOverlayAlpha'],
  fragment: {
    declarations: `
      #include<mySpriteColorOverlay>
      uniform vec3 uMySpriteOverlayColor;
      uniform float uMySpriteOverlayAlpha;
    `,
    modifyColor: 'colorOut = mySpriteApplyColorOverlay(colorOut, uMySpriteOverlayColor, uMySpriteOverlayAlpha);'
  }
};
