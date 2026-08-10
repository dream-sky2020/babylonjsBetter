import { Vector3 } from '@babylonjs/core';
import { defineParticleMotion } from '../../defineParticleMotion';

type RepulsorState = { velocity: Vector3 };

const respawnNearCenter = (
  particle: { position: Vector3 },
  state: RepulsorState,
  random: () => number,
  spawnRadius: number,
  initialSpeed: number
) => {
  const y = random() * 2 - 1;
  const phase = random() * Math.PI * 2;
  const planar = Math.sqrt(Math.max(0, 1 - y * y));
  const direction = new Vector3(Math.cos(phase) * planar, y, Math.sin(phase) * planar);
  const radius = Math.max(0.001, Math.sqrt(random()) * spawnRadius);
  particle.position.copyFrom(direction).scaleInPlace(radius);
  state.velocity.copyFrom(direction).scaleInPlace(initialSpeed);
};

export default defineParticleMotion<RepulsorState>({
  id: 'repulsor',
  name: '中心排斥',
  description: '粒子从中心附近生成并被持续向外推开，离开力场边界后回到中心重新生成。',
  version: 1,
  parameters: {
    strength: { type: 'number', label: '排斥强度', default: 2.4, min: 0.1, max: 12, step: 0.1, group: '力场' },
    damping: { type: 'number', label: '速度阻尼', default: 0.985, min: 0.8, max: 1, step: 0.001, group: '力场' },
    spawnRadius: { type: 'number', label: '中心生成半径', default: 0.45, min: 0.05, max: 2, step: 0.05, group: '生命周期' },
    initialSpeed: { type: 'number', label: '初始外扩速度', default: 0.2, min: 0, max: 5, step: 0.05, group: '生命周期' }
  },
  createState: () => ({ velocity: Vector3.Zero() }),
  initialize: (particle, state, { random }, parameters) => {
    respawnNearCenter(
      particle,
      state,
      random,
      Number(parameters.spawnRadius),
      Number(parameters.initialSpeed)
    );
  },
  update: (particle, state, context, parameters) => {
    const distance = particle.position.length();
    if (distance >= context.runtime.fieldRadius) {
      respawnNearCenter(
        particle,
        state,
        context.random,
        Number(parameters.spawnRadius),
        Number(parameters.initialSpeed)
      );
      return;
    }

    const awayFromCenter = particle.position.scale(1 / Math.max(0.001, distance));
    state.velocity.addInPlace(awayFromCenter.scale(Number(parameters.strength) * context.deltaSeconds));
    state.velocity.scaleInPlace(Math.pow(Number(parameters.damping), context.deltaSeconds * 60));
    particle.position.addInPlace(state.velocity.scale(context.deltaSeconds));
  }
});
