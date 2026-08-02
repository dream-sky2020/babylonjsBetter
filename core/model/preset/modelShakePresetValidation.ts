import type {
  ModelShakePreset,
  ModelShakePresetControls,
  ModelShakePresetLibrary
} from '@/core/model/types/model-shake-preset.types.ts';

export const DEFAULT_MODEL_SHAKE_CONTROLS: ModelShakePresetControls = {
  durationMs: 500,
  frequencyHz: 24,
  mode: 'wave',
  positionEnabled: true,
  rotationEnabled: true,
  scaleEnabled: true,
  positionXMin: -0.08, positionXMax: 0.08,
  positionYMin: -0.03, positionYMax: 0.03,
  positionZMin: -0.02, positionZMax: 0.02,
  rotationXMin: -1.5, rotationXMax: 1.5,
  rotationYMin: -1, rotationYMax: 1,
  rotationZMin: -4, rotationZMax: 4,
  scaleXMin: -0.035, scaleXMax: 0.035,
  scaleYMin: -0.06, scaleYMax: 0.06,
  scaleZMin: -0.035, scaleZMax: 0.035
};

const numberInRange = (value: unknown, fallback: number, min: number, max: number): number => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

export const sanitizeModelShakeControls = (raw: unknown): ModelShakePresetControls => {
  const value = raw && typeof raw === 'object'
    ? raw as Partial<ModelShakePresetControls> & Record<string, unknown>
    : {};
  const pair = (prefix: 'positionX' | 'positionY' | 'positionZ' | 'rotationX' | 'rotationY' | 'rotationZ' | 'scaleX' | 'scaleY' | 'scaleZ', fallbackMin: number, fallbackMax: number, limit: number) => {
    const legacy = numberInRange(value[prefix] ?? (prefix.startsWith('scale') ? value.scale : undefined), Math.max(Math.abs(fallbackMin), Math.abs(fallbackMax)), 0, limit);
    const minimum = numberInRange(value[`${prefix}Min`], -legacy, -limit, limit);
    const maximum = numberInRange(value[`${prefix}Max`], legacy, -limit, limit);
    return minimum <= maximum ? [minimum, maximum] : [maximum, minimum];
  };
  const px = pair('positionX', -0.08, 0.08, 100); const py = pair('positionY', -0.03, 0.03, 100); const pz = pair('positionZ', -0.02, 0.02, 100);
  const rx = pair('rotationX', -1.5, 1.5, 180); const ry = pair('rotationY', -1, 1, 180); const rz = pair('rotationZ', -4, 4, 180);
  const sx = pair('scaleX', -0.035, 0.035, 3); const sy = pair('scaleY', -0.06, 0.06, 3); const sz = pair('scaleZ', -0.035, 0.035, 3);
  return {
    durationMs: numberInRange(value.durationMs, DEFAULT_MODEL_SHAKE_CONTROLS.durationMs, 30, 10000),
    frequencyHz: numberInRange(value.frequencyHz, DEFAULT_MODEL_SHAKE_CONTROLS.frequencyHz, 0.1, 120),
    mode: value.mode === 'random' ? 'random' : 'wave',
    positionEnabled: typeof value.positionEnabled === 'boolean' ? value.positionEnabled : true,
    rotationEnabled: typeof value.rotationEnabled === 'boolean' ? value.rotationEnabled : true,
    scaleEnabled: typeof value.scaleEnabled === 'boolean' ? value.scaleEnabled : true,
    positionXMin: px[0], positionXMax: px[1], positionYMin: py[0], positionYMax: py[1], positionZMin: pz[0], positionZMax: pz[1],
    rotationXMin: rx[0], rotationXMax: rx[1], rotationYMin: ry[0], rotationYMax: ry[1], rotationZMin: rz[0], rotationZMax: rz[1],
    scaleXMin: sx[0], scaleXMax: sx[1], scaleYMin: sy[0], scaleYMax: sy[1], scaleZMin: sz[0], scaleZMax: sz[1]
  };
};

export const createDefaultModelShakePreset = (presetKey = 'model_shake_default'): ModelShakePreset => ({
  presetKey,
  name: '默认模型抖动',
  controls: { ...DEFAULT_MODEL_SHAKE_CONTROLS }
});

export const sanitizeModelShakePresetLibrary = (raw: unknown): ModelShakePresetLibrary => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).map(([key, item]) => {
    const value = item && typeof item === 'object' ? item as Partial<ModelShakePreset> : {};
    return [key, {
      presetKey: key,
      name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : key,
      controls: sanitizeModelShakeControls(value.controls)
    }];
  }));
};
