import type { SignalNodeDefinition } from './types.ts';

export class SignalNodeRegistry {
  private readonly definitions = new Map<string, SignalNodeDefinition>();

  register(definition: SignalNodeDefinition): this {
    if (this.definitions.has(definition.typeId)) throw new Error(`Signal Node 类型重复：${definition.typeId}`);
    this.definitions.set(definition.typeId, definition);
    return this;
  }

  get(typeId: string): SignalNodeDefinition | undefined {
    return this.definitions.get(typeId);
  }

  list(): readonly SignalNodeDefinition[] {
    return [...this.definitions.values()];
  }
}
