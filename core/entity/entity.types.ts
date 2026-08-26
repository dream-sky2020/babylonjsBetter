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
  name?: string;
  archetypeId?: string;
  enabled?: boolean;
  components: IComponent[];
}

/** 地图、场景或其他空间结构只依赖这一种挂载容器。 */
export interface IEntityContainer {
  entities: IEntity[];
}

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
  allowMultiple?: boolean;
  fields: readonly ComponentFieldSchema[];
  createDefault: () => T;
  validate?: (component: T) => readonly string[];
  migrate?: (data: Record<string, unknown>, fromVersion: number) => T;
};
