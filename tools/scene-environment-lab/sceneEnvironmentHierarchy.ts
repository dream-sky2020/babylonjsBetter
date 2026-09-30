import { Matrix, Quaternion, Vector3 } from '@babylonjs/core';
import { environmentNodeEntries, environmentParentCandidates, orderedEnvironmentEntries, validateEnvironmentHierarchy } from '../../core/scene/sceneEnvironment.hierarchy.ts';
import type { EditorHierarchyDropIntent } from '../../core/ui/editor-kit/ObjectHierarchy.tsx';
import type { SceneEnvironmentPreset, SceneEnvironmentVector3 } from '../../core/scene/sceneEnvironment.types.ts';

const tuple = (value: Vector3): SceneEnvironmentVector3 => [value.x, value.y, value.z];

/** Resolve relative to declaration IDs, not UI indices (which include read-only render nodes). */
export function moveEnvironmentNode(preset: SceneEnvironmentPreset, intent: EditorHierarchyDropIntent): SceneEnvironmentPreset {
  if (intent.sourceIds.length !== 1) throw new Error('一次只能移动一个声明节点');
  const id = intent.sourceIds[0];
  const entries = orderedEnvironmentEntries(preset);
  const source = entries.find(entry => entry.id === id);
  if (!source) throw new Error('只读节点和场景配置不能移动');
  const target = entries.find(entry => entry.id === intent.targetId);
  let parentId: string | null;
  if (intent.placement === 'root-end') {
    if (intent.targetId !== null) throw new Error('根层级目标无效');
    parentId = null;
  } else {
    if (!target || target.id === id) throw new Error('放置目标必须是其他声明节点');
    if (!['inside', 'before', 'after'].includes(intent.placement)) throw new Error('放置方式无效');
    parentId = intent.placement === 'inside' ? target.id : target.definition.parentId ?? null;
  }
  if (parentId !== intent.parentId) throw new Error('父节点已改变，请重新拖动');
  const siblings = entries.filter(entry => (entry.definition.parentId ?? null) === parentId).map(entry => entry.id);
  const order = siblings.filter(sibling => sibling !== id);
  const index = intent.placement === 'before' || intent.placement === 'after'
    ? order.indexOf(target!.id) + (intent.placement === 'after' ? 1 : 0) : order.length;
  order.splice(index, 0, id);
  if ((source.definition.parentId ?? null) === parentId && order.every((item, i) => item === siblings[i])) return preset;
  const next = structuredClone(reparentEnvironmentNode(preset, id, parentId));
  const definitions = new Map(environmentNodeEntries(next).map(entry => [entry.id, entry.definition]));
  order.forEach((nodeId, order) => { definitions.get(nodeId)!.order = order; });
  validateEnvironmentHierarchy(next);
  return next;
}

/** Read authored transforms, never the current preview/animation/display state. */
export function environmentWorldMatrices(preset: SceneEnvironmentPreset): Map<string, Matrix> {
  validateEnvironmentHierarchy(preset);
  const entries = new Map(environmentNodeEntries(preset).map(entry => [entry.id, entry.definition]));
  const worlds = new Map<string, Matrix>();
  const resolve = (id: string): Matrix => {
    const found = worlds.get(id);
    if (found) return found;
    const definition = entries.get(id)!;
    const parent = definition.parentId ? resolve(definition.parentId) : Matrix.Identity();
    const local = 'light' in definition ? Matrix.Identity() : Matrix.Compose(
      new Vector3(...(definition.scaling ?? [1, 1, 1])),
      Quaternion.FromEulerAngles(...(definition.rotation ?? [0, 0, 0])),
      new Vector3(...definition.position),
    );
    const world = local.multiply(parent);
    worlds.set(id, world);
    return world;
  };
  entries.forEach((_definition, id) => resolve(id));
  return worlds;
}

export function reparentEnvironmentNode(preset: SceneEnvironmentPreset, id: string, parentId: string | null): SceneEnvironmentPreset {
  const entry = environmentNodeEntries(preset).find(item => item.id === id);
  if (!entry) throw new Error('请选择可移动的场景节点');
  if (parentId && !environmentParentCandidates(preset, id).some(item => item.id === parentId)) throw new Error('不能移入自身、后代或不允许的父节点');
  if ((entry.definition.parentId ?? null) === parentId) return preset;
  const worlds = environmentWorldMatrices(preset);
  const parentWorld = parentId ? worlds.get(parentId)! : Matrix.Identity();
  if (Math.abs(parentWorld.determinant()) < 1e-10) throw new Error('父节点缩放为零或接近零，无法保持世界姿态');
  const inverseParent = Matrix.Invert(parentWorld);
  const next = structuredClone(preset);
  const target = environmentNodeEntries(next).find(item => item.id === id)!.definition;
  if ('light' in target && 'light' in entry.definition) {
    const oldParent = entry.definition.parentId ? worlds.get(entry.definition.parentId)! : Matrix.Identity();
    const relative = oldParent.multiply(inverseParent);
    const light = target.light;
    // Directions are parent-local vectors; point positions include translation.
    if (light.primitive !== 'hemispheric') {
      const position = light.position ?? (light.primitive === 'directional' ? light.direction.map(v => -v) as unknown as SceneEnvironmentVector3 : [0, 0, 0]);
      light.position = tuple(Vector3.TransformCoordinates(new Vector3(...position), relative));
    }
    if (light.primitive !== 'point') light.direction = tuple(Vector3.TransformNormal(new Vector3(...light.direction), relative));
  } else if (!('light' in target)) {
    const local = worlds.get(id)!.multiply(inverseParent);
    const scale = new Vector3(), rotation = new Quaternion(), position = new Vector3();
    if (!local.decompose(scale, rotation, position)) throw new Error('此父节点关系无法保持世界姿态');
    const reconstructed = Matrix.Compose(scale, rotation, position);
    if (local.asArray().some((value, index) => !Number.isFinite(value) || Math.abs(value - reconstructed.asArray()[index]) > 1e-5 * Math.max(1, Math.abs(value)))) {
      throw new Error('改父级会产生无法保存的剪切变换，请先调整父节点的旋转或非均匀缩放');
    }
    target.position = tuple(position);
    target.rotation = tuple(rotation.toEulerAngles());
    target.scaling = tuple(scale);
  }
  target.parentId = parentId;
  const siblings = environmentNodeEntries(next).map((item, index) => ({ ...item, index })).filter(item => item.id !== id && (item.definition.parentId ?? null) === parentId);
  target.order = Math.max(-1, ...siblings.map(item => item.definition.order ?? item.index)) + 1;
  validateEnvironmentHierarchy(next);
  return next;
}
