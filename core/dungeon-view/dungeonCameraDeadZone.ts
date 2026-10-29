/** Dead-zone dimensions are full widths in display-space world units. */
export type DungeonCameraDeadZoneSettings = { enabled: boolean; width: number; depth: number; debug: boolean };
export const DEFAULT_CAMERA_DEAD_ZONE: Readonly<DungeonCameraDeadZoneSettings> = Object.freeze({ enabled: false, width: 8, depth: 8, debug: false });

export const validateCameraDeadZone = (saved: unknown, version: number): DungeonCameraDeadZoneSettings => {
  if (version !== 1 || !saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('相机跟随区域设置无效');
  const value = saved as Record<string, unknown>;
  if (typeof value.enabled !== 'boolean' || typeof value.debug !== 'boolean'
    || typeof value.width !== 'number' || !Number.isFinite(value.width) || value.width < 0 || value.width > 1000
    || typeof value.depth !== 'number' || !Number.isFinite(value.depth) || value.depth < 0 || value.depth > 1000) throw new Error('相机跟随区域尺寸或开关无效');
  return { enabled: value.enabled, width: value.width, depth: value.depth, debug: value.debug };
};

/** Move the desired center only by the amount outside each boundary. */
export const resolveCameraDeadZoneTarget = (center: number, player: number, size: number): number => {
  const half = Math.max(0, size) / 2;
  return center + Math.min(0, player - center + half) + Math.max(0, player - center - half);
};

/** Critically damped follow with continuous velocity and no target overshoot. */
export const smoothCameraFollow = (current: number, target: number, velocity: number, response: number, deltaSeconds: number): { position: number; velocity: number } => {
  if (response <= 0) return { position: target, velocity: 0 };
  if (deltaSeconds <= 0) return { position: current, velocity };
  const error = current - target;
  if (Math.abs(error) < 1e-8) return { position: target, velocity: 0 };
  const decay = Math.exp(-response * deltaSeconds);
  const impulse = velocity + response * error;
  const position = target + (error + impulse * deltaSeconds) * decay;
  if ((target - current) * (target - position) <= 0) return { position: target, velocity: 0 };
  return { position, velocity: (velocity - response * impulse * deltaSeconds) * decay };
};
