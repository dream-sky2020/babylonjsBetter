import { SHADER_NOISE, type SpriteAshShaderDefinition } from './spriteAshShader.types';

export const spriteNoiseErodeShader: Omit<SpriteAshShaderDefinition, 'mode' | 'variant'> = {
  shaderName: 'spriteNoiseErode',
  subdivisions: 72,
  vertexSource: `
    precision highp float;
    attribute vec3 position; attribute vec2 uv;
    uniform mat4 worldViewProjection;
    uniform float uTime,uProgress,uRise,uDriftX,uTurbulence,uSeed,uVariant;
    varying vec2 vUV; varying float vMotion;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+uSeed)*43758.5453);}
    void main(){
      vUV=uv; vec3 p=position;
      float motion=smoothstep(0.,1.,uProgress*1.2-uv.y*.25);
      float wave=sin(uv.y*12.+uTime*3.+hash(floor(uv*14.))*6.2831);
      if(uVariant<.5){
        p.x+=uDriftX*motion+wave*uTurbulence*motion*(.25+uv.y);
        p.y+=uRise*motion*motion+cos(uv.x*10.-uTime*2.)*uTurbulence*motion*.35;
      }else if(uVariant<1.5){
        p.z+=(hash(floor(uv*vec2(20.,26.)))-.5)*uTurbulence*smoothstep(.15,.8,uProgress)*.2;
      }else if(uVariant<2.5){
        vec2 c=uv-.5; float pull=smoothstep(0.,.75,uProgress-length(c)*.55);
        float a=pull*pull*1.8,cs=cos(a),sn=sin(a); vec2 spun=mat2(cs,-sn,sn,cs)*c;
        p.xy+=(spun-c)*pull; p.z-=uTurbulence*pull*sin(length(c)*30.-uTime*4.); motion=pull;
      }
      vMotion=motion; gl_Position=worldViewProjection*vec4(p,1.);
    }`,
  fragmentSource: `
    precision highp float;
    varying vec2 vUV; varying float vMotion;
    uniform sampler2D uTexture;
    uniform float uTime,uProgress,uDirectionAngle,uNoiseScale,uNoiseStrength,uNoiseSpeed,uEdgeWidth,uEdgeSoftness,uEdgeIntensity,uCharStrength,uAshTrail,uAshDensity,uAshOpacity,uFlickerSpeed,uSeed,uAlphaCutoff,uVariant;
    uniform vec3 uEdgeColor,uCharColor,uAshColor;
    ${SHADER_NOISE}
    void main(){
      vec4 source=texture2D(uTexture,vUV); if(source.a<uAlphaCutoff)discard;
      if(uProgress<=.001){gl_FragColor=source;return;}
      vec2 axis=vec2(cos(uDirectionAngle),sin(uDirectionAngle));
      vec2 animatedUv=vUV*uNoiseScale+vec2(uTime*uNoiseSpeed,-uTime*uNoiseSpeed*.63);
      float crystal=abs(noise(vUV*uNoiseScale*2.)-noise(vUV.yx*uNoiseScale*2.+8.));
      float field=dot(vUV-.5,axis)+.5+(fbm(animatedUv)-.5)*uNoiseStrength;
      if(uVariant>.5&&uVariant<1.5)field+=crystal*.22;
      if(uVariant>1.5&&uVariant<2.5){vec2 c=vUV-.5;float r=length(c)*1.42;float spiral=sin(atan(c.y,c.x)*7.-uTime*2.5+r*18.)*.045;field=1.-r+spiral+(fbm(animatedUv)-.5)*uNoiseStrength;}
      float margin=.12+uNoiseStrength*.55;
      float threshold=mix(-margin,1.+margin,clamp(uProgress,0.,1.));
      float d=field-threshold;
      float remain=smoothstep(-uEdgeSoftness,uEdgeSoftness,d);
      float edge=(1.-smoothstep(uEdgeWidth,uEdgeWidth+uEdgeSoftness,d))*remain;
      float nearFront=smoothstep(-uEdgeWidth*4.,uEdgeWidth*3.,d)*(1.-smoothstep(uEdgeWidth*3.,uEdgeWidth*15.,d));
      float detail=uVariant>.5&&uVariant<1.5?smoothstep(.08,.0,abs(crystal-.16))*nearFront:0.;
      float charBand=(1.-smoothstep(uEdgeWidth*3.2,uEdgeWidth*5.5,d))*remain;
      float trailPos=clamp(-d/max(.001,uAshTrail),0.,1.);
      float trail=(1.-remain)*(1.-smoothstep(.72,1.,trailPos));
      float speck=trail*step(1.-uAshDensity,hash(floor((vUV+vec2(vMotion*uTime*.02,0.))*uNoiseScale*5.)))*(1.-trailPos);
      float flicker=.82+.18*sin(uTime*uFlickerSpeed+fbm(vUV*13.)*12.);
      vec3 alive=mix(source.rgb,uCharColor,clamp(charBand*uCharStrength+detail*.42,0.,1.));
      alive+=uEdgeColor*(edge*uEdgeIntensity*flicker+detail*.65);
      float aliveAlpha=source.a*remain,trailAlpha=uVariant<.5?source.a*speck*uAshOpacity:0.;
      float alpha=max(aliveAlpha,trailAlpha)*(1.-smoothstep(.96,1.,uProgress));
      vec3 color=mix(alive,uAshColor,clamp(trailAlpha/(aliveAlpha+trailAlpha+.0001),0.,1.));
      if(alpha<uAlphaCutoff)discard; gl_FragColor=vec4(color,alpha);
    }`
};
