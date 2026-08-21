import { ParticleSystem, Vector3 } from '@babylonjs/core';
import { particleColor, type SpriteDeathParticleProfile } from './particleProfile.types.ts';

export const configurePixelParticles: SpriteDeathParticleProfile = (system, preset, minBox, maxBox) => {
  system.createBoxEmitter(new Vector3(-.35, -.15, -.2), new Vector3(.35, .55, .2), minBox, maxBox);
  system.color1 = particleColor(preset.edgeColor, .95); system.color2 = particleColor('#d7f8ff', .9); system.colorDead = particleColor(preset.ashColor, 0);
  system.minLifeTime = .4; system.maxLifeTime = .95; system.minEmitPower = .35; system.maxEmitPower = .85 + preset.turbulence * .45;
  system.gravity.set(preset.driftX * .08, -.2 + preset.rise * .04, 0); system.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  return 190;
};
