import type { SpriteShaderModule } from '../composer/shaderModule.types.ts';

export const baseSpriteModule: SpriteShaderModule = {
  id: 'base-sprite',
  attributes: ['position', 'uv'],
  uniforms: ['worldViewProjection', 'uTime', 'uRenderSizePx', 'uUseMask', 'uSpriteOpacity'],
  samplers: ['uMaskTexture'],
  fragment: {
    declarations: `
      uniform float uSpriteOpacity;
      #include<mySpriteAlphaSampling>
      #include<mySpriteColorUtils>
      #include<mySpriteAtlasSampling>
    `,
    beforeOutput: 'alphaOut *= uSpriteOpacity;'
  }
};
