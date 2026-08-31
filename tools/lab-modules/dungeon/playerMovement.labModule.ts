import { Color3, MeshBuilder, StandardMaterial, TransformNode } from '@babylonjs/core';
import {
  startDungeonPlayerMovement,
  startDungeonPlayerRelativeMovement,
  startDungeonPlayerTurn,
  updateDungeonPlayerMovement,
  type DungeonPlayerMovementOptions,
  type DungeonPlayerRelativeMovement,
  type DungeonPlayerMovementTimingMode,
  type DungeonPlayerTurn,
  type DungeonPlayerTurnTimingMode,
} from '@/core/dungeon-player-movement';
import type { DungeonMapDirection } from '@/core/map';
import { setDungeonRuntimePlayerPosition } from '@/core/dungeon-runtime';
import { resolveDungeonMapTileWorldLayout } from '@/core/scene';
import {
  createLabField,
  createLabJson,
  createLabStatus,
  createLabSwitch,
  type LabModule,
} from '@/tools/lab-kit';
import type { DungeonObstaclesReadyEvent } from './dungeonLab.types';

const createNumberInput = (value: number, min: number, step: number): HTMLInputElement => {
  const input = document.createElement('input');
  input.type = 'number';
  input.value = String(value);
  input.min = String(min);
  input.step = String(step);
  return input;
};

const readPositiveNumber = (input: HTMLInputElement, fallback: number): number => {
  const value = Number(input.value);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const createModeSelect = <T extends string>(options: ReadonlyArray<readonly [T, string]>): HTMLSelectElement => {
  const select = document.createElement('select');
  select.replaceChildren(...options.map(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  }));
  return select;
};

export const playerMovementLabModule: LabModule = {
  id: 'player-movement',
  dependencies: ['dungeon-grid-debug', 'dungeon-obstacle'],
  setup(context) {
    const panel = context.ui.addPanel('player-movement', '玩家移动');
    const boundsToggle = createLabSwitch('限制玩家不能移出地图', true);
    const obstacleToggle = createLabSwitch('限制玩家不能跨越障碍', true);
    const teleportToggle = createLabSwitch('瞬移（跳过逐帧过渡）');
    const movementTimingSelect = createModeSelect<DungeonPlayerMovementTimingMode>([
      ['world-units-per-second', '每秒移动多少世界单位'],
      ['seconds-per-tile', '移动一格需要多少秒'],
    ]);
    const movementTimingInput = createNumberInput(6, 0.01, 0.1);
    const turnTimingSelect = createModeSelect<DungeonPlayerTurnTimingMode>([
      ['radians-per-second', '每秒转动多少度'],
      ['seconds-per-turn', '每次转向需要多少秒'],
    ]);
    const turnTimingInput = createNumberInput(360, 0.01, 0.1);
    const controls = document.createElement('div');
    controls.className = 'lab-movement-grid';
    const directions: ReadonlyArray<readonly [DungeonMapDirection, string]> = [
      ['north', '↑ 北'], ['west', '← 西'], ['south', '↓ 南'], ['east', '→ 东'],
    ];
    directions.forEach(([direction, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.move = direction;
      button.textContent = label;
      controls.append(button);
    });
    const relativeControls = document.createElement('div');
    relativeControls.className = 'lab-relative-movement-grid';
    const relativeMovements: ReadonlyArray<readonly [DungeonPlayerRelativeMovement, string]> = [
      ['forward', '↑ 前进'], ['left', '← 向左'], ['backward', '↓ 后退'], ['right', '→ 向右'],
    ];
    relativeMovements.forEach(([movement, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.relativeMove = movement;
      button.textContent = label;
      relativeControls.append(button);
    });
    const turnControls = document.createElement('div');
    turnControls.className = 'lab-turn-grid';
    const turns: ReadonlyArray<readonly [DungeonPlayerTurn, string]> = [
      ['left', '↶ 左转'], ['back', '↺ 后转'], ['right', '↷ 右转'],
    ];
    turns.forEach(([turn, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.turn = turn;
      button.textContent = label;
      turnControls.append(button);
    });
    const teleportPositionControls = document.createElement('div');
    teleportPositionControls.className = 'lab-player-movement-teleport';
    const teleportXInput = createNumberInput(0, 0, 1);
    const teleportYInput = createNumberInput(0, 0, 1);
    teleportXInput.placeholder = 'X';
    teleportXInput.setAttribute('aria-label', '目标格 X');
    teleportYInput.placeholder = 'Y';
    teleportYInput.setAttribute('aria-label', '目标格 Y');
    const teleportPositionButton = document.createElement('button');
    teleportPositionButton.type = 'button';
    teleportPositionButton.textContent = '瞬移到指定位置';
    teleportPositionControls.append(teleportXInput, teleportYInput, teleportPositionButton);
    const status = createLabStatus('尚未创建 DungeonRuntime。');
    const runtimeJson = createLabJson();
    const movementTimingField = createLabField('移动速度（世界单位/秒）', movementTimingInput);
    const turnTimingField = createLabField('转向速度（度/秒）', turnTimingInput);
    const movementTimingValues: Record<DungeonPlayerMovementTimingMode, string> = {
      'world-units-per-second': '6',
      'seconds-per-tile': '1',
    };
    const turnTimingValues: Record<DungeonPlayerTurnTimingMode, string> = {
      'radians-per-second': '360',
      'seconds-per-turn': '0.25',
    };
    let activeMovementTimingMode: DungeonPlayerMovementTimingMode = 'world-units-per-second';
    let activeTurnTimingMode: DungeonPlayerTurnTimingMode = 'radians-per-second';
    const setFieldLabel = (field: HTMLLabelElement, label: string) => {
      const text = field.querySelector('span');
      if (text) text.textContent = label;
    };
    const syncTimingInputs = () => {
      activeMovementTimingMode = movementTimingSelect.value as DungeonPlayerMovementTimingMode;
      const movementByTile = activeMovementTimingMode === 'seconds-per-tile';
      movementTimingInput.value = movementTimingValues[activeMovementTimingMode];
      movementTimingInput.step = movementByTile ? '0.05' : '0.1';
      setFieldLabel(movementTimingField, movementByTile ? '每格移动耗时（秒）' : '移动速度（世界单位/秒）');
      activeTurnTimingMode = turnTimingSelect.value as DungeonPlayerTurnTimingMode;
      const turnByAction = activeTurnTimingMode === 'seconds-per-turn';
      turnTimingInput.value = turnTimingValues[activeTurnTimingMode];
      turnTimingInput.step = turnByAction ? '0.05' : '15';
      setFieldLabel(turnTimingField, turnByAction ? '每次转向耗时（秒）' : '转向速度（度/秒）');
    };
    movementTimingInput.addEventListener('input', () => {
      movementTimingValues[activeMovementTimingMode] = movementTimingInput.value;
    });
    turnTimingInput.addEventListener('input', () => {
      turnTimingValues[activeTurnTimingMode] = turnTimingInput.value;
    });
    movementTimingSelect.addEventListener('change', syncTimingInputs);
    turnTimingSelect.addEventListener('change', syncTimingInputs);
    panel.content.append(
      boundsToggle.row,
      obstacleToggle.row,
      teleportToggle.row,
      createLabField('移动计时模式', movementTimingSelect),
      movementTimingField,
      createLabField('转向计时模式', turnTimingSelect),
      turnTimingField,
      createLabField('东南西北绝对移动', controls),
      createLabField('相对当前朝向移动', relativeControls),
      createLabField('原地转向', turnControls),
      createLabField('指定格坐标（X / Y）', teleportPositionControls),
      status,
      runtimeJson,
    );

    const readTimingOptions = (): Pick<
      DungeonPlayerMovementOptions,
      'movementTimingMode' | 'movementSpeed' | 'movementSecondsPerTile'
      | 'turnTimingMode' | 'turnSpeed' | 'turnSecondsPerAction'
    > => {
      const movementTimingMode = movementTimingSelect.value as DungeonPlayerMovementTimingMode;
      const turnTimingMode = turnTimingSelect.value as DungeonPlayerTurnTimingMode;
      return {
        movementTimingMode,
        movementSpeed: movementTimingMode === 'world-units-per-second'
          ? readPositiveNumber(movementTimingInput, 6) : undefined,
        movementSecondsPerTile: movementTimingMode === 'seconds-per-tile'
          ? readPositiveNumber(movementTimingInput, 1) : undefined,
        turnTimingMode,
        turnSpeed: turnTimingMode === 'radians-per-second'
          ? readPositiveNumber(turnTimingInput, 360) * Math.PI / 180 : undefined,
        turnSecondsPerAction: turnTimingMode === 'seconds-per-turn'
          ? readPositiveNumber(turnTimingInput, 0.25) : undefined,
      };
    };

    let current: DungeonObstaclesReadyEvent | null = null;
    let markerRoot: TransformNode | null = null;
    let markerVerticalOffset = 0;
    let lastJsonUpdateTime = 0;

    const disposeMarker = () => {
      markerRoot?.dispose(false, true);
      markerRoot = null;
    };

    const createMarker = (event: DungeonObstaclesReadyEvent) => {
      disposeMarker();
      const layout = resolveDungeonMapTileWorldLayout(
        event.spawn.sceneEnvironmentComponent,
        event.runtime.map.width,
        event.runtime.map.height,
        event.runtime.playerPosition.tileX,
        event.runtime.playerPosition.tileY,
      );
      const tileShortSide = Math.min(layout.size[0], layout.size[2]);
      const markerHeight = Math.max(layout.size[1] * 1.5, 1.2);
      markerVerticalOffset = layout.size[1] / 2;
      markerRoot = new TransformNode('composable_player_pose', context.scene);
      const playerMaterial = new StandardMaterial('composable_player_debug_material', context.scene);
      playerMaterial.diffuseColor = Color3.FromHexString('#35c76f');
      playerMaterial.emissiveColor = Color3.FromHexString('#0b542c');

      const bodyBottomDiameter = Math.min(tileShortSide * 1.78, markerHeight * 0.72);
      const body = MeshBuilder.CreateCylinder('composable_player_body_cone', {
        height: markerHeight,
        diameterTop: markerHeight * 0.14,
        diameterBottom: bodyBottomDiameter,
        tessellation: 24,
      }, context.scene);
      body.position.y = markerVerticalOffset + markerHeight / 2;
      body.material = playerMaterial;
      body.parent = markerRoot;
      body.isPickable = false;

      const headDiameter = markerHeight * 0.72;
      const head = MeshBuilder.CreateSphere('composable_player_head', {
        diameter: headDiameter,
        segments: 16,
      }, context.scene);
      head.position.y = markerVerticalOffset + markerHeight + headDiameter * 0.45;
      head.material = playerMaterial;
      head.parent = markerRoot;
      head.isPickable = false;

      const facingMaterial = new StandardMaterial('composable_player_facing_material', context.scene);
      facingMaterial.diffuseColor = Color3.FromHexString('#8cffb7');
      facingMaterial.emissiveColor = Color3.FromHexString('#168f49');
      const facingLength = Math.min(tileShortSide * 0.22, markerHeight * 1.18);
      const facingPyramid = MeshBuilder.CreateCylinder('composable_player_facing_pyramid', {
        height: facingLength,
        diameterTop: 0,
        diameterBottom: Math.min(tileShortSide * 0.16, markerHeight * 0.62),
        tessellation: 4,
      }, context.scene);
      facingPyramid.rotation.x = Math.PI / 2;
      facingPyramid.position.set(
        0,
        markerVerticalOffset + markerHeight * 0.72,
        bodyBottomDiameter / 2 + facingLength / 2 + tileShortSide * 0.14,
      );
      facingPyramid.material = facingMaterial;
      facingPyramid.parent = markerRoot;
      facingPyramid.isPickable = false;
      facingPyramid.enableEdgesRendering();
      facingPyramid.edgesColor.set(0.55, 1, 0.72, 1);
      facingPyramid.edgesWidth = 2;
    };

    const refreshRuntimeJson = (force = false) => {
      if (!current) return;
      const now = performance.now();
      if (!force && now - lastJsonUpdateTime < 80) return;
      lastJsonUpdateTime = now;
      runtimeJson.textContent = JSON.stringify({
        mapId: current.runtime.map.id,
        playerPosition: current.runtime.playerPosition,
        playerFacing: current.runtime.playerFacing,
        playerWorldPosition: current.runtime.playerWorldPosition,
        playerWorldRotationY: current.runtime.playerWorldRotationY,
        playerMovement: current.runtime.playerMovement,
        obstacleStates: Object.fromEntries(current.runtime.obstacleStates),
      }, null, 2);
    };

    const syncMarker = () => {
      if (!current || !markerRoot) return;
      markerRoot.position.set(...current.runtime.playerWorldPosition);
      markerRoot.rotation.y = current.runtime.playerWorldRotationY;
      refreshRuntimeJson();
    };

    const resolveWorldPosition = (event: DungeonObstaclesReadyEvent) => (
      position: Readonly<{ tileX: number; tileY: number }>,
    ): readonly [number, number, number] => resolveDungeonMapTileWorldLayout(
      event.spawn.sceneEnvironmentComponent,
      event.runtime.map.width,
      event.runtime.map.height,
      position.tileX,
      position.tileY,
    ).center;

    const move = (direction: DungeonMapDirection) => {
      if (!current) return;
      const event = current;
      const result = startDungeonPlayerMovement(event.runtime, direction, {
        restrictToMapBounds: boundsToggle.input.checked,
        restrictMovementObstacles: obstacleToggle.input.checked,
        ...readTimingOptions(),
        teleport: teleportToggle.input.checked,
        resolveWorldPosition: resolveWorldPosition(event),
      });
      if (!result.started) {
        status.textContent = result.blockedReason === 'movement-obstacle'
          ? `移动被阻碍挡住：${result.blockedObstacleIds?.join('、') ?? '未知阻碍'}。`
          : result.blockedReason === 'movement-in-progress'
            ? '玩家仍在上一次移动过程中。'
            : `移动被地图边界阻挡：目标格 (${result.to.tileX}, ${result.to.tileY})。`;
        return;
      }
      syncMarker();
      refreshRuntimeJson(true);
      status.textContent = result.blockedReason === 'movement-obstacle'
        ? `玩家尝试向 ${direction} 移动，即将被阻碍挡回：${result.blockedObstacleIds?.join('、') ?? '未知阻碍'}。`
        : result.blockedReason === 'map-boundary'
          ? `玩家尝试向 ${direction} 移动，即将被地图边界挡回。`
        : result.completed
        ? `玩家瞬移到 (${result.to.tileX}, ${result.to.tileY})，朝向 ${direction}。`
        : `开始移动到 (${result.to.tileX}, ${result.to.tileY})，同时转向 ${direction}。`;
      if (result.completed) {
        void context.events.emit('dungeon:runtime-changed', { reason: 'player-movement-completed', runtime: event.runtime });
      }
    };

    const turnPlayer = (turn: DungeonPlayerTurn) => {
      if (!current) return;
      const event = current;
      const result = startDungeonPlayerTurn(event.runtime, turn, {
        ...readTimingOptions(),
        teleport: teleportToggle.input.checked,
      });
      if (!result.started) {
        status.textContent = '玩家仍在上一次移动或转向过程中。';
        return;
      }
      syncMarker();
      refreshRuntimeJson(true);
      status.textContent = result.completed
        ? `玩家原地转向完成：${result.fromFacing} → ${result.toFacing}。`
        : `开始原地转向：${result.fromFacing} → ${result.toFacing}。`;
      if (result.completed) {
        void context.events.emit('dungeon:runtime-changed', { reason: 'player-turn-completed', runtime: event.runtime });
      }
    };

    const moveRelative = (movement: DungeonPlayerRelativeMovement) => {
      if (!current) return;
      const event = current;
      const facingBeforeMove = event.runtime.playerFacing;
      const result = startDungeonPlayerRelativeMovement(event.runtime, movement, {
        restrictToMapBounds: boundsToggle.input.checked,
        restrictMovementObstacles: obstacleToggle.input.checked,
        ...readTimingOptions(),
        teleport: teleportToggle.input.checked,
        resolveWorldPosition: resolveWorldPosition(event),
      });
      if (!result.started) {
        status.textContent = result.blockedReason === 'movement-obstacle'
          ? `相对移动被阻碍挡住：${result.blockedObstacleIds?.join('、') ?? '未知阻碍'}。`
          : result.blockedReason === 'movement-in-progress'
            ? '玩家仍在上一次移动或转向过程中。'
            : `相对移动被地图边界阻挡：目标格 (${result.to.tileX}, ${result.to.tileY})。`;
        return;
      }
      syncMarker();
      refreshRuntimeJson(true);
      status.textContent = result.blockedReason === 'movement-obstacle'
        ? `玩家尝试 ${movement}，即将被阻碍挡回：${result.blockedObstacleIds?.join('、') ?? '未知阻碍'}。`
        : result.blockedReason === 'map-boundary'
          ? `玩家尝试 ${movement}，即将被地图边界挡回。`
        : result.completed
        ? `${movement} 瞬移完成：玩家位于 (${result.to.tileX}, ${result.to.tileY})，仍朝向 ${facingBeforeMove}。`
        : `开始 ${movement} 到 (${result.to.tileX}, ${result.to.tileY})，保持朝向 ${facingBeforeMove}。`;
      if (result.completed) {
        void context.events.emit('dungeon:runtime-changed', {
          reason: 'player-relative-movement-completed', runtime: event.runtime,
        });
      }
    };

    const teleportToPosition = () => {
      if (!current) {
        status.textContent = '尚未创建 DungeonRuntime，无法瞬移。';
        return;
      }
      const tileX = Number(teleportXInput.value);
      const tileY = Number(teleportYInput.value);
      if (!Number.isInteger(tileX) || !Number.isInteger(tileY)) {
        status.textContent = '目标位置必须使用整数格坐标。';
        return;
      }
      const event = current;
      try {
        setDungeonRuntimePlayerPosition(event.runtime, { tileX, tileY });
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : '目标位置无效。';
        return;
      }
      const worldPosition = resolveWorldPosition(event)({ tileX, tileY });
      event.runtime.playerWorldPosition = [...worldPosition];
      syncMarker();
      refreshRuntimeJson(true);
      status.textContent = `玩家已瞬移到 (${tileX}, ${tileY})，保持朝向 ${event.runtime.playerFacing}。`;
      void context.events.emit('dungeon:runtime-changed', {
        reason: 'player-position-teleported', runtime: event.runtime,
      });
    };

    controls.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((button) => {
      button.addEventListener('click', () => move(button.dataset.move as DungeonMapDirection));
    });
    turnControls.querySelectorAll<HTMLButtonElement>('[data-turn]').forEach((button) => {
      button.addEventListener('click', () => turnPlayer(button.dataset.turn as DungeonPlayerTurn));
    });
    relativeControls.querySelectorAll<HTMLButtonElement>('[data-relative-move]').forEach((button) => {
      button.addEventListener('click', () => moveRelative(button.dataset.relativeMove as DungeonPlayerRelativeMovement));
    });
    teleportPositionButton.addEventListener('click', teleportToPosition);
    const keyDirections: Readonly<Record<string, DungeonMapDirection>> = {
      ArrowUp: 'north', w: 'north', W: 'north', ArrowRight: 'east', d: 'east', D: 'east',
      ArrowDown: 'south', s: 'south', S: 'south', ArrowLeft: 'west', a: 'west', A: 'west',
    };
    const keyHandler = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
      const direction = keyDirections[event.key];
      if (!direction) return;
      event.preventDefault();
      move(direction);
    };
    window.addEventListener('keydown', keyHandler);

    const frameObserver = context.scene.onBeforeRenderObservable.add(() => {
      if (!current?.runtime.playerMovement) return;
      const movementKind = current.runtime.playerMovement.kind;
      const result = updateDungeonPlayerMovement(current.runtime, context.engine.getDeltaTime() / 1000);
      syncMarker();
      if (result.completed) {
        refreshRuntimeJson(true);
        status.textContent = movementKind === 'blocked'
          ? `移动受阻：玩家退回 (${current.runtime.playerPosition.tileX}, ${current.runtime.playerPosition.tileY})。`
          : movementKind === 'turn'
          ? `原地转向完成：玩家仍位于 (${current.runtime.playerPosition.tileX}, ${current.runtime.playerPosition.tileY})，朝向 ${current.runtime.playerFacing}。`
          : `移动完成：玩家位于 (${current.runtime.playerPosition.tileX}, ${current.runtime.playerPosition.tileY})，朝向 ${current.runtime.playerFacing}。`;
        void context.events.emit('dungeon:runtime-changed', {
          reason: movementKind === 'turn' ? 'player-turn-completed'
            : movementKind === 'blocked' ? 'player-movement-blocked' : 'player-movement-completed',
          runtime: current.runtime,
        });
      }
    });
    const offReady = context.events.on<DungeonObstaclesReadyEvent>('dungeon:obstacles-ready', (event) => {
      current = event;
      teleportXInput.max = String(event.runtime.map.width - 1);
      teleportYInput.max = String(event.runtime.map.height - 1);
      teleportXInput.value = String(event.runtime.playerPosition.tileX);
      teleportYInput.value = String(event.runtime.playerPosition.tileY);
      createMarker(event);
      syncMarker();
      refreshRuntimeJson(true);
      status.textContent = `玩家已在出生格 (${event.runtime.playerPosition.tileX}, ${event.runtime.playerPosition.tileY}) 创建，朝向 ${event.runtime.playerFacing}。`;
    });
    const offChanged = context.events.on('dungeon:runtime-changed', () => refreshRuntimeJson(true));
    return () => {
      offReady();
      offChanged();
      context.scene.onBeforeRenderObservable.remove(frameObserver);
      window.removeEventListener('keydown', keyHandler);
      disposeMarker();
    };
  },
};
