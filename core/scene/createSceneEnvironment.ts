import {
  CascadedShadowGenerator,
  Color3,
  Color4,
  DirectionalLight,
  HemisphericLight,
  MeshBuilder,
  PointLight,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
  type Light,
  type Node,
  type Mesh,
} from '@babylonjs/core';
import type { SceneEnvironmentInstance, SceneEnvironmentLight, SceneEnvironmentObject, SceneEnvironmentPreset } from './sceneEnvironment.types';
import { createModelEntity, type ModelEntity } from '../model';
import { getVisualDeformationRegistry } from '../render-deformation/visualDeformationRegistry.ts';
import type { ShadowQualityPresetLibrary, ShadowQualitySettings, ShadowQualityTier } from './shadowQualityPreset.types';
import { resolveShadowQuality } from './resolveShadowQuality';
import { environmentNodeEntries, validateEnvironmentHierarchy } from './sceneEnvironment.hierarchy.ts';
import { ParentLocalHemisphericLight } from './ParentLocalHemisphericLight.ts';

function attachEnvironmentHierarchy(instance: SceneEnvironmentInstance, preset: SceneEnvironmentPreset) {
  for (const { id, definition } of environmentNodeEntries(preset)) {
    const node = instance.nodes.get(id);
    if (!node) throw new Error(`场景节点尚未创建：${id}`);
    node.parent = definition.parentId ? instance.nodes.get(definition.parentId)! : instance.root;
  }
}

const createMaterial = (scene: Scene, presetKey: string, object: SceneEnvironmentObject): StandardMaterial => {
  const material = new StandardMaterial(`${presetKey}_${object.id}_material`, scene);
  material.diffuseColor = Color3.FromHexString(object.color);
  material.specularColor = Color3.Black();
  return material;
};

const toVector3 = (value: readonly [number, number, number]): Vector3 => new Vector3(...value);

const createLight = (scene: Scene, presetKey: string, definition: SceneEnvironmentLight): Light => {
  const config = definition.light;
  const light = config.primitive === 'hemispheric'
    ? new ParentLocalHemisphericLight(definition.id, toVector3(config.direction), scene)
    : config.primitive === 'directional'
      ? new DirectionalLight(definition.id, toVector3(config.direction), scene)
      : new PointLight(definition.id, toVector3(config.position), scene);
  light.name = `${presetKey}_${definition.name}`;
  light.intensity = definition.intensity;
  light.diffuse = Color3.FromHexString(definition.color);
  if (light instanceof HemisphericLight && config.primitive === 'hemispheric') {
    light.groundColor = Color3.FromHexString(config.groundColor);
  } else if (light instanceof DirectionalLight && config.primitive === 'directional' && config.position) {
    light.position.set(...config.position);
  } else if (light instanceof PointLight && config.primitive === 'point' && config.range !== undefined) {
    light.range = config.range;
  }
  return light;
};

const FILTER_QUALITY = {
  low: ShadowGenerator.QUALITY_LOW,
  medium: ShadowGenerator.QUALITY_MEDIUM,
  high: ShadowGenerator.QUALITY_HIGH,
} as const;

const applyShadowFilter = (generator: ShadowGenerator, shadow: ShadowQualitySettings): void => {
  const filter = shadow.filter;
  if (!filter || filter.mode === 'none') return;
  if (filter.mode === 'poisson') generator.usePoissonSampling = true;
  else if (filter.mode === 'exponential') generator.useExponentialShadowMap = true;
  else if (filter.mode === 'blur-exponential') generator.useBlurExponentialShadowMap = true;
  else if (filter.mode === 'close-exponential') generator.useCloseExponentialShadowMap = true;
  else if (filter.mode === 'blur-close-exponential') generator.useBlurCloseExponentialShadowMap = true;
  else if (filter.mode === 'pcf') generator.usePercentageCloserFiltering = true;
  else if (filter.mode === 'pcss') generator.useContactHardeningShadow = true;
  if (filter.quality) generator.filteringQuality = FILTER_QUALITY[filter.quality];
  if (filter.blurKernel !== undefined) generator.blurKernel = filter.blurKernel;
  if (filter.blurScale !== undefined) generator.blurScale = filter.blurScale;
  if (filter.blurBoxOffset !== undefined) generator.blurBoxOffset = filter.blurBoxOffset;
  if (filter.useKernelBlur !== undefined) generator.useKernelBlur = filter.useKernelBlur;
  if (filter.contactHardeningLightSize !== undefined) {
    generator.contactHardeningLightSizeUVRatio = filter.contactHardeningLightSize;
  }
};

const applyDirectionalShadowFrustum = (light: DirectionalLight, shadow: ShadowQualitySettings): void => {
  const frustum = shadow.directionalFrustum;
  light.autoUpdateExtends = frustum?.autoUpdateExtents ?? true;
  light.autoCalcShadowZBounds = frustum?.autoCalcZBounds ?? true;
  if (frustum?.size !== undefined) light.shadowFrustumSize = frustum.size;
  if (frustum?.minZ !== undefined) light.shadowMinZ = frustum.minZ;
  if (frustum?.maxZ !== undefined) light.shadowMaxZ = frustum.maxZ;
};

const applyCascadedShadowSettings = (
  generator: CascadedShadowGenerator,
  shadow: ShadowQualitySettings,
  debugOverride?: boolean,
): void => {
  const config = shadow.generator;
  if (config.type !== 'cascaded') return;
  if (config.cascadeCount !== undefined) generator.numCascades = config.cascadeCount;
  if (config.shadowMaxDistance !== undefined) generator.shadowMaxZ = config.shadowMaxDistance;
  if (config.lambda !== undefined) generator.lambda = config.lambda;
  if (config.blendPercentage !== undefined) generator.cascadeBlendPercentage = config.blendPercentage;
  if (config.stabilizeCascades !== undefined) generator.stabilizeCascades = config.stabilizeCascades;
  if (config.depthClamp !== undefined) generator.depthClamp = config.depthClamp;
  if (config.autoCalcDepthBounds !== undefined) generator.autoCalcDepthBounds = config.autoCalcDepthBounds;
  if (config.autoCalcDepthBoundsRefreshRate !== undefined) generator.autoCalcDepthBoundsRefreshRate = config.autoCalcDepthBoundsRefreshRate;
  if (config.freezeShadowCastersBoundingInfo !== undefined) generator.freezeShadowCastersBoundingInfo = config.freezeShadowCastersBoundingInfo;
  generator.debug = debugOverride ?? config.debug ?? false;
};

export type CreateSceneEnvironmentOptions = {
  /** Build a disabled candidate without changing scene background; caller activates after replacement. */
  staged?: boolean;
  signal?: AbortSignal;
  shadowQualityPresets: ShadowQualityPresetLibrary;
  shadowQualityTier?: ShadowQualityTier;
  /** 运行时覆盖全部 CSM 的级联着色调试状态，不修改预设数据。 */
  cascadedShadowDebug?: boolean;
};

const createSceneEnvironmentRuntime = (
  scene: Scene,
  preset: SceneEnvironmentPreset,
  options: CreateSceneEnvironmentOptions,
): { instance: SceneEnvironmentInstance; shadowGenerators: ShadowGenerator[] } => {
  validateEnvironmentHierarchy(preset);
  // Validate shadow references before allocating scene resources, including unsupported CSM lights.
  for (const definition of preset.lights) if ('shadow' in definition && definition.shadow) {
    const shadow = resolveShadowQuality(definition.shadow, options.shadowQualityPresets, options.shadowQualityTier);
    if (shadow.enabled && shadow.generator.type === 'cascaded' && definition.light.primitive !== 'directional') throw new Error(`光源 ${definition.id} 使用了 CSM，但 CSM 仅支持 directional 光源`);
  }
  const root = new TransformNode(`scene_environment_${preset.presetKey}`, scene);
  if (options.staged) root.setEnabled(false);
  const nodes = new Map<string, Node>();
  const groundMeshes = new Map<string, Mesh>();
  const shadowGenerators: ShadowGenerator[] = [];
  if (!options.staged) scene.clearColor = Color4.FromHexString(preset.clearColor);
  try {
    for (const definition of preset.transformNodes ?? []) {
      const node = new TransformNode(definition.id, scene);
      node.parent = root;
      nodes.set(`transform:${definition.id}`, node);
      node.position.set(...definition.position);
      if (definition.rotation) node.rotation.set(...definition.rotation);
      if (definition.scaling) node.scaling.set(...definition.scaling);
    }
    preset.lights.forEach((definition) => {
      const light = createLight(scene, preset.presetKey, definition);
      nodes.set(`light:${definition.id}`, light);
      light.parent = root;
      if (
        'shadow' in definition
        && definition.shadow
        && (light instanceof DirectionalLight || light instanceof PointLight)
      ) {
        const shadow = resolveShadowQuality(definition.shadow, options.shadowQualityPresets, options.shadowQualityTier);
        if (!shadow.enabled) return;
        if (shadow.generator.type === 'cascaded' && !(light instanceof DirectionalLight)) {
          throw new Error(`光源 ${definition.id} 使用了 CSM，但 CSM 仅支持 directional 光源`);
        }
        if (light instanceof DirectionalLight && shadow.generator.type === 'standard') applyDirectionalShadowFrustum(light, shadow);
        const generator = shadow.generator.type === 'cascaded'
          ? new CascadedShadowGenerator(shadow.mapSize ?? 1024, light as DirectionalLight, true, scene.activeCamera)
          : new ShadowGenerator(shadow.mapSize ?? 1024, light);
        shadowGenerators.push(generator);
        if (generator instanceof CascadedShadowGenerator) {
          applyCascadedShadowSettings(generator, shadow, options.cascadedShadowDebug);
        }
        generator.bias = shadow.bias ?? 0.0005;
        generator.normalBias = shadow.normalBias ?? 0.02;
        generator.setDarkness(shadow.darkness ?? 0.25);
        generator.forceBackFacesOnly = shadow.forceBackFacesOnly ?? false;
        if (shadow.frustumEdgeFalloff !== undefined) generator.frustumEdgeFalloff = shadow.frustumEdgeFalloff;
        if (shadow.depthScale !== undefined) generator.depthScale = shadow.depthScale;
        applyShadowFilter(generator, shadow);
      }
    });
    preset.objects.forEach((object) => {
      const geometry = object.geometry;
      const mesh = geometry.primitive === 'ground'
        ? MeshBuilder.CreateGround(object.id, { width: geometry.width, height: geometry.height }, scene)
        : geometry.primitive === 'box'
          ? MeshBuilder.CreateBox(object.id, { width: geometry.width, height: geometry.height, depth: geometry.depth }, scene)
          : MeshBuilder.CreateCylinder(object.id, {
            height: geometry.height,
            diameterTop: geometry.diameterTop,
            diameterBottom: geometry.diameterBottom,
            tessellation: geometry.tessellation,
          }, scene);
      const node = geometry.primitive === 'ground' ? new TransformNode(`${object.id}:transform`, scene) : mesh;
      node.parent = root;
      if (node !== mesh) { mesh.parent = node; groundMeshes.set(`object:${object.id}`, mesh); }
      nodes.set(`object:${object.id}`, node);
      node.position.set(...object.position);
      if (object.rotation) node.rotation.set(...object.rotation);
      if (object.scaling) node.scaling.set(...object.scaling);
      mesh.material = createMaterial(scene, preset.presetKey, object);
      getVisualDeformationRegistry(scene).register({ root: mesh, meshes: [mesh], kind: 'geometry', groupId: 'scene-geometry',
        id: `scene:${preset.presetKey}:object:${object.id}`, label: object.id,
        anchor: [0, mesh.getBoundingInfo().boundingBox.minimum.y, 0],
        tags: [preset.presetKey],
      });
      mesh.receiveShadows = object.shadow?.receive ?? false;
      if (object.shadow?.cast) shadowGenerators.forEach((generator) => generator.addShadowCaster(mesh));
    });
    const instance: SceneEnvironmentInstance = {
      presetKey: preset.presetKey,
      root,
      models: [],
      nodes,
      groundMeshes,
      dispose: () => {
        shadowGenerators.forEach((generator) => generator.dispose());
        root.dispose(false, true);
      },
    };
    if (!preset.models.length) attachEnvironmentHierarchy(instance, preset);
    return { instance, shadowGenerators };
  } catch (error) {
    shadowGenerators.forEach(generator => generator.dispose());
    root.dispose(false, true);
    throw error;
  }
};

/** 同步创建灯光和基础几何；模型声明由异步接口加载。 */
export const createSceneEnvironment = (
  scene: Scene,
  preset: SceneEnvironmentPreset,
  options: CreateSceneEnvironmentOptions,
): SceneEnvironmentInstance => {
  if (preset.models.length > 0) {
    throw new Error(`场景预设“${preset.presetKey}”包含本地模型，请使用 createSceneEnvironmentAsync。`);
  }
  return createSceneEnvironmentRuntime(scene, preset, options).instance;
};

/** 创建完整场景环境，并通过 core/model 加载预设声明的本地 GLB/GLTF。 */
export const createSceneEnvironmentAsync = async (
  scene: Scene,
  preset: SceneEnvironmentPreset,
  options: CreateSceneEnvironmentOptions,
): Promise<SceneEnvironmentInstance> => {
  options.signal?.throwIfAborted();
  const runtime = createSceneEnvironmentRuntime(scene, preset, options);
  const loadedModels: { definition: SceneEnvironmentPreset['models'][number]; entity: ModelEntity }[] = [];
  try {
    for (const definition of preset.models) {
      options.signal?.throwIfAborted();
      const entity = await createModelEntity(scene, definition.modelPath, {
        parent: runtime.instance.root,
        name: `${preset.presetKey}:${definition.id}`,
        transparencyPolicy: definition.transparencyPolicy,
        deformation: { id: `scene:${preset.presetKey}:model:${definition.id}`, groupId: 'scene-models', label: definition.id, tags: [preset.presetKey] },
      });
      if (options.signal?.aborted || scene.isDisposed) { entity.dispose(); throw new Error('场景加载已取消'); }
      loadedModels.push({ definition, entity });
      (runtime.instance.nodes as Map<string, Node>).set(`model:${definition.id}`, entity.root);
      entity.root.parent = runtime.instance.root;
      entity.root.position.set(...definition.position);
      if (definition.rotation) entity.root.rotation.set(...definition.rotation);
      if (definition.scaling) entity.root.scaling.set(...definition.scaling);
      entity.meshes.forEach((mesh) => {
        mesh.receiveShadows = definition.shadow?.receive ?? false;
        if (definition.shadow?.cast) {
          runtime.shadowGenerators.forEach((generator) => generator.addShadowCaster(mesh));
        }
      });
      if (definition.animation?.autoplay === true) {
        entity.playAnimation(definition.animation?.name, definition.animation?.loop ?? true);
      }
    }
    attachEnvironmentHierarchy(runtime.instance, preset);
  } catch (error) {
    loadedModels.forEach(({ entity }) => entity.dispose());
    runtime.instance.dispose();
    throw error;
  }
  let disposed = false;
  return {
    ...runtime.instance,
    models: loadedModels,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      loadedModels.forEach(({ entity }) => entity.dispose());
      runtime.instance.dispose();
    },
  };
};
