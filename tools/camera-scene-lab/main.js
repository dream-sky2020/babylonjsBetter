import { createCameraLabController } from '/core/camera/cameraLabController.ts';
import { createCameraLabScene } from '/core/scene/createCameraLabScene.ts';
import { createFloatingCameraControlPanel } from '/core/ui/FloatingCameraControlPanel.ts';

const stage = document.getElementById('stage');
const canvas = document.getElementById('preview');

if (!(stage instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Camera Scene Lab 初始化失败：缺少 stage 或 canvas');
}

const isTypingTarget = (target) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
};

const context = createCameraLabScene(canvas);
const controller = createCameraLabController(context.camera);
const panel = createFloatingCameraControlPanel(stage, controller);

const drag = {
  active: false,
  pointerId: -1,
  lastClientX: 0,
  lastClientY: 0
};

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  drag.active = true;
  drag.pointerId = event.pointerId;
  drag.lastClientX = event.clientX;
  drag.lastClientY = event.clientY;
  canvas.style.cursor = 'grabbing';
  canvas.setPointerCapture(event.pointerId);
  const shouldLockPointer = controller.state.lookControlMode === 'pointerLock';
  const mode = controller.state.mode;
  if ((mode === 'firstPerson' || mode === 'drone') && shouldLockPointer && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock?.();
  }
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag.active || event.pointerId !== drag.pointerId) return;
  const dx = event.clientX - drag.lastClientX;
  const dy = event.clientY - drag.lastClientY;
  drag.lastClientX = event.clientX;
  drag.lastClientY = event.clientY;
  controller.handlePointerDelta(dx, dy);
  panel.syncFromController();
  panel.updateStatus();
});

const stopDrag = (event) => {
  if (!drag.active || event.pointerId !== drag.pointerId) return;
  drag.active = false;
  drag.pointerId = -1;
  canvas.style.cursor = 'grab';
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
};
canvas.addEventListener('pointerup', stopDrag);
canvas.addEventListener('pointercancel', stopDrag);

document.addEventListener('pointerlockchange', () => {
  canvas.style.cursor = document.pointerLockElement === canvas ? 'none' : 'grab';
});
document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== canvas) return;
  controller.handlePointerDelta(event.movementX || 0, event.movementY || 0);
  panel.syncFromController();
  panel.updateStatus();
});

window.addEventListener('keydown', (event) => {
  if (isTypingTarget(event.target)) return;
  if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(event.code)) return;
  controller.keys.add(event.code);
  event.preventDefault();
});
window.addEventListener('keyup', (event) => {
  controller.keys.delete(event.code);
});

canvas.addEventListener('wheel', (event) => {
  if (controller.state.mode !== 'orbit') return;
  event.preventDefault();
  controller.handleWheel(event.deltaY);
  panel.syncFromController();
  panel.updateStatus();
}, { passive: false });

window.addEventListener('resize', () => {
  context.engine.resize();
});

context.engine.runRenderLoop(() => {
  const dt = context.engine.getDeltaTime() / 1000;
  controller.update(dt);
  panel.updateStatus();
  context.scene.render();
});

window.addEventListener('beforeunload', () => {
  panel.dispose();
  context.dispose();
});
