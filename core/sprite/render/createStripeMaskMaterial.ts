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
  angleDeg?: number;
  speed?: number;
  background?: string;
  segments?: StripeSegmentLike[];
};

export type StripeMaskMaterialController = {
  material: ShaderMaterial;
  updatePreset: (preset: StripePresetLike) => void;
  updateTime: (timeSec: number) => void;
  updateRenderSize: (widthPx: number, heightPx: number) => void;
  dispose: () => void;
};

export type StripeShaderMaterialController = StripeMaskMaterialController;

export type CreateStripeShaderMaterialOptions = {
  maskTexturePath?: string;
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
      uniform vec3 uBackgroundColor;
      uniform float uUseSolid;
      uniform float uUseMask;
      uniform float uAngleRad;
      uniform float uSpeed;
      uniform float uTime;
      uniform float uPatternPeriodPx;
      uniform vec2 uRenderSizePx;

      void main(void) {
        float maskAlpha = 1.0;
        if (uUseMask > 0.5) {
          maskAlpha = texture2D(uMaskTexture, vUV).a;
        }
        if (maskAlpha <= 0.001) {
          discard;
        }

        vec3 colorOut = uSolidColor;
        float stripeAlpha = 1.0;
        if (uUseSolid < 0.5) {
          vec2 pixelCoord = vUV * uRenderSizePx;
          vec2 centered = pixelCoord - uRenderSizePx * 0.5;
          float c = cos(uAngleRad);
          float s = sin(uAngleRad);
          float localX = centered.x * c + centered.y * s;
          float stripeU = fract((localX + uTime * uSpeed) / max(1.0, uPatternPeriodPx));
          vec4 stripeSample = texture2D(uStripeTexture, vec2(stripeU, 0.5));
          colorOut = mix(uBackgroundColor, stripeSample.rgb, stripeSample.a);
          stripeAlpha = 1.0;
        }

        gl_FragColor = vec4(colorOut, maskAlpha * stripeAlpha);
      }
    `;
    Effect.ShadersStore[`${FRAGMENT_SHADER_NAME}PixelShader`] = fragmentShader;
    Effect.ShadersStore[`${FRAGMENT_SHADER_NAME}FragmentShader`] = fragmentShader;
    Effect.ShadersStore[`${FRAGMENT_SHADER_NAME}Shader`] = fragmentShader;
  }
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

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
    const alpha = clamp01(Number(seg?.opacity) || 1);
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
    ctx.globalAlpha = clamp01(Number(last?.opacity) || 1);
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
        'uBackgroundColor',
        'uUseSolid',
        'uUseMask',
        'uAngleRad',
        'uSpeed',
        'uTime',
        'uPatternPeriodPx',
        'uRenderSizePx'
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

    stripeTexture.dispose();
    stripeTexture = buildStripeTexture(scene, preset, `${name}_stripeTexture`);
    material.setTexture('uStripeTexture', stripeTexture);
    material.setFloat('uUseSolid', mode === 'solid' ? 1 : 0);
    material.setColor3('uSolidColor', toColor3(preset?.solidColor, '#ffffff'));
    material.setColor3('uBackgroundColor', toColor3(preset?.background, '#000000'));
    material.setFloat('uAngleRad', ((Number.isFinite(angleDeg) ? angleDeg : 45) * Math.PI) / 180);
    material.setFloat('uSpeed', Number.isFinite(speed) ? speed : 80);
    material.setFloat('uPatternPeriodPx', getPatternPeriodPx(preset));
  };

  const applyRenderSize = (widthPx: number, heightPx: number) => {
    const width = Number.isFinite(widthPx) && widthPx > 0 ? widthPx : 1;
    const height = Number.isFinite(heightPx) && heightPx > 0 ? heightPx : 1;
    material.setVector2('uRenderSizePx', new Vector2(width, height));
  };

  applyPreset(initialPreset);
  applyRenderSize(options.renderSizePx?.width || 512, options.renderSizePx?.height || 512);

  return {
    material,
    updatePreset: (preset) => {
      applyPreset(preset);
    },
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
