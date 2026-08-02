export type ModelShakePresetControls = {
  durationMs: number;
  frequencyHz: number;
  mode: 'wave' | 'random';
  positionEnabled: boolean;
  rotationEnabled: boolean;
  scaleEnabled: boolean;
  positionXMin: number; positionXMax: number;
  positionYMin: number; positionYMax: number;
  positionZMin: number; positionZMax: number;
  rotationXMin: number; rotationXMax: number;
  rotationYMin: number; rotationYMax: number;
  rotationZMin: number; rotationZMax: number;
  scaleXMin: number; scaleXMax: number;
  scaleYMin: number; scaleYMax: number;
  scaleZMin: number; scaleZMax: number;
};

export type ModelShakePreset = {
  presetKey: string;
  name: string;
  controls: ModelShakePresetControls;
};

export type ModelShakePresetLibrary = Record<string, ModelShakePreset>;
