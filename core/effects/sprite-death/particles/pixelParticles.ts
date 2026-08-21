import { ParticleSystem, Vector3 } from '@babylonjs/core';
import { particleColor, type SpriteDeathParticleProfile } from './particleProfile.types.ts';

export const configurePixelParticles: SpriteDeathParticleProfile = (system, preset, minBox, maxBox) => {
  system.createBoxEmitter(new Vector3(-.35, -.15, -.2), new Vector3(.35, .55, .2), minBox, maxBox);
  system.color1 = particleColor(preset.edgeColor, .95); system.color2 = particleColor('#d7f8ff', .9); system.colorDead = particleColor(preset.ashColor, 0);
  system.blendMode = ParticleSystem.BLENDMODE_STANDARD;
};
