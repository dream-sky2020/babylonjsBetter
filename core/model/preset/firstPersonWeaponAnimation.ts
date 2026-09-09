import type { AnimationProject, Vec3, WeaponKeyframe } from './firstPersonWeaponPreset.ts';

const mix = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
export function sampleWeaponAnimation(frames: WeaponKeyframe[], time: number): Pick<WeaponKeyframe, 'position' | 'rotation'> {
  const sorted = [...frames].sort((a, b) => a.time - b.time);
  if (time <= sorted[0].time) return sorted[0];
  const last = sorted[sorted.length - 1];
  if (time >= last.time) return last;
  const index = sorted.findIndex(frame => frame.time >= time);
  const left = sorted[index - 1]; const right = sorted[index];
  if (time === right.time) return right;
  const t = (time - left.time) / Math.max(.0001, right.time - left.time);
  const eased = t * t * (3 - 2 * t);
  return { position: mix(left.position, right.position, eased), rotation: mix(left.rotation, right.rotation, eased) };
}
/** One clock drives both independent tracks, including disabled tracks retained for editing. */
export function sampleWeaponPoses(project: AnimationProject, time: number) {
  return { right: sampleWeaponAnimation(project.weapons.right.keyframes, time), left: sampleWeaponAnimation(project.weapons.left.keyframes, time) };
}
