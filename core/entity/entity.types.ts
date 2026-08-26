export interface IComponent {
  /** 组件实例 ID；同一实体可挂载多个同类型组件。 */
  id: string;
  /** 稳定的组件类型标识。 */
  type: string;
  /** 序列化版本，用于存档迁移。 */
  version: number;
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

export type EntityTypeDefinition = {
  type: string;
  label: string;
  description?: string;
  allowedContainers: readonly EntityContainerKind[];
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
  allowMultiple?: boolean;
  fields: readonly ComponentFieldSchema[];
  createDefault: () => T;
  validate?: (component: T) => readonly string[];
  migrate?: (data: Record<string, unknown>, fromVersion: number) => T;
};
