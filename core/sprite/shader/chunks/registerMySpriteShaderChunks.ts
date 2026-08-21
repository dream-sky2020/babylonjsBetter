import { Effect } from '@babylonjs/core';
import hashNoise from './common/hashNoise.glsl?raw';
import alphaSampling from './common/alphaSampling.glsl?raw';
import colorUtils from './common/colorUtils.glsl?raw';
import directionalField from './dissolve/directionalField.glsl?raw';
import frostField from './dissolve/frostField.glsl?raw';
import voidField from './dissolve/voidField.glsl?raw';
import edgeBand from './dissolve/edgeBand.glsl?raw';
import atlasSampling from './sprite/atlasSampling.glsl?raw';
import colorOverlay from './sprite/colorOverlay.glsl?raw';
import stripeMask from './sprite/stripeMask.glsl?raw';

const chunks: Record<string, string> = {
  mySpriteHashNoise: hashNoise,
  mySpriteAlphaSampling: alphaSampling,
  mySpriteColorUtils: colorUtils,
  mySpriteDirectionalField: directionalField,
  mySpriteFrostField: frostField,
  mySpriteVoidField: voidField,
  mySpriteEdgeBand: edgeBand,
  mySpriteAtlasSampling: atlasSampling,
  mySpriteColorOverlay: colorOverlay,
  mySpriteStripeMask: stripeMask
};

export const registerMySpriteShaderChunks = (): void => {
  for (const [name, source] of Object.entries(chunks)) Effect.IncludesShadersStore[name] ??= source;
};
