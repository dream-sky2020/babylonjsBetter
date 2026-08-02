export type ModelTransform = {
  position: [number, number, number];
  rotationDeg: [number, number, number];
  scaling: [number, number, number];
};

export type ModelSceneInstance = {
  id: string;
  name: string;
  modelPath: string;
  transform: ModelTransform;
};

export type ModelScenePreset = {
  id: string;
  name: string;
  instances: ModelSceneInstance[];
};

export type ModelScenePresetLibrary = Record<string, ModelScenePreset>;
