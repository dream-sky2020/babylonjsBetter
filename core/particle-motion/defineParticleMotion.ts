import type {
  MotionParameterSchema,
  MotionParameterValues,
  ParticleMotionDefinition
} from './types';

export const defineParticleMotion = <TState>(
  definition: ParticleMotionDefinition<TState>
): ParticleMotionDefinition<TState> => definition;

export const createDefaultMotionParameters = (
  schema: MotionParameterSchema
): MotionParameterValues => Object.fromEntries(
  Object.entries(schema).map(([key, definition]) => {
    const value = definition.type === 'vector3'
      ? { ...definition.default }
      : definition.default;
    return [key, value];
  })
);
