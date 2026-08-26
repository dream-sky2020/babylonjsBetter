import type { ComponentDefinition, IComponent } from './entity.types';

export class ComponentRegistry {
  private readonly definitions = new Map<string, ComponentDefinition>();

  register<T extends IComponent>(definition: ComponentDefinition<T>): void {
    if (this.definitions.has(definition.type)) {
      throw new Error(`Component definition already registered: ${definition.type}`);
    }
    this.definitions.set(definition.type, definition as unknown as ComponentDefinition);
  }

  get(type: string): ComponentDefinition | undefined {
    return this.definitions.get(type);
  }

  list(): ComponentDefinition[] {
    return [...this.definitions.values()].sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));
  }
}
