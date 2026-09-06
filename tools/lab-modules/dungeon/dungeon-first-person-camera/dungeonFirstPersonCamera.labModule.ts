import { Vector3 } from '@babylonjs/core';
import { resolveDungeonMapTileWorldLayout } from '@/core/scene';
import {
  createLabField,
  createLabJson,
  createLabStatus,
  createLabSwitch,
  type LabModule,
} from '@/tools/lab-kit';
import { dungeonMapChangedEvent } from '../dungeon-map-loader/dungeonMapLoader.protocol';
import {
  DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY,
  type DungeonMapLoaderReferences,
  type LoadedDungeonReferences,
} from '../dungeon-map-loader/dungeonMapLoader.references';

const degToRad = (value: number): number => value * Math.PI / 180;
const radToDeg = (value: number): number => value * 180 / Math.PI;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const createNumberInput = (value: number, min: number, max: number, step: number): HTMLInputElement => {
  const input = document.createElement('input');
  input.type = 'number';
  input.value = String(value);
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  return input;
};

const readClampedNumber = (input: HTMLInputElement, fallback: number): number => {
  const value = Number(input.value);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Number(input.max), Math.max(Number(input.min), value));
};

export const dungeonFirstPersonCameraLabModule: LabModule = {
  id: 'dungeon-first-person-camera',
  dependencies: ['player-movement'],
  setup(context) {
    const references = context.services.get<DungeonMapLoaderReferences>(
      DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY,
    );
    const panel = context.ui.addPanel('dungeon-first-person-camera', 'DRPG 第一人称相机');
    const enabledToggle = createLabSwitch('绑定到玩家第一人称姿态', true);
    const eyeHeightInput = createNumberInput(1.65, 0.1, 10, 0.05);
    const pitchInput = createNumberInput(0, -85, 85, 1);
    const freeLookToggle = createLabSwitch('启用拖拽自由观察', true);
    const horizontalLimitInput = createNumberInput(60, 0, 180, 1);
    const lookUpLimitInput = createNumberInput(60, 0, 85, 1);
    const lookDownLimitInput = createNumberInput(45, 0, 85, 1);
    const sensitivityInput = createNumberInput(1, 0.1, 3, 0.1);
    const smoothingInput = createNumberInput(18, 0, 60, 1);
    const autoRecenterToggle = createLabSwitch('松开拖拽后自动回正', true);
    const recenterDurationInput = createNumberInput(0.3, 0, 3, 0.05);
    const recenterActions = document.createElement('div');
    recenterActions.className = 'lab-module-actions';
    const smoothRecenterButton = document.createElement('button');
    smoothRecenterButton.type = 'button';
    smoothRecenterButton.textContent = '平滑回正';
    const immediateRecenterButton = document.createElement('button');
    immediateRecenterButton.type = 'button';
    immediateRecenterButton.textContent = '立即回正';
    recenterActions.append(smoothRecenterButton, immediateRecenterButton);
    const status = createLabStatus('等待 Dungeon Runtime。');
    const debug = createLabJson();
    panel.content.append(
      enabledToggle.row,
      createLabField('玩家脚底以上眼高（世界单位）', eyeHeightInput),
      createLabField('基础俯仰角（度）', pitchInput),
      freeLookToggle.row,
      createLabField('水平观察范围（±度）', horizontalLimitInput),
      createLabField('向上观察范围（度）', lookUpLimitInput),
      createLabField('向下观察范围（度）', lookDownLimitInput),
      createLabField('拖拽灵敏度倍率', sensitivityInput),
      createLabField('观察平滑响应（1/秒，0=立即）', smoothingInput),
      autoRecenterToggle.row,
      createLabField('回正耗时（秒）', recenterDurationInput),
      recenterActions,
      status,
      debug,
    );

    const previousMode = context.cameraController.state.mode;
    let current: LoadedDungeonReferences | null = null;
    let tileTopOffset = 0;
    let lastDebugTime = 0;
    let dragPointerId: number | null = null;
    let currentYawOffset = 0;
    let currentPitchOffset = 0;
    let targetYawOffset = 0;
    let targetPitchOffset = 0;
    let recenterElapsed = 0;
    let recenterDuration = 0;
    let recenterFromYaw = 0;
    let recenterFromPitch = 0;
    let recentering = false;
    const eyePosition = Vector3.Zero();
    const pose = { position: eyePosition, yaw: 0, pitch: 0 };

    const updateTileTopOffset = (): void => {
      if (!current) {
        tileTopOffset = 0;
        return;
      }
      const runtime = current.runtime;
      const layout = resolveDungeonMapTileWorldLayout(
        current.spawn.sceneEnvironmentComponent,
        runtime.map.width,
        runtime.map.height,
        runtime.playerPosition.tileX,
        runtime.playerPosition.tileY,
      );
      tileTopOffset = layout.size[1] / 2;
    };

    const binding = {
      readPose: () => {
        if (!enabledToggle.input.checked || !current) return null;
        const [x, y, z] = current.runtime.playerWorldPosition;
        eyePosition.set(x, y + tileTopOffset + readClampedNumber(eyeHeightInput, 1.65), z);
        pose.yaw = current.runtime.playerWorldRotationY + currentYawOffset;
        pose.pitch = degToRad(readClampedNumber(pitchInput, 0)) + currentPitchOffset;
        return pose;
      },
    };

    const cancelRecenter = (): void => { recentering = false; };
    const recenterImmediately = (): void => {
      cancelRecenter();
      currentYawOffset = 0;
      currentPitchOffset = 0;
      targetYawOffset = 0;
      targetPitchOffset = 0;
      context.cameraController.applyPose();
      refreshDebug(true);
    };
    const startSmoothRecenter = (): boolean => {
      targetYawOffset = 0;
      targetPitchOffset = 0;
      recenterFromYaw = currentYawOffset;
      recenterFromPitch = currentPitchOffset;
      recenterElapsed = 0;
      recenterDuration = readClampedNumber(recenterDurationInput, 0.3);
      recentering = recenterDuration > 0
        && (Math.abs(currentYawOffset) > 1e-5 || Math.abs(currentPitchOffset) > 1e-5);
      if (!recentering) recenterImmediately();
      return recentering;
    };

    const finishDragging = (pointerId: number): void => {
      if (dragPointerId !== pointerId) return;
      dragPointerId = null;
      if (context.canvas.hasPointerCapture(pointerId)) context.canvas.releasePointerCapture(pointerId);
      const startedRecenter = autoRecenterToggle.input.checked && startSmoothRecenter();
      status.textContent = autoRecenterToggle.input.checked
        ? startedRecenter
          ? '拖拽结束，正在平滑回正；玩家朝向保持不变。'
          : '拖拽结束，镜头已经位于玩家正前方。'
        : '拖拽结束，保留当前观察偏移；玩家朝向保持不变。';
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0 || !enabledToggle.input.checked || !freeLookToggle.input.checked) return;
      dragPointerId = event.pointerId;
      cancelRecenter();
      context.canvas.setPointerCapture(event.pointerId);
      status.textContent = '正在自由观察；只改变镜头偏移，不改变玩家朝向。';
      event.preventDefault();
    };
    const onPointerMove = (event: PointerEvent): void => {
      if (dragPointerId !== event.pointerId) return;
      const sensitivity = readClampedNumber(sensitivityInput, 1) * 0.0025;
      const horizontalLimit = degToRad(readClampedNumber(horizontalLimitInput, 60));
      const upLimit = degToRad(readClampedNumber(lookUpLimitInput, 60));
      const downLimit = degToRad(readClampedNumber(lookDownLimitInput, 45));
      targetYawOffset = clamp(targetYawOffset + event.movementX * sensitivity, -horizontalLimit, horizontalLimit);
      targetPitchOffset = clamp(targetPitchOffset - event.movementY * sensitivity, -downLimit, upLimit);
      event.preventDefault();
    };
    const onPointerUp = (event: PointerEvent): void => finishDragging(event.pointerId);
    const onLostPointerCapture = (event: PointerEvent): void => finishDragging(event.pointerId);

    context.canvas.addEventListener('pointerdown', onPointerDown);
    context.canvas.addEventListener('pointermove', onPointerMove);
    context.canvas.addEventListener('pointerup', onPointerUp);
    context.canvas.addEventListener('pointercancel', onPointerUp);
    context.canvas.addEventListener('lostpointercapture', onLostPointerCapture);

    const syncBinding = (): void => {
      if (enabledToggle.input.checked) {
        context.cameraController.bindFirstPersonPose(binding);
        context.cameraController.setMode('firstPerson');
        status.textContent = current
          ? '已由 Dungeon Runtime 驱动位置与朝向；Camera 原生 WASD 不参与移动。'
          : '第一人称绑定已开启，等待 Dungeon Runtime。';
      } else {
        context.cameraController.bindFirstPersonPose(null);
        status.textContent = '第一人称姿态绑定已关闭，可从 Camera 面板自由切换模式。';
      }
    };

    const refreshDebug = (force = false): void => {
      const now = performance.now();
      if (!force && now - lastDebugTime < 100) return;
      lastDebugTime = now;
      const camera = context.cameraController.activeCamera;
      debug.textContent = JSON.stringify({
        bindingEnabled: enabledToggle.input.checked,
        cameraMode: context.cameraController.state.mode,
        mapId: current?.map.id ?? null,
        playerTile: current?.runtime.playerPosition ?? null,
        playerFacing: current?.runtime.playerFacing ?? null,
        playerWorldPosition: current?.runtime.playerWorldPosition ?? null,
        playerYawDeg: current ? radToDeg(current.runtime.playerWorldRotationY) : null,
        tileTopOffset,
        eyeHeight: readClampedNumber(eyeHeightInput, 1.65),
        freeLookEnabled: freeLookToggle.input.checked,
        dragging: dragPointerId !== null,
        recentering,
        autoRecenterOnRelease: autoRecenterToggle.input.checked,
        currentYawOffsetDeg: radToDeg(currentYawOffset),
        currentPitchOffsetDeg: radToDeg(currentPitchOffset),
        targetYawOffsetDeg: radToDeg(targetYawOffset),
        targetPitchOffsetDeg: radToDeg(targetPitchOffset),
        cameraPosition: [camera.position.x, camera.position.y, camera.position.z],
        cameraYawDeg: radToDeg(camera.rotation.y),
        cameraPitchDeg: radToDeg(-camera.rotation.x),
      }, null, 2);
    };

    enabledToggle.input.addEventListener('change', () => {
      if (!enabledToggle.input.checked && dragPointerId !== null) finishDragging(dragPointerId);
      syncBinding();
      refreshDebug(true);
    });
    freeLookToggle.input.addEventListener('change', () => {
      if (!freeLookToggle.input.checked) {
        if (dragPointerId !== null) finishDragging(dragPointerId);
        const startedRecenter = startSmoothRecenter();
        status.textContent = startedRecenter
          ? '自由观察已关闭，镜头正在回到玩家正前方。'
          : '自由观察已关闭，镜头已经位于玩家正前方。';
      }
      refreshDebug(true);
    });
    eyeHeightInput.addEventListener('input', () => {
      context.cameraController.applyPose();
      refreshDebug(true);
    });
    pitchInput.addEventListener('input', () => {
      context.cameraController.applyPose();
      refreshDebug(true);
    });
    smoothRecenterButton.addEventListener('click', () => {
      status.textContent = startSmoothRecenter()
        ? '正在平滑回正；玩家朝向保持不变。'
        : '镜头已经位于玩家正前方。';
    });
    immediateRecenterButton.addEventListener('click', () => {
      recenterImmediately();
      status.textContent = '镜头已立即回正；玩家朝向保持不变。';
    });

    const frameObserver = context.scene.onBeforeRenderObservable.add(() => {
      const deltaSeconds = Math.min(0.1, Math.max(0, context.engine.getDeltaTime() / 1000));
      if (recentering) {
        recenterElapsed += deltaSeconds;
        const progress = clamp(recenterElapsed / recenterDuration, 0, 1);
        const eased = 1 - (1 - progress) ** 3;
        currentYawOffset = recenterFromYaw * (1 - eased);
        currentPitchOffset = recenterFromPitch * (1 - eased);
        if (progress >= 1) {
          currentYawOffset = 0;
          currentPitchOffset = 0;
          recentering = false;
          status.textContent = '镜头已平滑回正；玩家朝向保持不变。';
        }
      } else {
        const response = readClampedNumber(smoothingInput, 18);
        const alpha = response <= 0 ? 1 : 1 - Math.exp(-response * deltaSeconds);
        currentYawOffset += (targetYawOffset - currentYawOffset) * alpha;
        currentPitchOffset += (targetPitchOffset - currentPitchOffset) * alpha;
      }
      if (enabledToggle.input.checked) {
        if (context.cameraController.state.mode !== 'firstPerson') {
          context.cameraController.setMode('firstPerson');
        } else context.cameraController.applyPose();
      }
      refreshDebug();
    });
    const offMapChanged = context.communication.on(dungeonMapChangedEvent, (changed) => {
      const loaded = references.current;
      if (!loaded || loaded.loadId !== changed.loadId) return;
      current = loaded;
      updateTileTopOffset();
      syncBinding();
      refreshDebug(true);
    });

    syncBinding();
    refreshDebug(true);
    return () => {
      offMapChanged();
      context.scene.onBeforeRenderObservable.remove(frameObserver);
      context.canvas.removeEventListener('pointerdown', onPointerDown);
      context.canvas.removeEventListener('pointermove', onPointerMove);
      context.canvas.removeEventListener('pointerup', onPointerUp);
      context.canvas.removeEventListener('pointercancel', onPointerUp);
      context.canvas.removeEventListener('lostpointercapture', onLostPointerCapture);
      if (dragPointerId !== null && context.canvas.hasPointerCapture(dragPointerId)) {
        context.canvas.releasePointerCapture(dragPointerId);
      }
      context.cameraController.bindFirstPersonPose(null);
      context.cameraController.setMode(previousMode);
    };
  },
};
