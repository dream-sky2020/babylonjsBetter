import { Color3, Effect, Engine, Mesh, MeshBuilder, Scene, ShaderMaterial, Texture } from '@babylonjs/core';
import { DEFAULT_SPRITE_ASH_PRESET, normalizeSpriteAshPreset } from './spriteAshPreset';
import type { SpriteAshPreset } from './spriteAsh.types';

const VERTEX_SHADER = 'spriteAshVertex';
const FRAGMENT_SHADER = 'spriteAshFragment';

const registerShaders = () => {
  if (!Effect.ShadersStore[`${VERTEX_SHADER}VertexShader`]) Effect.ShadersStore[`${VERTEX_SHADER}VertexShader`] = `
    precision highp float;
    attribute vec3 position;
    attribute vec2 uv;
    uniform mat4 worldViewProjection;
    uniform float uTime;
    uniform float uProgress;
    uniform float uRise;
    uniform float uDriftX;
    uniform float uTurbulence;
    uniform float uSeed;
    varying vec2 vUV;
    varying float vMotion;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7)) + uSeed) * 43758.5453); }
    void main(void) {
      vUV = uv;
      float local = smoothstep(0.0, 1.0, uProgress * 1.2 - uv.y * 0.25);
      float wave = sin((uv.y * 12.0 + uTime * 3.0) + hash(floor(uv * 14.0)) * 6.2831);
      vec3 displaced = position;
      displaced.x += uDriftX * local + wave * uTurbulence * local * (0.25 + uv.y);
      displaced.y += uRise * local * local + cos((uv.x * 10.0 - uTime * 2.0)) * uTurbulence * local * 0.35;
      vMotion = local;
      gl_Position = worldViewProjection * vec4(displaced, 1.0);
    }
  `;
  if (!Effect.ShadersStore[`${FRAGMENT_SHADER}PixelShader`]) Effect.ShadersStore[`${FRAGMENT_SHADER}PixelShader`] = `
    precision highp float;
    varying vec2 vUV;
    varying float vMotion;
    uniform sampler2D uTexture;
    uniform float uTime;
    uniform float uProgress;
    uniform float uDirectionAngle;
    uniform float uNoiseScale;
    uniform float uNoiseStrength;
    uniform float uNoiseSpeed;
    uniform float uEdgeWidth;
    uniform float uEdgeSoftness;
    uniform vec3 uEdgeColor;
    uniform float uEdgeIntensity;
    uniform vec3 uCharColor;
    uniform float uCharStrength;
    uniform vec3 uAshColor;
    uniform float uAshTrail;
    uniform float uAshDensity;
    uniform float uAshOpacity;
    uniform float uFlickerSpeed;
    uniform float uSeed;
    uniform float uAlphaCutoff;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7)) + uSeed) * 43758.5453123); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);
    }
    float fbm(vec2 p) {
      float value = 0.0, amplitude = 0.5;
      for (int i=0;i<4;i++) { value += noise(p)*amplitude; p = p*2.03+17.13; amplitude*=0.5; }
      return value;
    }
    void main(void) {
      vec4 source = texture2D(uTexture, vUV);
      if (source.a < uAlphaCutoff) discard;
      vec2 axis = vec2(cos(uDirectionAngle), sin(uDirectionAngle));
      float coordinate = dot(vUV - vec2(0.5), axis) + 0.5;
      vec2 animatedUv = vUV * uNoiseScale + vec2(uTime * uNoiseSpeed, -uTime * uNoiseSpeed * 0.63);
      float field = coordinate + (fbm(animatedUv) - 0.5) * uNoiseStrength;
      float margin = 0.12 + uNoiseStrength * 0.55;
      float threshold = mix(-margin, 1.0 + margin, clamp(uProgress,0.0,1.0));
      float signedDistance = field - threshold;
      float remaining = smoothstep(-uEdgeSoftness, uEdgeSoftness, signedDistance);
      float edge = (1.0 - smoothstep(uEdgeWidth, uEdgeWidth + uEdgeSoftness, signedDistance)) * remaining;
      float charBand = (1.0 - smoothstep(uEdgeWidth * 3.2, uEdgeWidth * 5.5, signedDistance)) * remaining;
      float trailPosition = clamp((-signedDistance) / max(0.001,uAshTrail), 0.0, 1.0);
      float trail = (1.0 - remaining) * (1.0 - smoothstep(0.72,1.0,trailPosition));
      float cell = hash(floor((vUV + vec2(vMotion*uTime*0.02,0.0))*uNoiseScale*5.0));
      float ashSpeck = trail * step(1.0-uAshDensity,cell) * (1.0-trailPosition);
      float flicker = 0.82 + 0.18*sin(uTime*uFlickerSpeed + fbm(vUV*13.0)*12.0);
      vec3 charred = mix(source.rgb,uCharColor,charBand*uCharStrength);
      vec3 aliveColor = charred + uEdgeColor * edge * uEdgeIntensity * flicker;
      float aliveAlpha = source.a * remaining;
      float ashAlpha = source.a * ashSpeck * uAshOpacity;
      vec3 finalColor = mix(aliveColor,uAshColor,clamp(ashAlpha/(aliveAlpha+ashAlpha+0.0001),0.0,1.0));
      float finalAlpha = max(aliveAlpha,ashAlpha);
      if (finalAlpha < uAlphaCutoff) discard;
      gl_FragColor = vec4(finalColor,finalAlpha);
    }
  `;
};

export type SpriteAshEffectController = {
  mesh: Mesh;
  material: ShaderMaterial;
  texture: Texture;
  preset: SpriteAshPreset;
  setPreset: (preset: SpriteAshPreset) => void;
  setProgress: (progress: number) => void;
  updateTime: (timeSeconds: number) => void;
  setDisplayScale: (scale: number) => void;
  dispose: () => void;
};

export const createSpriteAshEffect = (
  scene: Scene,
  texturePath: string,
  presetInput: SpriteAshPreset = DEFAULT_SPRITE_ASH_PRESET
): SpriteAshEffectController => {
  registerShaders();
  const mesh = MeshBuilder.CreateGround('spriteAshPlane', { width: 1, height: 1, subdivisions: 72 }, scene);
  mesh.rotation.x = Math.PI / 2;
  mesh.bakeCurrentTransformIntoVertices();
  mesh.rotation.setAll(0);
  const texture = new Texture(texturePath, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
  texture.hasAlpha = true;
  texture.wrapU = Texture.CLAMP_ADDRESSMODE;
  texture.wrapV = Texture.CLAMP_ADDRESSMODE;
  const material = new ShaderMaterial('spriteAshMaterial', scene, { vertex: VERTEX_SHADER, fragment: FRAGMENT_SHADER }, {
    attributes: ['position','uv'],
    uniforms: ['worldViewProjection','uTime','uProgress','uRise','uDriftX','uTurbulence','uSeed','uDirectionAngle','uNoiseScale','uNoiseStrength','uNoiseSpeed','uEdgeWidth','uEdgeSoftness','uEdgeColor','uEdgeIntensity','uCharColor','uCharStrength','uAshColor','uAshTrail','uAshDensity','uAshOpacity','uFlickerSpeed','uAlphaCutoff'],
    samplers: ['uTexture'],
    needAlphaBlending: true,
    needAlphaTesting: true
  });
  material.backFaceCulling = false;
  material.alphaMode = Engine.ALPHA_COMBINE;
  material.setTexture('uTexture', texture);
  mesh.material = material;
  let preset = normalizeSpriteAshPreset(presetInput.presetKey, presetInput);
  let displayScale = 5;
  let progress = 0;
  let time = 0;

  const applyScale = () => {
    const size = texture.getSize();
    const aspect = Math.max(0.05, size.width / Math.max(1, size.height));
    mesh.scaling.set(displayScale * aspect, displayScale, 1);
  };
  const applyPreset = () => {
    material.setFloat('uDirectionAngle', preset.directionAngleDeg * Math.PI / 180);
    material.setFloat('uNoiseScale', preset.noiseScale);
    material.setFloat('uNoiseStrength', preset.noiseStrength);
    material.setFloat('uNoiseSpeed', preset.noiseSpeed);
    material.setFloat('uEdgeWidth', preset.edgeWidth);
    material.setFloat('uEdgeSoftness', preset.edgeSoftness);
    material.setColor3('uEdgeColor', Color3.FromHexString(preset.edgeColor));
    material.setFloat('uEdgeIntensity', preset.edgeIntensity);
    material.setColor3('uCharColor', Color3.FromHexString(preset.charColor));
    material.setFloat('uCharStrength', preset.charStrength);
    material.setColor3('uAshColor', Color3.FromHexString(preset.ashColor));
    material.setFloat('uAshTrail', preset.ashTrail);
    material.setFloat('uAshDensity', preset.ashDensity);
    material.setFloat('uAshOpacity', preset.ashOpacity);
    material.setFloat('uRise', preset.rise);
    material.setFloat('uDriftX', preset.driftX);
    material.setFloat('uTurbulence', preset.turbulence);
    material.setFloat('uFlickerSpeed', preset.flickerSpeed);
    material.setFloat('uSeed', preset.seed);
    material.setFloat('uAlphaCutoff', preset.alphaCutoff);
  };
  const applyFrame = () => { material.setFloat('uProgress', progress); material.setFloat('uTime', time); };
  texture.onLoadObservable.add(applyScale);
  applyScale(); applyPreset(); applyFrame();

  const controller: SpriteAshEffectController = {
    mesh, material, texture, preset,
    setPreset: (next) => { preset = normalizeSpriteAshPreset(next.presetKey, next); controller.preset = preset; applyPreset(); },
    setProgress: (next) => { progress = Math.max(0, Math.min(1, Number(next) || 0)); applyFrame(); },
    updateTime: (next) => { time = Number.isFinite(next) ? next : 0; applyFrame(); },
    setDisplayScale: (next) => { displayScale = Math.max(0.1, Number(next) || 1); applyScale(); },
    dispose: () => { material.dispose(); texture.dispose(); mesh.dispose(); }
  };
  return controller;
};
