import type { ArcRotateCamera } from '@babylonjs/core';
import { createCameraLabController, type CameraLabController, type CameraLabMode } from '@/core/camera/cameraLabController.ts';
import { createFloatingCameraControlPanel, type FloatingCameraControlPanel } from '@/core/ui/FloatingCameraControlPanel.ts';
import type { LabKeyboardConsumerHandle, LabKeyboardRouter } from '../keyboard';
import type { LabUi } from '../labUi.ts';
import { createLabField, createLabStatus, createLabSwitch } from '../labUi.ts';

export type LabCameraSystem = {
  controller: CameraLabController;
  floatingPanel: FloatingCameraControlPanel;
  setInputEnabled(enabled: boolean): void;
  update(deltaSeconds: number): void;
  dispose(): void;
};

const radToDeg = (value: number): number => value * 180 / Math.PI;

const keyboardCodesForMode = (mode: CameraLabMode): readonly string[] => {
  if (mode === 'orbit') return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  if (mode === 'drone') return ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'];
  if (mode === 'firstPerson') return ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
  return ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
};

export const createLabCameraSystem = (
  stage: HTMLElement,
  ui: LabUi,
  camera: ArcRotateCamera,
  keyboard: LabKeyboardRouter,
): LabCameraSystem => {
  const controller = createCameraLabController(camera, {
    mode: 'orbit',
    orbitCenter: camera.getTarget().clone(),
    orbitYaw: Math.PI / 2 - camera.alpha,
    orbitPitchDeg: radToDeg(Math.PI / 2 - camera.beta),
    orbitRadius: camera.radius,
    orbitInertia: camera.inertia,
    orbitPanningInertia: camera.panningInertia,
    orbitAngularSensibilityX: camera.angularSensibilityX,
    orbitAngularSensibilityY: camera.angularSensibilityY,
    orbitPanningSensibility: camera.panningSensibility,
    orbitWheelPrecision: camera.wheelPrecision,
    fovDeg: radToDeg(camera.fov),
    minZ: camera.minZ,
    maxZ: camera.maxZ,
  });
  const floatingPanel = createFloatingCameraControlPanel(stage, controller);
  floatingPanel.setVisible(false);

  const panel = ui.addPanel('system-camera', 'Camera');
  panel.root.classList.add('lab-system-panel');
  const floatingToggle = createLabSwitch('显示摄像机参数面板', false);
  const pointerToggle = createLabSwitch('启用鼠标与滚轮输入', true);
  const keyboardToggle = createLabSwitch('启用摄像机键盘输入', false);
  const interceptToggle = createLabSwitch('处理后拦截低优先级输入', true);
  const preventDefaultToggle = createLabSwitch('阻止浏览器默认行为', true);
  const priority = document.createElement('input');
  priority.type = 'number';
  priority.step = '1';
  priority.value = '50';
  const status = createLabStatus('环绕模式 · 摄像机键盘输入关闭。');
  panel.content.append(
    floatingToggle.row,
    pointerToggle.row,
    keyboardToggle.row,
    createLabField('键盘输入优先级', priority),
    interceptToggle.row,
    preventDefaultToggle.row,
    status,
  );

  let viewportInputEnabled = true;
  let keyboardDesiredEnabled = keyboardToggle.input.checked;
  let mode = controller.state.mode;
  let ownedCodes: ReadonlySet<string> = new Set();
  const renderStatus = (): void => {
    const keyboardState = !viewportInputEnabled
      ? '被 Viewport 临时暂停'
      : keyboardDesiredEnabled ? '开启' : '关闭';
    status.textContent = `${controller.state.mode} · 键盘${keyboardState} · 当前优先拥有：${[...ownedCodes].join('、') || '无'}`;
  };
  const syncNativeKeyboardCodes = (): void => {
    const active = keyboardDesiredEnabled && viewportInputEnabled;
    controller.setOwnedKeyboardCodes(active ? new Set(keyboardCodesForMode(mode)) : new Set());
  };
  const syncInput = (): void => {
    controller.setInputEnabled(pointerToggle.input.checked && viewportInputEnabled);
    keyboardRegistration.setEnabled(keyboardDesiredEnabled && viewportInputEnabled);
    syncNativeKeyboardCodes();
    renderStatus();
  };
  const keyboardRegistration: LabKeyboardConsumerHandle = keyboard.register({
    id: 'camera',
    label: '摄像机',
    keys: keyboardCodesForMode(mode),
    enabled: false,
    priority: Number(priority.value),
    intercept: interceptToggle.input.checked,
    preventDefault: preventDefaultToggle.input.checked,
    allowNativePropagation: true,
    onKeyDown: () => 'handled',
    onKeyUp: () => 'handled',
    onOwnershipChanged: (nextOwnedCodes) => {
      ownedCodes = nextOwnedCodes;
      renderStatus();
    },
  });

  floatingToggle.input.addEventListener('change', () => floatingPanel.setVisible(floatingToggle.input.checked));
  pointerToggle.input.addEventListener('change', syncInput);
  keyboardToggle.input.addEventListener('change', () => {
    keyboardDesiredEnabled = keyboardToggle.input.checked;
    syncInput();
  });
  priority.addEventListener('input', () => {
    const value = Number(priority.value);
    if (Number.isFinite(value)) keyboardRegistration.setPriority(value);
  });
  interceptToggle.input.addEventListener('change', () => keyboardRegistration.setIntercept(interceptToggle.input.checked));
  preventDefaultToggle.input.addEventListener('change', () => keyboardRegistration.setPreventDefault(preventDefaultToggle.input.checked));
  const syncKeyboardControls = (): void => {
    const settings = keyboard.getConsumer(keyboardRegistration.id);
    if (!settings) return;
    if (viewportInputEnabled) {
      keyboardDesiredEnabled = settings.enabled;
      keyboardToggle.input.checked = settings.enabled;
    } else keyboardToggle.input.checked = keyboardDesiredEnabled;
    priority.value = String(settings.priority);
    interceptToggle.input.checked = settings.intercept;
    preventDefaultToggle.input.checked = settings.preventDefault;
  };
  const offKeyboardChanged = keyboard.subscribe(syncKeyboardControls);
  syncKeyboardControls();
  syncInput();

  return {
    controller,
    floatingPanel,
    setInputEnabled: (enabled) => {
      viewportInputEnabled = enabled;
      syncInput();
    },
    update: (deltaSeconds) => {
      if (mode !== controller.state.mode) {
        mode = controller.state.mode;
        keyboardRegistration.setKeys(keyboardCodesForMode(mode));
        syncNativeKeyboardCodes();
        renderStatus();
      }
      controller.update(deltaSeconds);
      if (floatingPanel.visible) floatingPanel.updateStatus();
    },
    dispose: () => {
      keyboardRegistration.dispose();
      offKeyboardChanged();
      floatingPanel.dispose();
      panel.root.remove();
      controller.dispose();
    },
  };
};
