import { Frustum, Matrix, type AbstractMesh, type Camera } from '@babylonjs/core';

type OutlineRegion = { left: number; bottom: number; right: number; top: number };
const fullRegion: OutlineRegion = { left: 0, bottom: 0, right: 1, top: 1 };

// Animated vertex positions can extend beyond the static mesh bounds.
function hasDynamicBounds(mesh: AbstractMesh) {
  return !!(mesh.skeleton || mesh.morphTargetManager || mesh.bakedVertexAnimationManager || mesh.hasThinInstances || mesh.billboardMode);
}

export function createOutlineRegion() {
  const cameraPlanes = Frustum.GetPlanes(Matrix.Identity());
  const regionPlanes = Frustum.GetPlanes(Matrix.Identity());
  const cropMatrix = new Matrix();
  const croppedViewProjection = new Matrix();
  const depthMeshes: AbstractMesh[] = [];
  let region: OutlineRegion | null = fullRegion;

  return {
    get bounds() { return region; },
    update(camera: Camera, viewProjection: Matrix, groups: readonly { meshes: readonly AbstractMesh[] }[], width: number, height: number, padding: number) {
      const viewport = camera.viewport;
      if (viewport.x !== 0 || viewport.y !== 0 || viewport.width !== 1 || viewport.height !== 1 || width <= 0 || height <= 0) {
        region = fullRegion;
        return;
      }
      Frustum.GetPlanesToRef(viewProjection, cameraPlanes);
      const m = viewProjection.asArray();
      let left = Infinity, bottom = Infinity, right = -Infinity, top = -Infinity;
      for (const { meshes } of groups) for (const mesh of meshes) {
        if (!mesh.isEnabled() || !mesh.isVisible || mesh.visibility <= 0 || (mesh.layerMask & camera.layerMask) === 0) continue;
        if (hasDynamicBounds(mesh)) { region = fullRegion; return; }
        mesh.computeWorldMatrix();
        const box = mesh.getBoundingInfo().boundingBox;
        if (!box.isInFrustum(cameraPlanes)) continue;
        for (const { x, y, z } of box.vectorsWorld) {
          const w = x * m[3] + y * m[7] + z * m[11] + m[15];
          if (w <= 0) { region = fullRegion; return; }
          const u = ((x * m[0] + y * m[4] + z * m[8] + m[12]) / w + 1) * 0.5;
          const v = ((x * m[1] + y * m[5] + z * m[9] + m[13]) / w + 1) * 0.5;
          left = Math.min(left, u); right = Math.max(right, u);
          bottom = Math.min(bottom, v); top = Math.max(top, v);
        }
      }
      if (left === Infinity) { region = null; return; }
      left = Math.max(0, Math.floor(left * width - padding) / width);
      right = Math.min(1, Math.ceil(right * width + padding) / width);
      bottom = Math.max(0, Math.floor(bottom * height - padding) / height);
      top = Math.min(1, Math.ceil(top * height + padding) / height);
      if (left >= right || bottom >= top) { region = null; return; }
      if (left === 0 && bottom === 0 && right === 1 && top === 1) { region = fullRegion; return; }
      region = { left, bottom, right, top };

      // Preserve the camera's depth encoding and narrow only the four side planes.
      const sx = 1 / (right - left), sy = 1 / (top - bottom);
      Matrix.FromValuesToRef(sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, 1, 0,
        (1 - left - right) * sx, (1 - bottom - top) * sy, 0, 1, cropMatrix);
      viewProjection.multiplyToRef(cropMatrix, croppedViewProjection);
      Frustum.GetPlanesToRef(croppedViewProjection, regionPlanes);
    },
    filterDepthMeshes(meshes: readonly AbstractMesh[] | null, length: number) {
      if (!meshes || region === fullRegion) return null;
      depthMeshes.length = 0;
      if (!region) return depthMeshes;
      for (let index = 0; index < length; index++) {
        const mesh = meshes[index];
        if (hasDynamicBounds(mesh) || mesh.isInFrustum(regionPlanes)) depthMeshes.push(mesh);
      }
      return depthMeshes;
    },
  };
}
