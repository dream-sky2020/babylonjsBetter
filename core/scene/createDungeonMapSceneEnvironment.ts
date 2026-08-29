import type { Scene } from '@babylonjs/core';
import { getComponents, isEntityContainer, type IEntity, type ISceneEnvironmentComponent } from '../entity';
import type { DungeonMapData } from '../map';
import { createSceneEnvironment, createSceneEnvironmentAsync, type CreateSceneEnvironmentOptions } from './createSceneEnvironment';
import type {
  SceneEnvironmentInstance,
  SceneEnvironmentPreset,
  SceneEnvironmentPresetLibrary,
} from './sceneEnvironment.types';

export type DungeonMapSceneEnvironmentBinding = {
  mapEntity: IEntity;
  component: ISceneEnvironmentComponent;
  preset: SceneEnvironmentPreset;
};

export type DungeonMapSceneEnvironmentInstance = SceneEnvironmentInstance & {
  mapId: string;
  mapEntityId: string;
  componentId: string;
};

/**
 * 解析地图声明的场景环境。地图不直接依赖几何实现，只通过 map Entity 上的
 * scene-environment 组件引用预设 key。
 */
export const resolveDungeonMapSceneEnvironment = (
  map: DungeonMapData,
  presets: SceneEnvironmentPresetLibrary,
): DungeonMapSceneEnvironmentBinding => {
  if (!isEntityContainer(map.data)) {
    throw new Error(`地图“${map.id}”没有 Entity 数据容器。`);
  }

  const bindings = map.data.entities
    .filter((entity) => entity.entityType === 'map' && entity.enabled !== false)
    .flatMap((mapEntity) => getComponents<ISceneEnvironmentComponent>(mapEntity, 'scene-environment')
      .filter((component) => component.enabled !== false)
      .map((component) => ({ mapEntity, component })));

  if (bindings.length === 0) {
    throw new Error(`地图“${map.id}”的可用 map Entity 上没有 scene-environment 组件。`);
  }
  if (bindings.length > 1) {
    throw new Error(`地图“${map.id}”存在多个启用的 scene-environment 组件，无法确定唯一场景。`);
  }

  const [{ mapEntity, component }] = bindings;
  const presetKey = component.presetKey?.trim();
  if (!presetKey) throw new Error(`组件“${component.id}”没有设置 presetKey。`);
  const preset = presets[presetKey];
  if (!preset) throw new Error(`场景预设库中找不到 key“${presetKey}”。`);
  return { mapEntity, component, preset };
};

/** 从地图实体组件解析 presetKey，并创建对应的大场景环境。 */
export const createDungeonMapSceneEnvironment = (
  scene: Scene,
  map: DungeonMapData,
  presets: SceneEnvironmentPresetLibrary,
  options: CreateSceneEnvironmentOptions,
): DungeonMapSceneEnvironmentInstance => {
  const binding = resolveDungeonMapSceneEnvironment(map, presets);
  const instance = createSceneEnvironment(scene, binding.preset, options);
  return {
    ...instance,
    mapId: map.id,
    mapEntityId: binding.mapEntity.id,
    componentId: binding.component.id,
  };
};

/** 从地图组件解析场景，并异步加载其中声明的本地 GLB/GLTF 模型。 */
export const createDungeonMapSceneEnvironmentAsync = async (
  scene: Scene,
  map: DungeonMapData,
  presets: SceneEnvironmentPresetLibrary,
  options: CreateSceneEnvironmentOptions,
): Promise<DungeonMapSceneEnvironmentInstance> => {
  const binding = resolveDungeonMapSceneEnvironment(map, presets);
  const instance = await createSceneEnvironmentAsync(scene, binding.preset, options);
  return {
    ...instance,
    mapId: map.id,
    mapEntityId: binding.mapEntity.id,
    componentId: binding.component.id,
  };
};
