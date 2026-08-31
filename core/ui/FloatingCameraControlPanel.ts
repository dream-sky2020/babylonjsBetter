import { Vector3 } from '@babylonjs/core';
import type {
  CameraLabController,
  CameraLabMode,
  CameraLockPlaneAxis,
  CameraPositionAxis
} from '@/core/camera/cameraLabController.ts';
import { CAMERA_LAB_MODE_LABELS } from '@/core/camera/cameraLabController.ts';

export interface FloatingCameraControlPanel {
  element: HTMLDivElement;
  syncFromController: () => void;
  updateStatus: () => void;
  dispose: () => void;
}

const panelStyle = `
  position:absolute;
  left:16px;
  top:16px;
  z-index:20;
  width:360px;
  max-height:calc(100% - 32px);
  overflow:hidden;
  display:flex;
  flex-direction:column;
  border:1px solid rgba(148,163,184,.35);
  border-radius:12px;
  background:rgba(15,19,26,.72);
  color:#e8edf2;
  box-shadow:0 18px 40px rgba(0,0,0,.35);
  backdrop-filter:blur(8px);
  font-family:"Segoe UI","Microsoft YaHei",sans-serif;
  font-size:12px;
`;

const html = `
  <div data-role="header" style="flex:0 0 auto;">
    <div data-role="drag" style="box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:12px;height:44px;cursor:move;padding:7px 9px 7px 13px;border-bottom:1px solid rgba(148,163,184,.24);background:rgba(18,25,34,.82);font-weight:700;">
    <span data-role="title" style="white-space:nowrap;line-height:1;letter-spacing:.02em;">摄像机控制</span>
    <button data-role="toggle" type="button" title="折叠摄像机控制" aria-label="折叠摄像机控制">折叠</button>
    </div>
  </div>
  <div data-role="body" style="flex:1 1 auto;min-height:0;overflow-x:hidden;overflow-y:auto;padding:12px;">
    <label>预览模式</label>
    <select data-field="mode"></select>
    <label>鼠标视角方式</label>
    <select data-field="lookControlMode">
      <option value="pointerLock">点击画布锁定鼠标</option>
      <option value="drag">按住左键拖拽调整视野</option>
    </select>
    <div data-role="camera-position">
      <label>摄像机位置</label>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
        <div data-position-axis="x"><label>X</label><input data-field="position.x" type="number" step="0.1" /></div>
        <div data-position-axis="y"><label>Y</label><input data-field="position.y" type="number" step="0.1" /></div>
        <div data-position-axis="z"><label>Z</label><input data-field="position.z" type="number" step="0.1" /></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div><label>移动速度</label><input data-field="moveSpeed" type="number" min="0.1" max="200" step="0.1" /></div>
      <div><label>移动加速度</label><input data-field="moveAcceleration" type="number" min="0" max="1000" step="1" /></div>
      <div><label>移动减速度</label><input data-field="moveDeceleration" type="number" min="0" max="1000" step="1" /></div>
      <div><label>鼠标灵敏度</label><input data-field="mouseSensitivity" type="number" min="0.0005" max="0.02" step="0.0005" /></div>
      <div><label>视角平滑（响应/秒）</label><input data-field="lookSmoothing" type="number" min="0" max="60" step="1" /></div>
      <div data-lock-only><label>拖拽平移灵敏度</label><input data-field="panSensitivity" type="number" min="0.001" max="2" step="0.005" /></div>
      <div data-orbit-only><label>滚轮缩放速度</label><input data-field="orbitZoomSpeed" type="number" min="0.1" max="50" step="0.1" /></div>
      <div data-orbit-only><label>缩放平滑（响应/秒）</label><input data-field="zoomSmoothing" type="number" min="0" max="60" step="1" /></div>
      <div><label>垂直视场角（°）</label><input data-field="fovDeg" type="number" min="1" max="179" step="0.1" /></div>
      <div><label>水平视场角 HFOV（°）</label><input data-field="horizontalFovDeg" type="number" min="1" max="179" step="0.1" /></div>
      <div><label>近裁剪面</label><input data-field="minZ" type="number" min="0.001" step="0.01" /></div>
      <div><label>远裁剪面</label><input data-field="maxZ" type="number" min="0.01" step="10" /></div>
      <div data-first-person-only><label>第一人称高度</label><input data-field="firstPersonHeight" type="number" step="0.1" /></div>
      <div data-lock-only>
        <label>锁定平面</label>
        <select data-field="lockPlaneAxis">
          <option value="x">X（YZ 平面）</option>
          <option value="y">Y（XZ 平面）</option>
          <option value="z">Z（XY 平面）</option>
        </select>
      </div>
      <div data-lock-only><label>锁定平面坐标</label><input data-field="lockPlaneValue" type="number" step="0.1" /></div>
      <div data-orbit-only><label>环绕半径</label><input data-field="orbitRadius" type="number" min="1" max="300" step="0.5" /></div>
      <div data-orbit-only><label>环绕方位角（°）</label><input data-field="orbitYawDeg" type="number" step="1" /></div>
      <div data-orbit-only><label>环绕俯仰角（°）</label><input data-field="orbitPitchDeg" type="number" min="-80" max="80" step="1" /></div>
    </div>
    <div data-orbit-only>
      <label>环绕中心 XYZ</label>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
        <input data-field="orbitCenter.x" type="number" step="0.1" />
        <input data-field="orbitCenter.y" type="number" step="0.1" />
        <input data-field="orbitCenter.z" type="number" step="0.1" />
      </div>
    </div>
    <div data-lock-only>
      <label>终点锁定目标 XYZ</label>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
        <input data-field="lockTarget.x" type="number" step="0.1" />
        <input data-field="lockTarget.y" type="number" step="0.1" />
        <input data-field="lockTarget.z" type="number" step="0.1" />
      </div>
    </div>
    <button data-role="reset" type="button">恢复默认摄像机</button>
    <textarea data-role="status" readonly></textarea>
  </div>
`;

const applyControlStyles = (panel: HTMLDivElement): void => {
  panel.querySelectorAll('label').forEach((label) => {
    (label as HTMLElement).style.cssText = 'display:block;margin:8px 0 4px;color:#9fb0c5;';
  });
  panel.querySelectorAll('input,select,button,textarea').forEach((node) => {
    (node as HTMLElement).style.cssText = 'width:100%;box-sizing:border-box;border:1px solid rgba(148,163,184,.38);border-radius:6px;background:rgba(15,19,26,.92);color:#e8edf2;padding:6px 8px;';
  });
  const textarea = panel.querySelector('textarea');
  if (textarea) {
    textarea.style.marginTop = '10px';
    textarea.style.minHeight = '150px';
    textarea.style.fontFamily = 'Consolas, "Courier New", monospace';
    textarea.style.resize = 'vertical';
  }
  const resetButton = panel.querySelector<HTMLButtonElement>('button[data-role="reset"]');
  if (resetButton) {
    resetButton.style.marginTop = '10px';
    resetButton.style.background = 'rgba(47,111,237,.75)';
    resetButton.style.cursor = 'pointer';
  }
};

const readNumber = (input: HTMLInputElement, fallback: number): number => {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
};

const radiansToDegrees = (value: number): number => value * 180 / Math.PI;
const degreesToRadians = (value: number): number => value * Math.PI / 180;

export const createFloatingCameraControlPanel = (
  host: HTMLElement,
  controller: CameraLabController
): FloatingCameraControlPanel => {
  const panel = document.createElement('div');
  panel.style.cssText = panelStyle;
  panel.innerHTML = html;
  applyControlStyles(panel);
  host.appendChild(panel);

  const toggleButton = panel.querySelector<HTMLButtonElement>('button[data-role="toggle"]');
  if (!toggleButton) throw new Error('摄像机控制面板缺少折叠按钮。');
  toggleButton.style.cssText = `
    position:static;
    flex:0 0 auto;
    width:52px;
    height:28px;
    border:1px solid rgba(148,163,184,.4);
    border-radius:6px;
    background:rgba(71,85,105,.48);
    color:#e8edf2;
    padding:0 10px;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    font-size:12px;
    line-height:1;
    cursor:pointer;
  `;

  let isCollapsed = false;
  const panelBody = panel.querySelector<HTMLElement>('[data-role="body"]');
  const setCollapsed = (collapsed: boolean) => {
    if (collapsed === isCollapsed) return;
    isCollapsed = collapsed;
    if (panelBody) panelBody.style.display = collapsed ? 'none' : '';
    toggleButton.textContent = collapsed ? '展开' : '折叠';
    toggleButton.title = collapsed ? '展开摄像机控制' : '折叠摄像机控制';
    toggleButton.setAttribute('aria-label', collapsed ? '展开摄像机控制' : '折叠摄像机控制');
  };
  toggleButton.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
  });
  toggleButton.addEventListener('click', (event) => {
    event.stopPropagation();
    setCollapsed(!isCollapsed);
  });

  const modeSelect = panel.querySelector<HTMLSelectElement>('select[data-field="mode"]');
  if (modeSelect) {
    modeSelect.innerHTML = Object.entries(CAMERA_LAB_MODE_LABELS)
      .map(([value, label]) => `<option value="${value}">${label}</option>`)
      .join('');
  }

  const status = panel.querySelector<HTMLTextAreaElement>('textarea[data-role="status"]');

  const syncPositionVisibility = () => {
    const editableAxes = new Set(controller.getEditablePositionAxes());
    const positionGroup = panel.querySelector<HTMLElement>('[data-role="camera-position"]');
    if (positionGroup) positionGroup.style.display = editableAxes.size ? '' : 'none';
    panel.querySelectorAll<HTMLElement>('[data-position-axis]').forEach((element) => {
      element.style.display = editableAxes.has(element.dataset.positionAxis as CameraPositionAxis) ? '' : 'none';
    });
    panel.querySelectorAll<HTMLElement>('[data-orbit-only]').forEach((element) => {
      element.style.display = controller.state.mode === 'orbit' ? '' : 'none';
    });
    panel.querySelectorAll<HTMLElement>('[data-first-person-only]').forEach((element) => {
      element.style.display = controller.state.mode === 'firstPerson' ? '' : 'none';
    });
    panel.querySelectorAll<HTMLElement>('[data-lock-only]').forEach((element) => {
      element.style.display = controller.state.mode === 'lockPan' ? '' : 'none';
    });
  };

  const syncFromController = () => {
    const position = controller.getPosition();
    panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]').forEach((input) => {
      const field = input.dataset.field || '';
      const state = controller.state;
      if (field === 'mode') input.value = state.mode;
      else if (field === 'lookControlMode') input.value = state.lookControlMode;
      else if (field === 'moveSpeed') input.value = String(state.moveSpeed);
      else if (field === 'moveAcceleration') input.value = String(state.moveAcceleration);
      else if (field === 'moveDeceleration') input.value = String(state.moveDeceleration);
      else if (field === 'mouseSensitivity') input.value = String(state.mouseSensitivity);
      else if (field === 'lookSmoothing') input.value = String(state.lookSmoothing);
      else if (field === 'panSensitivity') input.value = String(state.panSensitivity);
      else if (field === 'orbitZoomSpeed') input.value = String(state.orbitZoomSpeed);
      else if (field === 'zoomSmoothing') input.value = String(state.zoomSmoothing);
      else if (field === 'fovDeg') input.value = String(state.fovDeg);
      else if (field === 'horizontalFovDeg') input.value = String(state.horizontalFovDeg);
      else if (field === 'minZ') input.value = String(state.minZ);
      else if (field === 'maxZ') input.value = String(state.maxZ);
      else if (field === 'firstPersonHeight') input.value = String(state.firstPersonHeight);
      else if (field === 'position.x') input.value = String(position.x);
      else if (field === 'position.y') input.value = String(position.y);
      else if (field === 'position.z') input.value = String(position.z);
      else if (field === 'lockPlaneAxis') input.value = state.lockPlaneAxis;
      else if (field === 'lockPlaneValue') input.value = String(state.lockPlaneValue);
      else if (field === 'orbitRadius') input.value = String(state.orbitRadius);
      else if (field === 'orbitYawDeg') input.value = String(radiansToDegrees(state.orbitYaw));
      else if (field === 'orbitPitchDeg') input.value = String(state.orbitPitchDeg);
      else if (field === 'orbitCenter.x') input.value = String(state.orbitCenter.x);
      else if (field === 'orbitCenter.y') input.value = String(state.orbitCenter.y);
      else if (field === 'orbitCenter.z') input.value = String(state.orbitCenter.z);
      else if (field === 'lockTarget.x') input.value = String(state.lockTarget.x);
      else if (field === 'lockTarget.y') input.value = String(state.lockTarget.y);
      else if (field === 'lockTarget.z') input.value = String(state.lockTarget.z);
    });
    syncPositionVisibility();
  };

  const updateStatus = () => {
    if (status) status.value = controller.getStatusText();
  };

  const applyField = (input: HTMLInputElement | HTMLSelectElement) => {
    const field = input.dataset.field || '';
    const state = controller.state;
    if (field === 'mode') controller.setMode(input.value as CameraLabMode);
    else if (field === 'lookControlMode') state.lookControlMode = input.value === 'drag' ? 'drag' : 'pointerLock';
    else if (field === 'moveSpeed') state.moveSpeed = readNumber(input as HTMLInputElement, state.moveSpeed);
    else if (field === 'moveAcceleration') state.moveAcceleration = Math.max(0, readNumber(input as HTMLInputElement, state.moveAcceleration));
    else if (field === 'moveDeceleration') state.moveDeceleration = Math.max(0, readNumber(input as HTMLInputElement, state.moveDeceleration));
    else if (field === 'mouseSensitivity') state.mouseSensitivity = readNumber(input as HTMLInputElement, state.mouseSensitivity);
    else if (field === 'lookSmoothing') state.lookSmoothing = Math.max(0, readNumber(input as HTMLInputElement, state.lookSmoothing));
    else if (field === 'panSensitivity') state.panSensitivity = Math.max(0, readNumber(input as HTMLInputElement, state.panSensitivity));
    else if (field === 'orbitZoomSpeed') state.orbitZoomSpeed = Math.max(0, readNumber(input as HTMLInputElement, state.orbitZoomSpeed));
    else if (field === 'zoomSmoothing') state.zoomSmoothing = Math.max(0, readNumber(input as HTMLInputElement, state.zoomSmoothing));
    else if (field === 'fovDeg') controller.setVerticalFovDeg(readNumber(input as HTMLInputElement, state.fovDeg));
    else if (field === 'horizontalFovDeg') controller.setHorizontalFovDeg(readNumber(input as HTMLInputElement, state.horizontalFovDeg));
    else if (field === 'minZ') state.minZ = Math.max(0.001, readNumber(input as HTMLInputElement, state.minZ));
    else if (field === 'maxZ') state.maxZ = Math.max(state.minZ + 0.001, readNumber(input as HTMLInputElement, state.maxZ));
    else if (field === 'firstPersonHeight') state.firstPersonHeight = readNumber(input as HTMLInputElement, state.firstPersonHeight);
    else if (field.startsWith('position.')) {
      const axis = field.slice(-1) as CameraPositionAxis;
      controller.setPositionAxis(axis, readNumber(input as HTMLInputElement, controller.getPosition()[axis]));
    }
    else if (field === 'lockPlaneAxis') {
      const axis = (input.value === 'x' || input.value === 'z' ? input.value : 'y') as CameraLockPlaneAxis;
      state.lockPlaneAxis = axis;
      state.lockPlaneValue = state.lockPosition[axis];
      const valueInput = panel.querySelector<HTMLInputElement>('input[data-field="lockPlaneValue"]');
      if (valueInput) valueInput.value = String(state.lockPlaneValue);
    }
    else if (field === 'lockPlaneValue') {
      state.lockPlaneValue = readNumber(input as HTMLInputElement, state.lockPlaneValue);
    }
    else if (field === 'orbitRadius') state.orbitRadius = readNumber(input as HTMLInputElement, state.orbitRadius);
    else if (field === 'orbitYawDeg') state.orbitYaw = degreesToRadians(readNumber(input as HTMLInputElement, radiansToDegrees(state.orbitYaw)));
    else if (field === 'orbitPitchDeg') state.orbitPitchDeg = readNumber(input as HTMLInputElement, state.orbitPitchDeg);
    else if (field.startsWith('orbitCenter.')) state.orbitCenter = new Vector3(
      field.endsWith('.x') ? readNumber(input as HTMLInputElement, state.orbitCenter.x) : state.orbitCenter.x,
      field.endsWith('.y') ? readNumber(input as HTMLInputElement, state.orbitCenter.y) : state.orbitCenter.y,
      field.endsWith('.z') ? readNumber(input as HTMLInputElement, state.orbitCenter.z) : state.orbitCenter.z
    );
    else if (field.startsWith('lockTarget.')) state.lockTarget = new Vector3(
      field.endsWith('.x') ? readNumber(input as HTMLInputElement, state.lockTarget.x) : state.lockTarget.x,
      field.endsWith('.y') ? readNumber(input as HTMLInputElement, state.lockTarget.y) : state.lockTarget.y,
      field.endsWith('.z') ? readNumber(input as HTMLInputElement, state.lockTarget.z) : state.lockTarget.z
    );
    controller.applyPose();
    if (field === 'fovDeg' || field === 'horizontalFovDeg') syncFromController();
    if (field === 'mode' || field === 'lockPlaneAxis') syncFromController();
    updateStatus();
  };

  const onInput = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
    applyField(target);
  };
  panel.addEventListener('input', onInput);
  panel.addEventListener('change', onInput);
  panel.querySelector('button[data-role="reset"]')?.addEventListener('click', () => {
    controller.reset();
    syncFromController();
    updateStatus();
  });

  const dragHandle = panel.querySelector<HTMLElement>('[data-role="drag"]');
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) return;
    panel.style.left = `${Math.max(0, startLeft + event.clientX - startX)}px`;
    panel.style.top = `${Math.max(0, startTop + event.clientY - startY)}px`;
  };
  const onPointerUp = () => {
    dragging = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };
  dragHandle?.addEventListener('pointerdown', (event) => {
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    startLeft = panel.offsetLeft;
    startTop = panel.offsetTop;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  });

  syncFromController();
  updateStatus();

  return {
    element: panel,
    syncFromController,
    updateStatus,
    dispose: () => {
      panel.remove();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    }
  };
};
