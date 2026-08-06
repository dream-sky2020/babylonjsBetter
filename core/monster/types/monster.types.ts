import type { StripePresetLike } from '@/core/sprite/render/createSpriteEffectMaterial.ts';

export type MonsterLayerKey = 'bottomFillMask' | 'bottomBorder' | 'body' | 'line';
export type MonsterFacingAxis = '+Z' | '-Z';

export type MonsterDisplayLayer = { path: string };
export type MonsterDisplayConfig = {
  id: string;
  name: string;
  scaleSize: number;
  scene3dScale: number;
  scene3dHeight: number;
  scene3dOffsetX: number;
  spriteFacingAxis: MonsterFacingAxis;
  renderOrder: MonsterLayerKey[];
  monsterStripePresetKey: string;
  layers: Record<MonsterLayerKey, MonsterDisplayLayer>;
};

export type MonsterStripeLayer = { stripePresetKey: string; visible: boolean };
export type MonsterStripePreset = {
  id: string;
  name: string;
  layers: Record<MonsterLayerKey, MonsterStripeLayer>;
};

export type MonsterDisplayConfigLibrary = Record<string, MonsterDisplayConfig>;
export type MonsterStripePresetLibrary = Record<string, MonsterStripePreset>;
export type StripePresetLibrary = Record<string, StripePresetLike & { presetKey: string; name: string }>;
