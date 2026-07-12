// utils/particleEditorHelpers.ts
import {
  DEFAULT_3D_CAMERA_ALPHA,
  DEFAULT_3D_CAMERA_BETA,
  DEFAULT_3D_CAMERA_RADIUS,
  ORTHO_HALF_HEIGHT
} from '../shared/core/scene/particleEditor.constants';

export const toFixedNumber = (value: number): number => Number(value.toFixed(4));

export const clamp = (value: number, min: number, max: number): number => 
  Math.max(min, Math.min(max, value));

export const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (c: number) => clamp(Math.round(c * 255), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: toFixedNumber(parseInt(result[1], 16) / 255),
        g: toFixedNumber(parseInt(result[2], 16) / 255),
        b: toFixedNumber(parseInt(result[3], 16) / 255)
      }
    : { r: 1, g: 1, b: 1 };
};

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const normalizePublicPath = (input: string): string => 
  decodeURI(input).replace(/^\/+/, '').replace(/^\.\/+/, '');

export const getLastParticlePresetKey = (): string => {
  if (typeof window === 'undefined') return 'spark';
  try {
    return window.localStorage.getItem('particle-editor.last-preset') || 'spark';
  } catch {
    return 'spark';
  }
};

export const saveLastParticlePresetKey = (presetKey: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('particle-editor.last-preset', presetKey);
  } catch {
    // ignore storage errors
  }
};

export const getLastViewMode = (): '2d' | '3d' => {
  if (typeof window === 'undefined') return '3d';
  try {
    return window.localStorage.getItem('particle-editor.last-view-mode') === '2d' ? '2d' : '3d';
  } catch {
    return '3d';
  }
};

export const saveLastViewMode = (mode: '2d' | '3d'): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('particle-editor.last-view-mode', mode);
  } catch {
    // ignore storage errors
  }
};

// 生成唯一ID
let gradientIdCounter = 0;
export const createGradientNodeId = (prefix: 'cg' | 'sg'): string => {
  gradientIdCounter += 1;
  return `${prefix}-${gradientIdCounter}`;
};

// 常量
export const INPUT_STEP = 0.01;
export {
  DEFAULT_3D_CAMERA_ALPHA,
  DEFAULT_3D_CAMERA_BETA,
  DEFAULT_3D_CAMERA_RADIUS,
  ORTHO_HALF_HEIGHT
};