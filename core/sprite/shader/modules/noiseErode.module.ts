import type { SpriteShaderModule } from '../composer/shaderModule.types.ts';

export type SpriteNoiseErodePattern = 'ash' | 'frost' | 'void';
export type SpriteNoiseErodeOptions = {
  enabled?: boolean; progress?: number; pattern?: SpriteNoiseErodePattern;
  directionAngleDeg?: number; noiseScale?: number; noiseStrength?: number; noiseSpeed?: number;
  edgeWidth?: number; edgeSoftness?: number; edgeColor?: string; edgeIntensity?: number;
  charColor?: string; charStrength?: number; seed?: number;
};

export const spriteNoiseErodePatternValue = (pattern: SpriteNoiseErodePattern = 'ash') => pattern === 'frost' ? 1 : pattern === 'void' ? 2 : 0;

export const noiseErodeModule: SpriteShaderModule = {
  id: 'noiseErode',
  requires: ['base-sprite', 'stripe', 'color-overlay'],
  uniforms: ['uMySpriteNoiseErodeEnabled','uMySpriteNoiseErodeProgress','uMySpriteNoiseErodePattern','uMySpriteNoiseErodeAngle','uMySpriteNoiseErodeScale','uMySpriteNoiseErodeStrength','uMySpriteNoiseErodeSpeed','uMySpriteNoiseErodeEdgeWidth','uMySpriteNoiseErodeEdgeSoftness','uMySpriteNoiseErodeEdgeColor','uMySpriteNoiseErodeEdgeIntensity','uMySpriteNoiseErodeCharColor','uMySpriteNoiseErodeCharStrength','uMySpriteNoiseErodeSeed'],
  fragment: {
  declarations: `
    #include<mySpriteHashNoise>
    #include<mySpriteDirectionalField>
    #include<mySpriteFrostField>
    #include<mySpriteVoidField>
    #include<mySpriteEdgeBand>
    uniform float uMySpriteNoiseErodeEnabled,uMySpriteNoiseErodeProgress,uMySpriteNoiseErodePattern,uMySpriteNoiseErodeAngle,uMySpriteNoiseErodeScale,uMySpriteNoiseErodeStrength,uMySpriteNoiseErodeSpeed,uMySpriteNoiseErodeEdgeWidth,uMySpriteNoiseErodeEdgeSoftness,uMySpriteNoiseErodeEdgeIntensity,uMySpriteNoiseErodeCharStrength,uMySpriteNoiseErodeSeed;
    uniform vec3 uMySpriteNoiseErodeEdgeColor,uMySpriteNoiseErodeCharColor;
  `,
  functions: `
    vec2 mySpriteNoiseErodeUv(vec2 uv,float enabled,float progress,float pattern,float time,float seed){
      if(enabled<.5||progress<=.001||pattern<1.5)return uv;
      return mySpriteVoidUv(uv,enabled,progress,time,seed);
    }
    float mySpriteNoiseErodeField(vec2 uv,float pattern,float angle,float scale,float strength,float time,float speed,float seed){
      vec2 axis=vec2(cos(angle),sin(angle));float grain=mySpriteFbm(uv*max(1.,scale)+axis*time*speed+seed*.173);
      if(pattern<.5)return mySpriteDirectionalField(uv,axis,grain,strength);
      if(pattern<1.5)return mySpriteFrostField(uv,grain,scale);
      return mySpriteVoidField(uv,scale,seed);
    }
  `,
  afterSample: `mySpriteSourceUv=mySpriteNoiseErodeUv(vUV,uMySpriteNoiseErodeEnabled,uMySpriteNoiseErodeProgress,uMySpriteNoiseErodePattern,uTime,uMySpriteNoiseErodeSeed);sourceSample=mySpriteSampleAtlas(uMaskTexture,mySpriteSourceUv);`,
  modifyField: `
    if(uMySpriteNoiseErodeEnabled>.5&&uMySpriteNoiseErodeProgress>.001){
      float f=mySpriteNoiseErodeField(vUV,uMySpriteNoiseErodePattern,uMySpriteNoiseErodeAngle,uMySpriteNoiseErodeScale,uMySpriteNoiseErodeStrength,uTime,uMySpriteNoiseErodeSpeed,uMySpriteNoiseErodeSeed);
      float soft=max(.001,uMySpriteNoiseErodeEdgeSoftness);float threshold=clamp(uMySpriteNoiseErodeProgress*1.28-.14,-.14,1.14);
      float remain=smoothstep(threshold-soft,threshold+soft,f);
      float edge=mySpriteEdgeBand(f,threshold,uMySpriteNoiseErodeEdgeWidth,soft);
      float charBand=(1.-remain)*smoothstep(threshold,threshold+uMySpriteNoiseErodeEdgeWidth*1.8,f);
      colorOut=mix(colorOut,uMySpriteNoiseErodeCharColor,charBand*uMySpriteNoiseErodeCharStrength);colorOut+=uMySpriteNoiseErodeEdgeColor*edge*uMySpriteNoiseErodeEdgeIntensity;alphaOut*=remain;
    }
  `
  }
};
