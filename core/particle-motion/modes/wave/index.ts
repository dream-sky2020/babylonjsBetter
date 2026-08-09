import { defineParticleMotion } from '../../defineParticleMotion';

type WaveState = {
  baseHeight: number;
  phase: number;
};

export default defineParticleMotion<WaveState>({
  id: 'wave',
  name: '波浪迁移',
  description: '粒子沿深度方向迁移，高度由连续正弦波控制。',
  version: 1,
  parameters: {
    travelSpeed: { type: 'number', label: '迁移速度', default: 1, min: -5, max: 5, step: 0.05, group: '迁移' },
    amplitude: { type: 'number', label: '波浪振幅', default: 0.85, min: 0, max: 5, step: 0.05, group: '波浪' },
    frequency: { type: 'number', label: '空间频率', default: 0.8, min: 0.05, max: 5, step: 0.05, group: '波浪' },
    temporalFrequency: { type: 'number', label: '时间频率', default: 2, min: -8, max: 8, step: 0.1, group: '波浪' }
  },
  createState: ({ random, runtime }) => ({
    baseHeight: (random() - 0.5) * runtime.fieldRadius * 0.35,
    phase: random() * Math.PI * 2
  }),
  initialize: (particle, _state, { random, runtime }) => {
    particle.position.set(
      (random() - 0.5) * runtime.fieldRadius * 2,
      0,
      (random() - 0.5) * runtime.fieldRadius * 2
    );
  },
  update: (particle, state, context, parameters) => {
    particle.position.y = state.baseHeight + Math.sin(
      particle.position.x * Number(parameters.frequency) +
      context.elapsedSeconds * Number(parameters.temporalFrequency) +
      state.phase
    ) * Number(parameters.amplitude);
    particle.position.z += context.deltaSeconds * Number(parameters.travelSpeed);
    if (particle.position.z > context.runtime.fieldRadius) particle.position.z = -context.runtime.fieldRadius;
    if (particle.position.z < -context.runtime.fieldRadius) particle.position.z = context.runtime.fieldRadius;
  }
});
