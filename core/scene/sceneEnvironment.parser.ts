import type {
  SceneEnvironmentGeometry,
  SceneEnvironmentLight,
  SceneEnvironmentModel,
  SceneEnvironmentObject,
  SceneEnvironmentPreset,
  SceneEnvironmentPresetLibrary,
  SceneEnvironmentVector3,
} from './sceneEnvironment.types';
import { parseShadowQualityReference } from './shadowQualityPreset.parser';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const readString = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${path} 必须是非空字符串`);
  return value;
};

const readPositiveNumber = (value: unknown, path: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`${path} 必须是大于 0 的有限数字`);
  return value;
};

const readNonNegativeNumber = (value: unknown, path: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${path} 必须是大于或等于 0 的有限数字`);
  return value;
};

const readOptionalPositiveNumber = (value: unknown, path: string): number | undefined => (
  value === undefined ? undefined : readPositiveNumber(value, path)
);

const readOptionalBoolean = (value: unknown, path: string): boolean | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new Error(`${path} 必须是布尔值`);
  return value;
};

const readVector3 = (value: unknown, path: string): SceneEnvironmentVector3 => {
  if (!Array.isArray(value) || value.length !== 3 || value.some((item) => typeof item !== 'number' || !Number.isFinite(item))) {
    throw new Error(`${path} 必须是包含三个有限数字的数组`);
  }
  return [value[0] as number, value[1] as number, value[2] as number];
};

const parseGeometry = (value: unknown, path: string): SceneEnvironmentGeometry => {
  if (!isRecord(value)) throw new Error(`${path} 必须是对象`);
  if (value.primitive === 'ground') {
    return { primitive: 'ground', width: readPositiveNumber(value.width, `${path}.width`), height: readPositiveNumber(value.height, `${path}.height`) };
  }
  if (value.primitive === 'box') {
    return { primitive: 'box', width: readPositiveNumber(value.width, `${path}.width`), height: readPositiveNumber(value.height, `${path}.height`), depth: readPositiveNumber(value.depth, `${path}.depth`) };
  }
  if (value.primitive === 'cylinder') {
    return {
      primitive: 'cylinder',
      height: readPositiveNumber(value.height, `${path}.height`),
      diameterTop: readNonNegativeNumber(value.diameterTop, `${path}.diameterTop`),
      diameterBottom: readPositiveNumber(value.diameterBottom, `${path}.diameterBottom`),
      tessellation: readOptionalPositiveNumber(value.tessellation, `${path}.tessellation`),
    };
  }
  throw new Error(`${path}.primitive 只允许 ground、box 或 cylinder`);
};

const parseObject = (value: unknown, path: string): SceneEnvironmentObject => {
  if (!isRecord(value)) throw new Error(`${path} 必须是对象`);
  const shadow = value.shadow;
  if (shadow !== undefined && !isRecord(shadow)) throw new Error(`${path}.shadow 必须是对象`);
  return {
    id: readString(value.id, `${path}.id`),
    name: readString(value.name, `${path}.name`),
    geometry: parseGeometry(value.geometry, `${path}.geometry`),
    position: readVector3(value.position, `${path}.position`),
    rotation: value.rotation === undefined ? undefined : readVector3(value.rotation, `${path}.rotation`),
    color: readString(value.color, `${path}.color`),
    shadow: shadow === undefined ? undefined : {
      cast: readOptionalBoolean(shadow.cast, `${path}.shadow.cast`),
      receive: readOptionalBoolean(shadow.receive, `${path}.shadow.receive`),
    },
  };
};

const parseModel = (value: unknown, path: string): SceneEnvironmentModel => {
  if (!isRecord(value)) throw new Error(`${path} 必须是对象`);
  const animation = value.animation;
  const shadow = value.shadow;
  if (animation !== undefined && !isRecord(animation)) throw new Error(`${path}.animation 必须是对象`);
  if (shadow !== undefined && !isRecord(shadow)) throw new Error(`${path}.shadow 必须是对象`);
  const transparencyPolicy = value.transparencyPolicy;
  if (transparencyPolicy !== undefined && transparencyPolicy !== 'source' && transparencyPolicy !== 'depth-safe-cutout') {
    throw new Error(`${path}.transparencyPolicy 只允许 source 或 depth-safe-cutout`);
  }
  const modelPath = readString(value.modelPath, `${path}.modelPath`);
  if (!/\.(?:glb|gltf)(?:[?#].*)?$/i.test(modelPath)) throw new Error(`${path}.modelPath 只支持 GLB 或 GLTF`);
  return {
    id: readString(value.id, `${path}.id`),
    name: readString(value.name, `${path}.name`),
    modelPath,
    position: readVector3(value.position, `${path}.position`),
    rotation: value.rotation === undefined ? undefined : readVector3(value.rotation, `${path}.rotation`),
    scaling: value.scaling === undefined ? undefined : readVector3(value.scaling, `${path}.scaling`),
    transparencyPolicy,
    animation: animation === undefined ? undefined : {
      name: animation.name === undefined ? undefined : readString(animation.name, `${path}.animation.name`),
      autoplay: readOptionalBoolean(animation.autoplay, `${path}.animation.autoplay`),
      loop: readOptionalBoolean(animation.loop, `${path}.animation.loop`),
    },
    shadow: shadow === undefined ? undefined : {
      cast: readOptionalBoolean(shadow.cast, `${path}.shadow.cast`),
      receive: readOptionalBoolean(shadow.receive, `${path}.shadow.receive`),
    },
  };
};

const parseLight = (value: unknown, path: string): SceneEnvironmentLight => {
  if (!isRecord(value)) throw new Error(`${path} 必须是对象`);
  if (!isRecord(value.light)) throw new Error(`${path}.light 必须是对象`);
  const base = {
    id: readString(value.id, `${path}.id`),
    name: readString(value.name, `${path}.name`),
    intensity: readNonNegativeNumber(value.intensity, `${path}.intensity`),
    color: readString(value.color, `${path}.color`),
  };
  const light = value.light;
  if (light.primitive === 'hemispheric') {
    if (value.shadow !== undefined) throw new Error(`${path}.shadow 不能用于 hemispheric 光源`);
    return { ...base, light: { primitive: 'hemispheric', direction: readVector3(light.direction, `${path}.light.direction`), groundColor: readString(light.groundColor, `${path}.light.groundColor`) } };
  }
  if (light.primitive === 'directional') {
    return { ...base, light: { primitive: 'directional', direction: readVector3(light.direction, `${path}.light.direction`), position: light.position === undefined ? undefined : readVector3(light.position, `${path}.light.position`) }, shadow: parseShadowQualityReference(value.shadow, `${path}.shadow`) };
  }
  if (light.primitive === 'point') {
    const shadow = parseShadowQualityReference(value.shadow, `${path}.shadow`);
    return { ...base, light: { primitive: 'point', position: readVector3(light.position, `${path}.light.position`), range: readOptionalPositiveNumber(light.range, `${path}.light.range`) }, shadow };
  }
  throw new Error(`${path}.light.primitive 只允许 hemispheric、directional 或 point`);
};

export const parseSceneEnvironmentPreset = (value: unknown, key: string): SceneEnvironmentPreset => {
  const path = `预设 ${key}`;
  if (!isRecord(value)) throw new Error(`${path} 必须是对象`);
  const presetKey = readString(value.presetKey, `${path}.presetKey`);
  if (presetKey !== key) throw new Error(`${path}.presetKey 必须与配置键一致`);
  if (!Array.isArray(value.lights)) throw new Error(`${path}.lights 必须是数组`);
  if (!Array.isArray(value.objects)) throw new Error(`${path}.objects 必须是数组`);
  if (value.models !== undefined && !Array.isArray(value.models)) throw new Error(`${path}.models 必须是数组`);
  const lights = value.lights.map((item, index) => parseLight(item, `${path}.lights[${index}]`));
  const objects = value.objects.map((item, index) => parseObject(item, `${path}.objects[${index}]`));
  const models = (value.models ?? []).map((item, index) => parseModel(item, `${path}.models[${index}]`));
  const nodeIds = new Set<string>();
  [...lights, ...objects, ...models].forEach((node) => {
    if (nodeIds.has(node.id)) throw new Error(`${path} 中存在重复节点 ID：${node.id}`);
    nodeIds.add(node.id);
  });
  return { presetKey, name: readString(value.name, `${path}.name`), clearColor: readString(value.clearColor, `${path}.clearColor`), lights, objects, models };
};

export const parseSceneEnvironmentPresetLibrary = (value: unknown): SceneEnvironmentPresetLibrary => {
  if (!isRecord(value)) throw new Error('场景预设配置根节点必须是对象');
  const resolved: SceneEnvironmentPresetLibrary = {};
  const resolving = new Set<string>();
  const resolvePreset = (key: string): SceneEnvironmentPreset => {
    if (resolved[key]) return resolved[key];
    const raw = value[key];
    if (!isRecord(raw)) throw new Error(`预设 ${key} 必须是对象`);
    if (raw.extendsPresetKey === undefined) {
      const preset = parseSceneEnvironmentPreset(raw, key);
      resolved[key] = preset;
      return preset;
    }
    if (resolving.has(key)) throw new Error(`场景预设继承存在循环：${[...resolving, key].join(' -> ')}`);
    resolving.add(key);
    const extendsPresetKey = readString(raw.extendsPresetKey, `预设 ${key}.extendsPresetKey`);
    if (!(extendsPresetKey in value)) throw new Error(`预设 ${key} 找不到基础预设 ${extendsPresetKey}`);
    const base = resolvePreset(extendsPresetKey);
    const presetKey = readString(raw.presetKey, `预设 ${key}.presetKey`);
    if (presetKey !== key) throw new Error(`预设 ${key}.presetKey 必须与配置键一致`);
    const shadowOverrides = raw.lightShadowOverrides;
    if (shadowOverrides !== undefined && !isRecord(shadowOverrides)) throw new Error(`预设 ${key}.lightShadowOverrides 必须是对象`);
    const overrideEntries = shadowOverrides === undefined ? [] : Object.entries(shadowOverrides);
    const lightIds = new Set(base.lights.map((light) => light.id));
    overrideEntries.forEach(([lightId]) => {
      if (!lightIds.has(lightId)) throw new Error(`预设 ${key}.lightShadowOverrides 引用了不存在的光源 ${lightId}`);
    });
    const lights = base.lights.map((light) => {
      if (shadowOverrides === undefined || !(light.id in shadowOverrides)) return light;
      if (!('shadow' in light)) throw new Error(`预设 ${key} 不能为 hemispheric 光源 ${light.id} 覆盖阴影`);
      return {
        ...light,
        shadow: parseShadowQualityReference(shadowOverrides[light.id], `预设 ${key}.lightShadowOverrides.${light.id}`),
      };
    });
    const preset: SceneEnvironmentPreset = {
      ...base,
      presetKey,
      name: readString(raw.name, `预设 ${key}.name`),
      clearColor: raw.clearColor === undefined ? base.clearColor : readString(raw.clearColor, `预设 ${key}.clearColor`),
      lights,
    };
    resolving.delete(key);
    resolved[key] = preset;
    return preset;
  };
  Object.keys(value).forEach(resolvePreset);
  return resolved;
};
