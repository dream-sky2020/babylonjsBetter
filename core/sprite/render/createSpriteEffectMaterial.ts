import { Color3, DynamicTexture, Effect, Scene, ShaderMaterial, Texture, Vector2, type BaseTexture } from '@babylonjs/core';
import {
  progressDirectionValue,
  progressShapeValue,
  resolveProgressOptions
} from '@/core/sprite/progress/spriteProgress.ts';
import { registerMySpriteShaderChunks } from '@/core/sprite/shader/chunks/registerMySpriteShaderChunks.ts';
import { spriteNoiseErodeBlendModeValue } from '@/core/sprite/shader/modules/noiseErode.module.ts';
import { composeSpriteShader } from '@/core/sprite/shader/composer/composeSpriteShader.ts';
import { registerSpriteShaderProgram } from '@/core/sprite/shader/composer/shaderProgramCache.ts';
import { stripedSpriteRecipe } from '@/core/sprite/shader/recipes/stripedSprite.recipe.ts';
import { FULL_SPRITE_NOISE_ERODE_FEATURES } from '@/core/sprite/dissolve/noiseErodeFeatureFlags.ts';
import type { SpriteNoiseErodeOptions } from '@/core/sprite/dissolve/spriteDissolve.types.ts';
export type { SpriteDissolveEffectState, SpriteNoiseErodeOptions } from '@/core/sprite/dissolve/spriteDissolve.types.ts';

export type StripeSegmentLike = {
  width?: number;
  fillType?: 'solid' | 'gradient';
  color?: string;
  fromColor?: string;
  toColor?: string;
  opacity?: number;
};

export type StripePresetLike = {
  mode?: 'texture' | 'solid' | 'stripes';
  solidColor?: string;
  solidOpacity?: number;
  angleDeg?: number;
  speed?: number;
  background?: string;
  backgroundOpacity?: number;
  segments?: StripeSegmentLike[];
};

export type StripeProgressShape = 'none' | 'linear' | 'radial' | 'sector' | 'ring' | 'diamond' | 'box' | 'rect-perimeter';
export type StripeProgressDirection = 'forward' | 'reverse' | 'center-out' | 'edges-in';

export type StripeProgressRegionStyle = {
  source?: 'texture' | 'color';
  color?: string;
  opacity?: number;
};

export type StripeProgressMaskOptions = {
  enabled?: boolean;
  value?: number;
  progress?: number;
  shape?: StripeProgressShape;
  direction?: StripeProgressDirection;
  /** 线性遮罩方向：0° 从左向右，90° 从下向上。 */
  angleDeg?: number;
  /** 扇形模式的起始角。0 度朝上，正方向为顺时针。 */
  startAngleDeg?: number;
  /** 扇形/环形覆盖角度。 */
  sweepAngleDeg?: number;
  innerRadius?: number;
  outerRadius?: number;
  /** 进度边缘柔化宽度，使用 0..1 的进度坐标。 */
  softness?: number;
  /** 圆形/扇形遮罩中心相对精灵中心的像素偏移；X 向右、Y 向上为正。 */
  centerOffsetPx?: { x?: number; y?: number };
  /** 圆形/扇形遮罩的轴向缩放；大于 1 会沿对应轴拉伸。 */
  axisScale?: { x?: number; y?: number };
  filled?: StripeProgressRegionStyle;
  unfilled?: StripeProgressRegionStyle;
};

export type StripeLayerProgressOptions = {
  enabled?: boolean;
  stripe?: StripeProgressMaskOptions;
  background?: StripeProgressMaskOptions;
};

export type StripeMaskMaterialController = {
  material: ShaderMaterial;
  updatePreset: (preset: StripePresetLike) => void;
  updateProgress: (progress: StripeProgressMaskOptions) => void;
  updateLayerProgress: (progress: StripeLayerProgressOptions) => void;
  updateDissolve: (options: SpriteNoiseErodeOptions) => void;
  /** @deprecated 兼容旧调用；新代码使用 updateDissolve。 */
  updateNoiseErode: (options: SpriteNoiseErodeOptions) => void;
  updateColorOverlay: (color: Color3, alpha: number) => void;
  updateTime: (timeSec: number) => void;
  updateRenderSize: (widthPx: number, heightPx: number) => void;
  dispose: () => void;
};

export type StripeShaderMaterialController = StripeMaskMaterialController;

export type CreateStripeShaderMaterialOptions = {
  maskTexturePath?: string;
  sourceTexture?: BaseTexture;
  progress?: StripeProgressMaskOptions;
  layerProgress?: StripeLayerProgressOptions;
  renderSizePx?: {
    width: number;
    height: number;
  };
};

const VERTEX_SHADER_NAME = 'mySpriteStripeVertex';
const FRAGMENT_SHADER_NAME = 'mySpriteStripeFragment';

const ensureShaderRegistered = () => {
  registerMySpriteShaderChunks();
  if (!Effect.ShadersStore[`${VERTEX_SHADER_NAME}VertexShader`]) {
    const vertexShader = `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      uniform mat4 worldViewProjection;
      varying vec2 vUV;
      /* mySprite:vertex:declarations */
      /* mySprite:vertex:functions */
      void main(void) {
        /* mySprite:vertex:beforePosition */
        vec3 mySpritePosition = position;
        /* mySprite:vertex:transformPosition */
        gl_Position = worldViewProjection * vec4(mySpritePosition, 1.0);
        /* mySprite:vertex:afterPosition */
        vUV = uv;
      }
    `;
    Effect.ShadersStore[`${VERTEX_SHADER_NAME}VertexShader`] = vertexShader;
    Effect.ShadersStore[`${VERTEX_SHADER_NAME}Shader`] = vertexShader;
  }

  if (!Effect.ShadersStore[`${FRAGMENT_SHADER_NAME}PixelShader`]) {
    const fragmentShader = `
      precision highp float;
      varying vec2 vUV;
      uniform sampler2D uMaskTexture;
      uniform sampler2D uStripeTexture;
      uniform vec3 uSolidColor;
      uniform float uSolidAlpha;
      uniform vec3 uBackgroundColor;
      uniform float uBackgroundAlpha;
      uniform float uUseSolid;
      uniform float uUseMask;
      uniform float uAngleRad;
      uniform float uSpeed;
      uniform float uTime;
      uniform float uPatternPeriodPx;
      uniform vec2 uRenderSizePx;
      uniform float uProgressEnabled;
      uniform float uProgress;
      uniform float uProgressShape;
      uniform float uProgressDirection;
      uniform float uProgressAngleRad;
      uniform float uProgressStartAngleRad;
      uniform float uProgressSweepAngleRad;
      uniform float uProgressInnerRadius;
      uniform float uProgressOuterRadius;
      uniform float uProgressSoftness;
      uniform vec2 uProgressCenterOffsetPx;
      uniform vec2 uProgressAxisScale;
      uniform float uFilledUseTexture;
      uniform vec3 uFilledColor;
      uniform float uFilledOpacity;
      uniform float uUnfilledUseTexture;
      uniform vec3 uUnfilledColor;
      uniform float uUnfilledOpacity;
      uniform float uLayerProgressEnabled;
      uniform float uStripeProgressEnabled;
      uniform float uStripeProgress;
      uniform float uStripeProgressShape;
      uniform float uStripeProgressDirection;
      uniform float uStripeProgressAngleRad;
      uniform float uStripeProgressStartAngleRad;
      uniform float uStripeProgressSweepAngleRad;
      uniform float uStripeProgressInnerRadius;
      uniform float uStripeProgressOuterRadius;
      uniform float uStripeProgressSoftness;
      uniform vec2 uStripeProgressCenterOffsetPx;
      uniform vec2 uStripeProgressAxisScale;
      uniform float uStripeFilledUseTexture;
      uniform vec3 uStripeFilledColor;
      uniform float uStripeFilledOpacity;
      uniform float uStripeUnfilledUseTexture;
      uniform vec3 uStripeUnfilledColor;
      uniform float uStripeUnfilledOpacity;
      uniform float uBackgroundProgressEnabled;
      uniform float uBackgroundProgress;
      uniform float uBackgroundProgressShape;
      uniform float uBackgroundProgressDirection;
      uniform float uBackgroundProgressAngleRad;
      uniform float uBackgroundProgressStartAngleRad;
      uniform float uBackgroundProgressSweepAngleRad;
      uniform float uBackgroundProgressInnerRadius;
      uniform float uBackgroundProgressOuterRadius;
      uniform float uBackgroundProgressSoftness;
      uniform vec2 uBackgroundProgressCenterOffsetPx;
      uniform vec2 uBackgroundProgressAxisScale;
      uniform float uBackgroundFilledUseTexture;
      uniform vec3 uBackgroundFilledColor;
      uniform float uBackgroundFilledOpacity;
      uniform float uBackgroundUnfilledUseTexture;
      uniform vec3 uBackgroundUnfilledColor;
      uniform float uBackgroundUnfilledOpacity;

      /* mySprite:fragment:declarations */
      /* mySprite:fragment:functions */

      const float PI = 3.14159265358979323846;

      float progressCoordinate(vec2 uv, float shape, float direction, float angle, float startAngle, float sweepAngle, float innerRadius, float outerRadius, vec2 centerOffsetPx, vec2 axisScale) {
        vec2 safeRenderSize = max(uRenderSizePx, vec2(1.0));
        float referenceSize = max(1.0, min(safeRenderSize.x, safeRenderSize.y));
        vec2 safeAxisScale = max(abs(axisScale), vec2(0.001));
        vec2 centeredUv = ((uv - vec2(0.5)) * safeRenderSize - centerOffsetPx) / referenceSize / safeAxisScale;
        float coordinate = 0.0;
        if (shape < 1.5) {
          vec2 linearUv = uv - vec2(0.5);
          vec2 axis = vec2(cos(angle), sin(angle));
          float extent = max(0.0001, 0.5 * (abs(axis.x) + abs(axis.y)));
          coordinate = dot(linearUv, axis) / (2.0 * extent) + 0.5;
        } else if (shape < 2.5) {
          coordinate = clamp(length(centeredUv) * 2.0, 0.0, 1.0);
        } else if (shape < 4.5) {
          float clockwiseAngle = atan(centeredUv.x, centeredUv.y);
          float sweep = clamp(abs(sweepAngle), 0.0001, 2.0 * PI);
          float turn = abs(direction - 2.0) > 0.25
            ? mod(clockwiseAngle - startAngle + 2.0 * PI, 2.0 * PI)
            : mod(startAngle - clockwiseAngle + 2.0 * PI, 2.0 * PI);
          float radius = length(centeredUv) * 2.0;
          if (turn > sweep || (shape > 3.5 && (radius < innerRadius || radius > outerRadius))) return 2.0;
          coordinate = turn / sweep;
          direction = 1.0;
        } else if (shape < 5.5) {
          coordinate = clamp((abs(centeredUv.x) + abs(centeredUv.y)) * 2.0, 0.0, 1.0);
        } else if (shape < 6.5) {
          coordinate = clamp(max(abs(centeredUv.x), abs(centeredUv.y)) * 2.0, 0.0, 1.0);
        } else {
          vec2 p = centeredUv * 2.0;
          float edgeDistance = max(abs(p.x), abs(p.y));
          if (edgeDistance < innerRadius || edgeDistance > outerRadius) return 2.0;
          float a = atan(p.y, p.x);
          coordinate = mod(a - startAngle + 2.0 * PI, 2.0 * PI) / (2.0 * PI);
        }
        if (direction > 2.5 && direction < 3.5) return clamp(abs(coordinate - 0.5) * 2.0, 0.0, 1.0);
        if (direction > 3.5) return clamp(1.0 - abs(coordinate - 0.5) * 2.0, 0.0, 1.0);
        if (direction > 1.5) return 1.0 - coordinate;
        return coordinate;
      }

      vec4 applyLayerProgress(
        vec4 layer,
        float enabled,
        float progress,
        float shape,
        float direction,
        float angle,
        float startAngle,
        float sweepAngle,
        float innerRadius,
        float outerRadius,
        float softness,
        vec2 centerOffsetPx,
        vec2 axisScale,
        float filledUseTexture,
        vec3 filledColor,
        float filledOpacity,
        float unfilledUseTexture,
        vec3 unfilledColor,
        float unfilledOpacity
      ) {
        if (enabled < 0.5 || layer.a <= 0.0001) return layer;
        float coordinate = progressCoordinate(vUV, shape, direction, angle, startAngle, sweepAngle, innerRadius, outerRadius, centerOffsetPx, axisScale);
        float edge = clamp(softness, 0.0, 0.5);
        float filled = edge <= 0.0001 ? step(coordinate, progress) : 1.0 - smoothstep(progress - edge, progress + edge, coordinate);
        float useTexture = mix(unfilledUseTexture, filledUseTexture, filled);
        vec3 regionColor = mix(unfilledColor, filledColor, filled);
        float regionOpacity = mix(unfilledOpacity, filledOpacity, filled);
        return vec4(mix(regionColor, layer.rgb, useTexture), layer.a * clamp(regionOpacity, 0.0, 1.0));
      }

      void main(void) {
        vec2 mySpriteSourceUv = vUV;
        vec4 sourceSample = texture2D(uMaskTexture, mySpriteSourceUv);
        /* mySprite:fragment:afterSample */
        float maskAlpha = 1.0;
        if (uUseMask > 0.5) {
          maskAlpha = sourceSample.a;
        }
        if (maskAlpha <= 0.001) {
          discard;
        }

        vec4 stripeLayer = vec4(uSolidColor, clamp(uSolidAlpha, 0.0, 1.0));
        vec4 backgroundLayer = vec4(0.0);
        if (uUseSolid > 1.5) {
          // Keep source alpha as the immutable silhouette mask. The content layer
          // stays opaque so texture styling does not square semi-transparent edges.
          stripeLayer = vec4(sourceSample.rgb, 1.0);
          maskAlpha = sourceSample.a;
        }
        if (uUseSolid < 0.5) {
          vec2 pixelCoord = vUV * uRenderSizePx;
          vec2 centered = pixelCoord - uRenderSizePx * 0.5;
          float c = cos(uAngleRad);
          float s = sin(uAngleRad);
          float localX = centered.x * c + centered.y * s;
          float stripeU = fract((localX + uTime * uSpeed) / max(1.0, uPatternPeriodPx));
          vec4 stripeSample = texture2D(uStripeTexture, vec2(stripeU, 0.5));
          float stripeAlpha = clamp(stripeSample.a, 0.0, 1.0);
          stripeLayer = vec4(stripeSample.rgb, stripeAlpha);
          backgroundLayer = vec4(uBackgroundColor, clamp(uBackgroundAlpha, 0.0, 1.0));
        }

        if (uLayerProgressEnabled > 0.5) {
          stripeLayer = applySpriteLayerProgress(stripeLayer, uStripeProgressEnabled, uStripeProgress, uStripeProgressShape, uStripeProgressDirection, uStripeProgressAngleRad, uStripeProgressStartAngleRad, uStripeProgressSweepAngleRad, uStripeProgressInnerRadius, uStripeProgressOuterRadius, uStripeProgressSoftness, uStripeProgressCenterOffsetPx, uStripeProgressAxisScale, uStripeFilledUseTexture, uStripeFilledColor, uStripeFilledOpacity, uStripeUnfilledUseTexture, uStripeUnfilledColor, uStripeUnfilledOpacity);
          backgroundLayer = applySpriteLayerProgress(backgroundLayer, uBackgroundProgressEnabled, uBackgroundProgress, uBackgroundProgressShape, uBackgroundProgressDirection, uBackgroundProgressAngleRad, uBackgroundProgressStartAngleRad, uBackgroundProgressSweepAngleRad, uBackgroundProgressInnerRadius, uBackgroundProgressOuterRadius, uBackgroundProgressSoftness, uBackgroundProgressCenterOffsetPx, uBackgroundProgressAxisScale, uBackgroundFilledUseTexture, uBackgroundFilledColor, uBackgroundFilledOpacity, uBackgroundUnfilledUseTexture, uBackgroundUnfilledColor, uBackgroundUnfilledOpacity);
        }

        float backgroundVisibleAlpha = backgroundLayer.a * (1.0 - stripeLayer.a);
        float alphaOut = stripeLayer.a + backgroundVisibleAlpha;
        vec3 mixedPremul = stripeLayer.rgb * stripeLayer.a + backgroundLayer.rgb * backgroundVisibleAlpha;
        vec3 colorOut = alphaOut > 0.0001 ? mixedPremul / alphaOut : vec3(0.0);

        if (uProgressEnabled > 0.5) {
          float coordinate = spriteProgressCoordinate(vUV, uProgressShape, uProgressDirection, uProgressAngleRad, uProgressStartAngleRad, uProgressSweepAngleRad, uProgressInnerRadius, uProgressOuterRadius, uProgressCenterOffsetPx, uProgressAxisScale);
          float edge = clamp(uProgressSoftness, 0.0, 0.5);
          float filled = edge <= 0.0001 ? step(coordinate, uProgress) : 1.0 - smoothstep(uProgress - edge, uProgress + edge, coordinate);
          float useTexture = mix(uUnfilledUseTexture, uFilledUseTexture, filled);
          vec3 regionColor = mix(uUnfilledColor, uFilledColor, filled);
          float regionOpacity = mix(uUnfilledOpacity, uFilledOpacity, filled);
          colorOut = mix(regionColor, colorOut, useTexture);
          alphaOut = mix(1.0, alphaOut, useTexture) * clamp(regionOpacity, 0.0, 1.0);
        }

        /* mySprite:fragment:modifyColor */
        /* mySprite:fragment:modifyField */
        /* mySprite:fragment:beforeOutput */
        gl_FragColor = vec4(colorOut, maskAlpha * alphaOut);
      }
    `;
    Effect.ShadersStore[`${FRAGMENT_SHADER_NAME}PixelShader`] = fragmentShader;
    Effect.ShadersStore[`${FRAGMENT_SHADER_NAME}FragmentShader`] = fragmentShader;
    Effect.ShadersStore[`${FRAGMENT_SHADER_NAME}Shader`] = fragmentShader;
  }
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const toOpacity = (value: unknown, fallback = 1): number => {
  const num = Number(value);
  return clamp01(Number.isFinite(num) ? num : fallback);
};

const toColor3 = (value: string | undefined, fallback: string): Color3 => {
  const source = typeof value === 'string' && value.trim() ? value : fallback;
  return Color3.FromHexString(source);
};

const buildStripeTexture = (scene: Scene, preset: StripePresetLike, name: string): DynamicTexture => {
  const segments: StripeSegmentLike[] = Array.isArray(preset.segments) && preset.segments.length > 0
    ? preset.segments
    : [{ width: 24, fillType: 'solid', color: '#ffffff', opacity: 1 }];
  const period = Math.max(1, Math.round(segments.reduce((sum, seg) => sum + Math.max(0.01, Number(seg?.width) || 0.01), 0)));
  const texture = new DynamicTexture(name, { width: period, height: 8 }, scene, false);
  texture.wrapU = Texture.CLAMP_ADDRESSMODE;
  texture.wrapV = Texture.CLAMP_ADDRESSMODE;
  texture.updateSamplingMode(Texture.BILINEAR_SAMPLINGMODE);
  texture.hasAlpha = true;

  const ctx = texture.getContext();
  const height = texture.getSize().height;

  let cursor = 0;
  for (const seg of segments) {
    const segWidth = Math.max(1, Math.round(Math.max(0.01, Number(seg?.width) || 0.01)));
    const alpha = toOpacity(seg?.opacity, 1);
    ctx.globalAlpha = alpha;
    if (seg?.fillType === 'gradient') {
      const grad = ctx.createLinearGradient(cursor, 0, cursor + segWidth, 0);
      grad.addColorStop(0, seg?.fromColor || '#ffffff');
      grad.addColorStop(1, seg?.toColor || '#000000');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = seg?.color || '#ffffff';
    }
    ctx.fillRect(cursor, 0, segWidth, height);
    cursor += segWidth;
  }

  if (cursor < period) {
    const last = segments[segments.length - 1];
    ctx.globalAlpha = toOpacity(last?.opacity, 1);
    ctx.fillStyle = last?.fillType === 'gradient' ? (last?.toColor || '#000000') : (last?.color || '#ffffff');
    ctx.fillRect(cursor, 0, period - cursor, height);
  }
  ctx.globalAlpha = 1;
  texture.update(false);
  return texture;
};

const getPatternPeriodPx = (preset: StripePresetLike): number => {
  const segments = Array.isArray(preset?.segments) && preset.segments.length > 0
    ? preset.segments
    : [{ width: 24 }];
  return Math.max(1, segments.reduce((sum, seg) => sum + Math.max(0.01, Number(seg?.width) || 0.01), 0));
};

const createSolidWhiteTexture = (scene: Scene, name: string): DynamicTexture => {
  const texture = new DynamicTexture(name, { width: 1, height: 1 }, scene, false);
  const ctx = texture.getContext();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1, 1);
  texture.hasAlpha = true;
  texture.update(false);
  return texture;
};

export const createSpriteEffectMaterial = (
  scene: Scene,
  name: string,
  initialPreset: StripePresetLike,
  options: CreateStripeShaderMaterialOptions = {}
): StripeShaderMaterialController => {
  ensureShaderRegistered();
  const shaderProgram = registerSpriteShaderProgram(composeSpriteShader(stripedSpriteRecipe, {
    vertex: Effect.ShadersStore[`${VERTEX_SHADER_NAME}VertexShader`] ?? '',
    fragment: Effect.ShadersStore[`${FRAGMENT_SHADER_NAME}PixelShader`] ?? ''
  }));

  const ownsMaskTexture = !options.sourceTexture;
  const maskTexture = options.sourceTexture ?? (options.maskTexturePath
    ? new Texture(options.maskTexturePath, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE)
    : createSolidWhiteTexture(scene, `${name}_whiteMaskTexture`));
  maskTexture.hasAlpha = true;
  maskTexture.wrapU = Texture.CLAMP_ADDRESSMODE;
  maskTexture.wrapV = Texture.CLAMP_ADDRESSMODE;

  const material = new ShaderMaterial(
    name,
    scene,
    {
      vertex: shaderProgram.vertexName,
      fragment: shaderProgram.fragmentName
    },
    {
      attributes: shaderProgram.attributes,
      uniforms: shaderProgram.uniforms,
      samplers: shaderProgram.samplers
    }
  );
  material.backFaceCulling = false;
  material.needAlphaBlending = () => true;
  material.alphaMode = 2;

  let stripeTexture = buildStripeTexture(scene, initialPreset, `${name}_stripeTexture`);
  material.setTexture('uMaskTexture', maskTexture);
  material.setTexture('uStripeTexture', stripeTexture);
  // A caller-provided texture is both the visual source and the sprite silhouette.
  // Surface-backed sprites pass their already configured atlas Texture here, so
  // limiting the mask switch to maskTexturePath would paint stripes over the
  // transparent part of the whole atlas frame.
  material.setFloat('uUseMask', options.maskTexturePath || options.sourceTexture ? 1 : 0);

  const applyPreset = (preset: StripePresetLike) => {
    const mode = preset?.mode === 'texture' ? 'texture' : preset?.mode === 'solid' ? 'solid' : 'stripes';
    const angleDeg = Number(preset?.angleDeg);
    const speed = Number(preset?.speed);
    const solidOpacity = Number(preset?.solidOpacity);
    const backgroundOpacity = Number(preset?.backgroundOpacity);

    stripeTexture.dispose();
    stripeTexture = buildStripeTexture(scene, preset, `${name}_stripeTexture`);
    material.setTexture('uStripeTexture', stripeTexture);
    material.setFloat('uUseSolid', mode === 'solid' ? 1 : mode === 'texture' ? 2 : 0);
    material.setColor3('uSolidColor', toColor3(preset?.solidColor, '#ffffff'));
    material.setFloat('uSolidAlpha', Number.isFinite(solidOpacity) ? clamp01(solidOpacity) : 1);
    material.setColor3('uBackgroundColor', toColor3(preset?.background, '#000000'));
    material.setFloat('uBackgroundAlpha', Number.isFinite(backgroundOpacity) ? clamp01(backgroundOpacity) : 1);
    material.setFloat('uAngleRad', ((Number.isFinite(angleDeg) ? angleDeg : 45) * Math.PI) / 180);
    material.setFloat('uSpeed', Number.isFinite(speed) ? speed : 80);
    material.setFloat('uPatternPeriodPx', getPatternPeriodPx(preset));
  };

  const applyRenderSize = (widthPx: number, heightPx: number) => {
    const width = Number.isFinite(widthPx) && widthPx > 0 ? widthPx : 1;
    const height = Number.isFinite(heightPx) && heightPx > 0 ? heightPx : 1;
    material.setVector2('uRenderSizePx', new Vector2(width, height));
  };

  const applyProgressGeometry = (prefix: '' | 'Stripe' | 'Background', progress: StripeProgressMaskOptions) => {
    const resolved = resolveProgressOptions(progress);
    const startAngleDeg = Number(progress.startAngleDeg);
    const sweepAngleDeg = Number(progress.sweepAngleDeg);
    const innerRadius = Number(progress.innerRadius);
    const outerRadius = Number(progress.outerRadius);
    const softness = Number(progress.softness);
    material.setFloat(`u${prefix}ProgressShape`, progressShapeValue(resolved.shape));
    material.setFloat(`u${prefix}ProgressDirection`, progressDirectionValue(resolved.direction));
    material.setFloat(`u${prefix}ProgressAngleRad`, resolved.angleDeg * Math.PI / 180);
    material.setFloat(`u${prefix}ProgressStartAngleRad`, (Number.isFinite(startAngleDeg) ? startAngleDeg : 0) * Math.PI / 180);
    material.setFloat(`u${prefix}ProgressSweepAngleRad`, Math.max(0.001, Math.min(360, Math.abs(Number.isFinite(sweepAngleDeg) ? sweepAngleDeg : 360))) * Math.PI / 180);
    material.setFloat(`u${prefix}ProgressInnerRadius`, clamp01(Number.isFinite(innerRadius) ? innerRadius : 0.65));
    material.setFloat(`u${prefix}ProgressOuterRadius`, clamp01(Number.isFinite(outerRadius) ? outerRadius : 1));
    material.setFloat(`u${prefix}ProgressSoftness`, Math.max(0, Math.min(0.5, Number.isFinite(softness) ? softness : 0)));
    material.setVector2(`u${prefix}ProgressCenterOffsetPx`, new Vector2(
      Number.isFinite(Number(progress.centerOffsetPx?.x)) ? Number(progress.centerOffsetPx?.x) : 0,
      Number.isFinite(Number(progress.centerOffsetPx?.y)) ? Number(progress.centerOffsetPx?.y) : 0
    ));
    material.setVector2(`u${prefix}ProgressAxisScale`, new Vector2(
      Number.isFinite(Number(progress.axisScale?.x)) ? Math.max(0.001, Math.abs(Number(progress.axisScale?.x))) : 1,
      Number.isFinite(Number(progress.axisScale?.y)) ? Math.max(0.001, Math.abs(Number(progress.axisScale?.y))) : 1
    ));
    return resolved;
  };

  const applyProgress = (progress: StripeProgressMaskOptions = {}) => {
    const resolved = applyProgressGeometry('', progress);
    const value = Number(progress.progress ?? progress.value);
    const filled = progress.filled ?? {};
    const unfilled = progress.unfilled ?? {};
    material.setFloat('uProgressEnabled', progress.enabled !== false && resolved.shape !== 'none' ? 1 : 0);
    material.setFloat('uProgress', Number.isFinite(value) ? value : 1);
    material.setFloat('uFilledUseTexture', filled.source === 'color' ? 0 : 1);
    material.setColor3('uFilledColor', toColor3(filled.color, '#ffffff'));
    material.setFloat('uFilledOpacity', toOpacity(filled.opacity, 1));
    material.setFloat('uUnfilledUseTexture', unfilled.source === 'color' ? 0 : 1);
    material.setColor3('uUnfilledColor', toColor3(unfilled.color, '#000000'));
    material.setFloat('uUnfilledOpacity', toOpacity(unfilled.opacity, 0.25));
  };

  const applyLayerProgressPart = (prefix: 'Stripe' | 'Background', progress: StripeProgressMaskOptions = {}) => {
    const resolved = applyProgressGeometry(prefix, progress);
    const value = Number(progress.progress ?? progress.value);
    const filled = progress.filled ?? {};
    const unfilled = progress.unfilled ?? {};
    material.setFloat(`u${prefix}ProgressEnabled`, progress.enabled !== false && resolved.shape !== 'none' ? 1 : 0);
    material.setFloat(`u${prefix}Progress`, Number.isFinite(value) ? value : 1);
    material.setFloat(`u${prefix}FilledUseTexture`, filled.source === 'color' ? 0 : 1);
    material.setColor3(`u${prefix}FilledColor`, toColor3(filled.color, '#ffffff'));
    material.setFloat(`u${prefix}FilledOpacity`, toOpacity(filled.opacity, 1));
    material.setFloat(`u${prefix}UnfilledUseTexture`, unfilled.source === 'color' ? 0 : 1);
    material.setColor3(`u${prefix}UnfilledColor`, toColor3(unfilled.color, '#000000'));
    material.setFloat(`u${prefix}UnfilledOpacity`, toOpacity(unfilled.opacity, 0.25));
  };

  const applyLayerProgress = (progress: StripeLayerProgressOptions = {}) => {
    material.setFloat('uLayerProgressEnabled', progress.enabled === true ? 1 : 0);
    applyLayerProgressPart('Stripe', progress.stripe);
    applyLayerProgressPart('Background', progress.background);
  };

  const applyNoiseErode = (options: SpriteNoiseErodeOptions) => {
    const progress = Number(options.progress);
    material.setFloat('uMySpriteNoiseErodeEnabled', options.enabled === true ? 1 : 0);
    for (const module of stripedSpriteRecipe.modules) for (const toggle of module.runtimeToggles ?? []) {
      const value = options[toggle.optionKey as keyof SpriteNoiseErodeOptions];
      material.setFloat(toggle.uniform, typeof value === 'boolean' ? (value ? 1 : 0) : toggle.defaultEnabled === false ? 0 : 1);
    }
    material.setFloat('uMySpriteNoiseErodeProgress', Number.isFinite(progress) ? clamp01(progress) : 0);
    material.setFloat('uMySpriteNoiseErodeProgressPower', Math.max(.1, Number(options.progressPower) || 1));
    material.setFloat('uMySpriteNoiseErodeStartHold', Math.max(0, Math.min(.9, Number(options.startHold) || 0)));
    material.setFloat('uMySpriteNoiseErodeEndFade', Math.max(0, Math.min(.5, Number.isFinite(Number(options.endFade)) ? Number(options.endFade) : .04)));
    material.setFloat('uMySpriteNoiseErodeFieldBlendMode', spriteNoiseErodeBlendModeValue(options.fieldBlendMode));
    material.setFloat('uMySpriteNoiseErodeFieldInvert', clamp01(Number(options.fieldInvert) || 0));
    material.setFloat('uMySpriteNoiseErodeFieldContrast', Math.max(.1, Number(options.fieldContrast) || 1));
    material.setFloat('uMySpriteNoiseErodeFieldOffset', Math.max(-1, Math.min(1, Number(options.fieldOffset) || 0)));
    material.setFloat('uMySpriteNoiseErodeDirectionalStrength', clamp01(Number.isFinite(Number(options.directionalStrength)) ? Number(options.directionalStrength) : 1));
    material.setFloat('uMySpriteNoiseErodeRadialStrength', clamp01(Number(options.radialStrength) || 0));
    material.setFloat('uMySpriteNoiseErodeRadialDirection', Math.max(-1, Math.min(1, Number.isFinite(Number(options.radialDirection)) ? Number(options.radialDirection) : 1)));
    material.setVector2('uMySpriteNoiseErodeCenter', new Vector2(Number(options.centerX) || 0, Number(options.centerY) || 0));
    material.setVector2('uMySpriteNoiseErodeRadialScale', new Vector2(Math.max(.1, Number(options.radialScaleX) || 1), Math.max(.1, Number(options.radialScaleY) || 1)));
    material.setFloat('uMySpriteNoiseErodeRadialRotation', (Number(options.radialRotationDeg) || 0) * Math.PI / 180);
    material.setFloat('uMySpriteNoiseErodeRadialPower', Math.max(.1, Number(options.radialPower) || 1));
    material.setFloat('uMySpriteNoiseErodeRadialNoiseStrength', clamp01(Number.isFinite(Number(options.radialNoiseStrength)) ? Number(options.radialNoiseStrength) : .2));
    material.setFloat('uMySpriteNoiseErodeRadialNoiseScale', Math.max(1, Number(options.radialNoiseScale) || 6));
    material.setFloat('uMySpriteNoiseErodeCrystalStrength', clamp01(Number(options.crystalStrength) || 0));
    material.setFloat('uMySpriteNoiseErodeCrystalScale', Math.max(.25, Number(options.crystalScale) || 8));
    material.setFloat('uMySpriteNoiseErodeCrystalSharpness', clamp01(Number.isFinite(Number(options.crystalSharpness)) ? Number(options.crystalSharpness) : .5));
    material.setFloat('uMySpriteNoiseErodeCrystalAspect', Math.max(.1, Number(options.crystalAspect) || 1));
    material.setFloat('uMySpriteNoiseErodeCrystalRotation', (Number(options.crystalRotationDeg) || 0) * Math.PI / 180);
    material.setFloat('uMySpriteNoiseErodeCrystalCrackWidth', Math.max(.001, Math.min(.25, Number(options.crystalCrackWidth) || .035)));
    material.setFloat('uMySpriteNoiseErodeCrystalJitter', clamp01(Number.isFinite(Number(options.crystalJitter)) ? Number(options.crystalJitter) : .12));
    material.setFloat('uMySpriteNoiseErodeCrystalBranchStrength', clamp01(Number.isFinite(Number(options.crystalBranchStrength)) ? Number(options.crystalBranchStrength) : .35));
    material.setFloat('uMySpriteNoiseErodeCrystalBranchScale', Math.max(.25, Number(options.crystalBranchScale) || 1.7));
    material.setFloat('uMySpriteNoiseErodeSpiralStrength', Math.max(0, Number(options.spiralStrength) || 0));
    material.setFloat('uMySpriteNoiseErodeSpiralTurns', Math.max(0, Number(options.spiralTurns) || 3));
    material.setFloat('uMySpriteNoiseErodeSpiralSpeed', Number.isFinite(Number(options.spiralSpeed)) ? Number(options.spiralSpeed) : 2.5);
    material.setFloat('uMySpriteNoiseErodeSpiralDirection', Math.max(-1, Math.min(1, Number.isFinite(Number(options.spiralDirection)) ? Number(options.spiralDirection) : 1)));
    material.setFloat('uMySpriteNoiseErodeSpiralRadialFrequency', Math.max(0, Number(options.spiralRadialFrequency) || 18));
    material.setFloat('uMySpriteNoiseErodeVoidPullStrength', clamp01(Number(options.voidPullStrength) || 0));
    material.setFloat('uMySpriteNoiseErodeVoidPullRadius', Math.max(.05, Number(options.voidPullRadius) || .72));
    material.setFloat('uMySpriteNoiseErodeVoidPullFalloff', Math.max(.05, Math.min(1, Number(options.voidPullFalloff) || .67)));
    material.setFloat('uMySpriteNoiseErodeVoidPullPower', Math.max(.1, Number(options.voidPullPower) || 2));
    material.setFloat('uMySpriteNoiseErodeAngle', (Number(options.directionAngleDeg) || 90) * Math.PI / 180);
    material.setFloat('uMySpriteNoiseErodeScale', Math.max(1, Number(options.noiseScale) || 7));
    material.setFloat('uMySpriteNoiseErodeStrength', clamp01(Number.isFinite(Number(options.noiseStrength)) ? Number(options.noiseStrength) : .62));
    material.setFloat('uMySpriteNoiseErodeSpeed', Number.isFinite(Number(options.noiseSpeed)) ? Number(options.noiseSpeed) : .08);
    material.setFloat('uMySpriteNoiseErodeNoiseDetail', clamp01(Number.isFinite(Number(options.noiseDetail)) ? Number(options.noiseDetail) : .72));
    material.setFloat('uMySpriteNoiseErodeNoiseRoughness', clamp01(Number.isFinite(Number(options.noiseRoughness)) ? Number(options.noiseRoughness) : .5));
    material.setFloat('uMySpriteNoiseErodeNoiseAspect', Math.max(.1, Number(options.noiseAspect) || 1));
    material.setFloat('uMySpriteNoiseErodeNoiseRotation', (Number(options.noiseRotationDeg) || 0) * Math.PI / 180);
    material.setFloat('uMySpriteNoiseErodeNoiseFlowAngle', (Number.isFinite(Number(options.noiseFlowAngleDeg)) ? Number(options.noiseFlowAngleDeg) : 90) * Math.PI / 180);
    material.setFloat('uMySpriteNoiseErodeWarpStrength', clamp01(Number(options.warpStrength) || 0));
    material.setFloat('uMySpriteNoiseErodeWarpScale', Math.max(.25, Number(options.warpScale) || 4));
    material.setFloat('uMySpriteNoiseErodeWarpSpeed', Number.isFinite(Number(options.warpSpeed)) ? Number(options.warpSpeed) : .05);
    material.setFloat('uMySpriteNoiseErodeEdgeWidth', Math.max(.001, Number(options.edgeWidth) || .1));
    material.setFloat('uMySpriteNoiseErodeEdgeSoftness', Math.max(.001, Number(options.edgeSoftness) || .025));
    material.setColor3('uMySpriteNoiseErodeEdgeColor', toColor3(options.edgeColor, '#ffb45b'));
    material.setFloat('uMySpriteNoiseErodeEdgeIntensity', Math.max(0, Number.isFinite(Number(options.edgeIntensity)) ? Number(options.edgeIntensity) : 1.4));
    material.setFloat('uMySpriteNoiseErodeEdgeInnerWidth', Math.max(.01, Number(options.edgeInnerWidth) || .32));
    material.setFloat('uMySpriteNoiseErodeEdgeOuterWidth', Math.max(.01, Number(options.edgeOuterWidth) || 1));
    material.setColor3('uMySpriteNoiseErodeEdgeInnerColor', toColor3(options.edgeInnerColor, '#fff1c7'));
    material.setColor3('uMySpriteNoiseErodeEdgeOuterColor', toColor3(options.edgeOuterColor ?? options.edgeColor, '#ffb45b'));
    material.setFloat('uMySpriteNoiseErodeEdgeFalloffPower', Math.max(.1, Number(options.edgeFalloffPower) || 1));
    material.setFloat('uMySpriteNoiseErodeEdgeNoiseStrength', clamp01(Number(options.edgeNoiseStrength) || 0));
    material.setFloat('uMySpriteNoiseErodeEdgeNoiseScale', Math.max(.25, Number(options.edgeNoiseScale) || 18));
    material.setFloat('uMySpriteNoiseErodeEdgePulseStrength', clamp01(Number(options.edgePulseStrength) || 0));
    material.setFloat('uMySpriteNoiseErodeEdgePulseSpeed', Math.max(0, Number(options.edgePulseSpeed) || 7));
    material.setFloat('uMySpriteNoiseErodeResidueWidth', Math.max(.001, Number(options.residueWidth) || .18));
    material.setFloat('uMySpriteNoiseErodeResidueOpacity', clamp01(Number(options.residueOpacity) || 0));
    material.setColor3('uMySpriteNoiseErodeResidueColor', toColor3(options.residueColor, '#4a4038'));
    material.setFloat('uMySpriteNoiseErodeResidueDensity', clamp01(Number.isFinite(Number(options.residueDensity)) ? Number(options.residueDensity) : .55));
    material.setFloat('uMySpriteNoiseErodeResidueNoiseScale', Math.max(.25, Number(options.residueNoiseScale) || 24));
    material.setFloat('uMySpriteNoiseErodeResidueDecayPower', Math.max(.1, Number(options.residueDecayPower) || 1.4));
    material.setFloat('uMySpriteNoiseErodeResidueFadeStart', Math.max(0, Math.min(.99, Number.isFinite(Number(options.residueFadeStart)) ? Number(options.residueFadeStart) : .82)));
    material.setFloat('uMySpriteNoiseErodeResidueGlow', Math.max(0, Number(options.residueGlow) || 0));
    material.setFloat('uMySpriteNoiseErodeVertexDeformStrength', Math.max(0, Math.min(2, Number(options.vertexDeformStrength) || 0)));
    material.setFloat('uMySpriteNoiseErodeVertexBendX', Math.max(-2, Math.min(2, Number(options.vertexBendX) || 0)));
    material.setFloat('uMySpriteNoiseErodeVertexBendY', Math.max(-2, Math.min(2, Number(options.vertexBendY) || 0)));
    material.setFloat('uMySpriteNoiseErodeVertexTwist', Math.max(-6.3, Math.min(6.3, Number(options.vertexTwist) || 0)));
    material.setFloat('uMySpriteNoiseErodeVertexBulge', Math.max(-2, Math.min(2, Number(options.vertexBulge) || 0)));
    material.setFloat('uMySpriteNoiseErodeVertexDepth', Math.max(-2, Math.min(2, Number(options.vertexDepth) || 0)));
    material.setFloat('uMySpriteNoiseErodeVertexWaveStrength', clamp01(Number(options.vertexWaveStrength) || 0));
    material.setFloat('uMySpriteNoiseErodeVertexWaveScale', Math.max(.1, Number(options.vertexWaveScale) || 8));
    material.setFloat('uMySpriteNoiseErodeVertexWaveSpeed', Math.max(-20, Math.min(20, Number.isFinite(Number(options.vertexWaveSpeed)) ? Number(options.vertexWaveSpeed) : 3)));
    material.setFloat('uMySpriteNoiseErodeVertexAnchorY', Math.max(0, Math.min(.99, Number(options.vertexAnchorY) || 0)));
    material.setFloat('uMySpriteNoiseErodeRise', Math.max(-4, Math.min(8, Number(options.rise) || 0)));
    material.setFloat('uMySpriteNoiseErodeDriftX', Math.max(-4, Math.min(4, Number(options.driftX) || 0)));
    material.setFloat('uMySpriteNoiseErodeTurbulence', Math.max(0, Math.min(2, Number(options.turbulence) || 0)));
    material.setColor3('uMySpriteNoiseErodeAshColor', toColor3(options.ashColor, '#b8b8b8'));
    material.setFloat('uMySpriteNoiseErodeAshTrail', Math.max(.001, Number(options.ashTrail) || .2));
    material.setFloat('uMySpriteNoiseErodeAshDensity', clamp01(Number(options.ashDensity) || 0));
    material.setFloat('uMySpriteNoiseErodeAshOpacity', clamp01(Number(options.ashOpacity) || 0));
    material.setFloat('uMySpriteNoiseErodeFlickerSpeed', Math.max(0, Number(options.flickerSpeed) || 0));
    material.setFloat('uMySpriteNoiseErodeAlphaCutoff', Math.max(0, Math.min(.5, Number.isFinite(Number(options.alphaCutoff)) ? Number(options.alphaCutoff) : .01)));
    material.setColor3('uMySpriteNoiseErodeCharColor', toColor3(options.charColor, '#202020'));
    material.setFloat('uMySpriteNoiseErodeCharStrength', clamp01(Number.isFinite(Number(options.charStrength)) ? Number(options.charStrength) : .8));
    material.setFloat('uMySpriteNoiseErodeSeed', Number.isFinite(Number(options.seed)) ? Number(options.seed) : 1);
  };

  const applyColorOverlay = (color: Color3, alpha: number) => {
    material.setColor3('uMySpriteOverlayColor', color);
    material.setFloat('uMySpriteOverlayAlpha', clamp01(Number.isFinite(alpha) ? alpha : 0));
  };

  applyPreset(initialPreset);
  applyRenderSize(options.renderSizePx?.width || 512, options.renderSizePx?.height || 512);
  applyProgress(options.progress);
  applyLayerProgress(options.layerProgress);
  applyNoiseErode({ ...FULL_SPRITE_NOISE_ERODE_FEATURES, enabled: false, progress: 0 });
  applyColorOverlay(Color3.Black(), 0);

  return {
    material,
    updatePreset: (preset) => {
      applyPreset(preset);
    },
    updateProgress: applyProgress,
    updateLayerProgress: applyLayerProgress,
    updateDissolve: applyNoiseErode,
    updateNoiseErode: applyNoiseErode,
    updateColorOverlay: applyColorOverlay,
    updateTime: (timeSec) => {
      material.setFloat('uTime', Number.isFinite(timeSec) ? timeSec : 0);
    },
    updateRenderSize: applyRenderSize,
    dispose: () => {
      stripeTexture.dispose();
      if (ownsMaskTexture) maskTexture.dispose();
      material.dispose();
    }
  };
};

export const createSpriteMaskMaterial = (
  scene: Scene,
  name: string,
  maskTexturePath: string,
  initialPreset: StripePresetLike,
  renderSizePx?: CreateStripeShaderMaterialOptions['renderSizePx']
): StripeMaskMaterialController => createSpriteEffectMaterial(scene, name, initialPreset, {
  maskTexturePath,
  renderSizePx
});
