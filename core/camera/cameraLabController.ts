import { ArcRotateCamera, UniversalCamera, Vector3, type ArcRotateCameraMouseWheelInput } from '@babylonjs/core';
import { applyOrthographicFrustum } from './orthographicFrustum.ts';

export type CameraProjection = 'perspective' | 'orthographic';
export type CameraViewConfiguration = Partial<Pick<CameraLabControllerState,
  'projection' | 'orbitCenter' | 'orbitYaw' | 'orbitPitchDeg' | 'orbitRadius' |
  'fovDeg' | 'minZ' | 'maxZ' | 'orthographicSize' | 'orthographicMinSize' |
  'orthographicMaxSize' | 'viewLocked' | 'lowerAlphaLimit' | 'upperAlphaLimit' |
  'lowerBetaLimit' | 'upperBetaLimit'>>;
export type CameraViewPreset = Readonly<{ id: string; label: string; view: CameraViewConfiguration }>;
export const CAMERA_VIEW_PRESETS: readonly CameraViewPreset[] = [
  { id: 'free', label: '自由透视环绕', view: { projection: 'perspective', viewLocked: false } },
  { id: 'top', label: '正交俯视', view: { projection: 'orthographic', orbitYaw: 0, orbitPitchDeg: 89.99, viewLocked: true } },
  { id: 'side', label: '正交侧视', view: { projection: 'orthographic', orbitYaw: Math.PI / 2, orbitPitchDeg: 0, viewLocked: true } },
  { id: 'isometric', label: '正交等距', view: { projection: 'orthographic', orbitYaw: Math.PI / 4, orbitPitchDeg: 35.26438968, viewLocked: true } },
];

export type CameraLabMode = 'firstPerson' | 'drone' | 'orbit' | 'lockPan';
export type CameraLookControlMode = 'pointerLock' | 'drag';
export type CameraLockPlaneAxis = 'x' | 'y' | 'z';
export type CameraPositionAxis = 'x' | 'y' | 'z';
export type CameraFovReference = 'vertical' | 'horizontal';

export type CameraFirstPersonPose = Readonly<{
  position: Vector3;
  yaw: number;
  pitch: number;
}>;

export type CameraFirstPersonPoseBinding = Readonly<{
  readPose: () => CameraFirstPersonPose | null;
}>;

export interface CameraLabControllerState {
  projection: CameraProjection;
  viewPreset: string | null;
  /** 垂直可见半范围（世界单位），完整可见高度为此值的两倍。 */
  orthographicSize: number;
  orthographicMinSize: number;
  orthographicMaxSize: number;
  viewLocked: boolean;
  /** 自由编辑时的 Babylon alpha/beta 限制（弧度，null 无限制）；锁定时保留用于解锁。 */
  lowerAlphaLimit: number | null;
  upperAlphaLimit: number | null;
  lowerBetaLimit: number | null;
  upperBetaLimit: number | null;
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
  /** Babylon 原生环绕旋转/缩放惯性（0 立即停止，默认 0.9）。 */
  orbitInertia: number;
  /** Babylon 原生环绕平移惯性。 */
  orbitPanningInertia: number;
  /** Babylon 原生水平环绕灵敏度；数值越小越快。 */
  orbitAngularSensibilityX: number;
  /** Babylon 原生垂直环绕灵敏度；数值越小越快。 */
  orbitAngularSensibilityY: number;
  /** Babylon 原生平移灵敏度；数值越小越快。 */
  orbitPanningSensibility: number;
  /** Babylon 原生滚轮精度；数值越小缩放越快。 */
  orbitWheelPrecision: number;
  /** Babylon 原生第一人称移动速度。 */
  firstPersonMoveSpeed: number;
  /** Babylon 原生第一人称移动惯性。 */
  firstPersonInertia: number;
  /** Babylon 原生第一人称鼠标灵敏度；数值越小越快。 */
  firstPersonAngularSensibility: number;
  /** Babylon 原生无人机移动速度。 */
  droneMoveSpeed: number;
  /** Babylon 原生无人机移动惯性。 */
  droneInertia: number;
  /** Babylon 原生无人机鼠标灵敏度；数值越小越快。 */
  droneAngularSensibility: number;
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
  /** 当前输入门是否开启（含 Viewport 暂停）；姿态绑定更新不受此门影响。 */
  readonly inputEnabled: boolean;
  readonly presets: readonly CameraViewPreset[];
  setProjection: (projection: CameraProjection) => boolean;
  setOrthographicSize: (size: number) => boolean;
  setView: (view: CameraViewConfiguration) => void;
  applyPreset: (preset: string | CameraViewPreset) => boolean;
  state: CameraLabControllerState;
  readonly activeCamera: ArcRotateCamera | UniversalCamera;
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
  /** 从当前 Babylon 相机读取真实姿态、投影和输入参数。 */
  refreshStateFromActiveCamera: () => void;
  /** 将控制器中的面板草稿一次性应用到当前相机。 */
  applyStateToActiveCamera: () => void;
  /** 恢复当前相机在创建时捕获的 Babylon 原生参数，不改变姿态。 */
  resetActiveCameraToNativeDefaults: () => void;
  /** 恢复各模式的项目初始姿态，不覆盖当前调校参数。 */
  resetInitialPose: () => void;
  /** Viewport 覆盖层使用；关闭后不会因模式更新而重新挂载输入。 */
  setInputEnabled: (enabled: boolean) => void;
  /** 设置当前由相机消费者赢得的键盘按键。 */
  setOwnedKeyboardCodes: (codes: ReadonlySet<string>) => void;
  /** 由角色/运行时提供第一人称姿态；绑定后相机不再自行决定位置与朝向。 */
  bindFirstPersonPose: (binding: CameraFirstPersonPoseBinding | null) => void;
  dispose: () => void;
  getStatusText: () => string;
}

export const CAMERA_LAB_MODE_LABELS: Record<CameraLabMode, string> = {
  firstPerson: '第一人称漫游',
  drone: '无人机视角',
  orbit: '环绕模式',
  lockPan: '终点锁定 / 定向平移'
};

export const CAMERA_LAB_DEFAULT_STATE: CameraLabControllerState = {
  projection: 'perspective',
  viewPreset: null,
  orthographicSize: 10,
  orthographicMinSize: 0.01,
  orthographicMaxSize: 10000,
  viewLocked: false,
  lowerAlphaLimit: null,
  upperAlphaLimit: null,
  lowerBetaLimit: 0.01,
  upperBetaLimit: Math.PI - 0.01,
  mode: 'orbit',
  lookControlMode: 'drag',
  moveSpeed: 18,
  moveAcceleration: 72,
  moveDeceleration: 96,
  mouseSensitivity: 0.003,
  lookSmoothing: 18,
  panSensitivity: 0.04,
  orbitInertia: 0.9,
  orbitPanningInertia: 0.9,
  orbitAngularSensibilityX: 1000,
  orbitAngularSensibilityY: 1000,
  orbitPanningSensibility: 1000,
  orbitWheelPrecision: 3,
  firstPersonMoveSpeed: 2,
  firstPersonInertia: 0.9,
  firstPersonAngularSensibility: 2000,
  droneMoveSpeed: 2,
  droneInertia: 0.9,
  droneAngularSensibility: 2000,
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
  initialState: Partial<CameraLabControllerState> = {},
  customPresets: readonly CameraViewPreset[] = [],
): CameraLabController => {
  const state = cloneState({
    ...CAMERA_LAB_DEFAULT_STATE,
    lowerAlphaLimit: camera.lowerAlphaLimit,
    upperAlphaLimit: camera.upperAlphaLimit,
    lowerBetaLimit: camera.lowerBetaLimit,
    upperBetaLimit: camera.upperBetaLimit,
    ...initialState
  });
  const initialPoseState = cloneState(state);
  const keys = new Set<string>();
  const movementVelocity = Vector3.Zero();
  let pendingPointerX = 0;
  let pendingPointerY = 0;
  const scene = camera.getScene();
  const firstPersonCamera = new UniversalCamera(
    `${camera.name}_firstPerson`,
    state.firstPersonPosition.clone(),
    scene
  );
  const droneCamera = new UniversalCamera(
    `${camera.name}_drone`,
    state.dronePosition.clone(),
    scene
  );
  const ensureNativeOrbitInputs = (): void => {
    if (!camera.inputs.attached.keyboard) camera.inputs.addKeyboard();
    if (!camera.inputs.attached.mousewheel) camera.inputs.addMouseWheel();
    if (!camera.inputs.attached.pointers) camera.inputs.addPointers();
  };

  // 有些场景会先调用 camera.inputs.clear()。必须先恢复原生 Input，
  // 再读取代理属性，否则 angularSensibility / wheelPrecision 等会读成 0。
  ensureNativeOrbitInputs();
  const nativeDefaults = {
    orbit: {
      inertia: camera.inertia,
      panningInertia: camera.panningInertia,
      angularSensibilityX: camera.angularSensibilityX,
      angularSensibilityY: camera.angularSensibilityY,
      panningSensibility: camera.panningSensibility,
      wheelPrecision: camera.wheelPrecision,
      fov: camera.fov,
      minZ: camera.minZ,
      maxZ: camera.maxZ
    },
    firstPerson: {
      speed: firstPersonCamera.speed,
      inertia: firstPersonCamera.inertia,
      angularSensibility: firstPersonCamera.angularSensibility,
      fov: firstPersonCamera.fov,
      minZ: firstPersonCamera.minZ,
      maxZ: firstPersonCamera.maxZ
    },
    drone: {
      speed: droneCamera.speed,
      inertia: droneCamera.inertia,
      angularSensibility: droneCamera.angularSensibility,
      fov: droneCamera.fov,
      minZ: droneCamera.minZ,
      maxZ: droneCamera.maxZ
    }
  };
  let attachedNativeCamera: ArcRotateCamera | UniversalCamera | null = null;
  let inputEnabled = true;
  let disposed = false;
  let ownedKeyboardCodes: ReadonlySet<string> = new Set();
  let firstPersonPoseBinding: CameraFirstPersonPoseBinding | null = null;
  const presets = [...CAMERA_VIEW_PRESETS, ...customPresets];
  let arcProjection = state.projection;
  let hasOrthographicSize = initialState.orthographicSize !== undefined || state.projection === 'orthographic';
  const freeProjection = new Map<UniversalCamera, { fovDeg: number; horizontalFovDeg: number; fovReference: CameraFovReference; minZ: number; maxZ: number }>();
  let arcPerspective = { fovDeg: state.fovDeg, horizontalFovDeg: state.horizontalFovDeg, fovReference: state.fovReference, minZ: state.minZ, maxZ: state.maxZ };
  const wheelInput = camera.inputs.attached.mousewheel as ArcRotateCameraMouseWheelInput;
  const originalWheelCompute = wheelInput.customComputeDeltaFromMouseWheel;
  const computeOrthographicWheel = (delta: number): number => {
    if (inputEnabled) {
      const exponent = clamp(-delta / (Math.max(.01, state.orbitWheelPrecision) * 1000), -20, 20);
      setOrthographicSize(state.orthographicSize * Math.exp(exponent));
    }
    return 0;
  };
  const syncWheelProjection = (): void => {
    wheelInput.customComputeDeltaFromMouseWheel = state.projection === 'orthographic'
      ? computeOrthographicWheel
      : originalWheelCompute;
  };

  firstPersonCamera.keysUp = [87];
  firstPersonCamera.keysDown = [83];
  firstPersonCamera.keysLeft = [65];
  firstPersonCamera.keysRight = [68];
  firstPersonCamera.keysUpward = [];
  firstPersonCamera.keysDownward = [];
  droneCamera.keysUp = [87];
  droneCamera.keysDown = [83];
  droneCamera.keysLeft = [65];
  droneCamera.keysRight = [68];
  droneCamera.keysUpward = [69];
  droneCamera.keysDownward = [81];
  const applyBoundFirstPersonPose = (): boolean => {
    const pose = firstPersonPoseBinding?.readPose();
    if (!pose) return false;
    state.firstPersonPosition.copyFrom(pose.position);
    state.yaw = pose.yaw;
    state.pitch = clamp(pose.pitch, degToRad(-85), degToRad(85));
    firstPersonCamera.position.copyFrom(pose.position);
    firstPersonCamera.setTarget(pose.position.add(lookForwardFromYawPitch(state.yaw, state.pitch)));
    firstPersonCamera.cameraDirection.setAll(0);
    firstPersonCamera.cameraRotation.setAll(0);
    return true;
  };

  firstPersonCamera.onAfterCheckInputsObservable.add(() => {
    if (applyBoundFirstPersonPose()) return;
    // 未绑定角色时继续保留原生漫游模式的固定视点高度语义。
    firstPersonCamera.position.y = state.firstPersonHeight;
  });

  const applyNativeOrbitOptions = (): void => {
    camera.inertia = clamp(state.orbitInertia, 0, 0.9999);
    camera.panningInertia = clamp(state.orbitPanningInertia, 0, 0.9999);
    camera.angularSensibilityX = Math.max(1, state.orbitAngularSensibilityX);
    camera.angularSensibilityY = Math.max(1, state.orbitAngularSensibilityY);
    camera.panningSensibility = Math.max(1, state.orbitPanningSensibility);
    camera.wheelPrecision = Math.max(0.01, state.orbitWheelPrecision);
  };

  const applyNativeFreeCameraOptions = (
    nativeCamera: UniversalCamera,
    mode: 'firstPerson' | 'drone'
  ): void => {
    const firstPerson = mode === 'firstPerson';
    nativeCamera.speed = Math.max(0.01, firstPerson ? state.firstPersonMoveSpeed : state.droneMoveSpeed);
    nativeCamera.inertia = clamp(firstPerson ? state.firstPersonInertia : state.droneInertia, 0, 0.9999);
    nativeCamera.angularSensibility = Math.max(
      1,
      firstPerson ? state.firstPersonAngularSensibility : state.droneAngularSensibility
    );
  };

  const applyOwnedKeyboardCodes = (): void => {
    const owns = (code: string): boolean => ownedKeyboardCodes.has(code);
    camera.keysUp = owns('ArrowUp') ? [38] : [];
    camera.keysDown = owns('ArrowDown') ? [40] : [];
    camera.keysLeft = owns('ArrowLeft') ? [37] : [];
    camera.keysRight = owns('ArrowRight') ? [39] : [];
    for (const nativeCamera of [firstPersonCamera, droneCamera]) {
      nativeCamera.keysUp = owns('KeyW') ? [87] : [];
      nativeCamera.keysDown = owns('KeyS') ? [83] : [];
      nativeCamera.keysLeft = owns('KeyA') ? [65] : [];
      nativeCamera.keysRight = owns('KeyD') ? [68] : [];
    }
    firstPersonCamera.keysUpward = [];
    firstPersonCamera.keysDownward = [];
    droneCamera.keysUpward = owns('KeyE') ? [69] : [];
    droneCamera.keysDownward = owns('KeyQ') ? [81] : [];
  };

  const syncOrbitStateFromCamera = (): void => {
    state.orbitCenter.copyFrom(camera.getTarget());
    state.orbitYaw = Math.PI / 2 - camera.alpha;
    state.orbitPitchDeg = radToDeg(Math.PI / 2 - camera.beta);
    state.orbitRadius = camera.radius;
  };

  const syncFreeCameraState = (
    nativeCamera: UniversalCamera,
    mode: 'firstPerson' | 'drone'
  ): void => {
    const position = mode === 'firstPerson' ? state.firstPersonPosition : state.dronePosition;
    position.copyFrom(nativeCamera.position);
    state.yaw = nativeCamera.rotation.y;
    state.pitch = -nativeCamera.rotation.x;
  };

  const stopNativeOrbitMotion = (): void => {
    camera.inertialAlphaOffset = 0;
    camera.inertialBetaOffset = 0;
    camera.inertialRadiusOffset = 0;
    camera.inertialPanningX = 0;
    camera.inertialPanningY = 0;
    camera.movement.resetRotationVelocity();
    camera.movement.resetPanVelocity();
    camera.movement.resetZoomVelocity();
  };

  const detachActiveNativeCamera = (): void => {
    if (!attachedNativeCamera) return;
    if (attachedNativeCamera === camera) {
      syncOrbitStateFromCamera();
      stopNativeOrbitMotion();
    } else if (attachedNativeCamera instanceof UniversalCamera) {
      const mode = attachedNativeCamera === firstPersonCamera ? 'firstPerson' : 'drone';
      syncFreeCameraState(attachedNativeCamera, mode);
      attachedNativeCamera.cameraDirection.setAll(0);
      attachedNativeCamera.cameraRotation.setAll(0);
    }
    attachedNativeCamera.detachControl();
    attachedNativeCamera = null;
  };

  const activateNativeCamera = (
    nativeCamera: ArcRotateCamera | UniversalCamera
  ): void => {
    if (attachedNativeCamera !== nativeCamera) {
      detachActiveNativeCamera();
      scene.activeCamera = nativeCamera;
      if (inputEnabled) {
        nativeCamera.attachControl(true);
        attachedNativeCamera = nativeCamera;
      }
    }
  };

  const attachNativeOrbit = (): void => {
    ensureNativeOrbitInputs();
    applyNativeOrbitOptions();
    activateNativeCamera(camera);
  };

  const attachNativeFreeCamera = (
    nativeCamera: UniversalCamera,
    mode: 'firstPerson' | 'drone'
  ): void => {
    applyNativeFreeCameraOptions(nativeCamera, mode);
    activateNativeCamera(nativeCamera);
  };

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

  const applyProjection = (): void => {
    const engine = camera.getEngine();
    const activeCamera = scene.activeCamera ?? camera;
    if (activeCamera !== camera && activeCamera !== firstPersonCamera && activeCamera !== droneCamera) return;
    const aspectRatio = Math.max(0.0001, engine.getRenderWidth() * activeCamera.viewport.width / Math.max(1, engine.getRenderHeight() * activeCamera.viewport.height));
    if (state.fovReference === 'horizontal') {
      state.horizontalFovDeg = clamp(state.horizontalFovDeg, 1, 179);
      state.fovDeg = horizontalToVerticalFov(state.horizontalFovDeg, aspectRatio);
    } else {
      state.fovDeg = clamp(state.fovDeg, 1, 179);
      state.horizontalFovDeg = verticalToHorizontalFov(state.fovDeg, aspectRatio);
    }
    if (activeCamera === camera) {
      camera.mode = state.projection === 'orthographic' ? ArcRotateCamera.ORTHOGRAPHIC_CAMERA : ArcRotateCamera.PERSPECTIVE_CAMERA;
      arcProjection = state.projection;
      syncWheelProjection();
      if (state.projection === 'orthographic') {
        state.orthographicMinSize = Math.max(.0001, state.orthographicMinSize);
        state.orthographicMaxSize = Math.max(state.orthographicMinSize, state.orthographicMaxSize);
        state.orthographicSize = clamp(state.orthographicSize, state.orthographicMinSize, state.orthographicMaxSize);
        applyOrthographicFrustum(camera, state.orthographicSize, engine.getRenderWidth() * camera.viewport.width, engine.getRenderHeight() * camera.viewport.height);
      }
    } else {
      state.projection = 'perspective';
      activeCamera.mode = ArcRotateCamera.PERSPECTIVE_CAMERA;
    }
    activeCamera.fov = degToRad(clamp(state.fovDeg, 1, 179));
    activeCamera.fovMode = ArcRotateCamera.FOVMODE_VERTICAL_FIXED;
    activeCamera.minZ = Math.max(0.001, state.minZ);
    activeCamera.maxZ = Math.max(activeCamera.minZ + 0.001, state.maxZ);
  };

  const syncProjectionStateFromCamera = (): void => {
    const activeCamera = scene.activeCamera ?? camera;
    if (activeCamera !== camera && activeCamera !== firstPersonCamera && activeCamera !== droneCamera) return;
    const engine = camera.getEngine();
    const aspectRatio = Math.max(0.0001, engine.getRenderWidth() * activeCamera.viewport.width / Math.max(1, engine.getRenderHeight() * activeCamera.viewport.height));
    state.fovDeg = clamp(activeCamera.fovMode === ArcRotateCamera.FOVMODE_HORIZONTAL_FIXED
      ? horizontalToVerticalFov(radToDeg(activeCamera.fov), aspectRatio) : radToDeg(activeCamera.fov), 1, 179);
    state.horizontalFovDeg = verticalToHorizontalFov(state.fovDeg, aspectRatio);
    state.minZ = activeCamera.minZ;
    state.maxZ = activeCamera.maxZ;
    state.projection = activeCamera.mode === ArcRotateCamera.ORTHOGRAPHIC_CAMERA ? 'orthographic' : 'perspective';
    if (activeCamera === camera && state.projection === 'orthographic') {
      state.orthographicSize = Math.abs((camera.orthoTop ?? state.orthographicSize) - (camera.orthoBottom ?? -state.orthographicSize)) / 2;
      hasOrthographicSize = true;
    }
  };

  const refreshStateFromActiveCamera = (): void => {
    if (state.mode === 'orbit') {
      syncOrbitStateFromCamera();
      state.viewLocked = camera.lowerAlphaLimit !== null && camera.lowerAlphaLimit === camera.upperAlphaLimit
        && camera.lowerBetaLimit !== null && camera.lowerBetaLimit === camera.upperBetaLimit;
      if (!state.viewLocked) {
        state.lowerAlphaLimit = camera.lowerAlphaLimit;
        state.upperAlphaLimit = camera.upperAlphaLimit;
        state.lowerBetaLimit = camera.lowerBetaLimit;
        state.upperBetaLimit = camera.upperBetaLimit;
      }
      state.orbitInertia = camera.inertia;
      state.orbitPanningInertia = camera.panningInertia;
      state.orbitAngularSensibilityX = camera.angularSensibilityX;
      state.orbitAngularSensibilityY = camera.angularSensibilityY;
      state.orbitPanningSensibility = camera.panningSensibility;
      state.orbitWheelPrecision = camera.wheelPrecision;
    } else if (state.mode === 'firstPerson' || state.mode === 'drone') {
      const nativeCamera = state.mode === 'firstPerson' ? firstPersonCamera : droneCamera;
      syncFreeCameraState(nativeCamera, state.mode);
      if (state.mode === 'firstPerson') {
        state.firstPersonMoveSpeed = nativeCamera.speed;
        state.firstPersonInertia = nativeCamera.inertia;
        state.firstPersonAngularSensibility = nativeCamera.angularSensibility;
      } else {
        state.droneMoveSpeed = nativeCamera.speed;
        state.droneInertia = nativeCamera.inertia;
        state.droneAngularSensibility = nativeCamera.angularSensibility;
      }
    } else {
      state.lockPosition.copyFrom(camera.position);
      state.lockTarget.copyFrom(camera.getTarget());
      state.lockPlaneValue = state.lockPosition[state.lockPlaneAxis];
    }
    syncProjectionStateFromCamera();
  };

  const resetActiveCameraToNativeDefaults = (): void => {
    refreshStateFromActiveCamera();
    const defaults = state.mode === 'firstPerson'
      ? nativeDefaults.firstPerson
      : state.mode === 'drone'
        ? nativeDefaults.drone
        : nativeDefaults.orbit;
    state.fovDeg = radToDeg(defaults.fov);
    state.fovReference = 'vertical';
    state.minZ = defaults.minZ;
    state.maxZ = defaults.maxZ;
    if (state.mode === 'orbit') {
      state.orbitInertia = nativeDefaults.orbit.inertia;
      state.orbitPanningInertia = nativeDefaults.orbit.panningInertia;
      state.orbitAngularSensibilityX = nativeDefaults.orbit.angularSensibilityX;
      state.orbitAngularSensibilityY = nativeDefaults.orbit.angularSensibilityY;
      state.orbitPanningSensibility = nativeDefaults.orbit.panningSensibility;
      state.orbitWheelPrecision = nativeDefaults.orbit.wheelPrecision;
    } else if (state.mode === 'firstPerson') {
      state.firstPersonMoveSpeed = nativeDefaults.firstPerson.speed;
      state.firstPersonInertia = nativeDefaults.firstPerson.inertia;
      state.firstPersonAngularSensibility = nativeDefaults.firstPerson.angularSensibility;
    } else if (state.mode === 'drone') {
      state.droneMoveSpeed = nativeDefaults.drone.speed;
      state.droneInertia = nativeDefaults.drone.inertia;
      state.droneAngularSensibility = nativeDefaults.drone.angularSensibility;
    }
    applyPose();
  };

  const resetInitialPose = (): void => {
    arcProjection = initialPoseState.projection;
    state.projection = state.mode === 'firstPerson' || state.mode === 'drone' ? 'perspective' : arcProjection;
    for (const key of ['orthographicSize', 'orthographicMinSize', 'orthographicMaxSize', 'viewPreset', 'viewLocked', 'lowerAlphaLimit', 'upperAlphaLimit', 'lowerBetaLimit', 'upperBetaLimit'] as const) {
      Object.assign(state, { [key]: initialPoseState[key] });
    }
    state.yaw = initialPoseState.yaw;
    state.pitch = initialPoseState.pitch;
    state.firstPersonHeight = initialPoseState.firstPersonHeight;
    state.firstPersonPosition.copyFrom(initialPoseState.firstPersonPosition);
    state.dronePosition.copyFrom(initialPoseState.dronePosition);
    state.orbitCenter.copyFrom(initialPoseState.orbitCenter);
    state.orbitYaw = initialPoseState.orbitYaw;
    state.orbitPitchDeg = initialPoseState.orbitPitchDeg;
    state.orbitRadius = initialPoseState.orbitRadius;
    state.lockPlaneAxis = initialPoseState.lockPlaneAxis;
    state.lockPlaneValue = initialPoseState.lockPlaneValue;
    state.lockPosition.copyFrom(initialPoseState.lockPosition);
    state.lockTarget.copyFrom(initialPoseState.lockTarget);
    keys.clear();
    movementVelocity.setAll(0);
    pendingPointerX = 0;
    pendingPointerY = 0;
    applyPose();
  };

  const applyPose = (): void => {
    if (disposed) return;
    if (state.mode === 'orbit') {
      stopNativeOrbitMotion();
      const pitch = degToRad(state.orbitPitchDeg);
      camera.setTarget(state.orbitCenter);
      camera.alpha = Math.PI / 2 - state.orbitYaw;
      camera.beta = Math.PI / 2 - pitch;
      camera.radius = clamp(state.orbitRadius, Math.max(1, camera.lowerRadiusLimit ?? 1), Math.min(300, camera.upperRadiusLimit ?? 300));
      camera.lowerAlphaLimit = state.viewLocked ? camera.alpha : state.lowerAlphaLimit;
      camera.upperAlphaLimit = state.viewLocked ? camera.alpha : state.upperAlphaLimit;
      camera.lowerBetaLimit = state.viewLocked ? camera.beta : state.lowerBetaLimit;
      camera.upperBetaLimit = state.viewLocked ? camera.beta : state.upperBetaLimit;
      if (camera.lowerAlphaLimit !== null && camera.upperAlphaLimit !== null && camera.lowerAlphaLimit > camera.upperAlphaLimit) camera.upperAlphaLimit = camera.lowerAlphaLimit;
      if (camera.lowerBetaLimit !== null && camera.upperBetaLimit !== null && camera.lowerBetaLimit > camera.upperBetaLimit) camera.upperBetaLimit = camera.lowerBetaLimit;
      camera.alpha = clamp(camera.alpha, camera.lowerAlphaLimit ?? -Infinity, camera.upperAlphaLimit ?? Infinity);
      camera.beta = clamp(camera.beta, camera.lowerBetaLimit ?? -Infinity, camera.upperBetaLimit ?? Infinity);
      attachNativeOrbit();
      applyProjection();
      return;
    }

    if (state.mode === 'firstPerson' || state.mode === 'drone') {
      const nativeCamera = state.mode === 'firstPerson' ? firstPersonCamera : droneCamera;
      if (attachedNativeCamera !== nativeCamera) detachActiveNativeCamera();
      const position = state.mode === 'firstPerson' ? state.firstPersonPosition : state.dronePosition;
      if (state.mode !== 'firstPerson' || !applyBoundFirstPersonPose()) {
        if (state.mode === 'firstPerson') position.y = state.firstPersonHeight;
        nativeCamera.position.copyFrom(position);
        state.pitch = clamp(state.pitch, degToRad(-85), degToRad(85));
        nativeCamera.setTarget(position.add(lookForwardFromYawPitch(state.yaw, state.pitch)));
      }
      attachNativeFreeCamera(nativeCamera, state.mode);
      applyProjection();
      return;
    }

    detachActiveNativeCamera();
    scene.activeCamera = camera;
    applyProjection();

    if (state.mode === 'lockPan') {
      camera.lowerAlphaLimit = camera.upperAlphaLimit = null;
      camera.lowerBetaLimit = camera.upperBetaLimit = null;
      setAxisValue(state.lockPosition, state.lockPlaneAxis, state.lockPlaneValue);
      camera.position.copyFrom(state.lockPosition);
      camera.setTarget(state.lockTarget);
      camera.rebuildAnglesAndRadius();
      return;
    }

  };

  const update = (dt: number): void => {
    if (disposed) return;
    const frameDt = Math.min(0.1, Math.max(0, dt));
    if (state.mode === 'orbit') {
      // ArcRotateCamera 在 scene.render() 内消化输入与惯性。
      // 这里只读回原生姿态，不每帧重写 alpha/beta/radius/target。
      syncOrbitStateFromCamera();
      applyNativeOrbitOptions();
      applyProjection();
      return;
    }
    if (state.mode === 'firstPerson' || state.mode === 'drone') {
      const nativeCamera = state.mode === 'firstPerson' ? firstPersonCamera : droneCamera;
      syncFreeCameraState(nativeCamera, state.mode);
      applyNativeFreeCameraOptions(nativeCamera, state.mode);
      applyProjection();
      return;
    }
    if (!inputEnabled) { applyProjection(); return; }
    const pointerAlpha = smoothingAlpha(state.lookSmoothing, frameDt);
    const pointerX = pendingPointerX * pointerAlpha;
    const pointerY = pendingPointerY * pointerAlpha;
    pendingPointerX -= pointerX;
    pendingPointerY -= pointerY;
    if (state.mode === 'lockPan') {
      const { forward: panForward, right: panRight } = getLockPlaneBasis();
      state.lockPosition.addInPlace(panRight.scale(pointerX * state.panSensitivity));
      state.lockPosition.addInPlace(panForward.scale(-pointerY * state.panSensitivity));
    }

    const desiredVelocity = Vector3.Zero();

    if (state.mode === 'lockPan') {
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
    if (!inputEnabled || state.mode !== 'lockPan') return;
    pendingPointerX += dx;
    pendingPointerY += dy;
  };

  const handleWheel = (deltaY: number): void => {
    // 环绕模式的滚轮由 ArcRotateCameraMouseWheelInput 原生处理。
    void deltaY;
  };

  const reset = (): void => {
    detachActiveNativeCamera();
    const next = cloneState(initialPoseState);
    Object.assign(state, next);
    arcProjection = next.projection;
    freeProjection.clear();
    keys.clear();
    movementVelocity.setAll(0);
    pendingPointerX = 0;
    pendingPointerY = 0;
    applyPose();
  };

  const getEditablePositionAxes = (): CameraPositionAxis[] => {
    if (state.mode === 'drone') return ['x', 'y', 'z'];
    if (state.mode === 'firstPerson') return firstPersonPoseBinding ? [] : ['x', 'z'];
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
    if (!Number.isFinite(value) || state.projection === 'orthographic') return false;
    state.fovDeg = clamp(value, 1, 179);
    state.fovReference = 'vertical';
    applyPose();
    return true;
  };

  const setHorizontalFovDeg = (value: number): boolean => {
    if (!Number.isFinite(value) || state.projection === 'orthographic') return false;
    state.horizontalFovDeg = clamp(value, 1, 179);
    state.fovReference = 'horizontal';
    applyPose();
    return true;
  };

  const getStatusText = (): string => {
    const activeCamera = controller.activeCamera;
    const target = activeCamera.getTarget();
    const commonLines = [
      `模式: ${CAMERA_LAB_MODE_LABELS[state.mode]} · ${state.projection} · ${state.viewPreset ?? '自定义'}`,
      `position: x=${formatNumber(activeCamera.position.x)}, y=${formatNumber(activeCamera.position.y)}, z=${formatNumber(activeCamera.position.z)}`,
      `target:   x=${formatNumber(target.x)}, y=${formatNumber(target.y)}, z=${formatNumber(target.z)}`,
      state.projection === 'orthographic'
        ? `orthographicSize=${formatNumber(state.orthographicSize)}（垂直半范围）, clip=${formatNumber(state.minZ)}..${formatNumber(state.maxZ)}`
        : `vfov=${formatNumber(state.fovDeg)}°, hfov=${formatNumber(state.horizontalFovDeg)}° (${state.fovReference}), clip=${formatNumber(state.minZ)}..${formatNumber(state.maxZ)}`
    ];
    if (state.mode === 'orbit') commonLines.push(
      `alpha=${formatNumber(radToDeg(camera.alpha))}°, beta=${formatNumber(radToDeg(camera.beta))}°, radius=${formatNumber(camera.radius)}`,
      `inertia=${formatNumber(camera.inertia)}, panningInertia=${formatNumber(camera.panningInertia)}`,
      `angularSensibility=${formatNumber(camera.angularSensibilityX)}/${formatNumber(camera.angularSensibilityY)}, wheelPrecision=${formatNumber(camera.wheelPrecision)}`
    );
    else if (state.mode === 'firstPerson' || state.mode === 'drone') {
      const nativeCamera = state.mode === 'firstPerson' ? firstPersonCamera : droneCamera;
      commonLines.push(
        `rotation: x=${formatNumber(radToDeg(nativeCamera.rotation.x))}°, y=${formatNumber(radToDeg(nativeCamera.rotation.y))}°`,
        `speed=${formatNumber(nativeCamera.speed)}, inertia=${formatNumber(nativeCamera.inertia)}, angularSensibility=${formatNumber(nativeCamera.angularSensibility)}`
      );
      if (state.mode === 'firstPerson') commonLines.push(firstPersonPoseBinding
        ? '姿态来源: 外部第一人称绑定'
        : `项目高度约束: y=${formatNumber(state.firstPersonHeight)}`);
    } else commonLines.push(
      `自定义锁定平面: ${state.lockPlaneAxis.toUpperCase()}=${formatNumber(state.lockPlaneValue)}`,
      `speed=${formatNumber(state.moveSpeed)}, acceleration=${formatNumber(state.moveAcceleration)}, deceleration=${formatNumber(state.moveDeceleration)}`
    );
    return commonLines.join('\n');
  };

  const setOrthographicSize = (size: number): boolean => {
    if (!Number.isFinite(size) || size <= 0) return false;
    state.orthographicSize = clamp(size, state.orthographicMinSize, state.orthographicMaxSize);
    hasOrthographicSize = true;
    applyProjection();
    return true;
  };
  const setProjection = (projection: CameraProjection): boolean => {
    if (state.mode === 'firstPerson' || state.mode === 'drone') return projection === 'perspective';
    refreshStateFromActiveCamera();
    if (state.projection === projection) return true;
    stopNativeOrbitMotion();
    if (projection === 'orthographic' && !hasOrthographicSize) {
      state.orthographicSize = camera.radius * Math.tan(camera.fov / 2);
      hasOrthographicSize = true;
    }
    state.projection = projection;
    state.viewPreset = null;
    applyProjection();
    return true;
  };
  const setView = (view: CameraViewConfiguration): void => {
    for (const value of Object.values(view)) {
      if (typeof value === 'number' && !Number.isFinite(value)) throw new RangeError('Camera view numbers must be finite');
      if (value instanceof Vector3 && ![value.x, value.y, value.z].every(Number.isFinite)) throw new RangeError('Camera target must be finite');
    }
    controller.setMode('orbit');
    refreshStateFromActiveCamera();
    if (view.projection) setProjection(view.projection);
    Object.assign(state, view, { orbitCenter: view.orbitCenter?.clone() ?? state.orbitCenter, viewPreset: null });
    if (view.orthographicSize !== undefined) hasOrthographicSize = true;
    if (view.fovDeg !== undefined) state.fovReference = 'vertical';
    applyPose();
    refreshStateFromActiveCamera();
  };
  const resizeObserver = camera.getEngine().onResizeObservable.add(() => { if (!disposed) applyProjection(); });
  const controller: CameraLabController = {
    get inputEnabled() { return inputEnabled && !disposed; },
    presets,
    setProjection,
    setOrthographicSize,
    setView,
    applyPreset: (preset) => {
      const resolved = typeof preset === 'string' ? presets.find(item => item.id === preset) : preset;
      if (!resolved) return false;
      setView({ viewLocked: false, lowerAlphaLimit: null, upperAlphaLimit: null, lowerBetaLimit: .0001, upperBetaLimit: Math.PI - .0001, ...resolved.view });
      state.viewPreset = resolved.id;
      return true;
    },
    state,
    get activeCamera() {
      return scene.activeCamera instanceof UniversalCamera && (scene.activeCamera === firstPersonCamera || scene.activeCamera === droneCamera)
        ? scene.activeCamera
        : camera;
    },
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
    refreshStateFromActiveCamera,
    applyStateToActiveCamera: () => { applyPose(); refreshStateFromActiveCamera(); },
    resetActiveCameraToNativeDefaults,
    resetInitialPose,
    setInputEnabled: (enabled) => {
      if (inputEnabled === enabled) return;
      inputEnabled = enabled;
      if (!enabled) { keys.clear(); movementVelocity.setAll(0); pendingPointerX = 0; pendingPointerY = 0; }
      if (!enabled) detachActiveNativeCamera();
      else applyPose();
    },
    setOwnedKeyboardCodes: (codes) => {
      const lostOwnership = [...ownedKeyboardCodes].some(code => !codes.has(code));
      ownedKeyboardCodes = new Set(codes);
      applyOwnedKeyboardCodes();
      for (const code of keys) if (!codes.has(code)) keys.delete(code);
      if (lostOwnership) {
        movementVelocity.setAll(0);
        // Flush native held-key caches: a swallowed keyup must not restart movement
        // when this consumer wins the key back later.
        const native = attachedNativeCamera;
        const keyboardInput = native?.inputs.attached.keyboard;
        keyboardInput?.detachControl();
        if (native instanceof UniversalCamera) native.cameraDirection.setAll(0);
        else if (native === camera) stopNativeOrbitMotion();
        if (inputEnabled) keyboardInput?.attachControl(true);
      }
    },
    bindFirstPersonPose: (binding) => {
      firstPersonPoseBinding = binding;
      if (state.mode === 'firstPerson') applyPose();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      camera.getEngine().onResizeObservable.remove(resizeObserver);
      camera.onDisposeObservable.remove(disposeObserver);
      wheelInput.customComputeDeltaFromMouseWheel = originalWheelCompute;
      detachActiveNativeCamera();
      firstPersonCamera.dispose();
      droneCamera.dispose();
    },
    setMode: (mode) => {
      if (state.mode === mode) return;
      refreshStateFromActiveCamera();
      const projectionSnapshot = { fovDeg: state.fovDeg, horizontalFovDeg: state.horizontalFovDeg, fovReference: state.fovReference, minZ: state.minZ, maxZ: state.maxZ };
      if (state.mode === 'firstPerson' || state.mode === 'drone') freeProjection.set(state.mode === 'firstPerson' ? firstPersonCamera : droneCamera, projectionSnapshot);
      else { arcPerspective = projectionSnapshot; arcProjection = state.projection; }
      detachActiveNativeCamera();
      state.mode = mode;
      if (mode === 'firstPerson' || mode === 'drone') {
        const native = mode === 'firstPerson' ? firstPersonCamera : droneCamera;
        Object.assign(state, freeProjection.get(native) ?? { fovDeg: radToDeg(native.fov), fovReference: 'vertical', minZ: native.minZ, maxZ: native.maxZ });
        state.projection = 'perspective';
      } else { Object.assign(state, arcPerspective); state.projection = arcProjection; }
      movementVelocity.setAll(0);
      pendingPointerX = 0;
      pendingPointerY = 0;
      applyPose();
    },
    getStatusText
  };

  const disposeObserver = camera.onDisposeObservable.add(() => controller.dispose());
  applyPose();
  if (initialState.viewPreset && controller.applyPreset(initialState.viewPreset)) {
    Object.assign(initialPoseState, cloneState(state));
  }
  return controller;
};
