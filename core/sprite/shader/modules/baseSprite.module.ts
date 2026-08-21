import type { SpriteShaderModule } from '../composer/shaderModule.types.ts';

export const baseSpriteModule: SpriteShaderModule = {
  id: 'base-sprite',
  attributes: ['position', 'uv'],
  uniforms: ['worldViewProjection', 'uTime', 'uRenderSizePx', 'uUseMask'],
  samplers: ['uMaskTexture'],
  fragment: {
    declarations: `
      #include<mySpriteAlphaSampling>
      #include<mySpriteColorUtils>
      #include<mySpriteAtlasSampling>
    `
  }
};
