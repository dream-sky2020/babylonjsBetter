import type { CameraLabController, CameraLabMode, CameraLockPlaneAxis, CameraPositionAxis } from '@/core/camera/cameraLabController.ts';
import { CAMERA_LAB_MODE_LABELS } from '@/core/camera/cameraLabController.ts';

export interface FloatingCameraControlPanel {
  element: HTMLDivElement;
  readonly visible: boolean;
  setVisible: (visible: boolean) => void;
  /** 兼容旧调用：有未应用草稿时不会覆盖输入框。 */
  syncFromController: () => void;
  updateStatus: () => void;
  dispose: () => void;
}

const panelStyle = `position:absolute;left:16px;top:16px;z-index:20;width:380px;max-height:calc(100% - 32px);overflow:hidden;display:flex;flex-direction:column;border:1px solid rgba(148,163,184,.35);border-radius:12px;background:rgba(15,19,26,.78);color:#e8edf2;box-shadow:0 18px 40px rgba(0,0,0,.35);backdrop-filter:blur(8px);font-family:"Segoe UI","Microsoft YaHei",sans-serif;font-size:12px;`;
const nativeLabel = (property: string, title: string): string => `<label><code>${property}</code><span>${title}</span></label>`;

const html = `
  <div data-role="header" style="flex:0 0 auto;"><div data-role="drag" style="box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:12px;height:44px;cursor:move;padding:7px 9px 7px 13px;border-bottom:1px solid rgba(148,163,184,.24);background:rgba(18,25,34,.82);font-weight:700;"><span>摄像机控制</span><button data-role="toggle" type="button">折叠</button></div></div>
  <div data-role="body" style="flex:1 1 auto;min-height:0;overflow-x:hidden;overflow-y:auto;padding:12px;">
    <label><span>预览模式</span></label><select data-field="mode"></select>
    <div data-role="camera-position">${nativeLabel('position', '相机位置')}<div class="camera-vector"><div data-position-axis="x"><small>X</small><input data-field="position.x" type="number" step="0.1" /></div><div data-position-axis="y"><small>Y</small><input data-field="position.y" type="number" step="0.1" /></div><div data-position-axis="z"><small>Z</small><input data-field="position.z" type="number" step="0.1" /></div></div></div>

    <section data-orbit-only>
      <div class="camera-grid">
        <div>${nativeLabel('alpha', '水平环绕角 °')}<input data-field="orbitAlphaDeg" type="number" step="1" /></div>
        <div>${nativeLabel('beta', '垂直环绕角 °')}<input data-field="orbitBetaDeg" type="number" min="1" max="179" step="1" /></div>
        <div>${nativeLabel('radius', '环绕半径')}<input data-field="orbitRadius" type="number" min="1" max="300" step="0.5" /></div>
        <div>${nativeLabel('inertia', '旋转/缩放惯性')}<input data-field="orbitInertia" type="number" min="0" max="0.9999" step="0.01" /></div>
        <div>${nativeLabel('panningInertia', '平移惯性')}<input data-field="orbitPanningInertia" type="number" min="0" max="0.9999" step="0.01" /></div>
        <div>${nativeLabel('wheelPrecision', '滚轮精度（小=快）')}<input data-field="orbitWheelPrecision" type="number" min="0.01" step="0.1" /></div>
        <div>${nativeLabel('angularSensibilityX', '水平灵敏度（小=快）')}<input data-field="orbitAngularSensibilityX" type="number" min="1" step="10" /></div>
        <div>${nativeLabel('angularSensibilityY', '垂直灵敏度（小=快）')}<input data-field="orbitAngularSensibilityY" type="number" min="1" step="10" /></div>
        <div>${nativeLabel('panningSensibility', '平移灵敏度（小=快）')}<input data-field="orbitPanningSensibility" type="number" min="1" step="10" /></div>
      </div>
      ${nativeLabel('target', '环绕目标 XYZ')}<div class="camera-vector"><input data-field="orbitCenter.x" type="number" step="0.1" /><input data-field="orbitCenter.y" type="number" step="0.1" /><input data-field="orbitCenter.z" type="number" step="0.1" /></div>
    </section>

    <section data-first-person-only><div class="camera-grid">
      <div>${nativeLabel('speed', '移动速度')}<input data-field="firstPersonMoveSpeed" type="number" min="0.01" step="0.1" /></div>
      <div>${nativeLabel('inertia', '移动惯性')}<input data-field="firstPersonInertia" type="number" min="0" max="0.9999" step="0.01" /></div>
      <div>${nativeLabel('angularSensibility', '鼠标灵敏度（小=快）')}<input data-field="firstPersonAngularSensibility" type="number" min="1" step="10" /></div>
      <div>${nativeLabel('rotation.x', '俯仰角 °')}<input data-field="freeRotationXDeg" type="number" min="-85" max="85" step="1" /></div>
      <div>${nativeLabel('rotation.y', '朝向角 °')}<input data-field="freeRotationYDeg" type="number" step="1" /></div>
      <div><label><code>约束</code><span>第一人称高度</span></label><input data-field="firstPersonHeight" type="number" step="0.1" /></div>
    </div></section>

    <section data-drone-only><div class="camera-grid">
      <div>${nativeLabel('speed', '移动速度')}<input data-field="droneMoveSpeed" type="number" min="0.01" step="0.1" /></div>
      <div>${nativeLabel('inertia', '移动惯性')}<input data-field="droneInertia" type="number" min="0" max="0.9999" step="0.01" /></div>
      <div>${nativeLabel('angularSensibility', '鼠标灵敏度（小=快）')}<input data-field="droneAngularSensibility" type="number" min="1" step="10" /></div>
      <div>${nativeLabel('rotation.x', '俯仰角 °')}<input data-field="freeRotationXDeg" type="number" min="-85" max="85" step="1" /></div>
      <div>${nativeLabel('rotation.y', '朝向角 °')}<input data-field="freeRotationYDeg" type="number" step="1" /></div>
    </div></section>

    <section data-lock-only><div class="camera-note">此模式是项目自定义约束，不是 Babylon 原生相机类型。</div><div class="camera-grid">
      <div><label><span>锁定平面</span></label><select data-field="lockPlaneAxis"><option value="x">X（YZ 平面）</option><option value="y">Y（XZ 平面）</option><option value="z">Z（XY 平面）</option></select></div>
      <div><label><span>锁定坐标</span></label><input data-field="lockPlaneValue" type="number" step="0.1" /></div>
      <div><label><span>移动速度</span></label><input data-field="moveSpeed" type="number" min="0.1" step="0.1" /></div><div><label><span>移动加速度</span></label><input data-field="moveAcceleration" type="number" min="0" step="1" /></div>
      <div><label><span>移动减速度</span></label><input data-field="moveDeceleration" type="number" min="0" step="1" /></div><div><label><span>拖拽响应</span></label><input data-field="lookSmoothing" type="number" min="0" step="1" /></div>
      <div><label><span>拖拽平移灵敏度</span></label><input data-field="panSensitivity" type="number" min="0.001" step="0.005" /></div>
    </div><label><span>锁定目标 XYZ</span></label><div class="camera-vector"><input data-field="lockTarget.x" type="number" step="0.1" /><input data-field="lockTarget.y" type="number" step="0.1" /><input data-field="lockTarget.z" type="number" step="0.1" /></div></section>

    <div class="camera-grid camera-common"><div>${nativeLabel('fov', '垂直视场角 °')}<input data-field="fovDeg" type="number" min="1" max="179" step="0.1" /></div><div>${nativeLabel('minZ', '近裁剪面')}<input data-field="minZ" type="number" min="0.001" step="0.01" /></div><div>${nativeLabel('maxZ', '远裁剪面')}<input data-field="maxZ" type="number" min="0.01" step="10" /></div></div>
    <div data-role="draft-state" class="camera-note">面板值已与当前相机同步。</div>
    <div class="camera-actions"><button data-role="refresh" type="button">从当前相机刷新</button><button data-role="apply" type="button">应用到相机</button><button data-role="native-defaults" type="button">恢复原生参数</button><button data-role="initial-pose" type="button">恢复初始姿态</button></div>
    <textarea data-role="status" readonly></textarea>
  </div>`;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const radToDeg = (value: number): number => value * 180 / Math.PI;
const degToRad = (value: number): number => value * Math.PI / 180;

export const createFloatingCameraControlPanel = (host: HTMLElement, controller: CameraLabController): FloatingCameraControlPanel => {
  const panel = document.createElement('div');
  panel.style.cssText = panelStyle;
  panel.innerHTML = html;
  panel.querySelectorAll('label').forEach((node) => (node as HTMLElement).style.cssText = 'display:flex;align-items:baseline;gap:7px;margin:8px 0 4px;color:#9fb0c5;');
  panel.querySelectorAll('label code').forEach((node) => (node as HTMLElement).style.cssText = 'color:#7dd3fc;font-size:11px;');
  panel.querySelectorAll<HTMLElement>('input,select,button,textarea').forEach((node) => node.style.cssText = 'width:100%;box-sizing:border-box;border:1px solid rgba(148,163,184,.38);border-radius:6px;background:rgba(15,19,26,.92);color:#e8edf2;padding:6px 8px;');
  const toggleButton = panel.querySelector<HTMLButtonElement>('button[data-role="toggle"]');
  if (toggleButton) toggleButton.style.cssText = 'flex:0 0 auto;width:auto;min-width:52px;height:28px;box-sizing:border-box;border:1px solid rgba(148,163,184,.4);border-radius:6px;background:rgba(71,85,105,.48);color:#e8edf2;padding:0 10px;cursor:pointer;';
  panel.querySelectorAll<HTMLElement>('.camera-grid').forEach((node) => node.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:0 8px;');
  panel.querySelectorAll<HTMLElement>('.camera-vector').forEach((node) => node.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;');
  panel.querySelectorAll<HTMLElement>('.camera-note').forEach((node) => node.style.cssText = 'margin-top:9px;padding:7px 8px;border-radius:6px;background:rgba(30,41,59,.64);color:#aebdce;');
  panel.querySelectorAll<HTMLElement>('.camera-actions').forEach((node) => node.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;');
  panel.querySelectorAll<HTMLButtonElement>('.camera-actions button').forEach((node) => node.style.cursor = 'pointer');
  const applyButton = panel.querySelector<HTMLButtonElement>('button[data-role="apply"]'); if (applyButton) applyButton.style.background = 'rgba(37,99,235,.82)';
  const status = panel.querySelector<HTMLTextAreaElement>('textarea[data-role="status"]'); if (status) status.style.cssText += 'margin-top:10px;min-height:125px;font-family:Consolas,"Courier New",monospace;resize:vertical;';
  host.appendChild(panel);

  const modeSelect = panel.querySelector<HTMLSelectElement>('select[data-field="mode"]');
  if (modeSelect) modeSelect.innerHTML = Object.entries(CAMERA_LAB_MODE_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  const draftState = panel.querySelector<HTMLElement>('[data-role="draft-state"]');
  let dirty = false;
  let visible = true;
  const find = (field: string): HTMLInputElement | HTMLSelectElement | null => panel.querySelector(`[data-field="${field}"]`);
  const read = (field: string, fallback: number): number => { const value = Number(find(field)?.value); return Number.isFinite(value) ? value : fallback; };
  const write = (field: string, value: string | number): void => { panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[data-field="${field}"]`).forEach((node) => node.value = String(value)); };
  const updateDraftState = (): void => { if (!draftState) return; draftState.textContent = dirty ? '有尚未应用的面板修改。刷新会放弃这些修改。' : '面板值已与当前相机同步。'; draftState.style.color = dirty ? '#fbbf24' : '#aebdce'; };
  const syncVisibility = (): void => {
    const mode = controller.state.mode; const axes = new Set(controller.getEditablePositionAxes());
    const positionGroup = panel.querySelector<HTMLElement>('[data-role="camera-position"]'); if (positionGroup) positionGroup.style.display = axes.size ? '' : 'none';
    panel.querySelectorAll<HTMLElement>('[data-position-axis]').forEach((node) => node.style.display = axes.has(node.dataset.positionAxis as CameraPositionAxis) ? '' : 'none');
    panel.querySelectorAll<HTMLElement>('[data-orbit-only]').forEach((node) => node.style.display = mode === 'orbit' ? '' : 'none');
    panel.querySelectorAll<HTMLElement>('[data-first-person-only]').forEach((node) => node.style.display = mode === 'firstPerson' ? '' : 'none');
    panel.querySelectorAll<HTMLElement>('[data-drone-only]').forEach((node) => node.style.display = mode === 'drone' ? '' : 'none');
    panel.querySelectorAll<HTMLElement>('[data-lock-only]').forEach((node) => node.style.display = mode === 'lockPan' ? '' : 'none');
    const button = panel.querySelector<HTMLButtonElement>('button[data-role="native-defaults"]'); if (button) { button.disabled = mode === 'lockPan'; button.title = mode === 'lockPan' ? '自定义模式没有对应的 Babylon 原生参数' : ''; }
  };
  const updateStatus = (): void => { if (status) status.value = controller.getStatusText(); };
  const populate = (force = false): void => {
    if (dirty && !force) { updateStatus(); return; }
    const state = controller.state; const position = controller.getPosition();
    write('mode', state.mode); write('position.x', position.x); write('position.y', position.y); write('position.z', position.z);
    write('orbitAlphaDeg', radToDeg(Math.PI / 2 - state.orbitYaw)); write('orbitBetaDeg', 90 - state.orbitPitchDeg); write('orbitRadius', state.orbitRadius);
    write('orbitInertia', state.orbitInertia); write('orbitPanningInertia', state.orbitPanningInertia); write('orbitAngularSensibilityX', state.orbitAngularSensibilityX); write('orbitAngularSensibilityY', state.orbitAngularSensibilityY); write('orbitPanningSensibility', state.orbitPanningSensibility); write('orbitWheelPrecision', state.orbitWheelPrecision);
    write('orbitCenter.x', state.orbitCenter.x); write('orbitCenter.y', state.orbitCenter.y); write('orbitCenter.z', state.orbitCenter.z);
    write('firstPersonMoveSpeed', state.firstPersonMoveSpeed); write('firstPersonInertia', state.firstPersonInertia); write('firstPersonAngularSensibility', state.firstPersonAngularSensibility);
    write('droneMoveSpeed', state.droneMoveSpeed); write('droneInertia', state.droneInertia); write('droneAngularSensibility', state.droneAngularSensibility);
    write('freeRotationXDeg', radToDeg(-state.pitch)); write('freeRotationYDeg', radToDeg(state.yaw)); write('firstPersonHeight', state.firstPersonHeight);
    write('lockPlaneAxis', state.lockPlaneAxis); write('lockPlaneValue', state.lockPlaneValue); write('moveSpeed', state.moveSpeed); write('moveAcceleration', state.moveAcceleration); write('moveDeceleration', state.moveDeceleration); write('lookSmoothing', state.lookSmoothing); write('panSensitivity', state.panSensitivity);
    write('lockTarget.x', state.lockTarget.x); write('lockTarget.y', state.lockTarget.y); write('lockTarget.z', state.lockTarget.z);
    write('fovDeg', state.fovDeg); write('minZ', state.minZ); write('maxZ', state.maxZ);
    dirty = false; syncVisibility(); updateDraftState(); updateStatus();
  };

  const applyDraft = (): void => {
    const state = controller.state; const position = controller.getPosition();
    for (const axis of controller.getEditablePositionAxes()) position[axis] = read(`position.${axis}`, position[axis]);
    state.orbitYaw = Math.PI / 2 - degToRad(read('orbitAlphaDeg', radToDeg(Math.PI / 2 - state.orbitYaw))); state.orbitPitchDeg = 90 - read('orbitBetaDeg', 90 - state.orbitPitchDeg); state.orbitRadius = clamp(read('orbitRadius', state.orbitRadius), 1, 300);
    state.orbitCenter.set(read('orbitCenter.x', state.orbitCenter.x), read('orbitCenter.y', state.orbitCenter.y), read('orbitCenter.z', state.orbitCenter.z));
    state.orbitInertia = clamp(read('orbitInertia', state.orbitInertia), 0, .9999); state.orbitPanningInertia = clamp(read('orbitPanningInertia', state.orbitPanningInertia), 0, .9999); state.orbitAngularSensibilityX = Math.max(1, read('orbitAngularSensibilityX', state.orbitAngularSensibilityX)); state.orbitAngularSensibilityY = Math.max(1, read('orbitAngularSensibilityY', state.orbitAngularSensibilityY)); state.orbitPanningSensibility = Math.max(1, read('orbitPanningSensibility', state.orbitPanningSensibility)); state.orbitWheelPrecision = Math.max(.01, read('orbitWheelPrecision', state.orbitWheelPrecision));
    state.firstPersonMoveSpeed = Math.max(.01, read('firstPersonMoveSpeed', state.firstPersonMoveSpeed)); state.firstPersonInertia = clamp(read('firstPersonInertia', state.firstPersonInertia), 0, .9999); state.firstPersonAngularSensibility = Math.max(1, read('firstPersonAngularSensibility', state.firstPersonAngularSensibility));
    state.droneMoveSpeed = Math.max(.01, read('droneMoveSpeed', state.droneMoveSpeed)); state.droneInertia = clamp(read('droneInertia', state.droneInertia), 0, .9999); state.droneAngularSensibility = Math.max(1, read('droneAngularSensibility', state.droneAngularSensibility));
    state.pitch = -degToRad(clamp(read('freeRotationXDeg', radToDeg(-state.pitch)), -85, 85)); state.yaw = degToRad(read('freeRotationYDeg', radToDeg(state.yaw))); state.firstPersonHeight = read('firstPersonHeight', state.firstPersonHeight);
    state.lockPlaneAxis = (find('lockPlaneAxis')?.value || state.lockPlaneAxis) as CameraLockPlaneAxis; state.lockPlaneValue = read('lockPlaneValue', state.lockPlaneValue); state.moveSpeed = Math.max(0, read('moveSpeed', state.moveSpeed)); state.moveAcceleration = Math.max(0, read('moveAcceleration', state.moveAcceleration)); state.moveDeceleration = Math.max(0, read('moveDeceleration', state.moveDeceleration)); state.lookSmoothing = Math.max(0, read('lookSmoothing', state.lookSmoothing)); state.panSensitivity = Math.max(0, read('panSensitivity', state.panSensitivity));
    state.lockTarget.set(read('lockTarget.x', state.lockTarget.x), read('lockTarget.y', state.lockTarget.y), read('lockTarget.z', state.lockTarget.z));
    state.fovDeg = clamp(read('fovDeg', state.fovDeg), 1, 179); state.fovReference = 'vertical'; state.minZ = Math.max(.001, read('minZ', state.minZ)); state.maxZ = Math.max(state.minZ + .001, read('maxZ', state.maxZ));
    controller.applyStateToActiveCamera(); dirty = false; populate(true);
  };

  panel.addEventListener('input', (event) => { const target = event.target; if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return; if (target.dataset.field === 'mode') return; dirty = true; updateDraftState(); });
  modeSelect?.addEventListener('change', () => { controller.setMode(modeSelect.value as CameraLabMode); dirty = false; controller.refreshStateFromActiveCamera(); populate(true); });
  panel.querySelector('button[data-role="refresh"]')?.addEventListener('click', () => { controller.refreshStateFromActiveCamera(); dirty = false; populate(true); });
  panel.querySelector('button[data-role="apply"]')?.addEventListener('click', applyDraft);
  panel.querySelector('button[data-role="native-defaults"]')?.addEventListener('click', () => { controller.resetActiveCameraToNativeDefaults(); controller.refreshStateFromActiveCamera(); dirty = false; populate(true); });
  panel.querySelector('button[data-role="initial-pose"]')?.addEventListener('click', () => { controller.resetInitialPose(); controller.refreshStateFromActiveCamera(); dirty = false; populate(true); });

  const toggle = panel.querySelector<HTMLButtonElement>('button[data-role="toggle"]'); const body = panel.querySelector<HTMLElement>('[data-role="body"]'); let collapsed = false;
  toggle?.addEventListener('pointerdown', (event) => event.stopPropagation()); toggle?.addEventListener('click', (event) => { event.stopPropagation(); collapsed = !collapsed; if (body) body.style.display = collapsed ? 'none' : ''; toggle.textContent = collapsed ? '展开' : '折叠'; });
  const handle = panel.querySelector<HTMLElement>('[data-role="drag"]'); let dragging = false; let startX = 0; let startY = 0; let startLeft = 0; let startTop = 0;
  const onMove = (event: PointerEvent): void => { if (!dragging) return; panel.style.left = `${Math.max(0, startLeft + event.clientX - startX)}px`; panel.style.top = `${Math.max(0, startTop + event.clientY - startY)}px`; };
  const onUp = (): void => { dragging = false; window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  handle?.addEventListener('pointerdown', (event) => { if ((event.target as HTMLElement).closest('button')) return; dragging = true; startX = event.clientX; startY = event.clientY; startLeft = panel.offsetLeft; startTop = panel.offsetTop; window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); });

  populate(true);
  return {
    element: panel,
    get visible() { return visible; },
    setVisible: (nextVisible) => {
      visible = nextVisible;
      panel.style.display = visible ? 'flex' : 'none';
      if (visible) populate(false);
    },
    syncFromController: () => populate(false),
    updateStatus,
    dispose: () => { panel.remove(); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); },
  };
};
