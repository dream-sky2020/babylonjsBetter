import { canAttachComponentDefinitionToEntityType } from './component.registry';
import type {
  BatchEditScope,
  ComponentDefinition,
  ComponentFieldSchema,
  EntityContainerKind,
  EntityTypeDefinition,
  IComponent,
  IEntity,
  IEntityContainer,
} from './entity.types';

export type BatchOperation = 'create' | 'edit' | 'delete';

export type BatchContainerTarget = {
  id: string;
  kind: EntityContainerKind;
  container: IEntityContainer;
};

export type BatchEntityTarget = {
  containerId: string;
  entity: IEntity;
};

export type BatchEntityGroup = {
  key: string;
  entityType: string;
  archetypeId?: string;
  targets: BatchEntityTarget[];
  compatible: boolean;
  reason?: string;
};

export type BatchComponentTarget = {
  containerId: string;
  entityId: string;
  component: IComponent;
};

export type BatchComponentGroup = {
  key: string;
  componentType: string;
  slot?: string;
  targets: BatchComponentTarget[];
  compatible: boolean;
  reason?: string;
};

export type MutationChange = {
  targetId: string;
  kind: EntityContainerKind;
  before: IEntityContainer;
  after: IEntityContainer;
};

export type MutationPlan = {
  id: string;
  label: string;
  operation: string;
  createdAt: number;
  changes: MutationChange[];
  blockedReasons: string[];
  summary: {
    changedContainers: number;
    createdEntities: number;
    deletedEntities: number;
    createdComponents: number;
    deletedComponents: number;
  };
};

export type BatchFieldValue<T = unknown> =
  | { state: 'same'; value: T }
  | { state: 'mixed' }
  | { state: 'missing' };

const supportsScope = (scope: BatchEditScope, kinds: readonly string[]) => (
  scope === 'compatible' || new Set(kinds).size === 1
);

export const dedupeBatchContainerTargets = (
  targets: readonly BatchContainerTarget[],
): BatchContainerTarget[] => [...new Map(targets.map((target) => [target.id, target])).values()];

export const listBatchEntityDefinitions = (
  definitions: readonly EntityTypeDefinition[],
  targets: readonly BatchContainerTarget[],
  operation: BatchOperation,
): EntityTypeDefinition[] => {
  const kinds = targets.map((target) => target.kind);
  return definitions.filter((definition) => {
    const policy = definition.batch;
    if (!policy?.[operation] || !supportsScope(policy.scope, kinds)) return false;
    if (!targets.every((target) => definition.allowedContainers.includes(target.kind))) return false;
    if (operation === 'create' && definition.allowMultiplePerContainer === false) {
      return targets.every((target) => !target.container.entities.some(
        (entity) => entity.entityType === definition.type,
      ));
    }
    return true;
  });
};

/**
 * 跨容器只按 entityType 建立候选组。每个容器必须恰好有一个实例才可安全编辑；
 * 多实例需要未来的 type + slot/archetypeId 匹配协议。
 */
export const resolveBatchEntityGroups = (
  targets: readonly BatchContainerTarget[],
): BatchEntityGroup[] => {
  const entityKeys = new Set(targets.flatMap((target) => (
    target.container.entities.map((entity) => `${entity.entityType}\u0000${entity.archetypeId ?? ''}`)
  )));
  return [...entityKeys].sort().map((key) => {
    const [entityType, archetypeId = ''] = key.split('\u0000');
    const matches = targets.map((target) => ({
      containerId: target.id,
      entities: target.container.entities.filter((entity) => (
        entity.entityType === entityType && (entity.archetypeId ?? '') === archetypeId
      )),
    }));
    const missing = matches.filter((match) => match.entities.length === 0).length;
    const ambiguous = matches.filter((match) => match.entities.length > 1).length;
    return {
      key,
      entityType,
      archetypeId: archetypeId || undefined,
      targets: matches.flatMap((match) => match.entities.length === 1
        ? [{ containerId: match.containerId, entity: match.entities[0] }]
        : []),
      compatible: missing === 0 && ambiguous === 0,
      reason: missing > 0
        ? `${missing} 个容器缺少该 Entity`
        : ambiguous > 0
          ? `${ambiguous} 个容器存在多个同类型 Entity`
          : undefined,
    };
  });
};

/** 同类型多实例组件使用 type + slot 跨 Entity 匹配；没有 slot 的重复实例保持只读。 */
export const resolveBatchComponentGroups = (
  targets: readonly BatchEntityTarget[],
): BatchComponentGroup[] => {
  const componentKeys = new Set(targets.flatMap((target) => target.entity.components.map(
    (component) => `${component.type}\u0000${component.slot ?? ''}`,
  )));
  return [...componentKeys].sort().map((key) => {
    const [componentType, slot = ''] = key.split('\u0000');
    const matches = targets.map((target) => ({
      containerId: target.containerId,
      entityId: target.entity.id,
      components: target.entity.components.filter((component) => (
        component.type === componentType && (component.slot ?? '') === slot
      )),
    }));
    const missing = matches.filter((match) => match.components.length === 0).length;
    const ambiguous = matches.filter((match) => match.components.length > 1).length;
    return {
      key,
      componentType,
      slot: slot || undefined,
      targets: matches.flatMap((match) => match.components.length === 1 ? [{
        containerId: match.containerId,
        entityId: match.entityId,
        component: match.components[0],
      }] : []),
      compatible: missing === 0 && ambiguous === 0,
      reason: missing > 0
        ? `${missing} 个 Entity 缺少该 Component 槽位`
        : ambiguous > 0
          ? `${ambiguous} 个 Entity 的同一槽位存在多个实例`
          : undefined,
    };
  });
};

export const listBatchComponentDefinitions = (
  definitions: readonly ComponentDefinition[],
  targets: readonly BatchEntityTarget[],
  operation: BatchOperation,
): ComponentDefinition[] => {
  const entityTypes = targets.map((target) => target.entity.entityType);
  return definitions.filter((definition) => {
    const policy = definition.batch;
    if (!policy?.[operation] || !supportsScope(policy.scope, entityTypes)) return false;
    if (!targets.every((target) => canAttachComponentDefinitionToEntityType(definition, target.entity.entityType))) return false;
    const instances = targets.map((target) => target.entity.components.filter(
      (component) => component.type === definition.type,
    ));
    if (operation === 'create') {
      return definition.allowMultiple === true || instances.every((items) => items.length === 0);
    }
    if (operation === 'edit') {
      return resolveBatchComponentGroups(targets).some((group) => (
        group.componentType === definition.type && group.compatible
      ));
    }
    return instances.every((items) => items.length > 0);
  });
};

const cloneContainer = (container: IEntityContainer): IEntityContainer => (
  JSON.parse(JSON.stringify(container)) as IEntityContainer
);

export const createMutationPlan = (
  label: string,
  operation: string,
  targets: readonly BatchContainerTarget[],
  updater: (target: BatchContainerTarget) => IEntityContainer,
): MutationPlan => {
  const blockedReasons: string[] = [];
  const changes = dedupeBatchContainerTargets(targets).flatMap((target) => {
    try {
      const before = cloneContainer(target.container);
      const after = cloneContainer(updater({ ...target, container: before }));
      return JSON.stringify(before) === JSON.stringify(after)
        ? []
        : [{ targetId: target.id, kind: target.kind, before, after }];
    } catch (error) {
      blockedReasons.push(`${target.id}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  });
  return {
    id: `mutation-plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    operation,
    createdAt: Date.now(),
    changes,
    blockedReasons,
    summary: changes.reduce((summary, change) => {
      const beforeEntities = change.before.entities.length;
      const afterEntities = change.after.entities.length;
      const beforeComponents = change.before.entities.reduce(
        (count, entity) => count + entity.components.length, 0,
      );
      const afterComponents = change.after.entities.reduce(
        (count, entity) => count + entity.components.length, 0,
      );
      return {
        changedContainers: summary.changedContainers + 1,
        createdEntities: summary.createdEntities + Math.max(0, afterEntities - beforeEntities),
        deletedEntities: summary.deletedEntities + Math.max(0, beforeEntities - afterEntities),
        createdComponents: summary.createdComponents + Math.max(0, afterComponents - beforeComponents),
        deletedComponents: summary.deletedComponents + Math.max(0, beforeComponents - afterComponents),
      };
    }, {
      changedContainers: 0,
      createdEntities: 0,
      deletedEntities: 0,
      createdComponents: 0,
      deletedComponents: 0,
    }),
  };
};

const valueAtPath = (source: unknown, path: string): unknown => path.split('.').reduce<unknown>(
  (current, key) => current && typeof current === 'object'
    ? (current as Record<string, unknown>)[key]
    : undefined,
  source,
);

const comparableValue = (value: unknown, field: ComponentFieldSchema): string => {
  if (field.batch?.equality === 'unordered-array' && Array.isArray(value)) {
    return JSON.stringify([...value].map((item) => JSON.stringify(item)).sort());
  }
  if (field.batch?.equality === 'deep') return JSON.stringify(value);
  return typeof value === 'object' ? JSON.stringify(value) : `${typeof value}:${String(value)}`;
};

export const resolveBatchFieldValue = (
  components: readonly IComponent[],
  field: ComponentFieldSchema,
): BatchFieldValue => {
  const values = components.map((component) => valueAtPath(component, field.path));
  if (values.every((value) => value === undefined)) return { state: 'missing' };
  const first = comparableValue(values[0], field);
  return values.every((value) => comparableValue(value, field) === first)
    ? { state: 'same', value: values[0] }
    : { state: 'mixed' };
};
