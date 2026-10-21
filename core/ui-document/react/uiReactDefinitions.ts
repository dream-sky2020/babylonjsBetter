import { UiDefinitionRegistry } from '../uiDefinition.registry';
import type { UiDefinition } from '../uiDocument.types';
import { reactUiPrefabs } from '../../ui/prefabs/catalog';

/** React code and editable metadata are registered together. No drawing adapter is required. */
export function registerReactUiComponent(registry: UiDefinitionRegistry, definition: Omit<UiDefinition, 'render' | 'hitTest'> & { component: NonNullable<UiDefinition['component']> }) {
  registry.register(definition);
}

export function createReactUiDefinitionRegistry(): UiDefinitionRegistry {
  const registry = new UiDefinitionRegistry();
  reactUiPrefabs.forEach(prefab => registerReactUiComponent(registry, prefab.definition));
  return registry;
}
