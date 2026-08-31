import { ArcRotateCamera, Vector3 } from '@babylonjs/core';

export type CameraLabMode = 'firstPerson' | 'drone' | 'orbit' | 'lockPan';
export type CameraLookControlMode = 'pointerLock' | 'drag';
export type CameraLockPlaneAxis = 'x' | 'y' | 'z';
export type CameraPositionAxis = 'x' | 'y' | 'z';
export type CameraFovReference = 'vertical' | 'horizontal';

export interface CameraLabControllerState {
  mode: CameraLabMode;
  lookControlMode: CameraLookControlMode;
  moveSpeed: number;
  /** 键盘移动达到目标速度时的加速度（世界单位/秒²）。 */
  moveAcceleration: number;
  /** 松开键盘后停止移动的减速度（世界单位/秒²）。 */
  moveDeceleration: number;
  mouseSensitivity: number;
  /** 鼠标输入响应速度（1/秒）；越高越跟手，0 表示不平滑。 */
  lookSmoothing: number;
  /** 锁定平面拖拽的世界单位/像素。 */
  panSensitivity: number;
  /** 每格滚轮改变的环绕半径。 */
  orbitZoomSpeed: number;
  /** 滚轮缩放响应速度（1/秒）；越高越跟手，0 表示不平滑。 */
  zoomSmoothing: number;
  /** 垂直视场角（度）。 */
  fovDeg: number;
  /** 水平视场角（度）；根据画布宽高比与垂直视场角联动。 */
  horizontalFovDeg: number;
  /** 最后编辑的 FOV 方向；画布比例变化时保持该方向数值不变。 */
  fovReference: CameraFovReference;
  minZ: number;
  maxZ: number;
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
  getEditablePositionAxes: () => CameraPositionAxis[];
  getPosition: () => Vector3;
  setPositionAxis: (axis: CameraPositionAxis, value: number) => boolean;
  setVerticalFovDeg: (value: number) => boolean;
  setHorizontalFovDeg: (value: number) => boolean;
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
  moveAcceleration: 72,
  moveDeceleration: 96,
  mouseSensitivity: 0.003,
  lookSmoothing: 18,
  panSensitivity: 0.04,
  orbitZoomSpeed: 2,
  zoomSmoothing: 14,
  fovDeg: 24.64,
  horizontalFovDeg: 41.55,
  fovReference: 'vertical',
  minZ: 0.05,
  maxZ: 1500,
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
const smoothingAlpha = (response: number, dt: number): number => response <= 0
  ? 1 : 1 - Math.exp(-response * dt);

const moveVectorTowards = (current: Vector3, target: Vector3, maxDelta: number): void => {
  const delta = target.subtract(current);
  const distance = delta.length();
  if (distance <= maxDelta || distance <= 1e-8) current.copyFrom(target);
  else current.addInPlace(delta.scale(maxDelta / distance));
};

const verticalToHorizontalFov = (verticalDeg: number, aspectRatio: number): number => radToDeg(
  2 * Math.atan(Math.tan(degToRad(verticalDeg) / 2) * aspectRatio),
);

const horizontalToVerticalFov = (horizontalDeg: number, aspectRatio: number): number => radToDeg(
  2 * Math.atan(Math.tan(degToRad(horizontalDeg) / 2) / aspectRatio),
);

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
  const movementVelocity = Vector3.Zero();
  let pendingPointerX = 0;
  let pendingPointerY = 0;
  let pendingWheelSteps = 0;

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
    const engine = camera.getEngine();
    const aspectRatio = Math.max(0.0001, engine.getRenderWidth() / Math.max(1, engine.getRenderHeight()));
    if (state.fovReference === 'horizontal') {
      state.horizontalFovDeg = clamp(state.horizontalFovDeg, 1, 179);
      state.fovDeg = horizontalToVerticalFov(state.horizontalFovDeg, aspectRatio);
    } else {
      state.fovDeg = clamp(state.fovDeg, 1, 179);
      state.horizontalFovDeg = verticalToHorizontalFov(state.fovDeg, aspectRatio);
    }
    camera.fov = degToRad(clamp(state.fovDeg, 1, 179));
    camera.minZ = Math.max(0.001, state.minZ);
    camera.maxZ = Math.max(camera.minZ + 0.001, state.maxZ);

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
    const frameDt = Math.min(0.1, Math.max(0, dt));
    const pointerAlpha = smoothingAlpha(state.lookSmoothing, frameDt);
    const pointerX = pendingPointerX * pointerAlpha;
    const pointerY = pendingPointerY * pointerAlpha;
    pendingPointerX -= pointerX;
    pendingPointerY -= pointerY;
    const sensitivity = state.mouseSensitivity;
    if (state.mode === 'orbit') {
      state.orbitYaw -= pointerX * sensitivity;
      state.orbitPitchDeg = clamp(state.orbitPitchDeg + pointerY * sensitivity * 40, -80, 80);
      const wheelAlpha = smoothingAlpha(state.zoomSmoothing, frameDt);
      const wheelStep = pendingWheelSteps * wheelAlpha;
      pendingWheelSteps -= wheelStep;
      state.orbitRadius = clamp(state.orbitRadius + wheelStep * state.orbitZoomSpeed, 1, 300);
    } else if (state.mode === 'firstPerson' || state.mode === 'drone') {
      state.yaw -= pointerX * sensitivity;
      state.pitch = clamp(state.pitch - pointerY * sensitivity, degToRad(-85), degToRad(85));
    } else if (state.mode === 'lockPan') {
      const { forward: panForward, right: panRight } = getLockPlaneBasis();
      state.lockPosition.addInPlace(panRight.scale(pointerX * state.panSensitivity));
      state.lockPosition.addInPlace(panForward.scale(-pointerY * state.panSensitivity));
    }

    const forward = horizontalForwardFromYaw(state.yaw);
    const right = rightFromYaw(state.yaw);
    const desiredVelocity = Vector3.Zero();

    if (state.mode === 'firstPerson' || state.mode === 'drone') {
      const position = state.mode === 'firstPerson' ? state.firstPersonPosition : state.dronePosition;
      if (keys.has('KeyW')) desiredVelocity.addInPlace(forward);
      if (keys.has('KeyS')) desiredVelocity.subtractInPlace(forward);
      if (keys.has('KeyD')) desiredVelocity.addInPlace(right);
      if (keys.has('KeyA')) desiredVelocity.subtractInPlace(right);
      if (state.mode === 'drone') {
        if (keys.has('KeyE')) desiredVelocity.y += 1;
        if (keys.has('KeyQ')) desiredVelocity.y -= 1;
      } else {
        position.y = state.firstPersonHeight;
      }
      if (desiredVelocity.lengthSquared() > 1) desiredVelocity.normalize();
      desiredVelocity.scaleInPlace(Math.max(0, state.moveSpeed));
      const response = desiredVelocity.lengthSquared() > 0 ? state.moveAcceleration : state.moveDeceleration;
      moveVectorTowards(movementVelocity, desiredVelocity, Math.max(0, response) * frameDt);
      position.addInPlace(movementVelocity.scale(frameDt));
    } else if (state.mode === 'lockPan') {
      const { forward: lockForward, right: lockRight } = getLockPlaneBasis();
      if (keys.has('KeyW')) desiredVelocity.addInPlace(lockForward);
      if (keys.has('KeyS')) desiredVelocity.subtractInPlace(lockForward);
      if (keys.has('KeyD')) desiredVelocity.addInPlace(lockRight);
      if (keys.has('KeyA')) desiredVelocity.subtractInPlace(lockRight);
      if (desiredVelocity.lengthSquared() > 1) desiredVelocity.normalize();
      desiredVelocity.scaleInPlace(Math.max(0, state.moveSpeed));
      const response = desiredVelocity.lengthSquared() > 0 ? state.moveAcceleration : state.moveDeceleration;
      moveVectorTowards(movementVelocity, desiredVelocity, Math.max(0, response) * frameDt);
      state.lockPosition.addInPlace(movementVelocity.scale(frameDt));
      setAxisValue(state.lockPosition, state.lockPlaneAxis, state.lockPlaneValue);
    } else moveVectorTowards(movementVelocity, Vector3.Zero(), Math.max(0, state.moveDeceleration) * frameDt);

    applyPose();
  };

  const handlePointerDelta = (dx: number, dy: number): void => {
    pendingPointerX += dx;
    pendingPointerY += dy;
  };

  const handleWheel = (deltaY: number): void => {
    if (state.mode !== 'orbit') return;
    pendingWheelSteps += Math.sign(deltaY);
  };

  const reset = (): void => {
    const next = cloneState(CAMERA_LAB_DEFAULT_STATE);
    Object.assign(state, next);
    keys.clear();
    movementVelocity.setAll(0);
    pendingPointerX = 0;
    pendingPointerY = 0;
    pendingWheelSteps = 0;
    applyPose();
  };

  const getEditablePositionAxes = (): CameraPositionAxis[] => {
    if (state.mode === 'drone') return ['x', 'y', 'z'];
    if (state.mode === 'firstPerson') return ['x', 'z'];
    if (state.mode === 'lockPan') return (['x', 'y', 'z'] as CameraPositionAxis[])
      .filter((axis) => axis !== state.lockPlaneAxis);
    return [];
  };

  const getPosition = (): Vector3 => {
    if (state.mode === 'firstPerson') return state.firstPersonPosition;
    if (state.mode === 'drone') return state.dronePosition;
    if (state.mode === 'lockPan') return state.lockPosition;
    return camera.position;
  };

  const setPositionAxis = (axis: CameraPositionAxis, value: number): boolean => {
    if (!Number.isFinite(value) || !getEditablePositionAxes().includes(axis)) return false;
    getPosition()[axis] = value;
    applyPose();
    return true;
  };

  const setVerticalFovDeg = (value: number): boolean => {
    if (!Number.isFinite(value)) return false;
    state.fovDeg = clamp(value, 1, 179);
    state.fovReference = 'vertical';
    applyPose();
    return true;
  };

  const setHorizontalFovDeg = (value: number): boolean => {
    if (!Number.isFinite(value)) return false;
    state.horizontalFovDeg = clamp(value, 1, 179);
    state.fovReference = 'horizontal';
    applyPose();
    return true;
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
      `speed=${formatNumber(state.moveSpeed)}, acceleration=${formatNumber(state.moveAcceleration)}, deceleration=${formatNumber(state.moveDeceleration)}`,
      `sensitivity=${state.mouseSensitivity}, lookSmoothing=${formatNumber(state.lookSmoothing)}, zoomSmoothing=${formatNumber(state.zoomSmoothing)}`,
      `vfov=${formatNumber(state.fovDeg)}°, hfov=${formatNumber(state.horizontalFovDeg)}° (${state.fovReference}), clip=${formatNumber(state.minZ)}..${formatNumber(state.maxZ)}`
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
    getEditablePositionAxes,
    getPosition,
    setPositionAxis,
    setVerticalFovDeg,
    setHorizontalFovDeg,
    setMode: (mode) => {
      state.mode = mode;
      movementVelocity.setAll(0);
      pendingPointerX = 0;
      pendingPointerY = 0;
      pendingWheelSteps = 0;
      applyPose();
    },
    getStatusText
  };

  applyPose();
  return controller;
};
