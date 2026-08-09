import { Vector3 } from '@babylonjs/core';
import { defineParticleMotion } from '../../defineParticleMotion';

type AttractorState = { velocity: Vector3 };

export default defineParticleMotion<AttractorState>({
  id: 'attractor',
  name: '中心吸引',
  description: '粒子被中心点吸引，到达中心后从场边缘重新生成。',
  version: 1,
  parameters: {
    strength: { type: 'number', label: '吸引强度', default: 2.4, min: 0.1, max: 12, step: 0.1, group: '力场' },
    damping: { type: 'number', label: '速度阻尼', default: 0.985, min: 0.8, max: 1, step: 0.001, group: '力场' },
    respawnRadius: { type: 'number', label: '重生阈值', default: 0.45, min: 0.05, max: 2, step: 0.05, group: '生命周期' }
  },
  createState: () => ({ velocity: Vector3.Zero() }),
  initialize: (particle, _state, { random, runtime }) => {
    const phase = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * runtime.fieldRadius;
    particle.position.set(
      Math.cos(phase) * radius,
      (random() - 0.5) * runtime.fieldRadius,
      Math.sin(phase) * radius
    );
  },
  update: (particle, state, context, parameters) => {
    const toCenter = particle.position.scale(-1);
    const distance = Math.max(0.001, toCenter.length());
    toCenter.scaleInPlace(1 / distance);
    state.velocity.addInPlace(toCenter.scale(Number(parameters.strength) * context.deltaSeconds));
    state.velocity.scaleInPlace(Math.pow(Number(parameters.damping), context.deltaSeconds * 60));
    particle.position.addInPlace(state.velocity.scale(context.deltaSeconds));
    if (distance < Number(parameters.respawnRadius)) {
      const phase = context.random() * Math.PI * 2;
      particle.position.set(
        Math.cos(phase) * context.runtime.fieldRadius,
        (context.random() - 0.5) * context.runtime.fieldRadius,
        Math.sin(phase) * context.runtime.fieldRadius
      );
      state.velocity.set(0, 0, 0);
    }
  }
});
