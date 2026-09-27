import { Quaternion, type TransformNode } from '@babylonjs/core';
import type { EditorTransform, EditorVector } from './types.ts';
const plain = (v: EditorVector): EditorVector => ({ x: v.x, y: v.y, z: v.z });
export function readTransform(node: TransformNode): EditorTransform {
  const e = node.rotationQuaternion?.toEulerAngles() ?? node.rotation;
  return { position: plain(node.position), rotation: { x: e.x * 180 / Math.PI, y: e.y * 180 / Math.PI, z: e.z * 180 / Math.PI }, scaling: plain(node.scaling) };
}
export function writeTransform(node: TransformNode, value: EditorTransform) {
  node.position.copyFromFloats(value.position.x, value.position.y, value.position.z);
  const r = value.rotation;
  node.rotation.set(r.x * Math.PI / 180, r.y * Math.PI / 180, r.z * Math.PI / 180);
  if (node.rotationQuaternion) node.rotationQuaternion.copyFrom(Quaternion.FromEulerVector(node.rotation));
  node.scaling.copyFromFloats(value.scaling.x, value.scaling.y, value.scaling.z);
  node.computeWorldMatrix(true);
}
