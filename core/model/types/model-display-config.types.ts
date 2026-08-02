export type ModelDisplayConfig = {
  modelPath: string;
  rotationDeg: { x: number; y: number; z: number };
  scale: number;
  cameraDistance: number;
  rotationSpeedDegPerSec: number;
};

export type ModelDisplayConfigLibrary = Record<string, ModelDisplayConfig>;
