export interface IComponent {
  /** 组件实例 ID；同一实体可挂载多个同类型组件。 */
  id: string;
  /** 稳定的组件类型标识。 */
  type: string;
  /** 序列化版本，用于存档迁移。 */
  version: number;
  /** 同类型多实例组件跨 Entity 批量匹配时使用的稳定槽位。 */
  slot?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface IEntity {
  id: string;
  /** 稳定的实体类型；决定该实体可出现的容器以及可挂载的组件。 */
  entityType: string;
  name?: string;
  archetypeId?: string;
  enabled?: boolean;
  components: IComponent[];
}

/** 地图、场景或其他空间结构只依赖这一种挂载容器。 */
export interface IEntityContainer {
  entities: IEntity[];
}

export type EntityContainerKind =
  | 'map'
  | 'tile'
  | 'tile-edge'
  | 'shared-edge'
  | 'shared-point'
  | 'scene'
  | 'actor-slot'
  | 'item-slot';

/** 批量操作的目标范围；任何模式都不能绕过 allowedContainers/allowedEntityTypes。 */
export type BatchEditScope = 'same-kind' | 'compatible';

/** 未声明 batch 时，定义默认完全不参与批量写入。 */
export type BatchOperationPolicy = {
  scope: BatchEditScope;
  create?: boolean;
  edit?: boolean;
  delete?: boolean;
};

export type EntityTypeDefinition = {
  type: string;
  label: string;
  description?: string;
  allowedContainers: readonly EntityContainerKind[];
  batch?: BatchOperationPolicy;
  defaultComponents?: readonly string[];
  requiredComponents?: readonly string[];
  allowMultiplePerContainer?: boolean;
};

export type ComponentFieldControl =
  | 'checkbox'
  | 'select'
  | 'tags'
  | 'text'
  | 'number'
  | 'json';

export type ComponentFieldSchema = {
  path: string;
  label: string;
  control: ComponentFieldControl;
  batch?: {
    editable: boolean;
    strategy?: 'replace';
    equality?: 'strict' | 'deep' | 'unordered-array';
  };
  optional?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly { value: string; label: string }[];
};

export type ComponentDefinition<T extends IComponent = IComponent> = {
  type: T['type'];
  version: number;
  label: string;
  description?: string;
  /** 该组件允许挂载到的实体类型。 */
  allowedEntityTypes: readonly string[];
  batch?: BatchOperationPolicy;
  allowMultiple?: boolean;
  fields: readonly ComponentFieldSchema[];
  createDefault: () => T;
  validate?: (component: T) => readonly string[];
  migrate?: (data: Record<string, unknown>, fromVersion: number) => T;
};
