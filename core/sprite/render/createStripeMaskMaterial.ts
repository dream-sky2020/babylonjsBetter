import { Color3, DynamicTexture, Effect, Scene, ShaderMaterial, Texture, Vector2 } from '@babylonjs/core';

export type StripeSegmentLike = {
  width?: number;
  fillType?: 'solid' | 'gradient';
  color?: string;
  fromColor?: string;
  toColor?: string;
  opacity?: number;
};

export type StripePresetLike = {
  mode?: 'solid' | 'stripes';
  solidColor?: string;
  solidOpacity?: number;
  angleDeg?: number;
  speed?: number;
  background?: string;
  backgroundOpacity?: number;
  segments?: StripeSegmentLike[];
};

export type StripeProgressMode =
  | 'none'
  | 'left-to-right'
  | 'right-to-left'
  | 'bottom-to-top'
  | 'top-to-bottom'
  | 'radial-outward'
  | 'radial-inward'
  | 'sector-clockwise'
  | 'sector-counterclockwise';

export type StripeProgressRegionStyle = {
  source?: 'texture' | 'color';
  color?: string;
  opacity?: number;
};

export type StripeProgressMaskOptions = {
  enabled?: boolean;
  value?: number;
  mode?: StripeProgressMode;
  /** 扇形模式的起始角。0 度朝上，正方向为顺时针。 */
  startAngleDeg?: number;
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
  updateTime: (timeSec: number) => void;
  updateRenderSize: (widthPx: number, heightPx: number) => void;
  dispose: () => void;
};

export type StripeShaderMaterialController = StripeMaskMaterialController;

export type CreateStripeShaderMaterialOptions = {
  maskTexturePath?: string;
  progress?: StripeProgressMaskOptions;
  layerProgress?: StripeLayerProgressOptions;
  renderSizePx?: {
    width: number;
    height: number;
  };
};

const VERTEX_SHADER_NAME = 'spriteStripeVertex';
const FRAGMENT_SHADER_NAME = 'spriteStripeFragment';

const ensureShaderRegistered = () => {
  if (!Effect.ShadersStore[`${VERTEX_SHADER_NAME}VertexShader`]) {
    const vertexShader = `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      uniform mat4 worldViewProjection;
      varying vec2 vUV;
      void main(void) {
        gl_Position = worldViewProjection * vec4(position, 1.0);
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
      uniform float uProgressMode;
      uniform float uProgressStartAngleRad;
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
      uniform float uStripeProgressMode;
      uniform float uStripeProgressStartAngleRad;
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
      uniform float uBackgroundProgressMode;
      uniform float uBackgroundProgressStartAngleRad;
      uniform vec2 uBackgroundProgressCenterOffsetPx;
      uniform vec2 uBackgroundProgressAxisScale;
      uniform float uBackgroundFilledUseTexture;
      uniform vec3 uBackgroundFilledColor;
      uniform float uBackgroundFilledOpacity;
      uniform float uBackgroundUnfilledUseTexture;
      uniform vec3 uBackgroundUnfilledColor;
      uniform float uBackgroundUnfilledOpacity;

      const float PI = 3.14159265358979323846;

      float progressCoordinate(vec2 uv, float mode, float startAngle, vec2 centerOffsetPx, vec2 axisScale) {
        if (mode < 1.5) return uv.x;
        if (mode < 2.5) return 1.0 - uv.x;
        if (mode < 3.5) return uv.y;
        if (mode < 4.5) return 1.0 - uv.y;

        vec2 safeRenderSize = max(uRenderSizePx, vec2(1.0));
        float referenceSize = max(1.0, min(safeRenderSize.x, safeRenderSize.y));
        vec2 safeAxisScale = max(abs(axisScale), vec2(0.001));
        vec2 centeredUv = ((uv - vec2(0.5)) * safeRenderSize - centerOffsetPx) / referenceSize / safeAxisScale;
        float normalizedRadius = clamp(length(centeredUv) * 2.0, 0.0, 1.0);
        if (mode < 5.5) return normalizedRadius;
        if (mode < 6.5) return 1.0 - normalizedRadius;

        // atan(x, y) makes zero point upward. Normalize to a clockwise 0..1 turn.
        float clockwiseAngle = atan(centeredUv.x, centeredUv.y);
        float start = startAngle;
        float clockwiseTurn = mod(clockwiseAngle - start + 2.0 * PI, 2.0 * PI) / (2.0 * PI);
        if (mode < 7.5) return clockwiseTurn;
        return mod(start - clockwiseAngle + 2.0 * PI, 2.0 * PI) / (2.0 * PI);
      }

      vec4 applyLayerProgress(
        vec4 layer,
        float enabled,
        float progress,
        float mode,
        float startAngle,
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
        float coordinate = progressCoordinate(vUV, mode, startAngle, centerOffsetPx, axisScale);
        float filled = step(coordinate, clamp(progress, 0.0, 1.0));
        float useTexture = mix(unfilledUseTexture, filledUseTexture, filled);
        vec3 regionColor = mix(unfilledColor, filledColor, filled);
        float regionOpacity = mix(unfilledOpacity, filledOpacity, filled);
        return vec4(mix(regionColor, layer.rgb, useTexture), layer.a * clamp(regionOpacity, 0.0, 1.0));
      }

      void main(void) {
        float maskAlpha = 1.0;
        if (uUseMask > 0.5) {
          maskAlpha = texture2D(uMaskTexture, vUV).a;
        }
        if (maskAlpha <= 0.001) {
          discard;
        }

        vec4 stripeLayer = vec4(uSolidColor, clamp(uSolidAlpha, 0.0, 1.0));
        vec4 backgroundLayer = vec4(0.0);
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
          stripeLayer = applyLayerProgress(stripeLayer, uStripeProgressEnabled, uStripeProgress, uStripeProgressMode, uStripeProgressStartAngleRad, uStripeProgressCenterOffsetPx, uStripeProgressAxisScale, uStripeFilledUseTexture, uStripeFilledColor, uStripeFilledOpacity, uStripeUnfilledUseTexture, uStripeUnfilledColor, uStripeUnfilledOpacity);
          backgroundLayer = applyLayerProgress(backgroundLayer, uBackgroundProgressEnabled, uBackgroundProgress, uBackgroundProgressMode, uBackgroundProgressStartAngleRad, uBackgroundProgressCenterOffsetPx, uBackgroundProgressAxisScale, uBackgroundFilledUseTexture, uBackgroundFilledColor, uBackgroundFilledOpacity, uBackgroundUnfilledUseTexture, uBackgroundUnfilledColor, uBackgroundUnfilledOpacity);
        }

        float backgroundVisibleAlpha = backgroundLayer.a * (1.0 - stripeLayer.a);
        float alphaOut = stripeLayer.a + backgroundVisibleAlpha;
        vec3 mixedPremul = stripeLayer.rgb * stripeLayer.a + backgroundLayer.rgb * backgroundVisibleAlpha;
        vec3 colorOut = alphaOut > 0.0001 ? mixedPremul / alphaOut : vec3(0.0);

        if (uProgressEnabled > 0.5) {
          float coordinate = progressCoordinate(vUV, uProgressMode, uProgressStartAngleRad, uProgressCenterOffsetPx, uProgressAxisScale);
          float filled = step(coordinate, clamp(uProgress, 0.0, 1.0));
          float useTexture = mix(uUnfilledUseTexture, uFilledUseTexture, filled);
          vec3 regionColor = mix(uUnfilledColor, uFilledColor, filled);
          float regionOpacity = mix(uUnfilledOpacity, uFilledOpacity, filled);
          colorOut = mix(regionColor, colorOut, useTexture);
          alphaOut = mix(1.0, alphaOut, useTexture) * clamp(regionOpacity, 0.0, 1.0);
        }

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

const progressModeValue = (mode: StripeProgressMode | undefined): number => {
  if (mode === 'left-to-right') return 1;
  if (mode === 'right-to-left') return 2;
  if (mode === 'bottom-to-top') return 3;
  if (mode === 'top-to-bottom') return 4;
  if (mode === 'radial-outward') return 5;
  if (mode === 'radial-inward') return 6;
  if (mode === 'sector-clockwise') return 7;
  if (mode === 'sector-counterclockwise') return 8;
  return 0;
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

export const createStripeShaderMaterial = (
  scene: Scene,
  name: string,
  initialPreset: StripePresetLike,
  options: CreateStripeShaderMaterialOptions = {}
): StripeShaderMaterialController => {
  ensureShaderRegistered();

  const maskTexture = options.maskTexturePath
    ? new Texture(options.maskTexturePath, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE)
    : createSolidWhiteTexture(scene, `${name}_whiteMaskTexture`);
  maskTexture.hasAlpha = true;
  maskTexture.wrapU = Texture.CLAMP_ADDRESSMODE;
  maskTexture.wrapV = Texture.CLAMP_ADDRESSMODE;

  const material = new ShaderMaterial(
    name,
    scene,
    {
      vertex: VERTEX_SHADER_NAME,
      fragment: FRAGMENT_SHADER_NAME
    },
    {
      attributes: ['position', 'uv'],
      uniforms: [
        'worldViewProjection',
        'uSolidColor',
        'uSolidAlpha',
        'uBackgroundColor',
        'uBackgroundAlpha',
        'uUseSolid',
        'uUseMask',
        'uAngleRad',
        'uSpeed',
        'uTime',
        'uPatternPeriodPx',
        'uRenderSizePx',
        'uProgressEnabled',
        'uProgress',
        'uProgressMode',
        'uProgressStartAngleRad',
        'uProgressCenterOffsetPx',
        'uProgressAxisScale',
        'uFilledUseTexture',
        'uFilledColor',
        'uFilledOpacity',
        'uUnfilledUseTexture',
        'uUnfilledColor',
        'uUnfilledOpacity',
        'uLayerProgressEnabled',
        'uStripeProgressEnabled',
        'uStripeProgress',
        'uStripeProgressMode',
        'uStripeProgressStartAngleRad',
        'uStripeProgressCenterOffsetPx',
        'uStripeProgressAxisScale',
        'uStripeFilledUseTexture',
        'uStripeFilledColor',
        'uStripeFilledOpacity',
        'uStripeUnfilledUseTexture',
        'uStripeUnfilledColor',
        'uStripeUnfilledOpacity',
        'uBackgroundProgressEnabled',
        'uBackgroundProgress',
        'uBackgroundProgressMode',
        'uBackgroundProgressStartAngleRad',
        'uBackgroundProgressCenterOffsetPx',
        'uBackgroundProgressAxisScale',
        'uBackgroundFilledUseTexture',
        'uBackgroundFilledColor',
        'uBackgroundFilledOpacity',
        'uBackgroundUnfilledUseTexture',
        'uBackgroundUnfilledColor',
        'uBackgroundUnfilledOpacity'
      ],
      samplers: ['uMaskTexture', 'uStripeTexture']
    }
  );
  material.backFaceCulling = false;
  material.needAlphaBlending = () => true;
  material.alphaMode = 2;

  let stripeTexture = buildStripeTexture(scene, initialPreset, `${name}_stripeTexture`);
  material.setTexture('uMaskTexture', maskTexture);
  material.setTexture('uStripeTexture', stripeTexture);
  material.setFloat('uUseMask', options.maskTexturePath ? 1 : 0);

  const applyPreset = (preset: StripePresetLike) => {
    const mode = preset?.mode === 'solid' ? 'solid' : 'stripes';
    const angleDeg = Number(preset?.angleDeg);
    const speed = Number(preset?.speed);
    const solidOpacity = Number(preset?.solidOpacity);
    const backgroundOpacity = Number(preset?.backgroundOpacity);

    stripeTexture.dispose();
    stripeTexture = buildStripeTexture(scene, preset, `${name}_stripeTexture`);
    material.setTexture('uStripeTexture', stripeTexture);
    material.setFloat('uUseSolid', mode === 'solid' ? 1 : 0);
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

  const applyProgress = (progress: StripeProgressMaskOptions = {}) => {
    const mode = progressModeValue(progress.mode);
    const value = Number(progress.value);
    const startAngleDeg = Number(progress.startAngleDeg);
    const filled = progress.filled ?? {};
    const unfilled = progress.unfilled ?? {};
    material.setFloat('uProgressEnabled', progress.enabled !== false && mode > 0 ? 1 : 0);
    material.setFloat('uProgress', Number.isFinite(value) ? clamp01(value) : 1);
    material.setFloat('uProgressMode', mode);
    material.setFloat('uProgressStartAngleRad', ((Number.isFinite(startAngleDeg) ? startAngleDeg : 0) * Math.PI) / 180);
    material.setVector2('uProgressCenterOffsetPx', new Vector2(
      Number.isFinite(Number(progress.centerOffsetPx?.x)) ? Number(progress.centerOffsetPx?.x) : 0,
      Number.isFinite(Number(progress.centerOffsetPx?.y)) ? Number(progress.centerOffsetPx?.y) : 0
    ));
    material.setVector2('uProgressAxisScale', new Vector2(
      Number.isFinite(Number(progress.axisScale?.x)) ? Math.max(0.001, Math.abs(Number(progress.axisScale?.x))) : 1,
      Number.isFinite(Number(progress.axisScale?.y)) ? Math.max(0.001, Math.abs(Number(progress.axisScale?.y))) : 1
    ));
    material.setFloat('uFilledUseTexture', filled.source === 'color' ? 0 : 1);
    material.setColor3('uFilledColor', toColor3(filled.color, '#ffffff'));
    material.setFloat('uFilledOpacity', toOpacity(filled.opacity, 1));
    material.setFloat('uUnfilledUseTexture', unfilled.source === 'color' ? 0 : 1);
    material.setColor3('uUnfilledColor', toColor3(unfilled.color, '#000000'));
    material.setFloat('uUnfilledOpacity', toOpacity(unfilled.opacity, 0.25));
  };

  const applyLayerProgressPart = (prefix: 'Stripe' | 'Background', progress: StripeProgressMaskOptions = {}) => {
    const mode = progressModeValue(progress.mode);
    const value = Number(progress.value);
    const startAngleDeg = Number(progress.startAngleDeg);
    const filled = progress.filled ?? {};
    const unfilled = progress.unfilled ?? {};
    material.setFloat(`u${prefix}ProgressEnabled`, progress.enabled !== false && mode > 0 ? 1 : 0);
    material.setFloat(`u${prefix}Progress`, Number.isFinite(value) ? clamp01(value) : 1);
    material.setFloat(`u${prefix}ProgressMode`, mode);
    material.setFloat(`u${prefix}ProgressStartAngleRad`, ((Number.isFinite(startAngleDeg) ? startAngleDeg : 0) * Math.PI) / 180);
    material.setVector2(`u${prefix}ProgressCenterOffsetPx`, new Vector2(
      Number.isFinite(Number(progress.centerOffsetPx?.x)) ? Number(progress.centerOffsetPx?.x) : 0,
      Number.isFinite(Number(progress.centerOffsetPx?.y)) ? Number(progress.centerOffsetPx?.y) : 0
    ));
    material.setVector2(`u${prefix}ProgressAxisScale`, new Vector2(
      Number.isFinite(Number(progress.axisScale?.x)) ? Math.max(0.001, Math.abs(Number(progress.axisScale?.x))) : 1,
      Number.isFinite(Number(progress.axisScale?.y)) ? Math.max(0.001, Math.abs(Number(progress.axisScale?.y))) : 1
    ));
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

  applyPreset(initialPreset);
  applyRenderSize(options.renderSizePx?.width || 512, options.renderSizePx?.height || 512);
  applyProgress(options.progress);
  applyLayerProgress(options.layerProgress);

  return {
    material,
    updatePreset: (preset) => {
      applyPreset(preset);
    },
    updateProgress: applyProgress,
    updateLayerProgress: applyLayerProgress,
    updateTime: (timeSec) => {
      material.setFloat('uTime', Number.isFinite(timeSec) ? timeSec : 0);
    },
    updateRenderSize: applyRenderSize,
    dispose: () => {
      stripeTexture.dispose();
      maskTexture.dispose();
      material.dispose();
    }
  };
};

export const createStripeMaskMaterial = (
  scene: Scene,
  name: string,
  maskTexturePath: string,
  initialPreset: StripePresetLike,
  renderSizePx?: CreateStripeShaderMaterialOptions['renderSizePx']
): StripeMaskMaterialController => createStripeShaderMaterial(scene, name, initialPreset, {
  maskTexturePath,
  renderSizePx
});
