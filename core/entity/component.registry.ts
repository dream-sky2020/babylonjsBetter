import type { ComponentDefinition, IComponent } from './entity.types';

export const MAP_ENTITY_TYPE = 'map';
export const MAP_ENTITY_COMPONENT_TYPE = 'scene-environment';

/** map Entity 只承载大场景环境引用，其他业务数据应挂在格子、边或点的 Entity 上。 */
export const canAttachComponentDefinitionToEntityType = (
  definition: ComponentDefinition,
  entityType: string,
): boolean => (
  definition.allowedEntityTypes.includes(entityType)
  && (entityType !== MAP_ENTITY_TYPE || definition.type === MAP_ENTITY_COMPONENT_TYPE)
);

export class ComponentRegistry {
  private readonly definitions = new Map<string, ComponentDefinition>();

  register<T extends IComponent>(definition: ComponentDefinition<T>): void {
    if (this.definitions.has(definition.type)) {
      throw new Error(`Component definition already registered: ${definition.type}`);
    }
    if (definition.type !== MAP_ENTITY_COMPONENT_TYPE && definition.allowedEntityTypes.includes(MAP_ENTITY_TYPE)) {
      throw new Error(`Component “${definition.type}” cannot be registered for map Entity; only “${MAP_ENTITY_COMPONENT_TYPE}” is allowed.`);
    }
    this.definitions.set(definition.type, definition as unknown as ComponentDefinition);
  }

  get(type: string): ComponentDefinition | undefined {
    return this.definitions.get(type);
  }

  list(): ComponentDefinition[] {
    return [...this.definitions.values()].sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));
  }

  listForEntity(entityType: string): ComponentDefinition[] {
    return this.list().filter((definition) => canAttachComponentDefinitionToEntityType(definition, entityType));
  }

  canAttachTo(componentType: string, entityType: string): boolean {
    const definition = this.definitions.get(componentType);
    return definition ? canAttachComponentDefinitionToEntityType(definition, entityType) : false;
  }
}
