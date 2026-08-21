export type SpriteAshEffectMode = 'ash' | 'blackShards' | 'embers' | 'frost' | 'pixel' | 'void';

export type SpriteAshPreset = {
  presetKey: string;
  name: string;
  effectMode: SpriteAshEffectMode;
  duration: number;
  directionAngleDeg: number;
  noiseScale: number;
  noiseStrength: number;
  noiseSpeed: number;
  edgeWidth: number;
  edgeSoftness: number;
  edgeColor: string;
  edgeIntensity: number;
  charColor: string;
  charStrength: number;
  ashColor: string;
  ashTrail: number;
  ashDensity: number;
  ashOpacity: number;
  rise: number;
  driftX: number;
  turbulence: number;
  flickerSpeed: number;
  seed: number;
  alphaCutoff: number;
};

export type SpriteAshPresetLibrary = Record<string, SpriteAshPreset>;
