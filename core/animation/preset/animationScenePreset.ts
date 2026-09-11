import { parseSignalGraphDocument, type SignalGraphDocument } from '../signal/index.ts';

export type AnimationVec3 = Readonly<{ x: number; y: number; z: number }>;

export type AnimationSceneObject = Readonly<{
  id: string;
  parentId: string | null;
  name: string;
  factoryTypeId: string;
  enabled: boolean;
  position: AnimationVec3;
  rotation: AnimationVec3;
  scaling: AnimationVec3;
  config: Readonly<Record<string, unknown>>;
}>;

export type AnimationSignalBinding = Readonly<{
  id: string;
  outputId: string;
  objectId: string;
  adapterTypeId: string;
  config: Readonly<Record<string, unknown>>;
}>;

/** Open-ended attachment contract. Games decide what a mount accepts from its role/tags. */
export type AnimationMountPoint = Readonly<{
  id: string;
  name: string;
  objectId: string;
  role: string;
  tags: readonly string[];
}>;

export type AnimationTransport = Readonly<{
  duration: number;
  loop: boolean;
  playbackSpeed: number;
}>;

export type AnimationEventMarker = Readonly<{
  id: string;
  time: number;
  typeId: string;
  config: Readonly<Record<string, unknown>>;
}>;

/**
 * Generic, game-consumable animation scene. First-person actions are only one
 * possible template: no action enum or fixed rig is embedded in this contract.
 */
export type AnimationScenePreset = Readonly<{
  version: 1;
  name: string;
  description: string;
  tags: readonly string[];
  objects: readonly AnimationSceneObject[];
  mountPoints: readonly AnimationMountPoint[];
  events: readonly AnimationEventMarker[];
  signalGraph: SignalGraphDocument;
  bindings: readonly AnimationSignalBinding[];
  transport: AnimationTransport;
}>;

export type AnimationScenePresetLibrary = Readonly<Record<string, AnimationScenePreset>>;

const fail = (message: string): never => { throw new Error(`动画场景预设无效：${message}`); };
const finite = (value: unknown, field: string, positive = false) =>
  typeof value === 'number' && Number.isFinite(value) && (!positive || value > 0) ? value : fail(field);
const text = (value: unknown, field: string) => typeof value === 'string' ? value : fail(field);
const record = (value: unknown, field: string): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail(field);
const vector = (value: unknown, field: string): AnimationVec3 => {
  const raw = record(value, field);
  return { x: finite(raw.x, `${field}.x`), y: finite(raw.y, `${field}.y`), z: finite(raw.z, `${field}.z`) };
};
const strings = (value: unknown, field: string): string[] => {
  if (!Array.isArray(value) || value.some(entry => typeof entry !== 'string')) fail(field);
  return [...new Set(value as string[])];
};

export function parseAnimationScenePreset(value: unknown): AnimationScenePreset {
  const root = record(value, 'root');
  if (root.version !== 1) fail('version');
  if (!Array.isArray(root.objects) || !Array.isArray(root.bindings) || !Array.isArray(root.mountPoints) || !Array.isArray(root.events)) fail('collections');
  const ids = new Set<string>();
  const objects = root.objects.map((entry, index) => {
    const raw = record(entry, `objects[${index}]`);
    const id = text(raw.id, `objects[${index}].id`);
    if (!id || ids.has(id)) fail(`objects[${index}].id`);
    ids.add(id);
    const parentId = raw.parentId === null ? null : text(raw.parentId, `objects[${index}].parentId`);
    const config = record(raw.config, `objects[${index}].config`);
    const scaling = vector(raw.scaling, `objects[${index}].scaling`);
    if ([scaling.x, scaling.y, scaling.z].some(component => component <= 0)) fail(`objects[${index}].scaling`);
    if (typeof raw.enabled !== 'boolean') fail(`objects[${index}].enabled`);
    return { id, parentId, name: text(raw.name, `objects[${index}].name`), factoryTypeId: text(raw.factoryTypeId, `objects[${index}].factoryTypeId`), enabled: raw.enabled, position: vector(raw.position, `objects[${index}].position`), rotation: vector(raw.rotation, `objects[${index}].rotation`), scaling, config };
  });
  const byId = new Map(objects.map(object => [object.id, object]));
  objects.forEach(object => {
    if (object.parentId !== null && !ids.has(object.parentId)) fail(`${object.id}.parentId`);
    const ancestors = new Set([object.id]); let parentId = object.parentId;
    while (parentId !== null) {
      if (ancestors.has(parentId)) fail(`${object.id}.parentCycle`);
      ancestors.add(parentId); parentId = byId.get(parentId)?.parentId ?? null;
    }
  });
  const signalGraph = parseSignalGraphDocument(root.signalGraph);
  const outputIds = new Set(signalGraph.outputs.map(output => output.id));
  const bindingIds = new Set<string>();
  const bindings = root.bindings.map((entry, index) => {
    const raw = record(entry, `bindings[${index}]`);
    const id = text(raw.id, `bindings[${index}].id`);
    const outputId = text(raw.outputId, `bindings[${index}].outputId`);
    const objectId = text(raw.objectId, `bindings[${index}].objectId`);
    if (!id || bindingIds.has(id) || !ids.has(objectId) || !outputIds.has(outputId)) fail(`bindings[${index}] references`);
    bindingIds.add(id);
    return { id, outputId, objectId, adapterTypeId: text(raw.adapterTypeId, `bindings[${index}].adapterTypeId`), config: record(raw.config, `bindings[${index}].config`) };
  });
  const mountIds = new Set<string>();
  const mountPoints = root.mountPoints.map((entry, index) => {
    const raw = record(entry, `mountPoints[${index}]`);
    const id = text(raw.id, `mountPoints[${index}].id`);
    const objectId = text(raw.objectId, `mountPoints[${index}].objectId`);
    if (!id || mountIds.has(id) || !ids.has(objectId)) fail(`mountPoints[${index}] references`);
    mountIds.add(id);
    return { id, objectId, name: text(raw.name, `mountPoints[${index}].name`), role: text(raw.role, `mountPoints[${index}].role`), tags: strings(raw.tags, `mountPoints[${index}].tags`) };
  });
  const transport = record(root.transport, 'transport');
  if (typeof transport.loop !== 'boolean') fail('transport.loop');
  const eventIds = new Set<string>();
  const events = root.events.map((entry, index) => {
    const raw = record(entry, `events[${index}]`);
    const id = text(raw.id, `events[${index}].id`);
    const time = finite(raw.time, `events[${index}].time`);
    if (!id || eventIds.has(id) || time < 0) fail(`events[${index}]`);
    eventIds.add(id);
    return { id, time, typeId: text(raw.typeId, `events[${index}].typeId`), config: record(raw.config, `events[${index}].config`) };
  }).sort((left, right) => left.time - right.time);
  return {
    version: 1,
    name: text(root.name, 'name'),
    description: text(root.description, 'description'),
    tags: strings(root.tags, 'tags'),
    objects,
    mountPoints,
    events,
    signalGraph,
    bindings,
    transport: { duration: finite(transport.duration, 'transport.duration', true), loop: transport.loop, playbackSpeed: finite(transport.playbackSpeed, 'transport.playbackSpeed', true) },
  };
}

export function parseAnimationScenePresetLibrary(value: unknown): AnimationScenePresetLibrary {
  const root = record(value, 'library');
  return Object.fromEntries(Object.entries(root).map(([key, preset]) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) fail(`library key ${key}`);
    return [key, parseAnimationScenePreset(preset)];
  }));
}
