import type {
  ModelSceneInstance,
  ModelScenePreset,
  ModelScenePresetLibrary,
  ModelTransform
} from '@/core/model/types/model-scene-preset.types.ts';

const finiteTuple = (value: unknown, fallback: [number, number, number]): [number, number, number] => {
  if (!Array.isArray(value) || value.length !== 3) return [...fallback];
  return value.map((item, index) => Number.isFinite(Number(item)) ? Number(item) : fallback[index]) as [number, number, number];
};

export const createDefaultModelTransform = (): ModelTransform => ({
  position: [0, 0, 0],
  rotationDeg: [0, 0, 0],
  scaling: [1, 1, 1]
});

export const sanitizeModelSceneInstance = (raw: unknown, fallbackId: string): ModelSceneInstance | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<ModelSceneInstance>;
  const modelPath = typeof value.modelPath === 'string' ? value.modelPath.trim() : '';
  if (!/^\/resources\/.+\.(?:glb|gltf)(?:[?#].*)?$/i.test(modelPath)) return null;
  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : fallbackId;
  const transform = value.transform && typeof value.transform === 'object' ? value.transform : createDefaultModelTransform();
  return {
    id,
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : id,
    modelPath,
    transform: {
      position: finiteTuple(transform.position, [0, 0, 0]),
      rotationDeg: finiteTuple(transform.rotationDeg, [0, 0, 0]),
      scaling: finiteTuple(transform.scaling, [1, 1, 1])
    }
  };
};

export const sanitizeModelScenePreset = (raw: unknown, fallbackId: string): ModelScenePreset => {
  const value = raw && typeof raw === 'object' ? raw as Partial<ModelScenePreset> : {};
  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : fallbackId;
  const usedIds = new Set<string>();
  const instances = (Array.isArray(value.instances) ? value.instances : []).flatMap((item, index) => {
    const instance = sanitizeModelSceneInstance(item, `${id}_model_${index + 1}`);
    if (!instance || usedIds.has(instance.id)) return [];
    usedIds.add(instance.id);
    return [instance];
  });
  return {
    id,
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : id,
    instances
  };
};

export const sanitizeModelScenePresetLibrary = (raw: unknown): ModelScenePresetLibrary => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, sanitizeModelScenePreset(value, key)]));
};
