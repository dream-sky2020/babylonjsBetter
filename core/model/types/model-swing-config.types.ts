export type ModelSwingAxis = 'x' | 'y' | 'z';

export type ModelSwingConfig = {
  modelPath: string;
  enabled: boolean;
  baseRotationDeg: { x: number; y: number; z: number };
  axis: ModelSwingAxis;
  minAngleDeg: number;
  maxAngleDeg: number;
  frequencyHz: number;
  phaseDeg: number;
};

export type ModelSwingConfigLibrary = Record<string, ModelSwingConfig>;
