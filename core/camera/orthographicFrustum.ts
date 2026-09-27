import type { Camera } from '@babylonjs/core';

/** size is the vertical visible half-height in world units. Width follows aspect. */
export const calculateOrthographicFrustum = (size: number, width: number, height: number) => {
  const aspect = Math.max(1, width) / Math.max(1, height);
  return { orthoTop: size, orthoBottom: -size, orthoLeft: -size * aspect, orthoRight: size * aspect };
};

export const applyOrthographicFrustum = (camera: Camera, size: number, width: number, height: number): void => {
  Object.assign(camera, calculateOrthographicFrustum(size, width, height));
};
