import { Vector3 } from '@babylonjs/core';
import type {
  CameraLabController,
  CameraLabMode,
  CameraLockPlaneAxis
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
  overflow:auto;
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
  <div data-role="drag" style="cursor:move;padding:10px 12px;border-bottom:1px solid rgba(148,163,184,.24);font-weight:700;">摄像机控制</div>
  <div style="padding:12px;">
    <label>预览模式</label>
    <select data-field="mode"></select>
    <label>鼠标视角方式</label>
    <select data-field="lookControlMode">
      <option value="pointerLock">点击画布锁定鼠标</option>
      <option value="drag">按住左键拖拽调整视野</option>
    </select>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div><label>移动速度</label><input data-field="moveSpeed" type="number" min="0.1" max="200" step="0.1" /></div>
      <div><label>鼠标灵敏度</label><input data-field="mouseSensitivity" type="number" min="0.0005" max="0.02" step="0.0005" /></div>
      <div><label>第一人称高度</label><input data-field="firstPersonHeight" type="number" step="0.1" /></div>
      <div>
        <label>锁定平面</label>
        <select data-field="lockPlaneAxis">
          <option value="x">X（YZ 平面）</option>
          <option value="y">Y（XZ 平面）</option>
          <option value="z">Z（XY 平面）</option>
        </select>
      </div>
      <div><label>锁定平面坐标</label><input data-field="lockPlaneValue" type="number" step="0.1" /></div>
      <div><label>环绕半径</label><input data-field="orbitRadius" type="number" min="1" max="300" step="0.5" /></div>
      <div><label>环绕俯仰角</label><input data-field="orbitPitchDeg" type="number" min="-80" max="80" step="1" /></div>
    </div>
    <label>环绕中心 XYZ</label>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
      <input data-field="orbitCenter.x" type="number" step="0.1" />
      <input data-field="orbitCenter.y" type="number" step="0.1" />
      <input data-field="orbitCenter.z" type="number" step="0.1" />
    </div>
    <label>终点锁定目标 XYZ</label>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
      <input data-field="lockTarget.x" type="number" step="0.1" />
      <input data-field="lockTarget.y" type="number" step="0.1" />
      <input data-field="lockTarget.z" type="number" step="0.1" />
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

export const createFloatingCameraControlPanel = (
  host: HTMLElement,
  controller: CameraLabController
): FloatingCameraControlPanel => {
  const panel = document.createElement('div');
  panel.style.cssText = panelStyle;
  panel.innerHTML = html;
  applyControlStyles(panel);
  host.appendChild(panel);

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.textContent = '👁';
  toggleButton.title = '隐藏面板';
  toggleButton.setAttribute('aria-label', '隐藏面板');
  toggleButton.style.cssText = `
    position:absolute;
    z-index:21;
    width:24px;
    height:24px;
    border:1px solid rgba(148,163,184,.4);
    border-radius:999px;
    background:rgba(71,85,105,.48);
    color:#e8edf2;
    padding:0;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    font-size:13px;
    line-height:1;
    cursor:pointer;
  `;
  host.appendChild(toggleButton);

  let isCollapsed = false;
  const refreshToggleButtonPosition = () => {
    if (isCollapsed) return;
    const left = panel.offsetLeft + panel.offsetWidth - 30;
    const top = panel.offsetTop + 6;
    toggleButton.style.left = `${Math.max(0, left)}px`;
    toggleButton.style.top = `${Math.max(0, top)}px`;
  };
  const setCollapsed = (collapsed: boolean) => {
    if (collapsed === isCollapsed) return;
    isCollapsed = collapsed;
    if (collapsed) {
      panel.style.display = 'none';
      toggleButton.title = '显示面板';
      toggleButton.setAttribute('aria-label', '显示面板');
      return;
    }
    panel.style.display = '';
    toggleButton.title = '隐藏面板';
    toggleButton.setAttribute('aria-label', '隐藏面板');
    refreshToggleButtonPosition();
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

  const syncFromController = () => {
    panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]').forEach((input) => {
      const field = input.dataset.field || '';
      const state = controller.state;
      if (field === 'mode') input.value = state.mode;
      else if (field === 'lookControlMode') input.value = state.lookControlMode;
      else if (field === 'moveSpeed') input.value = String(state.moveSpeed);
      else if (field === 'mouseSensitivity') input.value = String(state.mouseSensitivity);
      else if (field === 'firstPersonHeight') input.value = String(state.firstPersonHeight);
      else if (field === 'lockPlaneAxis') input.value = state.lockPlaneAxis;
      else if (field === 'lockPlaneValue') input.value = String(state.lockPlaneValue);
      else if (field === 'orbitRadius') input.value = String(state.orbitRadius);
      else if (field === 'orbitPitchDeg') input.value = String(state.orbitPitchDeg);
      else if (field === 'orbitCenter.x') input.value = String(state.orbitCenter.x);
      else if (field === 'orbitCenter.y') input.value = String(state.orbitCenter.y);
      else if (field === 'orbitCenter.z') input.value = String(state.orbitCenter.z);
      else if (field === 'lockTarget.x') input.value = String(state.lockTarget.x);
      else if (field === 'lockTarget.y') input.value = String(state.lockTarget.y);
      else if (field === 'lockTarget.z') input.value = String(state.lockTarget.z);
    });
  };

  const updateStatus = () => {
    if (status) status.value = controller.getStatusText();
  };

  const applyField = (input: HTMLInputElement | HTMLSelectElement) => {
    const field = input.dataset.field || '';
    const state = controller.state;
    if (field === 'mode') state.mode = input.value as CameraLabMode;
    else if (field === 'lookControlMode') state.lookControlMode = input.value === 'drag' ? 'drag' : 'pointerLock';
    else if (field === 'moveSpeed') state.moveSpeed = readNumber(input as HTMLInputElement, state.moveSpeed);
    else if (field === 'mouseSensitivity') state.mouseSensitivity = readNumber(input as HTMLInputElement, state.mouseSensitivity);
    else if (field === 'firstPersonHeight') state.firstPersonHeight = readNumber(input as HTMLInputElement, state.firstPersonHeight);
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
    refreshToggleButtonPosition();
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
  refreshToggleButtonPosition();

  return {
    element: panel,
    syncFromController,
    updateStatus,
    dispose: () => {
      panel.remove();
      toggleButton.remove();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    }
  };
};
