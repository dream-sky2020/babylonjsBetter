import type { ComponentDefinition, IComponent } from './entity.types';

export const MAP_ENTITY_TYPE = 'map';
export const MAP_ENTITY_COMPONENT_TYPE = 'scene-environment';
const mapComponents = new Set([MAP_ENTITY_COMPONENT_TYPE, 'shared-variable', 'variable-trigger']);

/** map Entity 承载地图级场景、共享变量与变量变化触发。 */
export const canAttachComponentDefinitionToEntityType = (
  definition: ComponentDefinition,
  entityType: string,
): boolean => (
  definition.allowedEntityTypes.includes(entityType)
  && (entityType !== MAP_ENTITY_TYPE || mapComponents.has(definition.type))
);

export class ComponentRegistry {
  private readonly definitions = new Map<string, ComponentDefinition>();

  register<T extends IComponent>(definition: ComponentDefinition<T>): void {
    if (this.definitions.has(definition.type)) {
      throw new Error(`Component definition already registered: ${definition.type}`);
    }
    if (!mapComponents.has(definition.type) && definition.allowedEntityTypes.includes(MAP_ENTITY_TYPE)) {
      throw new Error(`Component “${definition.type}” cannot be registered for map Entity; allowed components: ${[...mapComponents].join(", ")}.`);
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
