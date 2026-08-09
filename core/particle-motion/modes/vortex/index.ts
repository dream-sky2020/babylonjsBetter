import { Vector3 } from '@babylonjs/core';
import { defineParticleMotion } from '../../defineParticleMotion';

type VortexState = {
  phase: number;
  radius: number;
  height: number;
  velocity: Vector3;
};

export default defineParticleMotion<VortexState>({
  id: 'vortex',
  name: '旋涡场',
  description: '围绕中心旋转，并叠加径向收缩与垂直波动。',
  version: 1,
  parameters: {
    angularSpeed: { type: 'number', label: '旋转速度', default: 1.1, min: -5, max: 5, step: 0.05, group: '旋转' },
    radialDrift: { type: 'number', label: '径向漂移', default: 0, min: -2, max: 2, step: 0.02, group: '旋转' },
    verticalWave: { type: 'number', label: '垂直波动', default: 0.35, min: 0, max: 4, step: 0.05, group: '扰动' },
    waveFrequency: { type: 'number', label: '波动频率', default: 3, min: 0.1, max: 12, step: 0.1, group: '扰动' }
  },
  createState: ({ random, runtime }) => ({
    phase: random() * Math.PI * 2,
    radius: Math.sqrt(random()) * runtime.fieldRadius,
    height: (random() - 0.5) * runtime.fieldRadius,
    velocity: Vector3.Zero()
  }),
  initialize: (particle, state) => {
    particle.position.set(
      Math.cos(state.phase) * state.radius,
      state.height,
      Math.sin(state.phase) * state.radius
    );
  },
  update: (particle, state, context, parameters) => {
    const angularSpeed = Number(parameters.angularSpeed);
    const radialDrift = Number(parameters.radialDrift);
    const verticalWave = Number(parameters.verticalWave);
    const waveFrequency = Number(parameters.waveFrequency);
    state.phase += context.deltaSeconds * angularSpeed;
    state.radius += radialDrift * context.deltaSeconds;
    if (state.radius < 0.2 || state.radius > context.runtime.fieldRadius) {
      state.radius = Math.max(0.2, Math.min(context.runtime.fieldRadius, state.radius));
    }
    particle.position.x = Math.cos(state.phase) * state.radius;
    particle.position.z = Math.sin(state.phase) * state.radius;
    particle.position.y = state.height + Math.sin(state.phase * waveFrequency + context.elapsedSeconds) * verticalWave;
  }
});
