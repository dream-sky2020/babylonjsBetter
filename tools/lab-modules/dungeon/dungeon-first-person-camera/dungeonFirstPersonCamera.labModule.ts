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
import {
  dungeonPlayerCameraModeChangedEvent,
  type DungeonPlayerCameraMode,
} from '../dungeon-player-camera/dungeonPlayerCamera.protocol';
import {
  DUNGEON_PLAYER_CAMERA_SERVICE_KEY,
  type DungeonPlayerCameraService,
} from '../dungeon-player-camera/dungeonPlayerCamera.references';

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

const createModeSelect = (): HTMLSelectElement => {
  const select = document.createElement('select');
  select.append(
    new Option('DRPG 第一人称', 'first-person'),
    new Option('第三人称俯视', 'overhead'),
  );
  return select;
};

export const dungeonPlayerCameraLabModule: LabModule = {
  id: 'dungeon-player-camera',
  dependencies: ['player-movement'],
  setup(context) {
    const references = context.services.get<DungeonMapLoaderReferences>(
      DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY,
    );
    const panel = context.ui.addPanel('dungeon-player-camera', 'Dungeon 玩家相机');
    const enabledToggle = createLabSwitch('绑定相机到玩家', true, {
      preference: { ui: context.ui, key: 'dungeon-player-camera/enabled' },
    });
    const modeSelect = createModeSelect();
    const switchModeButton = document.createElement('button');
    switchModeButton.type = 'button';
    switchModeButton.textContent = '切换视角（V）';
    const keyboardToggle = createLabSwitch('启用 V 键切换视角', true, {
      preference: { ui: context.ui, key: 'dungeon-player-camera/keyboard-enabled' },
    });
    const keyboardInterceptToggle = createLabSwitch('处理后拦截低优先级输入', true);
    const keyboardPreventDefaultToggle = createLabSwitch('阻止浏览器默认行为', true);
    const keyboardPriorityInput = createNumberInput(90, -1000, 1000, 1);
    const keyboardOwnershipStatus = createLabStatus('V 键消费者尚未注册。');
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
    const overheadDistanceInput = createNumberInput(32, 4, 120, 1);
    const overheadPitchInput = createNumberInput(55, 15, 85, 1);
    const overheadYawInput = createNumberInput(0, -180, 180, 1);
    const overheadTargetHeightInput = createNumberInput(0.8, -10, 20, 0.1);
    const overheadFollowInput = createNumberInput(14, 0, 60, 1);
    const status = createLabStatus('等待 Dungeon Runtime。');
    const debug = createLabJson();
    panel.content.append(
      enabledToggle.row,
      createLabField('当前玩家视角', modeSelect),
      switchModeButton,
      keyboardToggle.row,
      createLabField('V 键输入优先级', keyboardPriorityInput),
      keyboardInterceptToggle.row,
      keyboardPreventDefaultToggle.row,
      keyboardOwnershipStatus,
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
      createLabField('俯视距离', overheadDistanceInput),
      createLabField('俯视仰角（度）', overheadPitchInput),
      createLabField('俯视水平朝向（度，0=北朝上）', overheadYawInput),
      createLabField('俯视目标高度', overheadTargetHeightInput),
      createLabField('俯视跟随响应（0=立即）', overheadFollowInput),
      status,
      debug,
    );

    const previousMode = context.cameraController.state.mode;
    let current: LoadedDungeonReferences | null = null;
    let activeMode = modeSelect.value as DungeonPlayerCameraMode;
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
    const overheadTarget = Vector3.Zero();
    const desiredOverheadTarget = Vector3.Zero();
    let overheadTargetInitialized = false;

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
        if (!enabledToggle.input.checked || activeMode !== 'first-person' || !current) return null;
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
      if (event.button !== 0 || !enabledToggle.input.checked
        || activeMode !== 'first-person' || !freeLookToggle.input.checked) return;
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

    const applyOverheadPose = (deltaSeconds: number, snap = false): void => {
      if (!current) return;
      const [x, y, z] = current.runtime.playerWorldPosition;
      desiredOverheadTarget.set(
        x,
        y + tileTopOffset + readClampedNumber(overheadTargetHeightInput, 0.8),
        z,
      );
      if (snap || !overheadTargetInitialized) {
        overheadTarget.copyFrom(desiredOverheadTarget);
        overheadTargetInitialized = true;
      } else {
        const response = readClampedNumber(overheadFollowInput, 14);
        const alpha = response <= 0 ? 1 : 1 - Math.exp(-response * deltaSeconds);
        Vector3.LerpToRef(overheadTarget, desiredOverheadTarget, alpha, overheadTarget);
      }
      const cameraState = context.cameraController.state;
      cameraState.orbitCenter.copyFrom(overheadTarget);
      cameraState.orbitYaw = degToRad(readClampedNumber(overheadYawInput, 0));
      cameraState.orbitPitchDeg = readClampedNumber(overheadPitchInput, 55);
      cameraState.orbitRadius = readClampedNumber(overheadDistanceInput, 32);
      if (cameraState.mode !== 'orbit') context.cameraController.setMode('orbit');
      else context.cameraController.applyPose();
    };

    const syncBinding = (snapOverhead = false): void => {
      if (enabledToggle.input.checked && activeMode === 'first-person') {
        context.cameraController.bindFirstPersonPose(binding);
        context.cameraController.setMode('firstPerson');
        status.textContent = current
          ? '已由 Dungeon Runtime 驱动位置与朝向；Camera 原生 WASD 不参与移动。'
          : '第一人称绑定已开启，等待 Dungeon Runtime。';
      } else if (enabledToggle.input.checked) {
        context.cameraController.bindFirstPersonPose(null);
        applyOverheadPose(0, snapOverhead);
        status.textContent = current
          ? '第三人称俯视跟随玩家；移动输入仍使用地图绝对方向。'
          : '俯视绑定已开启，等待 Dungeon Runtime。';
      } else {
        context.cameraController.bindFirstPersonPose(null);
        status.textContent = '玩家相机绑定已关闭，可从 Camera 面板自由切换模式。';
      }
    };

    const setPlayerCameraMode = (
      mode: DungeonPlayerCameraMode,
      reason: 'ui' | 'keyboard' | 'service',
    ): void => {
      if (activeMode === mode) return;
      const previousPlayerMode = activeMode;
      activeMode = mode;
      modeSelect.value = mode;
      if (dragPointerId !== null) finishDragging(dragPointerId);
      recenterImmediately();
      overheadTargetInitialized = false;
      syncBinding(mode === 'overhead');
      void context.communication.publish(dungeonPlayerCameraModeChangedEvent, {
        mode,
        previousMode: previousPlayerMode,
        reason,
      });
      refreshDebug(true);
    };

    const togglePlayerCameraMode = (reason: 'ui' | 'keyboard' | 'service'): void => {
      setPlayerCameraMode(activeMode === 'first-person' ? 'overhead' : 'first-person', reason);
    };

    const cameraService: DungeonPlayerCameraService = {
      get mode() { return activeMode; },
      setMode: (mode) => setPlayerCameraMode(mode, 'service'),
      toggleMode: () => togglePlayerCameraMode('service'),
    };
    context.services.set(DUNGEON_PLAYER_CAMERA_SERVICE_KEY, cameraService);

    const refreshDebug = (force = false): void => {
      const now = performance.now();
      if (!force && now - lastDebugTime < 250) return;
      lastDebugTime = now;
      const camera = context.cameraController.activeCamera;
      debug.textContent = JSON.stringify({
        bindingEnabled: enabledToggle.input.checked,
        playerCameraMode: activeMode,
        cameraMode: context.cameraController.state.mode,
        mapId: current?.runtime.map.id ?? null,
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
        overheadTarget: overheadTargetInitialized ? overheadTarget.asArray() : null,
        cameraPosition: [camera.position.x, camera.position.y, camera.position.z],
        cameraYawDeg: radToDeg(camera.rotation.y),
        cameraPitchDeg: radToDeg(-camera.rotation.x),
      }, null, 2);
    };

    enabledToggle.input.addEventListener('change', () => {
      if (!enabledToggle.input.checked && dragPointerId !== null) finishDragging(dragPointerId);
      syncBinding(activeMode === 'overhead');
      refreshDebug(true);
    });
    modeSelect.addEventListener('change', () => {
      setPlayerCameraMode(modeSelect.value as DungeonPlayerCameraMode, 'ui');
    });
    switchModeButton.addEventListener('click', () => togglePlayerCameraMode('ui'));
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
    for (const input of [
      overheadDistanceInput,
      overheadPitchInput,
      overheadYawInput,
      overheadTargetHeightInput,
      overheadFollowInput,
    ]) {
      input.addEventListener('input', () => {
        if (activeMode === 'overhead') applyOverheadPose(0);
        refreshDebug(true);
      });
    }

    const keyboardRegistration = context.keyboard.register({
      id: 'dungeon-player-camera',
      label: 'Dungeon 玩家相机切换',
      keys: ['KeyV'],
      enabled: keyboardToggle.input.checked,
      priority: Number(keyboardPriorityInput.value),
      intercept: keyboardInterceptToggle.input.checked,
      preventDefault: keyboardPreventDefaultToggle.input.checked,
      // Controller 参数常用 number/select；这些控件聚焦时 V 仍应是全局视角快捷键。
      // 真正的文本编辑控件仍保留 V 给用户输入。
      allowWhenEditing: true,
      onKeyDown: (event) => {
        const target = event.nativeEvent?.target;
        if (target instanceof HTMLTextAreaElement
          || (target instanceof HTMLElement && target.isContentEditable)
          || (target instanceof HTMLInputElement
            && !['number', 'range', 'checkbox', 'radio', 'button', 'submit', 'reset'].includes(target.type))) {
          return 'ignored';
        }
        if (!event.repeat) togglePlayerCameraMode('keyboard');
        return 'handled';
      },
      onOwnershipChanged: (ownedCodes) => {
        keyboardOwnershipStatus.textContent = ownedCodes.has('KeyV')
          ? '当前优先拥有：KeyV。'
          : '当前未拥有 KeyV；请检查全局键盘开关、输入锁或更高优先级消费者。';
      },
    });
    keyboardToggle.input.addEventListener('change', () => {
      keyboardRegistration.setEnabled(keyboardToggle.input.checked);
    });
    keyboardPriorityInput.addEventListener('input', () => {
      const value = Number(keyboardPriorityInput.value);
      if (Number.isFinite(value)) keyboardRegistration.setPriority(value);
    });
    keyboardInterceptToggle.input.addEventListener('change', () => {
      keyboardRegistration.setIntercept(keyboardInterceptToggle.input.checked);
    });
    keyboardPreventDefaultToggle.input.addEventListener('change', () => {
      keyboardRegistration.setPreventDefault(keyboardPreventDefaultToggle.input.checked);
    });
    const syncKeyboardControls = () => {
      const settings = context.keyboard.getConsumer(keyboardRegistration.id);
      if (!settings) return;
      keyboardToggle.input.checked = settings.enabled;
      keyboardPriorityInput.value = String(settings.priority);
      keyboardInterceptToggle.input.checked = settings.intercept;
      keyboardPreventDefaultToggle.input.checked = settings.preventDefault;
    };
    const offKeyboardChanged = context.keyboard.subscribe(syncKeyboardControls);
    syncKeyboardControls();

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
        if (activeMode === 'first-person') {
          if (context.cameraController.state.mode !== 'firstPerson') {
            context.cameraController.setMode('firstPerson');
          } else context.cameraController.applyPose();
        } else applyOverheadPose(deltaSeconds);
      }
      refreshDebug();
    });
    const offMapChanged = context.communication.on(dungeonMapChangedEvent, (changed) => {
      const loaded = references.current;
      if (!loaded || loaded.loadId !== changed.loadId) return;
      current = loaded;
      updateTileTopOffset();
      overheadTargetInitialized = false;
      syncBinding(true);
      refreshDebug(true);
    });

    syncBinding();
    refreshDebug(true);
    return () => {
      offMapChanged();
      keyboardRegistration.dispose();
      offKeyboardChanged();
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

/** @deprecated 新 Lab 应使用 dungeon-player-camera；此 ID 仅保留旧组合配置兼容。 */
export const dungeonFirstPersonCameraLabModule: LabModule = {
  ...dungeonPlayerCameraLabModule,
  id: 'dungeon-first-person-camera',
};
