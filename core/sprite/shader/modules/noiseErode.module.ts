import type { SpriteShaderModule } from '../composer/shaderModule.types.ts';

export type SpriteNoiseErodeOptions = {
  enabled?: boolean; progress?: number; directionalStrength?: number; directionAngleDeg?: number;
  progressPower?: number; startHold?: number; endFade?: number;
  fieldBlendMode?: 'weighted' | 'add' | 'max' | 'min' | 'multiply'; fieldInvert?: number; fieldContrast?: number; fieldOffset?: number;
  radialStrength?: number; radialDirection?: number; centerX?: number; centerY?: number;
  radialScaleX?: number; radialScaleY?: number; radialRotationDeg?: number; radialPower?: number; radialNoiseStrength?: number; radialNoiseScale?: number;
  crystalStrength?: number; crystalScale?: number; crystalSharpness?: number; crystalAspect?: number; crystalRotationDeg?: number;
  crystalCrackWidth?: number; crystalJitter?: number; crystalBranchStrength?: number; crystalBranchScale?: number;
  spiralStrength?: number; spiralTurns?: number; spiralSpeed?: number; spiralDirection?: number; spiralRadialFrequency?: number;
  voidPullStrength?: number; voidPullRadius?: number; voidPullFalloff?: number; voidPullPower?: number;
  noiseScale?: number; noiseStrength?: number; noiseSpeed?: number;
  noiseDetail?: number; noiseRoughness?: number; noiseAspect?: number; noiseRotationDeg?: number; noiseFlowAngleDeg?: number;
  warpStrength?: number; warpScale?: number; warpSpeed?: number;
  edgeWidth?: number; edgeSoftness?: number; edgeColor?: string; edgeIntensity?: number;
  edgeInnerWidth?: number; edgeOuterWidth?: number; edgeInnerColor?: string; edgeOuterColor?: string; edgeFalloffPower?: number;
  edgeNoiseStrength?: number; edgeNoiseScale?: number; edgePulseStrength?: number; edgePulseSpeed?: number;
  residueWidth?: number; residueOpacity?: number; residueColor?: string; residueDensity?: number; residueNoiseScale?: number;
  residueDecayPower?: number; residueFadeStart?: number; residueGlow?: number;
  vertexDeformStrength?: number; vertexBendX?: number; vertexBendY?: number; vertexTwist?: number; vertexBulge?: number;
  vertexDepth?: number; vertexWaveStrength?: number; vertexWaveScale?: number; vertexWaveSpeed?: number; vertexAnchorY?: number;
  vertexSubdivisions?: number;
  rise?: number; driftX?: number; turbulence?: number;
  ashColor?: string; ashTrail?: number; ashDensity?: number; ashOpacity?: number;
  flickerSpeed?: number; alphaCutoff?: number;
  charColor?: string; charStrength?: number; seed?: number;
};

export const spriteNoiseErodeBlendModeValue = (mode: SpriteNoiseErodeOptions['fieldBlendMode'] = 'weighted') =>
  mode === 'add' ? 1 : mode === 'max' ? 2 : mode === 'min' ? 3 : mode === 'multiply' ? 4 : 0;

export const noiseErodeModule: SpriteShaderModule = {
  id: 'noiseErode', requires: ['base-sprite', 'stripe', 'color-overlay'],
  uniforms: [
    'uMySpriteNoiseErodeEnabled','uMySpriteNoiseErodeProgress','uMySpriteNoiseErodeAngle','uMySpriteNoiseErodeScale','uMySpriteNoiseErodeStrength','uMySpriteNoiseErodeSpeed',
    'uMySpriteNoiseErodeDirectionalStrength','uMySpriteNoiseErodeRadialStrength','uMySpriteNoiseErodeRadialDirection','uMySpriteNoiseErodeCenter',
    'uMySpriteNoiseErodeRadialScale','uMySpriteNoiseErodeRadialRotation','uMySpriteNoiseErodeRadialPower','uMySpriteNoiseErodeRadialNoiseStrength','uMySpriteNoiseErodeRadialNoiseScale',
    'uMySpriteNoiseErodeCrystalStrength','uMySpriteNoiseErodeCrystalScale','uMySpriteNoiseErodeCrystalSharpness','uMySpriteNoiseErodeSpiralStrength','uMySpriteNoiseErodeSpiralTurns','uMySpriteNoiseErodeSpiralSpeed','uMySpriteNoiseErodeSpiralDirection','uMySpriteNoiseErodeSpiralRadialFrequency','uMySpriteNoiseErodeVoidPullStrength','uMySpriteNoiseErodeVoidPullRadius','uMySpriteNoiseErodeVoidPullFalloff','uMySpriteNoiseErodeVoidPullPower',
    'uMySpriteNoiseErodeCrystalAspect','uMySpriteNoiseErodeCrystalRotation','uMySpriteNoiseErodeCrystalCrackWidth','uMySpriteNoiseErodeCrystalJitter','uMySpriteNoiseErodeCrystalBranchStrength','uMySpriteNoiseErodeCrystalBranchScale',
    'uMySpriteNoiseErodeProgressPower','uMySpriteNoiseErodeStartHold','uMySpriteNoiseErodeEndFade','uMySpriteNoiseErodeFieldBlendMode','uMySpriteNoiseErodeFieldInvert','uMySpriteNoiseErodeFieldContrast','uMySpriteNoiseErodeFieldOffset',
    'uMySpriteNoiseErodeNoiseDetail','uMySpriteNoiseErodeNoiseRoughness','uMySpriteNoiseErodeNoiseAspect','uMySpriteNoiseErodeNoiseRotation','uMySpriteNoiseErodeNoiseFlowAngle','uMySpriteNoiseErodeWarpStrength','uMySpriteNoiseErodeWarpScale','uMySpriteNoiseErodeWarpSpeed',
    'uMySpriteNoiseErodeEdgeWidth','uMySpriteNoiseErodeEdgeSoftness','uMySpriteNoiseErodeEdgeColor','uMySpriteNoiseErodeEdgeIntensity','uMySpriteNoiseErodeCharColor','uMySpriteNoiseErodeCharStrength','uMySpriteNoiseErodeSeed'
    ,'uMySpriteNoiseErodeEdgeInnerWidth','uMySpriteNoiseErodeEdgeOuterWidth','uMySpriteNoiseErodeEdgeInnerColor','uMySpriteNoiseErodeEdgeOuterColor','uMySpriteNoiseErodeEdgeFalloffPower','uMySpriteNoiseErodeEdgeNoiseStrength','uMySpriteNoiseErodeEdgeNoiseScale','uMySpriteNoiseErodeEdgePulseStrength','uMySpriteNoiseErodeEdgePulseSpeed'
    ,'uMySpriteNoiseErodeResidueWidth','uMySpriteNoiseErodeResidueOpacity','uMySpriteNoiseErodeResidueColor','uMySpriteNoiseErodeResidueDensity','uMySpriteNoiseErodeResidueNoiseScale','uMySpriteNoiseErodeResidueDecayPower','uMySpriteNoiseErodeResidueFadeStart','uMySpriteNoiseErodeResidueGlow'
    ,'uMySpriteNoiseErodeVertexDeformStrength','uMySpriteNoiseErodeVertexBendX','uMySpriteNoiseErodeVertexBendY','uMySpriteNoiseErodeVertexTwist','uMySpriteNoiseErodeVertexBulge','uMySpriteNoiseErodeVertexDepth','uMySpriteNoiseErodeVertexWaveStrength','uMySpriteNoiseErodeVertexWaveScale','uMySpriteNoiseErodeVertexWaveSpeed','uMySpriteNoiseErodeVertexAnchorY'
    ,'uMySpriteNoiseErodeRise','uMySpriteNoiseErodeDriftX','uMySpriteNoiseErodeTurbulence','uMySpriteNoiseErodeAshColor','uMySpriteNoiseErodeAshTrail','uMySpriteNoiseErodeAshDensity','uMySpriteNoiseErodeAshOpacity','uMySpriteNoiseErodeFlickerSpeed','uMySpriteNoiseErodeAlphaCutoff'
  ],
  vertex: {
    declarations: `
      uniform float uTime,uMySpriteNoiseErodeEnabled,uMySpriteNoiseErodeProgress,uMySpriteNoiseErodeProgressPower,uMySpriteNoiseErodeStartHold;
      uniform float uMySpriteNoiseErodeVertexDeformStrength,uMySpriteNoiseErodeVertexBendX,uMySpriteNoiseErodeVertexBendY,uMySpriteNoiseErodeVertexTwist,uMySpriteNoiseErodeVertexBulge,uMySpriteNoiseErodeVertexDepth,uMySpriteNoiseErodeVertexWaveStrength,uMySpriteNoiseErodeVertexWaveScale,uMySpriteNoiseErodeVertexWaveSpeed,uMySpriteNoiseErodeVertexAnchorY;
      uniform float uMySpriteNoiseErodeRise,uMySpriteNoiseErodeDriftX,uMySpriteNoiseErodeTurbulence,uMySpriteNoiseErodeSeed,uMySpriteNoiseErodeVoidPullStrength,uMySpriteNoiseErodeVoidPullRadius,uMySpriteNoiseErodeVoidPullFalloff,uMySpriteNoiseErodeVoidPullPower,uMySpriteNoiseErodeSpiralStrength,uMySpriteNoiseErodeSpiralTurns,uMySpriteNoiseErodeSpiralDirection,uMySpriteNoiseErodeRadialRotation;
      uniform vec2 uMySpriteNoiseErodeCenter,uMySpriteNoiseErodeRadialScale;
      varying float vMySpriteNoiseErodeMotion;
    `,
    transformPosition: `
      float mySpriteVertexCurveP=pow(clamp((uMySpriteNoiseErodeProgress-uMySpriteNoiseErodeStartHold)/max(.001,1.-uMySpriteNoiseErodeStartHold),0.,1.),max(.1,uMySpriteNoiseErodeProgressPower));
      float mySpriteLegacyMotion=smoothstep(0.,1.,mySpriteVertexCurveP*1.2-uv.y*.25)*uMySpriteNoiseErodeEnabled;
      float mySpriteVertexHash=fract(sin(dot(floor(uv*14.),vec2(127.1,311.7))+uMySpriteNoiseErodeSeed)*43758.5453);
      float mySpriteLegacyWave=sin(uv.y*12.+uTime*3.+mySpriteVertexHash*6.2831);
      mySpritePosition.x+=uMySpriteNoiseErodeDriftX*mySpriteLegacyMotion+mySpriteLegacyWave*uMySpriteNoiseErodeTurbulence*mySpriteLegacyMotion*(.25+uv.y);
      mySpritePosition.y+=uMySpriteNoiseErodeRise*mySpriteLegacyMotion*mySpriteLegacyMotion+cos(uv.x*10.-uTime*2.)*uMySpriteNoiseErodeTurbulence*mySpriteLegacyMotion*.35;
      vec2 mySpritePullCenter=uMySpriteNoiseErodeCenter*.5,mySpritePullPoint=uv-.5-mySpritePullCenter;float mySpriteRadialCos=cos(uMySpriteNoiseErodeRadialRotation),mySpriteRadialSin=sin(uMySpriteNoiseErodeRadialRotation);
      vec2 mySpritePullRadial=mat2(mySpriteRadialCos,-mySpriteRadialSin,mySpriteRadialSin,mySpriteRadialCos)*mySpritePullPoint/max(vec2(.1),uMySpriteNoiseErodeRadialScale);
      float mySpritePullInner=max(0.,uMySpriteNoiseErodeVoidPullRadius-uMySpriteNoiseErodeVoidPullFalloff),mySpritePullSpatial=1.-smoothstep(mySpritePullInner,uMySpriteNoiseErodeVoidPullRadius,length(mySpritePullRadial));
      float mySpritePull=pow(mySpriteVertexCurveP,max(.1,uMySpriteNoiseErodeVoidPullPower))*mySpritePullSpatial*uMySpriteNoiseErodeVoidPullStrength*uMySpriteNoiseErodeEnabled;
      float mySpritePullAngle=mySpritePull*mySpritePull*uMySpriteNoiseErodeSpiralStrength*max(.25,uMySpriteNoiseErodeSpiralTurns)*uMySpriteNoiseErodeSpiralDirection,mySpritePullCos=cos(mySpritePullAngle),mySpritePullSin=sin(mySpritePullAngle);
      vec2 mySpritePulled=mat2(mySpritePullCos,-mySpritePullSin,mySpritePullCos*0.+mySpritePullSin,mySpritePullCos)*mySpritePullPoint;mySpritePosition.xy+=(mySpritePulled-mySpritePullPoint)*mySpritePull;mySpritePosition.z-=uMySpriteNoiseErodeTurbulence*mySpritePull*sin(length(mySpritePullPoint)*30.-uTime*4.);
      float mySpriteAnchorWeight=clamp((uv.y-uMySpriteNoiseErodeVertexAnchorY)/max(.001,1.-uMySpriteNoiseErodeVertexAnchorY),0.,1.);
      float mySpriteDeform=mySpriteVertexCurveP*uMySpriteNoiseErodeVertexDeformStrength*mySpriteAnchorWeight*uMySpriteNoiseErodeEnabled;
      vec2 mySpriteLocal=mySpritePosition.xy;mySpriteLocal.x+=uMySpriteNoiseErodeVertexBendX*mySpriteLocal.y*mySpriteLocal.y*mySpriteDeform;mySpriteLocal.y+=uMySpriteNoiseErodeVertexBendY*mySpriteLocal.x*mySpriteLocal.x*mySpriteDeform;
      float mySpriteTwistAngle=uMySpriteNoiseErodeVertexTwist*mySpriteDeform,mySpriteTwistCos=cos(mySpriteTwistAngle),mySpriteTwistSin=sin(mySpriteTwistAngle);mySpriteLocal=mat2(mySpriteTwistCos,-mySpriteTwistSin,mySpriteTwistSin,mySpriteTwistCos)*mySpriteLocal;
      float mySpriteCenterWeight=max(0.,1.-length(mySpritePullPoint)*1.42);mySpriteLocal*=1.+uMySpriteNoiseErodeVertexBulge*mySpriteCenterWeight*mySpriteDeform;mySpritePosition.xy=mySpriteLocal;
      float mySpriteVertexWave=sin((uv.x+uv.y)*uMySpriteNoiseErodeVertexWaveScale+uTime*uMySpriteNoiseErodeVertexWaveSpeed+uMySpriteNoiseErodeSeed)*uMySpriteNoiseErodeVertexWaveStrength;
      mySpritePosition.z+=(uMySpriteNoiseErodeVertexDepth*mySpriteCenterWeight+mySpriteVertexWave)*mySpriteDeform;
      vMySpriteNoiseErodeMotion=max(mySpriteLegacyMotion,mySpritePull);
    `
  },
  fragment: {
    declarations: `
      #include<mySpriteHashNoise>
      #include<mySpriteEdgeBand>
      uniform float uMySpriteNoiseErodeEnabled,uMySpriteNoiseErodeProgress,uMySpriteNoiseErodeAngle,uMySpriteNoiseErodeScale,uMySpriteNoiseErodeStrength,uMySpriteNoiseErodeSpeed;
      uniform float uMySpriteNoiseErodeDirectionalStrength,uMySpriteNoiseErodeRadialStrength,uMySpriteNoiseErodeRadialDirection,uMySpriteNoiseErodeCrystalStrength,uMySpriteNoiseErodeCrystalScale,uMySpriteNoiseErodeCrystalSharpness,uMySpriteNoiseErodeSpiralStrength,uMySpriteNoiseErodeSpiralTurns,uMySpriteNoiseErodeVoidPullStrength;
      uniform float uMySpriteNoiseErodeCrystalAspect,uMySpriteNoiseErodeCrystalRotation,uMySpriteNoiseErodeCrystalCrackWidth,uMySpriteNoiseErodeCrystalJitter,uMySpriteNoiseErodeCrystalBranchStrength,uMySpriteNoiseErodeCrystalBranchScale;
      uniform float uMySpriteNoiseErodeRadialRotation,uMySpriteNoiseErodeRadialPower,uMySpriteNoiseErodeRadialNoiseStrength,uMySpriteNoiseErodeRadialNoiseScale,uMySpriteNoiseErodeSpiralSpeed,uMySpriteNoiseErodeSpiralDirection,uMySpriteNoiseErodeSpiralRadialFrequency,uMySpriteNoiseErodeVoidPullRadius,uMySpriteNoiseErodeVoidPullFalloff,uMySpriteNoiseErodeVoidPullPower;
      uniform float uMySpriteNoiseErodeProgressPower,uMySpriteNoiseErodeStartHold,uMySpriteNoiseErodeEndFade,uMySpriteNoiseErodeFieldBlendMode,uMySpriteNoiseErodeFieldInvert,uMySpriteNoiseErodeFieldContrast,uMySpriteNoiseErodeFieldOffset;
      uniform float uMySpriteNoiseErodeNoiseDetail,uMySpriteNoiseErodeNoiseRoughness,uMySpriteNoiseErodeNoiseAspect,uMySpriteNoiseErodeNoiseRotation,uMySpriteNoiseErodeNoiseFlowAngle,uMySpriteNoiseErodeWarpStrength,uMySpriteNoiseErodeWarpScale,uMySpriteNoiseErodeWarpSpeed;
      uniform float uMySpriteNoiseErodeEdgeWidth,uMySpriteNoiseErodeEdgeSoftness,uMySpriteNoiseErodeEdgeIntensity,uMySpriteNoiseErodeCharStrength,uMySpriteNoiseErodeSeed;
      uniform float uMySpriteNoiseErodeEdgeInnerWidth,uMySpriteNoiseErodeEdgeOuterWidth,uMySpriteNoiseErodeEdgeFalloffPower,uMySpriteNoiseErodeEdgeNoiseStrength,uMySpriteNoiseErodeEdgeNoiseScale,uMySpriteNoiseErodeEdgePulseStrength,uMySpriteNoiseErodeEdgePulseSpeed;
      uniform float uMySpriteNoiseErodeResidueWidth,uMySpriteNoiseErodeResidueOpacity,uMySpriteNoiseErodeResidueDensity,uMySpriteNoiseErodeResidueNoiseScale,uMySpriteNoiseErodeResidueDecayPower,uMySpriteNoiseErodeResidueFadeStart,uMySpriteNoiseErodeResidueGlow;
      uniform float uMySpriteNoiseErodeAshTrail,uMySpriteNoiseErodeAshDensity,uMySpriteNoiseErodeAshOpacity,uMySpriteNoiseErodeFlickerSpeed,uMySpriteNoiseErodeAlphaCutoff;
      uniform vec2 uMySpriteNoiseErodeCenter,uMySpriteNoiseErodeRadialScale;uniform vec3 uMySpriteNoiseErodeEdgeColor,uMySpriteNoiseErodeEdgeInnerColor,uMySpriteNoiseErodeEdgeOuterColor,uMySpriteNoiseErodeResidueColor,uMySpriteNoiseErodeCharColor,uMySpriteNoiseErodeAshColor;
      varying float vMySpriteNoiseErodeMotion;
    `,
    functions: `
      float mySpriteErodeHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+uMySpriteNoiseErodeSeed)*43758.5453123);}
      float mySpriteErodeNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mySpriteErodeHash(i),mySpriteErodeHash(i+vec2(1.,0.)),f.x),mix(mySpriteErodeHash(i+vec2(0.,1.)),mySpriteErodeHash(i+vec2(1.,1.)),f.x),f.y);}
      float mySpriteErodeFbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=mySpriteErodeNoise(p)*a;p=p*2.03+17.13;a*=.5;}return v;}
      float mySpriteNoiseErodeCrystalValue;
      float mySpriteNoiseErodeCurveProgress(){return pow(clamp((uMySpriteNoiseErodeProgress-uMySpriteNoiseErodeStartHold)/max(.001,1.-uMySpriteNoiseErodeStartHold),0.,1.),max(.1,uMySpriteNoiseErodeProgressPower));}
      vec2 mySpriteRadialPoint(vec2 p){float cs=cos(uMySpriteNoiseErodeRadialRotation),sn=sin(uMySpriteNoiseErodeRadialRotation);return mat2(cs,-sn,sn,cs)*p/max(vec2(.1),uMySpriteNoiseErodeRadialScale);}
      vec2 mySpriteStructuredNoiseUv(vec2 uv){vec2 p=uv-.5;float cs=cos(uMySpriteNoiseErodeNoiseRotation),sn=sin(uMySpriteNoiseErodeNoiseRotation);p=mat2(cs,-sn,sn,cs)*p;p.x/=max(.1,uMySpriteNoiseErodeNoiseAspect);return p+.5;}
      float mySpriteStructuredFbm(vec2 p){
        float rough=mix(.25,.72,clamp(uMySpriteNoiseErodeNoiseRoughness,0.,1.)),detail=clamp(uMySpriteNoiseErodeNoiseDetail,0.,1.);float value=0.,weight=0.,a=.5;
        value+=mySpriteErodeNoise(p)*a;weight+=a;p=p*2.03+17.13;a*=rough;
        float gate=smoothstep(0.,.34,detail);value+=mySpriteErodeNoise(p)*a*gate;weight+=a*gate;p=p*2.03+17.13;a*=rough;
        gate=smoothstep(.25,.7,detail);value+=mySpriteErodeNoise(p)*a*gate;weight+=a*gate;p=p*2.03+17.13;a*=rough;
        gate=smoothstep(.58,1.,detail);value+=mySpriteErodeNoise(p)*a*gate;weight+=a*gate;return value/max(.0001,weight);
      }
      vec2 mySpriteNoiseErodeUv(vec2 uv){
        float curveP=mySpriteNoiseErodeCurveProgress();if(uMySpriteNoiseErodeEnabled<.5||curveP<=.001||uMySpriteNoiseErodeVoidPullStrength<=.001)return uv;
        vec2 center=vec2(.5)+uMySpriteNoiseErodeCenter*.5,p=uv-center,rp=mySpriteRadialPoint(p);
        float inner=max(.0,uMySpriteNoiseErodeVoidPullRadius-uMySpriteNoiseErodeVoidPullFalloff),spatial=1.-smoothstep(inner,uMySpriteNoiseErodeVoidPullRadius,length(rp));
        float influence=pow(curveP,max(.1,uMySpriteNoiseErodeVoidPullPower))*spatial*uMySpriteNoiseErodeVoidPullStrength;
        float a=curveP*curveP*uMySpriteNoiseErodeSpiralStrength*2.8*uMySpriteNoiseErodeSpiralDirection*influence+mySpriteErodeNoise(uv*5.+uMySpriteNoiseErodeSeed+uTime*.02)*.12*influence;
        float cs=cos(a),sn=sin(a);return mat2(cs,-sn,sn,cs)*p*(1.-curveP*.22*influence)+center;
      }
      float mySpriteBlendErodeFields(float directional,float radial,float crystalField){
        float wd=clamp(uMySpriteNoiseErodeDirectionalStrength,0.,1.),wr=clamp(uMySpriteNoiseErodeRadialStrength,0.,1.),wc=clamp(uMySpriteNoiseErodeCrystalStrength,0.,1.);float total=max(.0001,wd+wr+wc);
        if(uMySpriteNoiseErodeFieldBlendMode<.5)return (directional*wd+radial*wr+crystalField*wc)/total;
        if(uMySpriteNoiseErodeFieldBlendMode<1.5)return clamp(directional*wd+radial*wr+crystalField*wc,0.,1.);
        if(uMySpriteNoiseErodeFieldBlendMode<2.5){float value=0.;if(wd>.001)value=max(value,directional*wd);if(wr>.001)value=max(value,radial*wr);if(wc>.001)value=max(value,crystalField*wc);return value;}
        if(uMySpriteNoiseErodeFieldBlendMode<3.5){float value=1.;if(wd>.001)value=min(value,mix(1.,directional,wd));if(wr>.001)value=min(value,mix(1.,radial,wr));if(wc>.001)value=min(value,mix(1.,crystalField,wc));return value;}
        return mix(1.,directional,wd)*mix(1.,radial,wr)*mix(1.,crystalField,wc);
      }
      float mySpriteNoiseErodeField(vec2 uv){
        float curveP=mySpriteNoiseErodeCurveProgress();
        vec2 axis=vec2(cos(uMySpriteNoiseErodeAngle),sin(uMySpriteNoiseErodeAngle));vec2 flow=vec2(cos(uMySpriteNoiseErodeNoiseFlowAngle),sin(uMySpriteNoiseErodeNoiseFlowAngle));
        vec2 warpCoord=uv*max(.25,uMySpriteNoiseErodeWarpScale)+flow*uTime*uMySpriteNoiseErodeWarpSpeed;
        vec2 warp=(vec2(mySpriteErodeNoise(warpCoord+uMySpriteNoiseErodeSeed),mySpriteErodeNoise(warpCoord.yx+uMySpriteNoiseErodeSeed+19.7))-.5)*uMySpriteNoiseErodeWarpStrength;
        vec2 warpedUv=uv+warp;float grain=mySpriteStructuredFbm(mySpriteStructuredNoiseUv(warpedUv)*max(1.,uMySpriteNoiseErodeScale)+flow*uTime*uMySpriteNoiseErodeSpeed+uMySpriteNoiseErodeSeed*.173);
        float directional=dot(uv-.5,axis)+.5+(grain-.5)*uMySpriteNoiseErodeStrength;
        vec2 p=uv-(vec2(.5)+uMySpriteNoiseErodeCenter*.5),rp=mySpriteRadialPoint(p);float radius=pow(length(rp)*1.42,max(.1,uMySpriteNoiseErodeRadialPower));
        float radialGrain=mySpriteStructuredFbm(mySpriteStructuredNoiseUv(warpedUv)*max(1.,uMySpriteNoiseErodeRadialNoiseScale)+uMySpriteNoiseErodeSeed*.271);
        float radial=mix(radius,1.-radius,clamp(uMySpriteNoiseErodeRadialDirection*.5+.5,0.,1.))+(radialGrain-.5)*uMySpriteNoiseErodeRadialNoiseStrength;
        radial+=sin(atan(rp.y,rp.x)*max(.1,uMySpriteNoiseErodeSpiralTurns)*uMySpriteNoiseErodeSpiralDirection-uTime*uMySpriteNoiseErodeSpiralSpeed+radius*uMySpriteNoiseErodeSpiralRadialFrequency)*.075*uMySpriteNoiseErodeSpiralStrength;
        vec2 cp=warpedUv-.5;float ccs=cos(uMySpriteNoiseErodeCrystalRotation),csn=sin(uMySpriteNoiseErodeCrystalRotation);cp=mat2(ccs,-csn,csn,ccs)*cp;cp.x/=max(.1,uMySpriteNoiseErodeCrystalAspect);
        vec2 crystalCoord=cp*max(2.,uMySpriteNoiseErodeCrystalScale*.42);vec2 crystalCell=floor(crystalCoord);crystalCoord+=(vec2(mySpriteErodeNoise(crystalCell+uMySpriteNoiseErodeSeed),mySpriteErodeNoise(crystalCell.yx+uMySpriteNoiseErodeSeed+37.1))-.5)*uMySpriteNoiseErodeCrystalJitter;
        vec2 cuv=abs(fract(crystalCoord+grain*.08)-vec2(.5));float crystalSoft=mix(.12,.012,clamp(uMySpriteNoiseErodeCrystalSharpness,0.,1.));
        float crystal=1.-smoothstep(uMySpriteNoiseErodeCrystalCrackWidth,uMySpriteNoiseErodeCrystalCrackWidth+crystalSoft,min(cuv.x,cuv.y));
        vec2 branchUv=abs(fract(mat2(.7071,-.7071,.7071,.7071)*crystalCoord*max(.25,uMySpriteNoiseErodeCrystalBranchScale))-vec2(.5));
        crystal=max(crystal,(1.-smoothstep(uMySpriteNoiseErodeCrystalCrackWidth*.55,uMySpriteNoiseErodeCrystalCrackWidth*.55+crystalSoft*.65,min(branchUv.x,branchUv.y)))*uMySpriteNoiseErodeCrystalBranchStrength);mySpriteNoiseErodeCrystalValue=crystal;
        float crystalFade=1.-smoothstep(.68,.94,curveP);float crystalField=clamp(grain*1.04+crystal*.24*crystalFade*(1.-grain),0.,1.);
        float field=mySpriteBlendErodeFields(directional,radial,crystalField);field=mix(field,1.-field,clamp(uMySpriteNoiseErodeFieldInvert,0.,1.));
        return (field-.5)*uMySpriteNoiseErodeFieldContrast+.5+uMySpriteNoiseErodeFieldOffset;
      }
    `,
    afterSample: `mySpriteSourceUv=mySpriteNoiseErodeUv(vUV);sourceSample=mySpriteSampleAtlas(uMaskTexture,mySpriteSourceUv);if(uMySpriteNoiseErodeEnabled>.5&&sourceSample.a<uMySpriteNoiseErodeAlphaCutoff)discard;`,
    modifyField: `
      float mySpriteCurveP=mySpriteNoiseErodeCurveProgress();if(uMySpriteNoiseErodeEnabled>.5&&mySpriteCurveP>.001){
        float f=mySpriteNoiseErodeField(vUV);float soft=max(.001,uMySpriteNoiseErodeEdgeSoftness);float margin=.12+uMySpriteNoiseErodeStrength*.55;float threshold=mix(-margin,1.+margin,mySpriteCurveP);
        float remain=smoothstep(threshold-soft,threshold+soft,f);float edgeD=max(0.,f-threshold+(mySpriteErodeNoise(vUV*max(.25,uMySpriteNoiseErodeEdgeNoiseScale)+uMySpriteNoiseErodeSeed+uTime*.03)-.5)*uMySpriteNoiseErodeEdgeNoiseStrength*uMySpriteNoiseErodeEdgeWidth);
        float innerEdge=pow(clamp(1.-smoothstep(0.,max(.001,uMySpriteNoiseErodeEdgeWidth*uMySpriteNoiseErodeEdgeInnerWidth),edgeD),0.,1.),uMySpriteNoiseErodeEdgeFalloffPower)*remain;
        float fullEdge=pow(clamp(1.-smoothstep(0.,max(.001,uMySpriteNoiseErodeEdgeWidth*uMySpriteNoiseErodeEdgeOuterWidth),edgeD),0.,1.),uMySpriteNoiseErodeEdgeFalloffPower)*remain;float outerEdge=max(0.,fullEdge-innerEdge);
        float edgePulse=1.+sin(uTime*uMySpriteNoiseErodeEdgePulseSpeed+mySpriteErodeNoise(vUV*7.+uMySpriteNoiseErodeSeed)*6.2831)*uMySpriteNoiseErodeEdgePulseStrength;float edgeFlicker=.82+.18*sin(uTime*uMySpriteNoiseErodeFlickerSpeed+mySpriteErodeFbm(vUV*13.)*12.);
        float nearFront=smoothstep(-uMySpriteNoiseErodeEdgeWidth*4.,uMySpriteNoiseErodeEdgeWidth*3.,f-threshold)*(1.-smoothstep(uMySpriteNoiseErodeEdgeWidth*3.,uMySpriteNoiseErodeEdgeWidth*15.,f-threshold));
        float crystalDetail=uMySpriteNoiseErodeCrystalStrength*smoothstep(.08,.0,abs(mySpriteNoiseErodeCrystalValue-.16))*nearFront*(1.-smoothstep(.68,.94,mySpriteCurveP));
        float charBand=(1.-smoothstep(uMySpriteNoiseErodeEdgeWidth*3.2,uMySpriteNoiseErodeEdgeWidth*5.5,f-threshold))*remain;
        colorOut=mix(colorOut,uMySpriteNoiseErodeCharColor,clamp(charBand*uMySpriteNoiseErodeCharStrength+crystalDetail*.42,0.,1.));colorOut+=(uMySpriteNoiseErodeEdgeInnerColor*innerEdge+uMySpriteNoiseErodeEdgeOuterColor*outerEdge)*uMySpriteNoiseErodeEdgeIntensity*edgePulse*edgeFlicker+uMySpriteNoiseErodeEdgeColor*crystalDetail*.65;
        float residueDistance=clamp((threshold-f)/max(.001,uMySpriteNoiseErodeResidueWidth),0.,1.);float residueGrain=mySpriteErodeNoise(floor(vUV*max(.25,uMySpriteNoiseErodeResidueNoiseScale))+uMySpriteNoiseErodeSeed+53.7);
        float residueCoverage=smoothstep(1.-uMySpriteNoiseErodeResidueDensity-.08,1.-uMySpriteNoiseErodeResidueDensity+.08,residueGrain);float residueLife=1.-smoothstep(uMySpriteNoiseErodeResidueFadeStart,1.,uMySpriteNoiseErodeProgress);
        float residue=(1.-remain)*pow(max(0.,1.-residueDistance),uMySpriteNoiseErodeResidueDecayPower)*residueCoverage*residueLife;float sourceAlphaOut=alphaOut;
        float trailPos=clamp((threshold-f)/max(.001,uMySpriteNoiseErodeAshTrail),0.,1.);float trail=(1.-remain)*(1.-smoothstep(.72,1.,trailPos));
        float ashSpeck=trail*step(1.-uMySpriteNoiseErodeAshDensity,mySpriteErodeNoise(floor((vUV+vec2(vMySpriteNoiseErodeMotion*uTime*.02,0.))*uMySpriteNoiseErodeScale*5.)))*(1.-trailPos);
        float aliveAlphaOut=sourceAlphaOut*remain,ashAlphaOut=sourceAlphaOut*ashSpeck*uMySpriteNoiseErodeAshOpacity,residueAlphaOut=sourceAlphaOut*residue*uMySpriteNoiseErodeResidueOpacity;
        colorOut=mix(colorOut,uMySpriteNoiseErodeAshColor,clamp(ashAlphaOut/(aliveAlphaOut+ashAlphaOut+.0001),0.,1.));colorOut=mix(colorOut,uMySpriteNoiseErodeResidueColor*(1.+uMySpriteNoiseErodeResidueGlow),clamp(residueAlphaOut/(aliveAlphaOut+ashAlphaOut+residueAlphaOut+.0001),0.,1.));
        float finalFade=1.-smoothstep(max(0.,1.-max(.0001,uMySpriteNoiseErodeEndFade)),1.,uMySpriteNoiseErodeProgress);alphaOut=max(max(aliveAlphaOut,ashAlphaOut),residueAlphaOut)*finalFade;
      }
    `
  }
};
