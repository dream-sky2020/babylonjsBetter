import type { UiDefinition } from './uiDocument.types.ts';

export class UiDefinitionRegistry {
  readonly #definitions = new Map<string, UiDefinition>();

  register(definition: UiDefinition): void {
    if (!definition.type.trim()) throw new Error('UI Definition type 不能为空。');
    if (this.#definitions.has(definition.type)) throw new Error(`UI Definition 已重复注册：${definition.type}`);
    this.#definitions.set(definition.type, definition);
  }

  get(type: string): UiDefinition | undefined {
    return this.#definitions.get(type);
  }

  require(type: string): UiDefinition {
    const definition = this.get(type);
    if (!definition) throw new Error(`UI Definition 不存在：${type}`);
    return definition;
  }

  list(): UiDefinition[] {
    return [...this.#definitions.values()].sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));
  }
}
