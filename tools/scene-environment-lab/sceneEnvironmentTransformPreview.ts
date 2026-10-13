import type { SceneEnvironmentPreset } from '../../core/scene/sceneEnvironment.types.ts';

/** Only fields handled by the adapter's sync may bypass scene creation. */
export function isEnvironmentTransformOnlyChange(previous: SceneEnvironmentPreset, next: SceneEnvironmentPreset): boolean {
  const structure = (preset: SceneEnvironmentPreset) => {
    const withoutTransform = ({ position: _position, rotation: _rotation, scaling: _scaling, ...rest }: { position: unknown; rotation?: unknown; scaling?: unknown }) => rest;
    return JSON.stringify({
      ...preset,
      transformNodes: preset.transformNodes?.map(withoutTransform),
      objects: preset.objects.map(withoutTransform),
      models: preset.models.map(withoutTransform),
      lights: preset.lights.map(definition => {
        if (definition.light.primitive === 'hemispheric') return definition;
        const { position: _position, ...light } = definition.light;
        return { ...definition, light };
      }),
    });
  };
  return structure(previous) === structure(next);
}
