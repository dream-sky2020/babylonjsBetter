import type {
  MonsterDisplayConfig,
  MonsterDisplayConfigLibrary,
  MonsterLayerKey,
  MonsterStripePreset,
  MonsterStripePresetLibrary,
  StripePresetLibrary
} from '@/core/monster/types/monster.types.ts';

export const MONSTER_LAYER_KEYS: MonsterLayerKey[] = ['bottomFillMask', 'bottomBorder', 'body', 'line'];
export const MONSTER_RENDER_ORDER = [...MONSTER_LAYER_KEYS];
export const STRIPE_NONE = '__none__';
export const DEFAULT_MONSTER_STRIPE_PRESET_KEY = 'monster_stripe_default';
export const DEFAULT_MONSTER_ASSETS: Record<MonsterLayerKey, string> = {
  line: 'Monster/尖锐文件_1_线条.png',
  body: 'Monster/尖锐文件_1_内部填色.png',
  bottomBorder: 'Monster/尖锐文件_1_底部边框.png',
  bottomFillMask: 'Monster/尖锐文件_1_底部边框内填色.png'
};

const numberOr = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const createDefaultStripePreset = (key: string) => ({
  presetKey: key, name: key, mode: 'stripes' as const, solidColor: '#ffffff', solidOpacity: 1,
  angleDeg: 45, speed: 90, background: '#000000', backgroundOpacity: 1,
  segments: [
    { width: 24, fillType: 'solid' as const, color: '#101218', opacity: 1 },
    { width: 24, fillType: 'solid' as const, color: '#9fd3ff', opacity: 1 }
  ]
});

export const createDefaultMonsterConfig = (id: string): MonsterDisplayConfig => ({
  id, name: id, scaleSize: 560, scene3dScale: 1, scene3dHeight: 0, scene3dOffsetX: 0,
  spriteFacingAxis: '+Z', renderOrder: [...MONSTER_RENDER_ORDER],
  monsterStripePresetKey: DEFAULT_MONSTER_STRIPE_PRESET_KEY,
  layers: Object.fromEntries(MONSTER_LAYER_KEYS.map((key) => [key, { path: DEFAULT_MONSTER_ASSETS[key] }])) as MonsterDisplayConfig['layers']
});

export const createDefaultMonsterStripePreset = (key: string): MonsterStripePreset => ({
  id: key, name: key,
  layers: Object.fromEntries(MONSTER_LAYER_KEYS.map((layerKey) => [layerKey, { stripePresetKey: STRIPE_NONE, visible: true }])) as MonsterStripePreset['layers']
});

export const normalizeStripePreset = (key: string, value: unknown) => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawSegments = Array.isArray(source.segments) ? source.segments : [];
  const segments = rawSegments.filter((item) => item && typeof item === 'object').map((item) => {
    const segment = item as Record<string, unknown>;
    return {
      width: Math.max(0.01, numberOr(segment.width, 20)),
      fillType: segment.fillType === 'gradient' ? 'gradient' as const : 'solid' as const,
      color: typeof segment.color === 'string' ? segment.color : '#ffffff',
      fromColor: typeof segment.fromColor === 'string' ? segment.fromColor : '#ffffff',
      toColor: typeof segment.toColor === 'string' ? segment.toColor : '#000000',
      opacity: Math.max(0, Math.min(1, numberOr(segment.opacity, 1)))
    };
  });
  return {
    presetKey: key,
    name: typeof source.name === 'string' && source.name.trim() ? source.name : key,
    mode: source.mode === 'solid' ? 'solid' as const : 'stripes' as const,
    solidColor: typeof source.solidColor === 'string' ? source.solidColor : '#ffffff',
    solidOpacity: Math.max(0, Math.min(1, numberOr(source.solidOpacity, 1))),
    angleDeg: Math.max(-360, Math.min(360, numberOr(source.angleDeg, 45))),
    speed: Math.max(-5000, Math.min(5000, numberOr(source.speed, 90))),
    background: typeof source.background === 'string' ? source.background : '#000000',
    backgroundOpacity: Math.max(0, Math.min(1, numberOr(source.backgroundOpacity, 1))),
    segments: segments.length ? segments : createDefaultStripePreset(key).segments
  };
};

export const normalizeStripePresetLibrary = (value: unknown): StripePresetLibrary => {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).filter(([key]) => key.trim()).map(([key, preset]) => [key, normalizeStripePreset(key, preset)]));
};

export const normalizeMonsterConfig = (key: string, value: unknown): MonsterDisplayConfig => {
  const fallback = createDefaultMonsterConfig(key);
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawLayers = source.layers && typeof source.layers === 'object' ? source.layers as Record<string, unknown> : {};
  const id = typeof source.id === 'string' && source.id.trim() ? source.id : key;
  return {
    id,
    name: typeof source.name === 'string' && source.name.trim() ? source.name : id,
    scaleSize: Math.max(1, numberOr(source.scaleSize, fallback.scaleSize)),
    scene3dScale: Math.max(0.01, numberOr(source.scene3dScale, fallback.scene3dScale)),
    scene3dHeight: numberOr(source.scene3dHeight, fallback.scene3dHeight),
    scene3dOffsetX: numberOr(source.scene3dOffsetX, fallback.scene3dOffsetX),
    spriteFacingAxis: source.spriteFacingAxis === '-Z' ? '-Z' : '+Z',
    renderOrder: [...MONSTER_RENDER_ORDER],
    monsterStripePresetKey: typeof source.monsterStripePresetKey === 'string' && source.monsterStripePresetKey.trim() ? source.monsterStripePresetKey : DEFAULT_MONSTER_STRIPE_PRESET_KEY,
    layers: Object.fromEntries(MONSTER_LAYER_KEYS.map((layerKey) => {
      const raw = rawLayers[layerKey] && typeof rawLayers[layerKey] === 'object' ? rawLayers[layerKey] as Record<string, unknown> : {};
      return [layerKey, { path: typeof raw.path === 'string' && raw.path.trim() ? raw.path : fallback.layers[layerKey].path }];
    })) as MonsterDisplayConfig['layers']
  };
};

export const normalizeMonsterConfigLibrary = (value: unknown): MonsterDisplayConfigLibrary => {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).filter(([key]) => key.trim()).map(([key, config]) => [key, normalizeMonsterConfig(key, config)]));
};

export const normalizeMonsterStripePreset = (key: string, value: unknown): MonsterStripePreset => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawLayers = source.layers && typeof source.layers === 'object' ? source.layers as Record<string, unknown> : {};
  const id = typeof source.id === 'string' && source.id.trim() ? source.id : key;
  return {
    id,
    name: typeof source.name === 'string' && source.name.trim() ? source.name : id,
    layers: Object.fromEntries(MONSTER_LAYER_KEYS.map((layerKey) => {
      const raw = rawLayers[layerKey] && typeof rawLayers[layerKey] === 'object' ? rawLayers[layerKey] as Record<string, unknown> : {};
      return [layerKey, {
        stripePresetKey: typeof raw.stripePresetKey === 'string' && raw.stripePresetKey.trim() ? raw.stripePresetKey : STRIPE_NONE,
        visible: raw.visible !== false
      }];
    })) as MonsterStripePreset['layers']
  };
};

export const normalizeMonsterStripePresetLibrary = (value: unknown): MonsterStripePresetLibrary => {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).filter(([key]) => key.trim()).map(([key, preset]) => [key, normalizeMonsterStripePreset(key, preset)]));
};

export const findDuplicateMonsterIds = (library: MonsterDisplayConfigLibrary) => {
  const seen = new Map<string, string>();
  const duplicates: Array<{ id: string; firstKey: string; currentKey: string }> = [];
  for (const [key, config] of Object.entries(library)) {
    const normalizedId = config.id.trim().toLocaleLowerCase();
    const firstKey = seen.get(normalizedId);
    if (firstKey) duplicates.push({ id: config.id, firstKey, currentKey: key });
    else seen.set(normalizedId, key);
  }
  return duplicates;
};
