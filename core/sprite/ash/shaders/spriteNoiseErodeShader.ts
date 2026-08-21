import { SHADER_NOISE, type SpriteAshShaderDefinition } from './spriteAshShader.types';

export const spriteNoiseErodeShader: SpriteAshShaderDefinition = {
  shaderName: 'spriteNoiseErode',
  subdivisions: 12,
  vertexSource: `
    precision highp float;
    attribute vec3 position; attribute vec2 uv;
    uniform mat4 worldViewProjection;
    uniform float uTime,uProgress,uRise,uDriftX,uTurbulence,uSeed,uVoidPullStrength,uVoidPullRadius,uVoidPullFalloff,uVoidPullPower,uSpiralStrength,uSpiralTurns,uSpiralDirection,uRadialRotation,uProgressPower,uStartHold;
    uniform float uVertexDeformStrength,uVertexBendX,uVertexBendY,uVertexTwist,uVertexBulge,uVertexDepth,uVertexWaveStrength,uVertexWaveScale,uVertexWaveSpeed,uVertexAnchorY;
    uniform vec2 uCenter,uRadialScale;
    varying vec2 vUV; varying float vMotion;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+uSeed)*43758.5453);}
    void main(){
      vUV=uv; vec3 p=position;float curveP=pow(clamp((uProgress-uStartHold)/max(.001,1.-uStartHold),0.,1.),max(.1,uProgressPower));
      float motion=smoothstep(0.,1.,curveP*1.2-uv.y*.25);
      float wave=sin(uv.y*12.+uTime*3.+hash(floor(uv*14.))*6.2831);
      p.x+=uDriftX*motion+wave*uTurbulence*motion*(.25+uv.y);
      p.y+=uRise*motion*motion+cos(uv.x*10.-uTime*2.)*uTurbulence*motion*.35;
      vec2 center=vec2(uCenter.x,uCenter.y)*.5;
      vec2 c=uv-.5-center;float rcs=cos(uRadialRotation),rsn=sin(uRadialRotation);vec2 rp=mat2(rcs,-rsn,rsn,rcs)*c/max(vec2(.1),uRadialScale);
      float inner=max(0.,uVoidPullRadius-uVoidPullFalloff),spatial=1.-smoothstep(inner,uVoidPullRadius,length(rp));
      float pull=pow(curveP,max(.1,uVoidPullPower))*spatial*uVoidPullStrength;
      float a=pull*pull*uSpiralStrength*max(.25,uSpiralTurns)*uSpiralDirection,cs=cos(a),sn=sin(a);
      vec2 spun=mat2(cs,-sn,sn,cs)*c;p.xy+=(spun-c)*pull;p.z-=uTurbulence*pull*sin(length(c)*30.-uTime*4.);
      float anchorWeight=clamp((uv.y-uVertexAnchorY)/max(.001,1.-uVertexAnchorY),0.,1.);float deform=curveP*uVertexDeformStrength*anchorWeight;
      vec2 local=p.xy;local.x+=uVertexBendX*local.y*local.y*deform;local.y+=uVertexBendY*local.x*local.x*deform;
      float twistAngle=uVertexTwist*deform,twc=cos(twistAngle),tws=sin(twistAngle);local=mat2(twc,-tws,tws,twc)*local;
      float centerWeight=max(0.,1.-length(c)*1.42);local*=1.+uVertexBulge*centerWeight*deform;p.xy=local;
      float vertexWave=sin((uv.x+uv.y)*uVertexWaveScale+uTime*uVertexWaveSpeed+uSeed)*uVertexWaveStrength;
      p.z+=(uVertexDepth*centerWeight+vertexWave)*deform;
      vMotion=max(motion,pull);gl_Position=worldViewProjection*vec4(p,1.);
    }`,
  fragmentSource: `
    precision highp float;
    varying vec2 vUV; varying float vMotion;
    uniform sampler2D uTexture;
    uniform float uTime,uProgress,uDirectionAngle,uNoiseScale,uNoiseStrength,uNoiseSpeed,uEdgeWidth,uEdgeSoftness,uEdgeIntensity,uEdgeInnerWidth,uEdgeOuterWidth,uEdgeFalloffPower,uEdgeNoiseStrength,uEdgeNoiseScale,uEdgePulseStrength,uEdgePulseSpeed,uResidueWidth,uResidueOpacity,uResidueDensity,uResidueNoiseScale,uResidueDecayPower,uResidueFadeStart,uResidueGlow,uCharStrength,uAshTrail,uAshDensity,uAshOpacity,uFlickerSpeed,uSeed,uAlphaCutoff;
    uniform float uNoiseDetail,uNoiseRoughness,uNoiseAspect,uNoiseRotation,uNoiseFlowAngle,uWarpStrength,uWarpScale,uWarpSpeed;
    uniform float uDirectionalStrength,uRadialStrength,uRadialDirection,uRadialRotation,uRadialPower,uRadialNoiseStrength,uRadialNoiseScale,uCrystalStrength,uCrystalScale,uCrystalSharpness,uCrystalAspect,uCrystalRotation,uCrystalCrackWidth,uCrystalJitter,uCrystalBranchStrength,uCrystalBranchScale,uSpiralStrength,uSpiralTurns,uSpiralSpeed,uSpiralDirection,uSpiralRadialFrequency,uVoidPullStrength,uVoidPullRadius,uVoidPullFalloff,uVoidPullPower;
    uniform float uProgressPower,uStartHold,uEndFade,uFieldBlendMode,uFieldInvert,uFieldContrast,uFieldOffset;
    uniform vec2 uCenter,uRadialScale;uniform vec3 uEdgeColor,uEdgeInnerColor,uEdgeOuterColor,uResidueColor,uCharColor,uAshColor;
    ${SHADER_NOISE}
    vec2 transformNoiseUv(vec2 uv){vec2 p=uv-.5;float cs=cos(uNoiseRotation),sn=sin(uNoiseRotation);p=mat2(cs,-sn,sn,cs)*p;p.x/=max(.1,uNoiseAspect);return p+.5;}
    float structuredFbm(vec2 p){
      float rough=mix(.25,.72,clamp(uNoiseRoughness,0.,1.)),detail=clamp(uNoiseDetail,0.,1.);float value=0.,weight=0.,a=.5;
      value+=noise(p)*a;weight+=a;p=p*2.03+17.13;a*=rough;
      float gate=smoothstep(0.,.34,detail);value+=noise(p)*a*gate;weight+=a*gate;p=p*2.03+17.13;a*=rough;
      gate=smoothstep(.25,.7,detail);value+=noise(p)*a*gate;weight+=a*gate;p=p*2.03+17.13;a*=rough;
      gate=smoothstep(.58,1.,detail);value+=noise(p)*a*gate;weight+=a*gate;return value/max(.0001,weight);
    }
    vec2 radialPoint(vec2 p){float cs=cos(uRadialRotation),sn=sin(uRadialRotation);return mat2(cs,-sn,sn,cs)*p/max(vec2(.1),uRadialScale);}
    float blendFields(float directional,float radial,float crystalField){
      float wd=clamp(uDirectionalStrength,0.,1.),wr=clamp(uRadialStrength,0.,1.),wc=clamp(uCrystalStrength,0.,1.);float total=max(.0001,wd+wr+wc);
      if(uFieldBlendMode<.5)return (directional*wd+radial*wr+crystalField*wc)/total;
      if(uFieldBlendMode<1.5)return clamp(directional*wd+radial*wr+crystalField*wc,0.,1.);
      if(uFieldBlendMode<2.5){float value=0.;if(wd>.001)value=max(value,directional*wd);if(wr>.001)value=max(value,radial*wr);if(wc>.001)value=max(value,crystalField*wc);return value;}
      if(uFieldBlendMode<3.5){float value=1.;if(wd>.001)value=min(value,mix(1.,directional,wd));if(wr>.001)value=min(value,mix(1.,radial,wr));if(wc>.001)value=min(value,mix(1.,crystalField,wc));return value;}
      return mix(1.,directional,wd)*mix(1.,radial,wr)*mix(1.,crystalField,wc);
    }
    void main(){
      float curveP=pow(clamp((uProgress-uStartHold)/max(.001,1.-uStartHold),0.,1.),max(.1,uProgressPower));
      vec2 center=vec2(.5)+uCenter*.5;vec2 c=vUV-center,rp=radialPoint(c);float r=pow(length(rp)*1.42,max(.1,uRadialPower));
      float inner=max(0.,uVoidPullRadius-uVoidPullFalloff),spatial=1.-smoothstep(inner,uVoidPullRadius,length(rp));
      float influence=pow(curveP,max(.1,uVoidPullPower))*spatial*uVoidPullStrength;
      float warpAngle=curveP*curveP*uSpiralStrength*2.8*uSpiralDirection*influence+noise(vUV*5.+uSeed+uTime*.02)*.12*influence;
      float cs=cos(warpAngle),sn=sin(warpAngle);vec2 sourceUv=mat2(cs,-sn,sn,cs)*c*(1.-curveP*.22*influence)+center;
      vec4 source=texture2D(uTexture,sourceUv);if(source.a<uAlphaCutoff)discard;
      if(curveP<=.001){gl_FragColor=source;return;}
      vec2 axis=vec2(cos(uDirectionAngle),sin(uDirectionAngle));
      vec2 flow=vec2(cos(uNoiseFlowAngle),sin(uNoiseFlowAngle));vec2 warpCoord=vUV*max(.25,uWarpScale)+flow*uTime*uWarpSpeed;
      vec2 warp=(vec2(noise(warpCoord+uSeed),noise(warpCoord.yx+uSeed+19.7))-.5)*uWarpStrength;
      vec2 warpedUv=vUV+warp;vec2 animatedUv=transformNoiseUv(warpedUv)*uNoiseScale+flow*uTime*uNoiseSpeed;
      float grain=structuredFbm(animatedUv);float directional=dot(vUV-.5,axis)+.5+(grain-.5)*uNoiseStrength;
      float radialGrain=structuredFbm(transformNoiseUv(warpedUv)*max(1.,uRadialNoiseScale)+uSeed*.271);
      float radial=mix(r,1.-r,clamp(uRadialDirection*.5+.5,0.,1.))+(radialGrain-.5)*uRadialNoiseStrength;
      float theta=atan(rp.y,rp.x);radial+=sin(theta*max(.1,uSpiralTurns)*uSpiralDirection-uTime*uSpiralSpeed+r*uSpiralRadialFrequency)*.075*uSpiralStrength;
      vec2 cp=warpedUv-.5;float ccs=cos(uCrystalRotation),csn=sin(uCrystalRotation);cp=mat2(ccs,-csn,csn,ccs)*cp;cp.x/=max(.1,uCrystalAspect);
      vec2 crystalCoord=cp*max(2.,uCrystalScale*.42);vec2 cell=floor(crystalCoord);crystalCoord+=(vec2(noise(cell+uSeed),noise(cell.yx+uSeed+37.1))-.5)*uCrystalJitter;
      vec2 crystalUv=abs(fract(crystalCoord+grain*.08)-vec2(.5));float crystalEdge=min(crystalUv.x,crystalUv.y);
      float crystalSoft=mix(.12,.012,clamp(uCrystalSharpness,0.,1.));float crystal=1.-smoothstep(uCrystalCrackWidth,uCrystalCrackWidth+crystalSoft,crystalEdge);
      vec2 branchUv=abs(fract(mat2(.7071,-.7071,.7071,.7071)*crystalCoord*max(.25,uCrystalBranchScale))-vec2(.5));float branchEdge=min(branchUv.x,branchUv.y);
      crystal=max(crystal,(1.-smoothstep(uCrystalCrackWidth*.55,uCrystalCrackWidth*.55+crystalSoft*.65,branchEdge))*uCrystalBranchStrength);
      float crystalFade=1.-smoothstep(.68,.94,curveP);float crystalField=clamp(grain*1.04+crystal*.24*crystalFade*(1.-grain),0.,1.);
      float field=blendFields(directional,radial,crystalField);field=mix(field,1.-field,clamp(uFieldInvert,0.,1.));field=(field-.5)*uFieldContrast+.5+uFieldOffset;
      float margin=.12+uNoiseStrength*.55;float threshold=mix(-margin,1.+margin,curveP);float d=field-threshold;
      float remain=smoothstep(-uEdgeSoftness,uEdgeSoftness,d);
      float edgeOffset=(noise(vUV*max(.25,uEdgeNoiseScale)+uSeed+uTime*.03)-.5)*uEdgeNoiseStrength*uEdgeWidth;float edgeD=max(0.,d+edgeOffset);
      float innerEdge=pow(clamp(1.-smoothstep(0.,max(.001,uEdgeWidth*uEdgeInnerWidth),edgeD),0.,1.),uEdgeFalloffPower)*remain;
      float fullEdge=pow(clamp(1.-smoothstep(0.,max(.001,uEdgeWidth*uEdgeOuterWidth),edgeD),0.,1.),uEdgeFalloffPower)*remain;
      float outerEdge=max(0.,fullEdge-innerEdge);float edgePulse=1.+sin(uTime*uEdgePulseSpeed+grain*6.2831)*uEdgePulseStrength;
      float nearFront=smoothstep(-uEdgeWidth*4.,uEdgeWidth*3.,d)*(1.-smoothstep(uEdgeWidth*3.,uEdgeWidth*15.,d));
      float detail=uCrystalStrength*smoothstep(.08,.0,abs(crystal-.16))*nearFront*crystalFade;
      float charBand=(1.-smoothstep(uEdgeWidth*3.2,uEdgeWidth*5.5,d))*remain;
      float trailPos=clamp(-d/max(.001,uAshTrail),0.,1.);float trail=(1.-remain)*(1.-smoothstep(.72,1.,trailPos));
      float speck=trail*step(1.-uAshDensity,hash(floor((vUV+vec2(vMotion*uTime*.02,0.))*uNoiseScale*5.)))*(1.-trailPos);
      float residueDistance=clamp(-d/max(.001,uResidueWidth),0.,1.);float residueGrain=noise(floor(vUV*max(.25,uResidueNoiseScale))+uSeed+53.7);
      float residueCoverage=smoothstep(1.-uResidueDensity-.08,1.-uResidueDensity+.08,residueGrain);float residueLife=1.-smoothstep(uResidueFadeStart,1.,uProgress);
      float residue=(1.-remain)*pow(max(0.,1.-residueDistance),uResidueDecayPower)*residueCoverage*residueLife;
      float flicker=.82+.18*sin(uTime*uFlickerSpeed+fbm(vUV*13.)*12.);
      vec3 alive=mix(source.rgb,uCharColor,clamp(charBand*uCharStrength+detail*.42,0.,1.));alive+=(uEdgeInnerColor*innerEdge+uEdgeOuterColor*outerEdge)*uEdgeIntensity*flicker*edgePulse+uEdgeColor*detail*.65;
      float aliveAlpha=source.a*remain,trailAlpha=source.a*speck*uAshOpacity,residueAlpha=source.a*residue*uResidueOpacity;float finalFade=1.-smoothstep(max(0.,1.-max(.0001,uEndFade)),1.,uProgress);float alpha=max(max(aliveAlpha,trailAlpha),residueAlpha)*finalFade;
      vec3 color=mix(alive,uAshColor,clamp(trailAlpha/(aliveAlpha+trailAlpha+.0001),0.,1.));color=mix(color,uResidueColor*(1.+uResidueGlow),clamp(residueAlpha/(aliveAlpha+trailAlpha+residueAlpha+.0001),0.,1.));if(alpha<uAlphaCutoff)discard;gl_FragColor=vec4(color,alpha);
    }`
};
