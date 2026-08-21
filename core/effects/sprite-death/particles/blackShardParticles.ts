import { ParticleSystem, Vector3 } from '@babylonjs/core';
import { particleColor, type SpriteDeathParticleProfile } from './particleProfile.types.ts';

export const configureBlackShardParticles: SpriteDeathParticleProfile = (system, preset, minBox, maxBox) => {
  system.createBoxEmitter(new Vector3(-.12 + preset.driftX * .08, -.5, -.12), new Vector3(.12 + preset.driftX * .08, -.16, .12), minBox, maxBox);
  system.color1 = particleColor('#070707', .98); system.color2 = particleColor('#454545', .92); system.colorDead = particleColor('#000000', 0);
  system.blendMode = ParticleSystem.BLENDMODE_STANDARD;
};
