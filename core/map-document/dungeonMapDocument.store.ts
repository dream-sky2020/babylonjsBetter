import {
  dungeonMapSpatialTargetKey,
  createDungeonMapDocumentIndexes,
} from './dungeonMapDocument.query.ts';
import type {
  DungeonMapDocumentComponent,
  DungeonMapDocumentEntity,
  DungeonMapDocumentV2,
  DungeonMapSpatialAttachmentComponent,
  DungeonMapSpatialTarget,
} from './dungeonMapDocument.types.ts';
import { validateDungeonMapDocumentV2 } from './dungeonMapDocument.validation.ts';
import type { IComponent, IEntity, IEntityContainer } from '../entity/entity.types.ts';

export type DungeonMapDocumentCommand = {
  label: string;
  apply(document: DungeonMapDocumentV2): DungeonMapDocumentV2;
};

export type DungeonMapDocumentStoreOptions = {
  maxHistory?: number;
  validateCommands?: boolean;
};

export type DungeonMapDocumentStoreChange = {
  label: string;
  source: 'execute' | 'undo' | 'redo' | 'rollback' | 'saved';
  document: DungeonMapDocumentV2;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
};

type HistoryEntry = {
  label: string;
  before: DungeonMapDocumentV2;
  after: DungeonMapDocumentV2;
};

type ActiveTransaction = {
  label: string;
  before: DungeonMapDocumentV2;
  changed: boolean;
};

const cloneRecord = <T>(value: T): T => structuredClone(value);

const withEntityTable = (
  document: DungeonMapDocumentV2,
  entities: DungeonMapDocumentEntity[],
): DungeonMapDocumentV2 => ({ ...document, entities });

const withComponentTable = (
  document: DungeonMapDocumentV2,
  type: string,
  table: DungeonMapDocumentComponent[],
): DungeonMapDocumentV2 => ({
  ...document,
  components: {
    ...document.components,
    ...(table.length > 0 ? { [type]: table } : {}),
  },
});

const withoutEmptyComponentTable = (
  document: DungeonMapDocumentV2,
  type: string,
  table: DungeonMapDocumentComponent[],
): DungeonMapDocumentV2 => {
  if (table.length > 0) return withComponentTable(document, type, table);
  const components = { ...document.components };
  delete components[type];
  return { ...document, components };
};

const documentsEqualByIdentity = (
  left: DungeonMapDocumentV2,
  right: DungeonMapDocumentV2,
): boolean => left === right;

/**
 * V2 编辑器状态的唯一写入口。每次修改创建新的根对象并只复制受影响的数据表，
 * 因此 Undo/Redo 可以保留旧根而与未修改的大数组共享内存。
 */
export class DungeonMapDocumentStore {
  private document: DungeonMapDocumentV2;
  private savedDocument: DungeonMapDocumentV2;
  private readonly past: HistoryEntry[] = [];
  private readonly future: HistoryEntry[] = [];
  private readonly listeners = new Set<(change: DungeonMapDocumentStoreChange) => void>();
  private readonly maxHistory: number;
  private readonly validateCommands: boolean;
  private activeTransaction: ActiveTransaction | null = null;

  constructor(document: DungeonMapDocumentV2, options: DungeonMapDocumentStoreOptions = {}) {
    const initial = cloneRecord(document);
    const issues = validateDungeonMapDocumentV2(initial);
    if (issues.length > 0) throw new Error(`无法创建地图文档 Store：${issues[0].message}`);
    this.document = initial;
    this.savedDocument = initial;
    this.maxHistory = Math.max(1, Math.floor(options.maxHistory ?? 100));
    this.validateCommands = options.validateCommands ?? true;
  }

  getDocument(): DungeonMapDocumentV2 {
    return this.document;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get dirty(): boolean {
    return !documentsEqualByIdentity(this.document, this.savedDocument);
  }

  subscribe(listener: (change: DungeonMapDocumentStoreChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private publish(label: string, source: DungeonMapDocumentStoreChange['source']): void {
    const change: DungeonMapDocumentStoreChange = {
      label,
      source,
      document: this.document,
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      dirty: this.dirty,
    };
    this.listeners.forEach((listener) => listener(change));
  }

  private assertValid(document: DungeonMapDocumentV2): void {
    if (!this.validateCommands) return;
    const issues = validateDungeonMapDocumentV2(document);
    if (issues.length > 0) throw new Error(`地图文档修改无效：${issues[0].message}`);
  }

  execute(command: DungeonMapDocumentCommand): boolean {
    const before = this.document;
    const after = command.apply(before);
    if (after === before) return false;
    this.assertValid(after);
    this.document = after;
    if (this.activeTransaction) {
      this.activeTransaction.changed = true;
    } else {
      this.past.push({ label: command.label, before, after });
      if (this.past.length > this.maxHistory) this.past.shift();
      this.future.length = 0;
    }
    this.publish(command.label, 'execute');
    return true;
  }

  beginTransaction(label: string): void {
    if (this.activeTransaction) throw new Error('地图文档事务不能嵌套。');
    this.activeTransaction = { label, before: this.document, changed: false };
  }

  commitTransaction(): boolean {
    const transaction = this.activeTransaction;
    if (!transaction) throw new Error('当前没有可提交的地图文档事务。');
    this.activeTransaction = null;
    if (!transaction.changed || transaction.before === this.document) return false;
    this.assertValid(this.document);
    this.past.push({ label: transaction.label, before: transaction.before, after: this.document });
    if (this.past.length > this.maxHistory) this.past.shift();
    this.future.length = 0;
    this.publish(transaction.label, 'execute');
    return true;
  }

  rollbackTransaction(): boolean {
    const transaction = this.activeTransaction;
    if (!transaction) throw new Error('当前没有可回滚的地图文档事务。');
    this.activeTransaction = null;
    if (!transaction.changed) return false;
    this.document = transaction.before;
    this.publish(transaction.label, 'rollback');
    return true;
  }

  undo(): boolean {
    if (this.activeTransaction) throw new Error('事务进行中不能撤销。');
    const entry = this.past.pop();
    if (!entry) return false;
    this.document = entry.before;
    this.future.push(entry);
    this.publish(entry.label, 'undo');
    return true;
  }

  redo(): boolean {
    if (this.activeTransaction) throw new Error('事务进行中不能重做。');
    const entry = this.future.pop();
    if (!entry) return false;
    this.document = entry.after;
    this.past.push(entry);
    this.publish(entry.label, 'redo');
    return true;
  }

  markSaved(): void {
    this.savedDocument = this.document;
    this.publish('标记为已保存', 'saved');
  }

  addEntity(entity: DungeonMapDocumentEntity, label = '添加 Entity'): boolean {
    return this.execute({
      label,
      apply: (document) => {
        if (document.entities.some(({ id }) => id === entity.id)) throw new Error(`Entity ID“${entity.id}”已经存在。`);
        return withEntityTable(document, [...document.entities, cloneRecord(entity)]);
      },
    });
  }

  updateEntity(
    entityId: string,
    patch: Partial<Omit<DungeonMapDocumentEntity, 'id'>>,
    label = '修改 Entity',
  ): boolean {
    return this.execute({
      label,
      apply: (document) => {
        const index = document.entities.findIndex(({ id }) => id === entityId);
        if (index < 0) throw new Error(`Entity“${entityId}”不存在。`);
        const entities = [...document.entities];
        entities[index] = { ...entities[index], ...cloneRecord(patch), id: entityId };
        return withEntityTable(document, entities);
      },
    });
  }

  removeEntity(entityId: string, label = '删除 Entity'): boolean {
    return this.execute({
      label,
      apply: (document) => {
        if (!document.entities.some(({ id }) => id === entityId)) throw new Error(`Entity“${entityId}”不存在。`);
        const components = Object.fromEntries(Object.entries(document.components).flatMap(([type, table]) => {
          const remaining = table.filter((component) => component.entityId !== entityId);
          return remaining.length > 0 ? [[type, remaining]] : [];
        }));
        return { ...document, entities: document.entities.filter(({ id }) => id !== entityId), components };
      },
    });
  }

  addComponent(component: DungeonMapDocumentComponent, label = '添加 Component'): boolean {
    return this.execute({
      label,
      apply: (document) => {
        const indexes = createDungeonMapDocumentIndexes(document);
        if (!indexes.entityById.has(component.entityId)) throw new Error(`Entity“${component.entityId}”不存在。`);
        if (indexes.componentById.has(component.id)) throw new Error(`Component ID“${component.id}”已经存在。`);
        const table = document.components[component.type] ?? [];
        return withComponentTable(document, component.type, [...table, cloneRecord(component)]);
      },
    });
  }

  updateComponent(
    componentId: string,
    patch: Record<string, unknown>,
    label = '修改 Component',
  ): boolean {
    return this.execute({
      label,
      apply: (document) => {
        const component = createDungeonMapDocumentIndexes(document).componentById.get(componentId);
        if (!component) throw new Error(`Component“${componentId}”不存在。`);
        const table = [...document.components[component.type]];
        const index = table.findIndex(({ id }) => id === componentId);
        table[index] = {
          ...component,
          ...cloneRecord(patch),
          id: component.id,
          entityId: component.entityId,
          type: component.type,
        };
        return withComponentTable(document, component.type, table);
      },
    });
  }

  replaceComponent(componentId: string, source: IComponent, label = '替换 Component'): boolean {
    return this.execute({
      label,
      apply: (document) => {
        const component = createDungeonMapDocumentIndexes(document).componentById.get(componentId);
        if (!component) throw new Error(`Component“${componentId}”不存在。`);
        const table = [...document.components[component.type]];
        const index = table.findIndex(({ id }) => id === componentId);
        table[index] = {
          ...cloneRecord(source),
          id: component.id,
          entityId: component.entityId,
          type: component.type,
        };
        return withComponentTable(document, component.type, table);
      },
    });
  }

  removeComponent(componentId: string, label = '删除 Component'): boolean {
    return this.execute({
      label,
      apply: (document) => {
        const component = createDungeonMapDocumentIndexes(document).componentById.get(componentId);
        if (!component) throw new Error(`Component“${componentId}”不存在。`);
        return withoutEmptyComponentTable(
          document,
          component.type,
          document.components[component.type].filter(({ id }) => id !== componentId),
        );
      },
    });
  }

  attachEntity(entityId: string, target: DungeonMapSpatialTarget, label = '挂载 Entity'): boolean {
    return this.execute({
      label,
      apply: (document) => {
        const indexes = createDungeonMapDocumentIndexes(document);
        if (!indexes.entityById.has(entityId)) throw new Error(`Entity“${entityId}”不存在。`);
        const table = [...(document.components['spatial-attachment'] ?? [])] as DungeonMapSpatialAttachmentComponent[];
        const index = table.findIndex((component) => component.entityId === entityId);
        if (index >= 0) {
          const current = table[index];
          const key = dungeonMapSpatialTargetKey(target);
          if (current.targets.some((candidate) => dungeonMapSpatialTargetKey(candidate) === key)) return document;
          table[index] = { ...current, targets: [...current.targets, cloneRecord(target)] };
        } else {
          let componentId = `${entityId}:spatial-attachment`;
          let suffix = 2;
          while (indexes.componentById.has(componentId)) {
            componentId = `${entityId}:spatial-attachment:${suffix}`;
            suffix += 1;
          }
          table.push({
            id: componentId,
            entityId,
            type: 'spatial-attachment',
            version: 1,
            targets: [cloneRecord(target)],
          });
        }
        return withComponentTable(document, 'spatial-attachment', table);
      },
    });
  }

  detachEntity(entityId: string, target: DungeonMapSpatialTarget, label = '解除 Entity 挂载'): boolean {
    return this.execute({
      label,
      apply: (document) => {
        const table = [...(document.components['spatial-attachment'] ?? [])] as DungeonMapSpatialAttachmentComponent[];
        const index = table.findIndex((component) => component.entityId === entityId);
        if (index < 0) return document;
        const key = dungeonMapSpatialTargetKey(target);
        const targets = table[index].targets.filter((candidate) => dungeonMapSpatialTargetKey(candidate) !== key);
        if (targets.length === table[index].targets.length) return document;
        if (targets.length === 0) table.splice(index, 1);
        else table[index] = { ...table[index], targets };
        return withoutEmptyComponentTable(document, 'spatial-attachment', table);
      },
    });
  }

  /** 将完整 Entity 直接写入标准化表并挂载到一个空间目标，作为单条历史记录。 */
  addEntityAt(target: DungeonMapSpatialTarget, source: IEntity, label = '添加 Entity'): boolean {
    return this.execute({
      label,
      apply: (document) => {
        const indexes = createDungeonMapDocumentIndexes(document);
        if (indexes.entityById.has(source.id)) throw new Error(`Entity ID“${source.id}”已经存在。`);
        source.components.forEach((component) => {
          if (indexes.componentById.has(component.id)) throw new Error(`Component ID“${component.id}”已经存在。`);
        });
        if (new Set(source.components.map(({ id }) => id)).size !== source.components.length) {
          throw new Error(`Entity“${source.id}”包含重复的 Component ID。`);
        }
        const entity: DungeonMapDocumentEntity = {
          id: source.id,
          entityType: source.entityType,
          ...(source.name !== undefined ? { name: source.name } : {}),
          ...(source.archetypeId !== undefined ? { archetypeId: source.archetypeId } : {}),
          ...(source.enabled !== undefined ? { enabled: source.enabled } : {}),
        };
        const components = Object.fromEntries(Object.entries(document.components).map(
          ([type, table]) => [type, [...table]],
        )) as Record<string, DungeonMapDocumentComponent[]>;
        source.components.filter(({ type }) => type !== 'spatial-attachment').forEach((component) => {
          const table = components[component.type] ?? [];
          table.push({ ...cloneRecord(component), entityId: source.id });
          components[component.type] = table;
        });
        let attachmentId = `${source.id}:spatial-attachment`;
        let suffix = 2;
        while (indexes.componentById.has(attachmentId)
          || source.components.some(({ id }) => id === attachmentId)) {
          attachmentId = `${source.id}:spatial-attachment:${suffix}`;
          suffix += 1;
        }
        const attachments = (components['spatial-attachment'] ?? []) as DungeonMapSpatialAttachmentComponent[];
        attachments.push({
          id: attachmentId,
          entityId: source.id,
          type: 'spatial-attachment',
          version: 1,
          targets: [cloneRecord(target)],
        });
        components['spatial-attachment'] = attachments;
        return { ...document, entities: [...document.entities, entity], components };
      },
    });
  }

  /** 从指定空间移除 Entity；没有其他挂载时级联删除身份与组件。 */
  removeEntityAt(target: DungeonMapSpatialTarget, entityId: string, label = '删除 Entity'): boolean {
    return this.execute({
      label,
      apply: (document) => {
        const targetKey = dungeonMapSpatialTargetKey(target);
        const attachments = [...(document.components['spatial-attachment'] ?? [])] as DungeonMapSpatialAttachmentComponent[];
        const index = attachments.findIndex((attachment) => attachment.entityId === entityId
          && attachment.targets.some((candidate) => dungeonMapSpatialTargetKey(candidate) === targetKey));
        if (index < 0) return document;
        const remainingTargets = attachments[index].targets.filter(
          (candidate) => dungeonMapSpatialTargetKey(candidate) !== targetKey,
        );
        if (remainingTargets.length > 0) {
          attachments[index] = { ...attachments[index], targets: remainingTargets };
          return withComponentTable(document, 'spatial-attachment', attachments);
        }
        const components = Object.fromEntries(Object.entries(document.components).flatMap(([type, table]) => {
          const remaining = table.filter((component) => component.entityId !== entityId);
          return remaining.length > 0 ? [[type, remaining]] : [];
        }));
        return {
          ...document,
          entities: document.entities.filter(({ id }) => id !== entityId),
          components,
        };
      },
    });
  }

  /**
   * 兼容旧 EntityContainer 调用方的原子写入桥梁。容器只是一份编辑快照；
   * 写回时会标准化 Entity/Component，并由空间挂载表达归属。
   */
  replaceSpatialContainer(
    target: DungeonMapSpatialTarget,
    container: IEntityContainer,
    label = '修改空间数据',
  ): boolean {
    return this.execute({
      label,
      apply: (document) => {
        const targetKey = dungeonMapSpatialTargetKey(target);
        const desiredIds = new Set<string>();
        container.entities.forEach((entity) => {
          if (desiredIds.has(entity.id)) throw new Error(`空间容器中 Entity ID“${entity.id}”重复。`);
          desiredIds.add(entity.id);
        });

        let entities = [...document.entities];
        const componentTables = Object.fromEntries(Object.entries(document.components).map(
          ([type, table]) => [type, [...table]],
        )) as Record<string, DungeonMapDocumentComponent[]>;
        const attachments = (componentTables['spatial-attachment'] ?? []) as DungeonMapSpatialAttachmentComponent[];
        componentTables['spatial-attachment'] = attachments;
        const existingAtTarget = new Set(attachments.filter((attachment) => attachment.targets.some(
          (candidate) => dungeonMapSpatialTargetKey(candidate) === targetKey,
        )).map(({ entityId }) => entityId));

        for (const entityId of existingAtTarget) {
          if (desiredIds.has(entityId)) continue;
          const attachmentIndex = attachments.findIndex((attachment) => attachment.entityId === entityId);
          const remainingTargets = attachments[attachmentIndex].targets.filter(
            (candidate) => dungeonMapSpatialTargetKey(candidate) !== targetKey,
          );
          if (remainingTargets.length > 0) {
            attachments[attachmentIndex] = { ...attachments[attachmentIndex], targets: remainingTargets };
          } else {
            attachments.splice(attachmentIndex, 1);
            entities = entities.filter(({ id }) => id !== entityId);
            Object.keys(componentTables).filter((type) => type !== 'spatial-attachment').forEach((type) => {
              componentTables[type] = componentTables[type].filter((component) => component.entityId !== entityId);
            });
          }
        }

        for (const desired of container.entities) {
          const entityIndex = entities.findIndex(({ id }) => id === desired.id);
          const identity: DungeonMapDocumentEntity = {
            id: desired.id,
            entityType: desired.entityType,
            ...(desired.name !== undefined ? { name: desired.name } : {}),
            ...(desired.archetypeId !== undefined ? { archetypeId: desired.archetypeId } : {}),
            ...(desired.enabled !== undefined ? { enabled: desired.enabled } : {}),
          };
          if (entityIndex >= 0) entities[entityIndex] = identity;
          else entities.push(identity);

          Object.keys(componentTables).filter((type) => type !== 'spatial-attachment').forEach((type) => {
            componentTables[type] = componentTables[type].filter((component) => component.entityId !== desired.id);
          });
          for (const component of desired.components) {
            const collision = Object.values(componentTables).flat().find(
              (candidate) => candidate.id === component.id && candidate.entityId !== desired.id,
            );
            if (collision) throw new Error(`Component ID“${component.id}”已属于另一个 Entity。`);
            const table = componentTables[component.type] ?? [];
            table.push({ ...cloneRecord(component), entityId: desired.id });
            componentTables[component.type] = table;
          }

          const attachmentIndex = attachments.findIndex((attachment) => attachment.entityId === desired.id);
          if (attachmentIndex >= 0) {
            const attachment = attachments[attachmentIndex];
            if (!attachment.targets.some((candidate) => dungeonMapSpatialTargetKey(candidate) === targetKey)) {
              attachments[attachmentIndex] = { ...attachment, targets: [...attachment.targets, cloneRecord(target)] };
            }
          } else {
            let id = `${desired.id}:spatial-attachment`;
            let suffix = 2;
            while (Object.values(componentTables).flat().some((component) => component.id === id)) {
              id = `${desired.id}:spatial-attachment:${suffix}`;
              suffix += 1;
            }
            attachments.push({ id, entityId: desired.id, type: 'spatial-attachment', version: 1, targets: [cloneRecord(target)] });
          }
        }

        Object.keys(componentTables).forEach((type) => {
          if (componentTables[type].length === 0) delete componentTables[type];
        });
        return { ...document, entities, components: componentTables };
      },
    });
  }
}
