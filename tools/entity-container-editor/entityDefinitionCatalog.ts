import {
  ComponentRegistry,
  EntityTypeRegistry,
  createEntity,
  type ComponentDefinition,
  type EntityTypeDefinition,
  type IEntity,
} from '@/core/entity';

const componentModules = import.meta.glob('/core/entity/components/*.component.ts', {
  eager: true,
  import: 'componentDefinition',
}) as Record<string, ComponentDefinition>;
const entityTypeModules = import.meta.glob('/core/entity/entity-types/*.entity-type.ts', {
  eager: true,
  import: 'entityTypeDefinition',
}) as Record<string, EntityTypeDefinition>;

export const componentRegistry = new ComponentRegistry();
Object.values(componentModules).forEach((definition) => componentRegistry.register(definition));

export const entityTypeRegistry = new EntityTypeRegistry();
Object.values(entityTypeModules).forEach((definition) => entityTypeRegistry.register(definition));

export const componentDefinitions = componentRegistry.list();
export const entityTypeDefinitions = entityTypeRegistry.list();

export const createEntityFromDefinition = (definition: EntityTypeDefinition): IEntity => {
  const entity = createEntity(definition.label, definition.type);
  const componentTypes = [...new Set([
    ...(definition.defaultComponents ?? []),
    ...(definition.requiredComponents ?? []),
  ])];
  entity.components = componentTypes.flatMap((componentType) => {
    const componentDefinition = componentRegistry.get(componentType);
    return componentDefinition && componentRegistry.canAttachTo(componentType, entity.entityType)
      ? [componentDefinition.createDefault()]
      : [];
  });
  return entity;
};
