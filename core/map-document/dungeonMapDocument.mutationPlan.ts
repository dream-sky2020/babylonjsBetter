import type { IComponent, IEntity, IEntityContainer } from '../entity/entity.types.ts';
import { DungeonMapDocumentQuery } from './dungeonMapDocument.query.ts';
import type { DungeonMapDocumentStore } from './dungeonMapDocument.store.ts';
import type { DungeonMapDocumentV2, DungeonMapSpatialTarget } from './dungeonMapDocument.types.ts';

export type DungeonMapDocumentContainerChange = Readonly<{
  target: DungeonMapSpatialTarget;
  before: IEntityContainer;
  after: IEntityContainer;
}>;

export type DungeonMapDocumentMutation =
  | Readonly<{ kind: 'add-entity-at'; target: DungeonMapSpatialTarget; entity: IEntity }>
  | Readonly<{ kind: 'attach-entity'; target: DungeonMapSpatialTarget; entityId: string }>
  | Readonly<{ kind: 'remove-entity-at'; target: DungeonMapSpatialTarget; entityId: string }>
  | Readonly<{ kind: 'update-entity'; entityId: string; entity: IEntity }>
  | Readonly<{ kind: 'add-component'; entityId: string; component: IComponent }>
  | Readonly<{ kind: 'replace-component'; componentId: string; component: IComponent }>
  | Readonly<{ kind: 'remove-component'; componentId: string }>;

export type DungeonMapDocumentMutationPlan = Readonly<{
  label: string;
  operations: readonly DungeonMapDocumentMutation[];
  blockedReasons: readonly string[];
}>;

const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
const entityIdentity = ({ components: _components, ...entity }: IEntity) => {
  void _components;
  return entity;
};

export const createDungeonMapDocumentMutationPlan = (
  document: DungeonMapDocumentV2,
  label: string,
  changes: readonly DungeonMapDocumentContainerChange[],
): DungeonMapDocumentMutationPlan => {
  const query = new DungeonMapDocumentQuery(document);
  const blockedReasons: string[] = [];
  const addOperations: DungeonMapDocumentMutation[] = [];
  const attachOperations: DungeonMapDocumentMutation[] = [];
  const removeAtOperations: DungeonMapDocumentMutation[] = [];
  const desiredEntities = new Map<string, IEntity>();
  const createdEntityIds = new Set<string>();
  const attachedKeys = new Set<string>();

  changes.forEach((change) => {
    const current = query.getContainerAt(change.target);
    if (!sameJson(current, change.before)) {
      blockedReasons.push('批量计划已经过期：目标数据在预览后发生了变化。');
      return;
    }
    const beforeById = new Map(change.before.entities.map((entity) => [entity.id, entity]));
    const afterById = new Map(change.after.entities.map((entity) => [entity.id, entity]));
    if (beforeById.size !== change.before.entities.length || afterById.size !== change.after.entities.length) {
      blockedReasons.push('批量计划包含重复的 Entity ID。');
      return;
    }

    change.after.entities.forEach((entity) => {
      const desired = desiredEntities.get(entity.id);
      if (desired && !sameJson(desired, entity)) {
        blockedReasons.push(`同一 Entity“${entity.id}”在多个目标中产生了冲突结果。`);
      } else if (!desired) {
        desiredEntities.set(entity.id, structuredClone(entity));
      }
    });

    change.after.entities.filter(({ id }) => !beforeById.has(id)).forEach((entity) => {
      if (!query.getEntity(entity.id) && !createdEntityIds.has(entity.id)) {
        addOperations.push({ kind: 'add-entity-at', target: change.target, entity: structuredClone(entity) });
        createdEntityIds.add(entity.id);
        return;
      }
      const key = `${entity.id}\u0000${JSON.stringify(change.target)}`;
      if (!attachedKeys.has(key)) {
        attachOperations.push({ kind: 'attach-entity', target: change.target, entityId: entity.id });
        attachedKeys.add(key);
      }
    });
    change.before.entities.filter(({ id }) => !afterById.has(id)).forEach((entity) => {
      removeAtOperations.push({ kind: 'remove-entity-at', target: change.target, entityId: entity.id });
    });
  });

  if (blockedReasons.length > 0) return { label, operations: [], blockedReasons: [...new Set(blockedReasons)] };

  const updateOperations: DungeonMapDocumentMutation[] = [];
  desiredEntities.forEach((desired, entityId) => {
    if (createdEntityIds.has(entityId)) return;
    const current = query.getEntitySnapshot(entityId);
    if (!current) {
      blockedReasons.push(`Entity“${entityId}”不存在，无法执行批量修改。`);
      return;
    }
    if (!sameJson(entityIdentity(current), entityIdentity(desired))) {
      updateOperations.push({ kind: 'update-entity', entityId, entity: structuredClone(desired) });
    }
    const beforeComponents = new Map(current.components.map((component) => [component.id, component]));
    const afterComponents = new Map(desired.components.map((component) => [component.id, component]));
    if (beforeComponents.size !== current.components.length || afterComponents.size !== desired.components.length) {
      blockedReasons.push(`Entity“${entityId}”包含重复的 Component ID。`);
      return;
    }
    current.components.filter(({ id }) => !afterComponents.has(id)).forEach((component) => {
      updateOperations.push({ kind: 'remove-component', componentId: component.id });
    });
    desired.components.filter(({ id }) => !beforeComponents.has(id)).forEach((component) => {
      if (query.indexes.componentById.has(component.id)) {
        blockedReasons.push(`Component ID“${component.id}”已经属于其他数据。`);
      } else {
        updateOperations.push({ kind: 'add-component', entityId, component: structuredClone(component) });
      }
    });
    desired.components.filter(({ id }) => beforeComponents.has(id)).forEach((component) => {
      if (!sameJson(beforeComponents.get(component.id), component)) {
        updateOperations.push({ kind: 'replace-component', componentId: component.id, component: structuredClone(component) });
      }
    });
  });

  return {
    label,
    operations: blockedReasons.length > 0
      ? []
      : [...addOperations, ...attachOperations, ...updateOperations, ...removeAtOperations],
    blockedReasons: [...new Set(blockedReasons)],
  };
};

export const executeDungeonMapDocumentMutationPlan = (
  store: DungeonMapDocumentStore,
  plan: DungeonMapDocumentMutationPlan,
): boolean => {
  if (plan.blockedReasons.length > 0) throw new Error(plan.blockedReasons[0]);
  store.beginTransaction(plan.label);
  try {
    plan.operations.forEach((operation) => {
      if (operation.kind === 'add-entity-at') store.addEntityAt(operation.target, operation.entity, plan.label);
      else if (operation.kind === 'attach-entity') store.attachEntity(operation.entityId, operation.target, plan.label);
      else if (operation.kind === 'remove-entity-at') store.removeEntityAt(operation.target, operation.entityId, plan.label);
      else if (operation.kind === 'update-entity') {
        store.updateEntity(operation.entityId, entityIdentity(operation.entity), plan.label);
      } else if (operation.kind === 'add-component') {
        store.addComponent({ ...operation.component, entityId: operation.entityId }, plan.label);
      } else if (operation.kind === 'replace-component') {
        store.replaceComponent(operation.componentId, operation.component, plan.label);
      } else store.removeComponent(operation.componentId, plan.label);
    });
    return store.commitTransaction();
  } catch (error) {
    try { store.rollbackTransaction(); } catch { /* 提交校验失败时事务已经关闭。 */ }
    throw error;
  }
};
