import {
  DEFAULT_3D_CAMERA_ALPHA,
  DEFAULT_3D_CAMERA_BETA,
  DEFAULT_3D_CAMERA_RADIUS,
  DEFAULT_PARTICLE_PRESET_KEY,
  ORTHO_HALF_HEIGHT
} from '@/core/particle/constants/particle.constants.ts';

export const normalizePublicPath = (input: string): string =>
  decodeURI(input).replace(/^\/+/, '').replace(/^\.\/+/, '');

export const getLastParticlePresetKey = (): string => {
  if (typeof window === 'undefined') return DEFAULT_PARTICLE_PRESET_KEY;
  try {
    return window.localStorage.getItem('particle-editor.last-preset') || DEFAULT_PARTICLE_PRESET_KEY;
  } catch {
    return DEFAULT_PARTICLE_PRESET_KEY;
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

let gradientIdCounter = 0;
export const createGradientNodeId = (prefix: 'cg' | 'sg'): string => {
  gradientIdCounter += 1;
  return `${prefix}-${gradientIdCounter}`;
};

export {
  DEFAULT_3D_CAMERA_ALPHA,
  DEFAULT_3D_CAMERA_BETA,
  DEFAULT_3D_CAMERA_RADIUS,
  ORTHO_HALF_HEIGHT
};
