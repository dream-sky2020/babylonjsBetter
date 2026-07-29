import { ArcRotateCamera, Vector3 } from '@babylonjs/core';

export type CameraLabMode = 'firstPerson' | 'drone' | 'orbit' | 'lockPan';
export type CameraLookControlMode = 'pointerLock' | 'drag';

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
  lockPlaneY: number;
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
  lockPlaneY: 6,
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
const rightFromYaw = (yaw: number): Vector3 => new Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
const lookForwardFromYawPitch = (yaw: number, pitch: number): Vector3 => {
  const cosPitch = Math.cos(pitch);
  return new Vector3(Math.sin(yaw) * cosPitch, Math.sin(pitch), Math.cos(yaw) * cosPitch);
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
      state.lockPosition.y = state.lockPlaneY;
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
      if (keys.has('KeyW')) state.lockPosition.z -= moveStep;
      if (keys.has('KeyS')) state.lockPosition.z += moveStep;
      if (keys.has('KeyD')) state.lockPosition.x += moveStep;
      if (keys.has('KeyA')) state.lockPosition.x -= moveStep;
      state.lockPosition.y = state.lockPlaneY;
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
      state.lockPosition.x -= dx * 0.04;
      state.lockPosition.z += dy * 0.04;
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
      `firstPersonHeight=${formatNumber(state.firstPersonHeight)}, lockPlaneY=${formatNumber(state.lockPlaneY)}`,
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
