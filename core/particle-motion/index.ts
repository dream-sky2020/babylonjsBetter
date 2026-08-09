export { defineParticleMotion, createDefaultMotionParameters } from './defineParticleMotion';
export {
  particleMotionDefinitions,
  particleMotionRegistry,
  getParticleMotionDefinition
} from './registry';
export type {
  MotionCreateContext,
  MotionParameterDefinition,
  MotionParameterSchema,
  MotionParameterValues,
  MotionUpdateContext,
  ParticleMotionDefinition,
  ParticleMotionRuntimeConfig
} from './types';
