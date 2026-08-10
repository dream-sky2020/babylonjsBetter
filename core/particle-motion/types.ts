import type { SolidParticle, Vector3 } from '@babylonjs/core';

export type MotionParameterSchema = Record<string, MotionParameterDefinition>;

type MotionParameterBase = {
  label: string;
  description?: string;
  group?: string;
};

export type MotionParameterDefinition =
  | (MotionParameterBase & {
      type: 'number';
      default: number;
      min: number;
      max: number;
      step: number;
    })
  | (MotionParameterBase & {
      type: 'boolean';
      default: boolean;
    })
  | (MotionParameterBase & {
      type: 'select';
      default: string;
      options: Array<{ value: string; label: string }>;
    })
  | (MotionParameterBase & {
      type: 'vector3';
      default: { x: number; y: number; z: number };
      min?: number;
      max?: number;
      step?: number;
    });

export type MotionParameterValues = Record<
  string,
  number | boolean | string | { x: number; y: number; z: number }
>;

export interface ParticleMotionRuntimeConfig {
  capacity: number;
  activeCount: number;
  timeScale: number;
  sizeScale: number;
  fieldRadius: number;
  seed: number;
}

export interface MotionCreateContext {
  random: () => number;
  runtime: ParticleMotionRuntimeConfig;
}

export interface MotionUpdateContext extends MotionCreateContext {
  deltaSeconds: number;
  elapsedSeconds: number;
}

export interface ParticleMotionDefinition<TState = unknown> {
  id: string;
  name: string;
  description: string;
  version: number;
  parameters: MotionParameterSchema;
  createState: (context: MotionCreateContext, parameters: MotionParameterValues) => TState;
  initialize: (
    particle: SolidParticle,
    state: TState,
    context: MotionCreateContext,
    parameters: MotionParameterValues
  ) => void;
  update: (
    particle: SolidParticle,
    state: TState,
    context: MotionUpdateContext,
    parameters: MotionParameterValues
  ) => void;
}

export type VelocityState = {
  velocity: Vector3;
};
