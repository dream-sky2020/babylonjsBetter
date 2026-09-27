import { Matrix, Vector3 } from '@babylonjs/core';
import type { DeformationCoefficients } from './deformation.ts';

export function deformationMatrix(anchor: Vector3, c: DeformationCoefficients): Matrix {
  return Matrix.FromValues(1, 0, 0, 0, c.x, c.y, c.z, 0, 0, 0, 1, 0,
    -anchor.y * c.x, anchor.y * (1 - c.y), -anchor.y * c.z, 1);
}
