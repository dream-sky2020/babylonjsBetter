import { ParticleSystem, Vector3 } from '@babylonjs/core';
import { particleColor, type SpriteDeathParticleProfile } from './particleProfile.types.ts';

export const configureEmberParticles: SpriteDeathParticleProfile = (system, preset, minBox, maxBox) => {
  system.createBoxEmitter(new Vector3(-.75, .15, -.45), new Vector3(.75, 1.15, .45), minBox, maxBox);
  system.color1 = particleColor(preset.edgeColor, 1); system.color2 = particleColor('#ffd35a', 1); system.colorDead = particleColor('#5b1600', 0);
  system.minLifeTime = .35; system.maxLifeTime = 1; system.minEmitPower = .9; system.maxEmitPower = 1.8 + preset.turbulence * 1.2;
  system.gravity.set(preset.driftX * .12, -.35 + preset.rise * .08, 0); system.blendMode = ParticleSystem.BLENDMODE_ADD;
  return 260;
};
