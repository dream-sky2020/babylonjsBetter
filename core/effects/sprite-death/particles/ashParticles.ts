import { ParticleSystem, Vector3 } from '@babylonjs/core';
import { particleColor, type SpriteDeathParticleProfile } from './particleProfile.types.ts';

export const configureAshParticles: SpriteDeathParticleProfile = (system, preset, minBox, maxBox) => {
  system.createBoxEmitter(new Vector3(-.38, .05, -.22), new Vector3(.38, .72, .22), minBox, maxBox);
  system.color1 = particleColor(preset.ashColor, .9); system.color2 = particleColor(preset.charColor, .78); system.colorDead = particleColor('#202020', 0);
  system.blendMode = ParticleSystem.BLENDMODE_STANDARD;
};
