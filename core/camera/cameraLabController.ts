import { ArcRotateCamera, Vector3 } from '@babylonjs/core';

export type CameraLabMode = 'firstPerson' | 'drone' | 'orbit' | 'lockPan';
export type CameraLookControlMode = 'pointerLock' | 'drag';
export type CameraLockPlaneAxis = 'x' | 'y' | 'z';

export interface CameraLabControllerState {
  mode: CameraLabMode;
  lookControlMode: CameraLookControlMode;
  moveSpeed: number;
  mouseSensitivity: number;
  firstPersonHeight: number;
  yaw: number;
  pitch: number;
  firstPersonPosition: Vector3;
  dronePosition: Vector3;
  orbitCenter: Vector3;
  orbitYaw: number;
  orbitPitchDeg: number;
  orbitRadius: number;
  /** 锁定的坐标轴；x/y/z 分别代表 YZ/XZ/XY 平面。 */
  lockPlaneAxis: CameraLockPlaneAxis;
  /** 相机在锁定轴上的固定坐标。 */
  lockPlaneValue: number;
  lockPosition: Vector3;
  lockTarget: Vector3;
}

export interface CameraLabController {
  state: CameraLabControllerState;
  keys: Set<string>;
  applyPose: () => void;
  reset: () => void;
  update: (dt: number) => void;
  handlePointerDelta: (dx: number, dy: number) => void;
  handleWheel: (deltaY: number) => void;
  setMode: (mode: CameraLabMode) => void;
  getStatusText: () => string;
}

export const CAMERA_LAB_MODE_LABELS: Record<CameraLabMode, string> = {
  firstPerson: '第一人称漫游',
  drone: '无人机视角',
  orbit: '环绕模式',
  lockPan: '终点锁定 / 定向平移'
};

export const CAMERA_LAB_DEFAULT_STATE: CameraLabControllerState = {
  mode: 'orbit',
  lookControlMode: 'drag',
  moveSpeed: 18,
  mouseSensitivity: 0.003,
  firstPersonHeight: 1.8,
  yaw: Math.PI,
  pitch: -0.08,
  firstPersonPosition: new Vector3(0, 1.8, 12),
  dronePosition: new Vector3(0, 7, 16),
  orbitCenter: new Vector3(0, -0.15, -18),
  orbitYaw: 0,
  orbitPitchDeg: 12,
  orbitRadius: 42,
  lockPlaneAxis: 'y',
  lockPlaneValue: 6,
  lockPosition: new Vector3(0, 6, 20),
  lockTarget: new Vector3(0, -0.15, -520)
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const degToRad = (deg: number): number => (deg * Math.PI) / 180;
const radToDeg = (rad: number): number => (rad * 180) / Math.PI;
const formatNumber = (value: number): string => (Number.isFinite(value) ? value.toFixed(2) : 'NaN');

const cloneState = (state: CameraLabControllerState): CameraLabControllerState => ({
  ...state,
  firstPersonPosition: state.firstPersonPosition.clone(),
  dronePosition: state.dronePosition.clone(),
  orbitCenter: state.orbitCenter.clone(),
  lockPosition: state.lockPosition.clone(),
  lockTarget: state.lockTarget.clone()
});

const horizontalForwardFromYaw = (yaw: number): Vector3 => new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
const rightFromYaw = (yaw: number): Vector3 => new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
const lookForwardFromYawPitch = (yaw: number, pitch: number): Vector3 => {
  const cosPitch = Math.cos(pitch);
  return new Vector3(Math.sin(yaw) * cosPitch, Math.sin(pitch), Math.cos(yaw) * cosPitch);
};

const setAxisValue = (vector: Vector3, axis: CameraLockPlaneAxis, value: number): void => {
  vector[axis] = value;
};

const projectOntoLockPlane = (
  direction: Vector3,
  axis: CameraLockPlaneAxis
): Vector3 => {
  const projected = direction.clone();
  setAxisValue(projected, axis, 0);
  return projected;
};

export const createCameraLabController = (
  camera: ArcRotateCamera,
  initialState: Partial<CameraLabControllerState> = {}
): CameraLabController => {
  const state = cloneState({
    ...CAMERA_LAB_DEFAULT_STATE,
    ...initialState
  });
  const keys = new Set<string>();

  /**
   * 生成相对于当前画面的平面移动基准：A/D 始终对应屏幕左/右。
   * W/S 优先采用相机 Forward 在平面上的投影；当相机接近平面法线方向时，
   * Forward 投影会退化，此时自动采用相机 Up 的投影。
   */
  const getLockPlaneBasis = (): { forward: Vector3; right: Vector3 } => {
    const axis = state.lockPlaneAxis;
    const cameraRight = projectOntoLockPlane(
      camera.getDirection(new Vector3(1, 0, 0)),
      axis
    );
    const cameraForward = projectOntoLockPlane(
      camera.getDirection(new Vector3(0, 0, 1)),
      axis
    );
    const cameraUp = projectOntoLockPlane(
      camera.getDirection(new Vector3(0, 1, 0)),
      axis
    );

    const right = cameraRight.lengthSquared() > 1e-6
      ? cameraRight.normalize()
      : axis === 'x'
        ? new Vector3(0, 1, 0)
        : new Vector3(1, 0, 0);
    const primaryForward = cameraForward.lengthSquared() >= cameraUp.lengthSquared()
      ? cameraForward
      : cameraUp;
    // Gram-Schmidt：去掉屏幕 Right 分量，保证对角移动不会发生斜切。
    primaryForward.subtractInPlace(right.scale(Vector3.Dot(primaryForward, right)));
    const forward = primaryForward.lengthSquared() > 1e-6
      ? primaryForward.normalize()
      : axis === 'z'
        ? new Vector3(0, 1, 0)
        : new Vector3(0, 0, -1);
    return { forward, right };
  };

  const applyPose = (): void => {
    camera.fov = 0.43;
    camera.minZ = 0.05;
    camera.maxZ = 1500;

    if (state.mode === 'orbit') {
      const pitch = degToRad(state.orbitPitchDeg);
      const cosPitch = Math.cos(pitch);
      const offset = new Vector3(
        Math.sin(state.orbitYaw) * cosPitch * state.orbitRadius,
        Math.sin(pitch) * state.orbitRadius,
        Math.cos(state.orbitYaw) * cosPitch * state.orbitRadius
      );
      camera.position.copyFrom(state.orbitCenter.add(offset));
      camera.setTarget(state.orbitCenter);
      camera.rebuildAnglesAndRadius();
      return;
    }

    if (state.mode === 'lockPan') {
      setAxisValue(state.lockPosition, state.lockPlaneAxis, state.lockPlaneValue);
      camera.position.copyFrom(state.lockPosition);
      camera.setTarget(state.lockTarget);
      camera.rebuildAnglesAndRadius();
      return;
    }

    const position = state.mode === 'firstPerson' ? state.firstPersonPosition : state.dronePosition;
    if (state.mode === 'firstPerson') {
      position.y = state.firstPersonHeight;
    }
    state.pitch = clamp(state.pitch, degToRad(-85), degToRad(85));
    camera.position.copyFrom(position);
    camera.setTarget(position.add(lookForwardFromYawPitch(state.yaw, state.pitch)));
    camera.rebuildAnglesAndRadius();
  };

  const update = (dt: number): void => {
    const moveStep = state.moveSpeed * Math.max(0, dt);
    const forward = horizontalForwardFromYaw(state.yaw);
    const right = rightFromYaw(state.yaw);

    if (state.mode === 'firstPerson' || state.mode === 'drone') {
      const position = state.mode === 'firstPerson' ? state.firstPersonPosition : state.dronePosition;
      if (keys.has('KeyW')) position.addInPlace(forward.scale(moveStep));
      if (keys.has('KeyS')) position.addInPlace(forward.scale(-moveStep));
      if (keys.has('KeyD')) position.addInPlace(right.scale(moveStep));
      if (keys.has('KeyA')) position.addInPlace(right.scale(-moveStep));
      if (state.mode === 'drone') {
        if (keys.has('KeyE')) position.y += moveStep;
        if (keys.has('KeyQ')) position.y -= moveStep;
      } else {
        position.y = state.firstPersonHeight;
      }
    } else if (state.mode === 'lockPan') {
      const { forward: lockForward, right: lockRight } = getLockPlaneBasis();
      if (keys.has('KeyW')) state.lockPosition.addInPlace(lockForward.scale(moveStep));
      if (keys.has('KeyS')) state.lockPosition.addInPlace(lockForward.scale(-moveStep));
      if (keys.has('KeyD')) state.lockPosition.addInPlace(lockRight.scale(moveStep));
      if (keys.has('KeyA')) state.lockPosition.addInPlace(lockRight.scale(-moveStep));
      setAxisValue(state.lockPosition, state.lockPlaneAxis, state.lockPlaneValue);
    }

    applyPose();
  };

  const handlePointerDelta = (dx: number, dy: number): void => {
    const sensitivity = state.mouseSensitivity;
    if (state.mode === 'orbit') {
      state.orbitYaw -= dx * sensitivity;
      state.orbitPitchDeg = clamp(state.orbitPitchDeg + dy * sensitivity * 40, -80, 80);
    } else if (state.mode === 'firstPerson' || state.mode === 'drone') {
      state.yaw -= dx * sensitivity;
      state.pitch = clamp(state.pitch - dy * sensitivity, degToRad(-85), degToRad(85));
    } else if (state.mode === 'lockPan') {
      const { forward, right } = getLockPlaneBasis();
      state.lockPosition.addInPlace(right.scale(dx * 0.04));
      state.lockPosition.addInPlace(forward.scale(-dy * 0.04));
    }
    applyPose();
  };

  const handleWheel = (deltaY: number): void => {
    if (state.mode !== 'orbit') return;
    state.orbitRadius = clamp(state.orbitRadius + Math.sign(deltaY) * 2, 1, 300);
    applyPose();
  };

  const reset = (): void => {
    const next = cloneState(CAMERA_LAB_DEFAULT_STATE);
    Object.assign(state, next);
    keys.clear();
    applyPose();
  };

  const getStatusText = (): string => {
    const target = camera.getTarget();
    return [
      `模式: ${CAMERA_LAB_MODE_LABELS[state.mode]}`,
      `position: x=${formatNumber(camera.position.x)}, y=${formatNumber(camera.position.y)}, z=${formatNumber(camera.position.z)}`,
      `target:   x=${formatNumber(target.x)}, y=${formatNumber(target.y)}, z=${formatNumber(target.z)}`,
      `yaw/pitch: ${formatNumber(radToDeg(state.yaw))}° / ${formatNumber(radToDeg(state.pitch))}°`,
      `lookControl: ${state.lookControlMode === 'drag' ? '按住左键拖拽' : '点击画布锁定鼠标'}`,
      `orbit: center=(${formatNumber(state.orbitCenter.x)}, ${formatNumber(state.orbitCenter.y)}, ${formatNumber(state.orbitCenter.z)}), radius=${formatNumber(state.orbitRadius)}, pitch=${formatNumber(state.orbitPitchDeg)}°`,
      `firstPersonHeight=${formatNumber(state.firstPersonHeight)}, lockPlane=${state.lockPlaneAxis.toUpperCase()}@${formatNumber(state.lockPlaneValue)}`,
      `speed=${formatNumber(state.moveSpeed)}, sensitivity=${state.mouseSensitivity}`
    ].join('\n');
  };

  const controller: CameraLabController = {
    state,
    keys,
    applyPose,
    reset,
    update,
    handlePointerDelta,
    handleWheel,
    setMode: (mode) => {
      state.mode = mode;
      applyPose();
    },
    getStatusText
  };

  applyPose();
  return controller;
};
