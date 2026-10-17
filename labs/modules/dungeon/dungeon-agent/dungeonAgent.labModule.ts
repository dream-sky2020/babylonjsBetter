import { DUNGEON_AGENT_NAVIGATION_MEMORY } from './dungeonAgentNavigation.memory';
import { DUNGEON_TRAVERSAL_STATE_MEMORY } from '../dungeon-traversal/dungeonTraversal.memory';
import { DUNGEON_MOVEMENT_STATE_MEMORY } from '../dungeon-movement/dungeonMovement.memory';
import { DUNGEON_GRID_MEMORY, type DungeonGridData } from '../dungeon-grid/dungeonGrid.memory';
import { DUNGEON_AGENTS_MEMORY, DUNGEON_AGENT_STATE_MEMORY, type DungeonAgentState } from './dungeonAgent.memory';
import { DUNGEON_AGENT_SETTINGS_MEMORY, DUNGEON_AGENT_CONTROLLER_MEMORY } from './dungeonAgentController.memory';
import { allocateDungeonAgentStorage } from './dungeonAgentStorage.memory';
import { DUNGEON_AGENT_CONTROL_SERVICE_KEY, type DungeonAgentCommands } from '@/core/dungeon-agent/dungeonAgentControl';
import { DungeonAgentSystem } from '@/core/dungeon-agent/dungeonAgentSystem';
import { DUNGEON_PLAYER_STEP_SERVICE_KEY } from '@/core/dungeon-player-movement/dungeonPlayerStepEvents';
import { applyDungeonViewToNode } from '@/core/dungeon-view/dungeonOverheadView.ts';
import { DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY } from '@/core/dungeon-runtime/dungeonRuntimeAssembly';
import { TransformNode } from '@babylonjs/core';
import {
  getDungeonMovementDirectionYaw,
  resolveDungeonMovementProfile,
  type DungeonMovementDirection,
} from '@/core/dungeon-movement';
import {
  createDefaultDungeonAgentControllerRegistry,
  createDefaultDungeonAgentControllerParameters,
  normalizeDungeonAgentTilePointList,
  type DungeonAgentControllerAction,
  type DungeonAgentControllerParameter,
  type DungeonAgentTilePoint,
  type DungeonAgentTurn,
} from '@/core/dungeon-agent';
import { resolveDungeonMapTileWorldLayout } from '@/core/scene';
import {
  createLabField,
  createLabJson,
  createLabStatus,
  createLabSwitch,
  type LabModule,
} from '@/labs/kit';
import {
  dungeonMapChangedEvent,
} from '../dungeon-map-loader/dungeonMapLoader.protocol';
import { DUNGEON_OVERHEAD_VIEW_SERVICE_KEY, type DungeonOverheadViewService } from '../dungeon-overhead-view/dungeonOverheadView.references';
import { createDungeonAgentDebugMarker, type DungeonAgentDebugMarker } from './dungeonAgentDebugMarker';
import { dungeonAgentsChangedEvent, dungeonAgentsLoadedEvent } from './dungeonAgent.protocol';

const FACTION_COLORS: Readonly<Record<string, string>> = {
  hostile: '#ef4444',
  friendly: '#3b82f6',
  neutral: '#f59e0b',
  mechanism: '#a855f7',
};

const createReadonlyInput = (): HTMLInputElement => {
  const input = document.createElement('input');
  input.readOnly = true;
  return input;
};

const createDurationInput = (): HTMLInputElement => {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '0.05';
  input.value = '0.3';
  return input;
};

const shortestAngleDelta = (from: number, to: number): number => {
  const fullTurn = Math.PI * 2;
  return ((to - from + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
};

const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress;

export const dungeonAgentLabModule: LabModule = {
  id: 'dungeon-agent',
  events: [{ definition: dungeonAgentsLoadedEvent, publishes: true }, { definition: dungeonAgentsChangedEvent, publishes: true }],
  dependencies: ['player-movement', 'dungeon-map-loader', 'dungeon-overhead-view'],
  setup(context) {
    const playerSteps = context.services.get(DUNGEON_PLAYER_STEP_SERVICE_KEY);
    const gridMemory = context.memory.acquire(DUNGEON_GRID_MEMORY);
    const descriptionsMemory = context.memory.acquire(DUNGEON_AGENTS_MEMORY);
    const agentStateMemory = context.memory.acquire(DUNGEON_AGENT_STATE_MEMORY);
    const settingsMemory = context.memory.acquire(DUNGEON_AGENT_SETTINGS_MEMORY);
    const controllersMemory = context.memory.acquire(DUNGEON_AGENT_CONTROLLER_MEMORY);
    const navigationMemory = context.memory.acquire(DUNGEON_AGENT_NAVIGATION_MEMORY);
    const traversalMemory = context.memory.acquire(DUNGEON_TRAVERSAL_STATE_MEMORY);
    const movementMemory = context.memory.acquire(DUNGEON_MOVEMENT_STATE_MEMORY);
    const agentControl = context.services.get(DUNGEON_AGENT_CONTROL_SERVICE_KEY);
    const overheadView = context.services.get<DungeonOverheadViewService>(DUNGEON_OVERHEAD_VIEW_SERVICE_KEY);
    const assembly = context.services.get(DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY);
    let prepared: { loadId: number; data: ReturnType<typeof allocateDungeonAgentStorage> } | null = null;
    const offPreparation = assembly.registerPreparation('dungeon-agent', (runtime, loadId) => {
      const data = allocateDungeonAgentStorage(loadId, '', runtime);
      const system = new DungeonAgentSystem(runtime, controllerRegistry, data.storage);
      prepared = { loadId, data };
      return system;
    });
    let agentSystem: DungeonAgentCommands | null = null;

    const panel = context.ui.addPanel('dungeon-agent', '可移动 Dungeon Agent');
    const debugToggle = createLabSwitch('显示 Agent Debug 模型', true, {
      preference: { ui: context.ui, key: 'dungeon-agent/debug-markers' },
    });
    const controllerToggle = createLabSwitch('启用 Agent Controller', true, {
      preference: { ui: context.ui, key: 'dungeon-agent/controllers-enabled' },
    });
    const selectedAgentSelect = document.createElement('select');
    const positionInput = createReadonlyInput();
    const facingInput = createReadonlyInput();
    const movementModeSelect = document.createElement('select');
    movementModeSelect.replaceChildren(
      Object.assign(document.createElement('option'), { value: 'ground-four-way', textContent: '四方向' }),
      Object.assign(document.createElement('option'), { value: 'ground-eight-way', textContent: '八方向' }),
    );
    const controllerSelect = document.createElement('select');
    const controllerDescription = document.createElement('p');
    controllerDescription.className = 'lab-hint';
    const controllerParameters = document.createElement('div');
    controllerParameters.className = 'lab-agent-controller-parameters';
    const controllerSource = createReadonlyInput();
    const resetControllerButton = document.createElement('button');
    resetControllerButton.type = 'button';
    resetControllerButton.textContent = '恢复地图 Controller 配置';
    const factionInput = createReadonlyInput();
    const priorityInput = document.createElement('input');
    priorityInput.type = 'number';
    priorityInput.step = '1';
    priorityInput.title = '本次运行覆盖，不写回地图组件';
    const resetPriorityButton = document.createElement('button');
    resetPriorityButton.type = 'button';
    resetPriorityButton.textContent = '恢复地图优先级';
    const durationInput = createDurationInput();
    const moveControls = document.createElement('div');
    moveControls.className = 'lab-movement-grid';
    const directions: ReadonlyArray<readonly [DungeonMovementDirection, string]> = [
      ['north-east', '↖ 东北'], ['north', '↑ 北'], ['north-west', '↗ 西北'],
      ['east', '← 东'], ['west', '→ 西'],
      ['south-east', '↙ 东南'], ['south', '↓ 南'], ['south-west', '↘ 西南'],
    ];
    directions.forEach(([direction, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.agentMove = direction;
      button.textContent = label;
      moveControls.append(button);
    });
    const turnControls = document.createElement('div');
    turnControls.className = 'lab-turn-grid';
    const turns: ReadonlyArray<readonly [DungeonAgentTurn, string]> = [
      ['left', '↶ 左转'], ['back', '↺ 后转'], ['right', '↷ 右转'],
    ];
    turns.forEach(([turn, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.agentTurn = turn;
      button.textContent = label;
      turnControls.append(button);
    });
    const status = createLabStatus('等待地图中的 dungeon-agent。');
    const runtimeJson = createLabJson();
    panel.content.append(
      debugToggle.row,
      controllerToggle.row,
      createLabField('选择 Agent', selectedAgentSelect),
      createLabField('当前格子', positionInput),
      createLabField('当前朝向', facingInput),
      createLabField('移动方向能力（本次运行）', movementModeSelect),
      createLabField('控制器', controllerSelect),
      controllerDescription,
      createLabField('配置来源', controllerSource),
      createLabField('Controller 参数（仅本次运行）', controllerParameters),
      resetControllerButton,
      createLabField('阵营', factionInput),
      createLabField('移动冲突优先级（本次运行）', priorityInput),
      resetPriorityButton,
      createLabField('移动 / 转向耗时（秒）', durationInput),
      createLabField('手动格步移动', moveControls),
      createLabField('手动原地转向', turnControls),
      status,
      runtimeJson,
    );

    let loaded: DungeonGridData | null = null;
    const controllerRegistry = createDefaultDungeonAgentControllerRegistry();
    const displayRoot = new TransformNode('dungeon_agent_display_mapping', context.scene);
    const syncDisplayView = () => applyDungeonViewToNode(displayRoot, overheadView.displayedView);
    const offView = overheadView.subscribe(syncDisplayView);
    syncDisplayView();
    const markers = new Map<string, DungeonAgentDebugMarker>();
    type ParameterControl = Readonly<{
      element: HTMLElement;
      sync(value: unknown): void;
    }>;
    const parameterControls = new Map<string, ParameterControl>();
    let renderedParameterKey = '';

    controllerSelect.replaceChildren(...[...controllerRegistry.values()].map((controller) => {
      const option = document.createElement('option');
      option.value = controller.id;
      option.textContent = controller.label;
      return option;
    }));

    const disposeMarkers = () => {
      markers.forEach((marker) => marker.dispose());
      markers.clear();
    };

    const tilePosition = (tileIndex: number) => {
      if (!loaded) return { tileX: 0, tileY: 0 };
      return {
        tileX: tileIndex % loaded.width,
        tileY: Math.floor(tileIndex / loaded.width),
      };
    };

    const tileWorldPosition = (tileIndex: number): readonly [number, number, number] => {
      if (!loaded) return [0, 0, 0];
      const { tileX, tileY } = tilePosition(tileIndex);
      return resolveDungeonMapTileWorldLayout(
        loaded,
        loaded.width,
        loaded.height,
        tileX,
        tileY,
      ).center;
    };

    const syncMarker = (entityId: string) => {
      const marker = markers.get(entityId);
      const data = agentStateMemory.current;
      const agent = data?.loadId === loaded?.loadId ? data?.agents.get(entityId) : undefined;
      if (!marker || !agent) return;
      const physicalPosition = agent.poseX === undefined || agent.poseY === undefined || !loaded ? null
        : resolveDungeonMapTileWorldLayout(loaded,loaded.width,loaded.height,agent.poseX,agent.poseY).center;
      if (!agent.movementKind) {
        marker.setPose(physicalPosition ?? tileWorldPosition(agent.tileIndex), getDungeonMovementDirectionYaw(agent.facing));
        return;
      }
      const progress = agent.visualProgress ?? (agent.durationSeconds! <= 0
        ? 1
        : Math.min(1, agent.elapsedSeconds! / agent.durationSeconds!));
      const from = tileWorldPosition(agent.fromTileIndex!);
      const to = tileWorldPosition(agent.toTileIndex!);
      const fromYaw = getDungeonMovementDirectionYaw(agent.fromFacing!);
      const rotationProgress = agent.rotationProgress ?? progress;
      const yaw = fromYaw + shortestAngleDelta(
        fromYaw,
        getDungeonMovementDirectionYaw(agent.toFacing!),
      ) * rotationProgress;
      marker.setPose(physicalPosition ?? [
        lerp(from[0], to[0], progress),
        lerp(from[1], to[1], progress),
        lerp(from[2], to[2], progress),
      ], yaw);
    };

    const renderMarkers = () => {
      disposeMarkers();
      const descriptions = descriptionsMemory.current;
      const runtime = agentStateMemory.current;
      if (!debugToggle.input.checked || !loaded || descriptions?.loadId !== loaded.loadId || runtime?.loadId !== loaded.loadId) return;
      descriptions.agents.forEach((description, entityId) => {
        const agent = runtime.agents.get(entityId);
        if (!agent) return;
        const { tileX, tileY } = tilePosition(agent.tileIndex);
        const layout = resolveDungeonMapTileWorldLayout(
          loaded!,
          loaded!.width,
          loaded!.height,
          tileX,
          tileY,
        );
        const factionId = description.factionId;
        const marker = createDungeonAgentDebugMarker(
          context.scene,
          `${loaded!.loadId}_${entityId}`,
          layout,
          FACTION_COLORS[factionId] ?? '#94a3b8',
        );
        marker.root.parent = displayRoot;
        markers.set(entityId, marker);
        syncMarker(entityId);
      });
    };

    const selectedAgent = (): DungeonAgentState | undefined => {
      const data = agentStateMemory.current;
      return data?.loadId === loaded?.loadId ? data?.agents.get(selectedAgentSelect.value) : undefined;
    };
    const agentName = (entityId: string) => descriptionsMemory.current?.agents.get(entityId)?.name ?? entityId;
    const traversal = () => traversalMemory.current?.loadId === loaded?.loadId ? traversalMemory.current : null;

    const effectiveController = (agent: DungeonAgentState) => {
      const row = controllersMemory.require().agents.get(agent.entityId)!;
      const config = { controllerId: row.controllerId, parameters: row.parameters };
      return { config, definition: controllerRegistry.get(config.controllerId) };
    };

    const applyParameterValue = (
      agent: DungeonAgentState,
      parameter: DungeonAgentControllerParameter,
      value: unknown,
    ) => {
      const currentAgent = selectedAgent();
      if (!currentAgent || currentAgent.entityId !== agent.entityId) return;
      const current = effectiveController(currentAgent);
      if (!current.definition) return;
      const parameters = { ...current.config.parameters, [parameter.key]: value };
      agentSystem!.setController(
        currentAgent.entityId,
        current.definition,
        parameters,
      );
      controllerSource.value = '本次运行覆盖（不写回地图）';
      status.textContent = `已更新 ${current.definition.label} 的“${parameter.label}”。`;
      refreshPanel();
    };

    const createTileListControl = (
      agent: DungeonAgentState,
      parameter: Extract<DungeonAgentControllerParameter, { type: 'tile-list' }>,
    ): ParameterControl => {
      const root = document.createElement('div');
      root.className = 'lab-agent-route-editor';
      const header = document.createElement('div');
      header.className = 'lab-agent-route-header';
      header.innerHTML = '<span>#</span><span>格子 X</span><span>格子 Y</span><span>操作</span>';
      const list = document.createElement('div');
      list.className = 'lab-agent-route-list';
      const addButton = document.createElement('button');
      addButton.type = 'button';
      addButton.textContent = '＋ 添加巡逻点';
      let points: DungeonAgentTilePoint[] = [];
      let signature = '';

      const commit = (next: readonly DungeonAgentTilePoint[]) => {
        points = next.map((point) => ({ ...point }));
        signature = '';
        applyParameterValue(agent, parameter, points);
      };
      const render = () => {
        if (!points.length) {
          const empty = document.createElement('div');
          empty.className = 'lab-agent-route-empty';
          empty.textContent = '尚无巡逻点；Controller 将停在原地。';
          list.replaceChildren(empty);
          return;
        }
        list.replaceChildren(...points.map((point, index) => {
          const row = document.createElement('div');
          row.className = 'lab-agent-route-item';
          const order = document.createElement('strong');
          order.textContent = String(index + 1);
          order.title = `巡逻点 ${index + 1}`;
          const xInput = document.createElement('input');
          xInput.type = 'number';
          xInput.min = '0';
          xInput.max = String(Math.max(0, (loaded?.width ?? 1) - 1));
          xInput.step = '1';
          xInput.value = String(point.x);
          xInput.title = '格子 X';
          xInput.setAttribute('aria-label', `巡逻点 ${index + 1} X`);
          const yInput = document.createElement('input');
          yInput.type = 'number';
          yInput.min = '0';
          yInput.max = String(Math.max(0, (loaded?.height ?? 1) - 1));
          yInput.step = '1';
          yInput.value = String(point.y);
          yInput.title = '格子 Y';
          yInput.setAttribute('aria-label', `巡逻点 ${index + 1} Y`);
          const removeButton = document.createElement('button');
          removeButton.type = 'button';
          removeButton.textContent = '删除';
          removeButton.title = `删除巡逻点 ${index + 1}`;
          const updateCoordinate = () => {
            const x = Number(xInput.value);
            const y = Number(yInput.value);
            const width = loaded?.width ?? 1;
            const height = loaded?.height ?? 1;
            if (!Number.isInteger(x) || !Number.isInteger(y)
              || x < 0 || y < 0 || x >= width || y >= height) {
              status.textContent = `巡逻点必须位于地图范围：X 0–${width - 1}，Y 0–${height - 1}。`;
              return;
            }
            commit(points.map((item, itemIndex) => itemIndex === index ? { x, y } : item));
          };
          xInput.addEventListener('change', updateCoordinate);
          yInput.addEventListener('change', updateCoordinate);
          removeButton.addEventListener('click', () => commit(points.filter((_, itemIndex) => itemIndex !== index)));
          row.append(order, xInput, yInput, removeButton);
          return row;
        }));
      };
      addButton.addEventListener('click', () => {
        const last = points[points.length - 1];
        const currentPosition = tilePosition(agent.tileIndex);
        const width = loaded?.width ?? 1;
        const next = last
          ? { x: (last.x + 1) % width, y: last.y }
          : { x: currentPosition.tileX, y: currentPosition.tileY };
        commit([...points, next]);
      });
      root.append(header, list, addButton);
      return {
        element: root,
        sync(value) {
          if (root.contains(document.activeElement)) return;
          const next = normalizeDungeonAgentTilePointList(value, parameter.defaultValue);
          const nextSignature = JSON.stringify(next);
          if (nextSignature === signature) return;
          points = next;
          signature = nextSignature;
          render();
        },
      };
    };

    const createParameterControl = (
      agent: DungeonAgentState,
      parameter: DungeonAgentControllerParameter,
    ): ParameterControl => {
      if (parameter.type === 'tile-list') return createTileListControl(agent, parameter);
      const control = parameter.type === 'select'
        ? document.createElement('select')
        : document.createElement('input');
      if (parameter.type === 'select') {
        control.replaceChildren(...parameter.options.map(({ value, label }) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = label;
          return option;
        }));
      } else if (control instanceof HTMLInputElement) {
        control.type = parameter.type === 'boolean' ? 'checkbox' : parameter.type;
        if (parameter.type === 'number') {
          if (parameter.min !== undefined) control.min = String(parameter.min);
          if (parameter.max !== undefined) control.max = String(parameter.max);
          if (parameter.step !== undefined) control.step = String(parameter.step);
          if (parameter.defaultValue === undefined) control.placeholder = '自动';
        } else if (parameter.type === 'text') {
          control.placeholder = parameter.placeholder ?? '';
        }
      }
      control.title = parameter.description ?? '';
      control.addEventListener('change', () => {
        let value: unknown;
        if (parameter.type === 'boolean' && control instanceof HTMLInputElement) {
          value = control.checked;
        } else if (control.value.trim() === '' && parameter.defaultValue === undefined) {
          const current = effectiveController(agent);
          const parameters = { ...current.config.parameters };
          delete parameters[parameter.key];
          if (current.definition) agentSystem!.setController(
            agent.entityId,
            current.definition,
            parameters,
          );
          refreshPanel();
          return;
        } else {
          value = parameter.type === 'number' ? Number(control.value) : control.value;
        }
        applyParameterValue(agent, parameter, value);
      });
      return {
        element: control,
        sync(value) {
          if (document.activeElement === control) return;
          if (parameter.type === 'boolean' && control instanceof HTMLInputElement) control.checked = value === true;
          else control.value = value === undefined ? '' : String(value);
        },
      };
    };

    const renderControllerParameters = (agent: DungeonAgentState | undefined) => {
      const current = agent ? effectiveController(agent) : undefined;
      const nextKey = agent && current ? `${agent.entityId}:${current.config.controllerId}` : '';
      if (nextKey !== renderedParameterKey) {
        renderedParameterKey = nextKey;
        parameterControls.clear();
        if (!agent || !current?.definition) {
          controllerParameters.replaceChildren();
        } else if (!current.definition.parameters.length) {
          const empty = document.createElement('span');
          empty.className = 'lab-hint';
          empty.textContent = '此 Controller 没有可调参数。';
          controllerParameters.replaceChildren(empty);
        } else {
          controllerParameters.replaceChildren(...current.definition.parameters.map((parameter) => {
            const control = createParameterControl(agent, parameter);
            parameterControls.set(parameter.key, control);
            return createLabField(parameter.label, control.element);
          }));
        }
      }
      if (!agent || !current?.definition) return;
      current.definition.parameters.forEach((parameter) => {
        const control = parameterControls.get(parameter.key);
        if (!control) return;
        const value = current.config.parameters[parameter.key] ?? parameter.defaultValue;
        control.sync(value);
      });
    };

    let panelDirty = true;
    let pendingStatus: string | null = null;
    const notifyMemories = () => {
      if (agentStateMemory.current) agentStateMemory.markChanged();
      if (controllersMemory.current) controllersMemory.markChanged();
      if (navigationMemory.current) navigationMemory.markChanged();
    };
    const queuePanelRefresh = () => { notifyMemories(); panelDirty = true; };
    const renderPanel = () => {
      if (panel.content.hidden) { panelDirty = true; return; }
      panelDirty = false;
      const agent = selectedAgent();
      const data = agentStateMemory.current;
      const descriptionData = descriptionsMemory.current;
      const basic = data?.loadId === loaded?.loadId ? data?.agents.get(selectedAgentSelect.value) : undefined;
      const description = descriptionData?.loadId === loaded?.loadId ? descriptionData?.agents.get(selectedAgentSelect.value) : undefined;
      if (agent && basic && description) {
        const current = effectiveController(agent);
        const position = tilePosition(basic.tileIndex);
        positionInput.value = `(${position.tileX}, ${position.tileY}) · index ${basic.tileIndex}`;
        facingInput.value = basic.facing;
        const actor = traversal()?.actors.get(agent.entityId);
        movementModeSelect.value = resolveDungeonMovementProfile(
          actor?.movementProfileId ?? description.movementProfileId,
        ).directionMode === 'eight-way' ? 'ground-eight-way' : 'ground-four-way';
        moveControls.querySelectorAll<HTMLButtonElement>('[data-agent-move*="-"]').forEach((button) => {
          button.disabled = movementModeSelect.value !== 'ground-eight-way';
        });
        controllerSelect.value = current.config.controllerId;
        controllerDescription.textContent = current.definition?.description
          ?? `未注册的 Controller：“${current.config.controllerId}”。`;
        controllerSource.value = controllersMemory.current?.agents.get(selectedAgentSelect.value)?.source === 'runtime-override'
          ? '本次运行覆盖（不写回地图）'
          : '地图初始配置';
        factionInput.value = description.factionId;
        priorityInput.value = String(basic.effectivePriority);
      } else {
        positionInput.value = '';
        facingInput.value = '';
        movementModeSelect.value = 'ground-four-way';
        moveControls.querySelectorAll<HTMLButtonElement>('[data-agent-move]').forEach((button) => {
          button.disabled = true;
        });
        controllerSelect.value = '';
        controllerDescription.textContent = '请先选择一个 Agent。';
        controllerSource.value = '';
        factionInput.value = '';
        priorityInput.value = '';
      }
      controllerSelect.disabled = !agent;
      movementModeSelect.disabled = !agent;
      resetControllerButton.disabled = controllersMemory.current?.agents.get(selectedAgentSelect.value)?.source !== 'runtime-override';
      resetPriorityButton.disabled = !agent || agent.priorityOverride === undefined;
      renderControllerParameters(agent);
      if (!panel.content.hidden) {
        const agents = agentStateMemory.current?.agents;
        const selectedNavigation = navigationMemory.current?.agents.get(selectedAgentSelect.value);
        const movement = movementMemory.current?.loadId === loaded?.loadId ? movementMemory.current : null;
        const preview = [];
        if (agents) for (const item of agents.values()) {
          if (preview.length === 20) break;
          preview.push({ ...item, name: agentName(item.entityId) });
        }
        runtimeJson.textContent = JSON.stringify(loaded ? {
          loadId: loaded.loadId,
          turnNumber: controllersMemory.current?.turnNumber,
          agentCount: agents?.size ?? 0,
          agentsPreview: preview,
          selectedNavigation: selectedNavigation ? {
            ...selectedNavigation,
            tileIndices: selectedNavigation.tileIndices.slice(0, 20),
            directions: selectedNavigation.directions.slice(0, 20),
            pathLength: selectedNavigation.tileIndices.length,
          } : null,
          actorCount: traversal()?.actors.size ?? 0,
          activeMovementRequestCount: movement?.activeRequests.size ?? 0,
          inspection: '完整 Agent、路径和预约数据请在系统与共享内存面板分页查看。',
        } : { loaded: false }, null, 2);
      }
    };
    const refreshPanel = () => { pendingStatus = null; notifyMemories(); renderPanel(); };
    const panelVisibilityObserver = new MutationObserver(() => {
      if (!panel.content.hidden) renderPanel();
    });
    panelVisibilityObserver.observe(panel.content, { attributes: true, attributeFilter: ['hidden'] });

    priorityInput.addEventListener('change', () => {
      const agent = selectedAgent();
      const value = Number(priorityInput.value);
      if (!agent || !Number.isInteger(value)) {
        status.textContent = '移动冲突优先级必须是整数。';
        refreshPanel();
        return;
      }
      agent.priorityOverride = value;
      status.textContent = `已将移动冲突优先级设为 ${value}（仅本次运行）。`;
      refreshPanel();
    });
    resetPriorityButton.addEventListener('click', () => {
      const agent = selectedAgent();
      if (!agent) return;
      agent.priorityOverride = undefined;
      status.textContent = '已恢复地图中的移动冲突优先级。';
      refreshPanel();
    });

    const populateAgentSelect = () => {
      const previous = selectedAgentSelect.value;
      const options = [...(descriptionsMemory.current?.agents.values() ?? [])].map((agent) => {
        const option = document.createElement('option');
        option.value = agent.entityId;
        option.textContent = agent.name === agent.entityId ? agent.entityId : `${agent.name} · ${agent.entityId}`;
        return option;
      });
      selectedAgentSelect.replaceChildren(...options);
      if (options.some(({ value }) => value === previous)) selectedAgentSelect.value = previous;
      refreshPanel();
    };

    const movementDuration = (): number => {
      const value = Number(durationInput.value);
      return Number.isFinite(value) && value >= 0 ? value : 0.3;
    };

    const describeControllerActions = (actions: readonly DungeonAgentControllerAction[]): string => {
      const moved = actions.filter((action) => action.outcome === 'move-started').length;
      const idle = actions.filter((action) => action.outcome === 'idle').length;
      const blocked = actions.filter((action) => action.outcome === 'blocked').length;
      return `Controller：移动 ${moved}，等待 ${idle}，受阻 ${blocked}。`;
    };

    const publishControllerActions = (actions: readonly DungeonAgentControllerAction[]) => {
      if (!loaded) return;
      const entityIds = actions
        .filter((action) => action.outcome === 'move-started')
        .map((action) => action.entityId);
      if (!entityIds.length) return;
      void context.communication.publish(dungeonAgentsChangedEvent, {
        loadId: loaded.loadId,
        entityIds,
        reason: 'controller-move-started',
      });
    };

    const moveSelectedAgent = (direction: DungeonMovementDirection) => {
      const agent = selectedAgent();
      if (!agent || !agentSystem || !loaded || assembly.isPaused || context.scheduler.isPaused) return;
      const result = agentSystem!.move(
        agent.entityId,
        direction,
        {
          durationSeconds: movementDuration(),
        },
      );
      status.textContent = result.started
        ? `${agentName(agent.entityId)} 开始向 ${direction} 移动。`
        : `移动失败：${result.blockedReason ?? 'unknown'}。`;
      syncMarker(agent.entityId);
      refreshPanel();
      if (result.started) void context.communication.publish(dungeonAgentsChangedEvent, {
        loadId: loaded.loadId,
        entityIds: [agent.entityId],
        reason: 'manual-move-started',
      });
    };

    const turnSelectedAgent = (turn: DungeonAgentTurn) => {
      const agent = selectedAgent();
      if (!agent || !agentSystem || !loaded || assembly.isPaused || context.scheduler.isPaused) return;
      const result = agentSystem!.turn(agent.entityId, turn, movementDuration());
      status.textContent = result.started
        ? `${agentName(agent.entityId)} 开始${turn}转向。`
        : `转向失败：${result.blockedReason ?? 'unknown'}。`;
      syncMarker(agent.entityId);
      refreshPanel();
      if (result.started) void context.communication.publish(dungeonAgentsChangedEvent, {
        loadId: loaded.loadId,
        entityIds: [agent.entityId],
        reason: 'manual-turn-started',
      });
    };

    moveControls.querySelectorAll<HTMLButtonElement>('[data-agent-move]').forEach((button) => {
      button.addEventListener('click', () => moveSelectedAgent(button.dataset.agentMove as DungeonMovementDirection));
    });
    turnControls.querySelectorAll<HTMLButtonElement>('[data-agent-turn]').forEach((button) => {
      button.addEventListener('click', () => turnSelectedAgent(button.dataset.agentTurn as DungeonAgentTurn));
    });
    selectedAgentSelect.addEventListener('change', refreshPanel);
    movementModeSelect.addEventListener('change', () => {
      const agent = selectedAgent();
      if (!agent || !agentSystem) return;
      agentSystem.setMovementProfile(agent.entityId, movementModeSelect.value);
      refreshPanel();
    });
    controllerSelect.addEventListener('change', () => {
      const agent = selectedAgent();
      const definition = controllerRegistry.get(controllerSelect.value);
      if (!agent || !definition) return;
      agentSystem!.setController(
        agent.entityId,
        definition,
        createDefaultDungeonAgentControllerParameters(definition),
      );
      renderedParameterKey = '';
      status.textContent = `已将 ${agentName(agent.entityId)} 的 Controller 切换为“${definition.label}”；仅影响本次运行。`;
      refreshPanel();
    });
    resetControllerButton.addEventListener('click', () => {
      const agent = selectedAgent();
      if (!agent) return;
      agentSystem!.resetController(agent.entityId);
      renderedParameterKey = '';
      status.textContent = `已恢复 ${agentName(agent.entityId)} 的地图 Controller 配置。`;
      refreshPanel();
    });
    controllerToggle.input.addEventListener('change', () => {
      if (settingsMemory.current) {
        settingsMemory.current.controllersEnabled = controllerToggle.input.checked;
        settingsMemory.markChanged();
      }
    });
    debugToggle.input.addEventListener('change', renderMarkers);

    const stopFrameTask = assembly.registerSimulation('dungeon-agent', 200, (deltaSeconds) => {
        if (!loaded) return;

        if (!agentSystem) return;
        const { completed, actions, changed } = agentSystem.update(deltaSeconds);
        changed.forEach(agent => syncMarker(agent.binding.entity.id));
        if (!completed.length && !actions.length) return;
        pendingStatus = actions.length
          ? describeControllerActions(actions)
          : `${completed.length} 个 Agent 完成移动或转向。`;
        queuePanelRefresh();
        publishControllerActions(actions);
        if (completed.length) void context.communication.publish(dungeonAgentsChangedEvent, {
          loadId: loaded.loadId,
          entityIds: completed,
          reason: 'movement-completed',
        });
    });
    const stopDebugTask = context.scheduler.register({
      id: 'debug-summary', phase: 'debug', order: 210, intervalSeconds: .25,
      description: '合并更新可见 Agent 面板',
      run: () => {
        if (panel.content.hidden) return;
        if (pendingStatus !== null) { status.textContent = pendingStatus; pendingStatus = null; }
        if (panelDirty || agentStateMemory.current?.activeAgentIds?.size) renderPanel();
      },
    });

    const offMapChanged = context.communication.on(dungeonMapChangedEvent, (changed) => {
      const next = gridMemory.current;
      if (!next || next.loadId !== changed.loadId) return;
      const nextSystem = agentControl.acquire(next.loadId);
      if (!nextSystem) return;
      loaded = next;
      agentSystem = nextSystem;
      if (!prepared || prepared.loadId !== next.loadId) return;
      const data = prepared.data;
      for (const domain of [data.descriptions, data.state, data.settings, data.controllers, data.navigation]) {
        domain.presetKey = next.presetKey;
      }
      descriptionsMemory.replace(data.descriptions);
      agentStateMemory.replace(data.state);
      data.settings.controllersEnabled = controllerToggle.input.checked;
      settingsMemory.replace(data.settings);
      controllersMemory.replace(data.controllers);
      navigationMemory.replace(data.navigation);
      prepared = null;
      const agentCount = data.descriptions.agents.size;
      try {
        disposeMarkers();
        populateAgentSelect();
        renderMarkers();
        status.textContent = agentCount
          ? `已从地图扫描并创建 ${agentCount} 个 Dungeon Agent。`
          : '当前地图没有 dungeon-agent；可先在地图编辑器的 Tile 中添加。';
        void context.communication.publish(dungeonAgentsLoadedEvent, {
          loadId: next.loadId,
          agentCount,
        });
      } catch (error) {

        status.textContent = error instanceof Error ? error.message : String(error);
      }
      refreshPanel();
    });

    const offRuntimeChanged = playerSteps.subscribe('dungeon-agent', 200, (changed) => {
      if (!agentSystem || !settingsMemory.current?.controllersEnabled || !loaded || changed.loadId !== loaded.loadId) return;

      const actions = agentSystem?.afterPlayerStep(changed) ?? [];
      actions.forEach(action => syncMarker(action.entityId));
      pendingStatus = `玩家格步触发第 ${controllersMemory.current?.turnNumber} 回合；${describeControllerActions(actions)}`;
      queuePanelRefresh();
      publishControllerActions(actions);
    });

    return () => {
      offPreparation();
      prepared = null;
      offMapChanged();
      offRuntimeChanged();
      offView();
      stopFrameTask();
      stopDebugTask();
      panelVisibilityObserver.disconnect();
      disposeMarkers();
      displayRoot.dispose();
      descriptionsMemory.replace(null);
      agentStateMemory.replace(null);
      settingsMemory.replace(null);
      controllersMemory.replace(null);
      navigationMemory.replace(null);
      panel.root.remove();
    };
  },
};
