import type { EntityContainerKind, EntityTypeDefinition } from './entity.types';

export class EntityTypeRegistry {
  private readonly definitions = new Map<string, EntityTypeDefinition>();

  register(definition: EntityTypeDefinition): void {
    if (this.definitions.has(definition.type)) {
      throw new Error(`Entity type definition already registered: ${definition.type}`);
    }
    this.definitions.set(definition.type, definition);
  }

  get(type: string): EntityTypeDefinition | undefined {
    return this.definitions.get(type);
  }

  list(): EntityTypeDefinition[] {
    return [...this.definitions.values()].sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));
  }

  listForContainer(containerKind: EntityContainerKind): EntityTypeDefinition[] {
    return this.list().filter((definition) => definition.allowedContainers.includes(containerKind));
  }

  canCreateIn(entityType: string, containerKind: EntityContainerKind): boolean {
    return this.definitions.get(entityType)?.allowedContainers.includes(containerKind) === true;
  }
}
