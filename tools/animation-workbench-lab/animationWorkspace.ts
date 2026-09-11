import { createDefaultSignalGraph, parseSignalGraphDocument, type SignalGraphDocument } from '../../core/animation/signal/index.ts';
import type { AnimationEventMarker, AnimationMountPoint, AnimationSceneObject, AnimationSignalBinding, AnimationTransport, AnimationVec3 } from '../../core/animation/preset/index.ts';

export type WorkbenchVec3 = AnimationVec3;
export type AnimationObjectRecord = AnimationSceneObject;
export type PreviewSignalBinding = AnimationSignalBinding;

export type AnimationWorkspace = Readonly<{
  version: 1;
  name: string;
  objects: readonly AnimationObjectRecord[];
  signalGraph: SignalGraphDocument;
  previewBindings: readonly PreviewSignalBinding[];
  mountPoints: readonly AnimationMountPoint[];
  events: readonly AnimationEventMarker[];
  transport: AnimationTransport;
}>;

const vector = (x = 0, y = 0, z = 0): WorkbenchVec3 => ({ x, y, z });

export const createDefaultAnimationWorkspace = (): AnimationWorkspace => ({
  version: 1,
  name: '未命名动画工作区',
  objects: [
    {
      id: 'workspace-root',
      parentId: null,
      name: '动画根节点',
      factoryTypeId: 'core.empty',
      enabled: true,
      position: vector(),
      rotation: vector(),
      scaling: vector(1, 1, 1),
      config: {},
    },
    {
      id: 'first-person-rig',
      parentId: 'workspace-root',
      name: '第一人称 Rig',
      factoryTypeId: 'rig.first-person',
      enabled: true,
      position: vector(),
      rotation: vector(),
      scaling: vector(1, 1, 1),
      config: { depth: .65 },
    },
    {
      id: 'right-hand-socket',
      parentId: 'first-person-rig',
      name: '右手武器挂点',
      factoryTypeId: 'core.socket',
      enabled: true,
      position: vector(.35, -.25, .8),
      rotation: vector(),
      scaling: vector(1, 1, 1),
      config: {},
    },
    {
      id: 'preview-object',
      parentId: 'right-hand-socket',
      name: '武器代理体',
      factoryTypeId: 'semantic.proxy',
      enabled: true,
      position: vector(),
      rotation: vector(),
      scaling: vector(.12, .06, 1.5),
      config: { shape: 'box', color: '#35b9d1', displayMode: 'xray', opacity: .14 },
    },
    {
      id: 'preview-grip',
      parentId: 'right-hand-socket',
      name: '持握体',
      factoryTypeId: 'semantic.grip',
      enabled: true,
      position: vector(0, 0, -.34),
      rotation: vector(),
      scaling: vector(.13, .13, .3),
      config: { shape: 'cylinder', color: '#e7a13e', displayMode: 'xray', opacity: .2 },
    },
    {
      id: 'preview-attack',
      parentId: 'right-hand-socket',
      name: '攻击体',
      factoryTypeId: 'semantic.attack',
      enabled: true,
      position: vector(0, 0, .52),
      rotation: vector(),
      scaling: vector(.16, .1, 1.15),
      config: { shape: 'box', color: '#e05261', displayMode: 'xray', opacity: .18 },
    },
    {
      id: 'preview-muzzle',
      parentId: 'right-hand-socket',
      name: '发射端',
      factoryTypeId: 'semantic.muzzle',
      enabled: false,
      position: vector(0, 0, 1.3),
      rotation: vector(),
      scaling: vector(1, 1, 1),
      config: { color: '#e95bb5' },
    },
  ],
  signalGraph: createDefaultSignalGraph(),
  previewBindings: [],
  mountPoints: [{ id: 'item', name: '道具模型', objectId: 'right-hand-socket', role: 'item', tags: ['first-person', 'right'] }],
  events: [],
  transport: { duration: 2, loop: true, playbackSpeed: 1 },
});

const isFiniteVector = (value: unknown): value is WorkbenchVec3 => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<WorkbenchVec3>;
  return [candidate.x, candidate.y, candidate.z].every(entry => typeof entry === 'number' && Number.isFinite(entry));
};

export const parseAnimationWorkspace = (value: unknown): AnimationWorkspace => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('动画工作区必须为对象');
  const root = value as Partial<AnimationWorkspace>;
  if (root.version !== 1 || typeof root.name !== 'string' || !Array.isArray(root.objects)) throw new Error('动画工作区版本或名称无效');
  const ids = new Set<string>();
  const objects = root.objects.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`动画对象 ${index} 无效`);
    const object = entry as Partial<AnimationObjectRecord>;
    if (!object.id || typeof object.id !== 'string' || ids.has(object.id)) throw new Error(`动画对象 ${index} 的 ID 无效`);
    ids.add(object.id);
    if (object.parentId !== null && typeof object.parentId !== 'string') throw new Error(`动画对象 ${object.id} 的父级无效`);
    if (!object.name || typeof object.name !== 'string' || !object.factoryTypeId || typeof object.factoryTypeId !== 'string') throw new Error(`动画对象 ${object.id} 的定义无效`);
    if (typeof object.enabled !== 'boolean' || !isFiniteVector(object.position) || !isFiniteVector(object.rotation) || !isFiniteVector(object.scaling)) throw new Error(`动画对象 ${object.id} 的变换无效`);
    const config = object.config === undefined ? {} : object.config;
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error(`动画对象 ${object.id} 的配置无效`);
    return { ...object, config } as AnimationObjectRecord;
  });
  objects.forEach((object) => {
    if (object.parentId !== null && !ids.has(object.parentId)) throw new Error(`动画对象 ${object.id} 引用了不存在的父级`);
    if ([object.scaling.x, object.scaling.y, object.scaling.z].some(value => value <= 0)) throw new Error(`动画对象 ${object.id} 的缩放必须大于零`);
  });
  const objectById = new Map(objects.map(object => [object.id, object]));
  objects.forEach((object) => {
    const ancestors = new Set<string>([object.id]);
    let parentId = object.parentId;
    while (parentId !== null) {
      if (ancestors.has(parentId)) throw new Error(`动画对象 ${object.id} 的父级形成了循环`);
      ancestors.add(parentId);
      parentId = objectById.get(parentId)?.parentId ?? null;
    }
  });
  const signalGraph = parseSignalGraphDocument(root.signalGraph);
  const rawBindings = Array.isArray(root.previewBindings) ? root.previewBindings : [];
  const previewBindings = rawBindings.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`预览绑定 ${index} 无效`);
    const binding = entry as Partial<PreviewSignalBinding>;
    if (!binding.id || !binding.outputId || !binding.objectId || !binding.adapterTypeId || !binding.config || typeof binding.config !== 'object' || Array.isArray(binding.config)) throw new Error(`预览绑定 ${index} 无效`);
    return binding as PreviewSignalBinding;
  });
  const outputIds = new Set(signalGraph.outputs.map(output => output.id));
  previewBindings.forEach((binding, index) => {
    if (!ids.has(binding.objectId) || !outputIds.has(binding.outputId)) throw new Error(`预览绑定 ${index} 引用了不存在的对象或输出`);
  });
  const rawMountPoints = Array.isArray(root.mountPoints) ? root.mountPoints : [];
  const mountPoints = rawMountPoints.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`挂载点 ${index} 无效`);
    const mount = entry as Partial<AnimationMountPoint>;
    if (!mount.id || !mount.name || !mount.objectId || !ids.has(mount.objectId) || typeof mount.role !== 'string' || !Array.isArray(mount.tags) || mount.tags.some(tag => typeof tag !== 'string')) throw new Error(`挂载点 ${index} 无效`);
    return mount as AnimationMountPoint;
  });
  const rawEvents = Array.isArray(root.events) ? root.events : [];
  const events = rawEvents.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`事件 ${index} 无效`);
    const marker = entry as Partial<AnimationEventMarker>;
    if (!marker.id || typeof marker.time !== 'number' || !Number.isFinite(marker.time) || marker.time < 0 || !marker.typeId || !marker.config || typeof marker.config !== 'object' || Array.isArray(marker.config)) throw new Error(`事件 ${index} 无效`);
    return marker as AnimationEventMarker;
  });
  const transport = root.transport ?? { duration: 2, loop: true, playbackSpeed: 1 };
  if (typeof transport.duration !== 'number' || !Number.isFinite(transport.duration) || transport.duration <= 0 || typeof transport.loop !== 'boolean' || typeof transport.playbackSpeed !== 'number' || !Number.isFinite(transport.playbackSpeed) || transport.playbackSpeed <= 0) throw new Error('播放设置无效');
  return { version: 1, name: root.name, objects, signalGraph, previewBindings, mountPoints, events, transport };
};

export const workspaceToScenePreset = (workspace: AnimationWorkspace, description = '', tags: readonly string[] = []) => ({
  version: 1 as const, name: workspace.name, description, tags, objects: workspace.objects, mountPoints: workspace.mountPoints,
  events: workspace.events, signalGraph: workspace.signalGraph, bindings: workspace.previewBindings, transport: workspace.transport,
});

export const scenePresetToWorkspace = (preset: import('../../core/animation/preset/index.ts').AnimationScenePreset): AnimationWorkspace => ({
  version: 1, name: preset.name, objects: preset.objects, signalGraph: preset.signalGraph, previewBindings: preset.bindings,
  mountPoints: preset.mountPoints, events: preset.events, transport: preset.transport,
});

export const cloneAnimationWorkspace = (workspace: AnimationWorkspace): AnimationWorkspace => structuredClone(workspace);
