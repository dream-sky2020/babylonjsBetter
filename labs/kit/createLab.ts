import { SystemRunner, SystemTaskFailure } from '@/core/system-runtime/SystemRunner';
import { ArcRotateCamera, Engine, Scene, Vector3 } from '@babylonjs/core';
import {
  LabExecutionMonitor,
  createLabExecutionPlanPanel,
  resolveLabExecutionPlan,
  type LabExecutionPlan,
  type LabExecutionPlanEntry,
} from './execution-plan';
import { createLabState, createLabStatePanel } from './lab-state';
import { LabMemoryRegistry } from './shared-memory';
import { createLabMemoryPanel } from './shared-memory/labMemoryPanel';
import { createLabCommunicationPanel } from './labCommunicationPanel';
import { LabCommunication } from './labCommunication';
import { createLabCommunicationLogPanel } from './labCommunicationLogPanel';
import { LabServiceRegistry } from './labServiceRegistry';
import type { CreateLabOptions, LabContext, LabHost, LabModuleLifecycle } from './labKit.types';
import { LabUi } from './labUi';
import { LabFrameClock } from './labFrameClock';
import { LabViewportManager } from './labViewportManager';
import {
  LabKeyboardRouter,
  createLabKeyboardDebugPanel,
  labKeyboardConflictDetectedEvent,
  labKeyboardConsumerSettingsChangedEvent,
  labKeyboardGlobalEnabledChangedEvent,
} from './keyboard';
import { createLabCameraSystem } from './camera';
import { LabPerformance, profileSystemTask } from './performance/LabPerformance';
import { createLabPerformancePanel } from './performance/labPerformancePanel';
import type { SystemTask } from '@/core/system-runtime/SystemRunner';
import { LabWorkbench } from './workbench/LabWorkbench';
import { LabObjects } from './objects/LabObjects';
import { mountLabObjectTree } from './objects/LabObjectTree';
import { LabObjectEditor } from './objects/LabObjectEditor';
import { mountLabObjectEditorPanel } from './objects/LabObjectEditorPanel';

type ActiveModule = {
  readonly entry: LabExecutionPlanEntry;
  readonly communication: ReturnType<LabCommunication['scope']>;
  readonly lifecycle: LabModuleLifecycle;
};

type KeyboardSettingsState = {
  globalEnabled: boolean;
  consumers: Record<string, { enabled: boolean; priority: number; intercept: boolean; preventDefault: boolean }>;
};

const collectDependencyIds = (
  moduleId: string,
  plan: LabExecutionPlan,
  result = new Set<string>(),
): ReadonlySet<string> => {
  const entry = plan.entries.find((candidate) => candidate.moduleId === moduleId);
  if (!entry) return result;
  entry.dependencies.forEach((dependencyId) => {
    if (result.has(dependencyId)) return;
    result.add(dependencyId);
    collectDependencyIds(dependencyId, plan, result);
  });
  return result;
};

const findDependencyPath = (
  targetModuleId: string,
  requestedModuleIds: readonly string[],
  plan: LabExecutionPlan,
): readonly string[] => {
  const byId = new Map(plan.entries.map((entry) => [entry.moduleId, entry]));
  const visit = (current: string, path: readonly string[]): readonly string[] | null => {
    if (current === targetModuleId) return [...path, current];
    const entry = byId.get(current);
    if (!entry) return null;
    for (const dependency of entry.dependencies) {
      const found = visit(dependency, [...path, current]);
      if (found) return found;
    }
    return null;
  };
  for (const requested of requestedModuleIds) {
    const found = visit(requested, []);
    if (found) return found;
  }
  return [targetModuleId];
};

const moduleFailure = (
  entry: LabExecutionPlanEntry,
  phase: 'setup' | 'start',
  error: unknown,
  requestedModuleIds: readonly string[],
  plan: LabExecutionPlan,
): Error => {
  const message = error instanceof Error ? error.message : String(error);
  const dependencyPath = findDependencyPath(entry.moduleId, requestedModuleIds, plan).join(' → ');
  return new Error(
    `Lab 模块“${entry.moduleId}”在 ${phase} 阶段失败：${message}\n依赖链：${dependencyPath}`,
    { cause: error },
  );
};

const normalizeLifecycle = (
  result: Awaited<ReturnType<LabExecutionPlanEntry['module']['setup']>>,
): LabModuleLifecycle => {
  if (typeof result === 'function') return { dispose: result };
  return result ?? {};
};

export const createLab = async (options: CreateLabOptions): Promise<LabHost> => {
  // 在创建 Engine 和注册任何资源之前完成依赖图校验。
  const executionPlan = resolveLabExecutionPlan(options.modules, options.catalog);
  const executionMonitor = new LabExecutionMonitor(executionPlan);

  options.root.className = 'lab-host';
  const workbench = new LabWorkbench(options.root, options.title, options.description);
  const { stage, canvas, panels, status } = workbench;
  const home = document.createElement('a');
  home.className = 'lab-home-link';
  home.href = '../../../index.html';
  home.textContent = '返回工具入口';
  workbench.header.append(home);
  const badge = document.createElement('div');
  badge.className = 'lab-badge';
  badge.textContent = options.badge;

  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  const frameClock = new LabFrameClock();
  const resetFrameClock = () => { frameClock.reset(); performanceStats.resetFrameTiming(); };
  document.addEventListener('visibilitychange', resetFrameClock);
  window.addEventListener('pagehide', resetFrameClock);
  window.addEventListener('pageshow', resetFrameClock);
  const disposeFrameClock = () => {
    document.removeEventListener('visibilitychange', resetFrameClock);
    window.removeEventListener('pagehide', resetFrameClock);
    window.removeEventListener('pageshow', resetFrameClock);
  };
  const scene = new Scene(engine);
  const camera = new ArcRotateCamera('composableLabCamera', -Math.PI / 4, 1.08, 105, Vector3.Zero(), scene);
  camera.lowerRadiusLimit = 3;
  camera.upperRadiusLimit = 500;
  camera.wheelPrecision = 8;
  const performanceStats = new LabPerformance(executionPlan.entries.map(entry => entry.moduleId));
  const communication = new LabCommunication({ measure: (id, kind, callback) => performanceStats.measure(id, kind, callback) });
  const hostCommunication = communication.scope('lab:host');
  const keyboardSettings: KeyboardSettingsState = { globalEnabled: true, consumers: {} };
  let markKeyboardSettingsChanged = (): void => {};
  const keyboard = new LabKeyboardRouter(window, {
    onGlobalEnabledChanged: (enabled) => {
      keyboardSettings.globalEnabled = enabled;
      markKeyboardSettingsChanged();
      void hostCommunication.publish(labKeyboardGlobalEnabledChangedEvent, { enabled });
    },
    onSettingsChanged: (consumer) => {
      keyboardSettings.consumers[consumer.id] = {
        enabled: consumer.enabled,
        priority: consumer.priority,
        intercept: consumer.intercept,
        preventDefault: consumer.preventDefault,
      };
      markKeyboardSettingsChanged();
      void hostCommunication.publish(labKeyboardConsumerSettingsChangedEvent, { consumer });
    },
    onConflictChanged: (code, consumerIds) => {
      void hostCommunication.publish(labKeyboardConflictDetectedEvent, { code, consumerIds });
    },
  });
  const runner = new SystemRunner();
  const registerTask = (owner: string, task: SystemTask) => runner.register(owner, profileSystemTask(performanceStats, owner, task));
  const services = new LabServiceRegistry();
  const memory = new LabMemoryRegistry();
  const ui = new LabUi(panels, status, { diagnostics: workbench.diagnostics,
    reveal: category => category === 'diagnostics' ? workbench.showDiagnostics() : workbench.showModules() });
  const objects = new LabObjects(error => ui.setStatus(error instanceof Error ? error.message : String(error), true));
  const disposeExecutionPlanPanel = createLabExecutionPlanPanel(ui, executionMonitor, runner, services, communication);
  const disposeCommunicationLogPanel = createLabCommunicationLogPanel(ui, communication.journal);
  const labState = createLabState();
  const keyboardStateRegistration = labState.registerReference<KeyboardSettingsState, KeyboardSettingsState>({
    moduleId: 'lab:host',
    key: 'keyboard-settings',
    version: 1,
    value: keyboardSettings,
    inspect: (value) => structuredClone(value),
    save: {
      serialize: (value) => structuredClone(value),
      validate: (saved) => {
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Keyboard Settings 存档无效。');
        const source = saved as Record<string, unknown>;
        if (typeof source.globalEnabled !== 'boolean' || !source.consumers || typeof source.consumers !== 'object' || Array.isArray(source.consumers)) {
          throw new Error('Keyboard Settings 存档字段无效。');
        }
        const consumers: KeyboardSettingsState['consumers'] = {};
        Object.entries(source.consumers as Record<string, unknown>).forEach(([id, raw]) => {
          if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`Keyboard 消费者“${id}”设置无效。`);
          const value = raw as Record<string, unknown>;
          if (typeof value.enabled !== 'boolean' || typeof value.priority !== 'number' || !Number.isFinite(value.priority)
            || typeof value.intercept !== 'boolean' || typeof value.preventDefault !== 'boolean') {
            throw new Error(`Keyboard 消费者“${id}”设置字段无效。`);
          }
          consumers[id] = { enabled: value.enabled, priority: value.priority, intercept: value.intercept, preventDefault: value.preventDefault };
        });
        return { globalEnabled: source.globalEnabled, consumers };
      },
      restore: (current, saved) => {
        current.globalEnabled = saved.globalEnabled;
        current.consumers = structuredClone(saved.consumers);
        keyboard.setGlobalEnabled(saved.globalEnabled);
        keyboard.getConsumers().forEach((consumer) => {
          const restored = saved.consumers[consumer.id];
          if (restored) keyboard.configureConsumer(consumer.id, restored);
        });
      },
    },
  });
  markKeyboardSettingsChanged = keyboardStateRegistration.markChanged;
  const disposeLabStatePanel = createLabStatePanel(ui, labState);
  const disposeKeyboardPanel = createLabKeyboardDebugPanel(ui, keyboard);
  const cameraSystem = createLabCameraSystem(stage, ui, camera, keyboard, options.initialCamera, options.cameraPresets);
  let objectEditor: LabObjectEditor | undefined;
  let viewportInputEnabled = true, editingInput = false;
  const syncCameraInput = () => cameraSystem.setInputEnabled(viewportInputEnabled && !editingInput);
  const viewport = new LabViewportManager(stage, canvas, { setInputEnabled(enabled) {
    viewportInputEnabled = enabled;
    if (!enabled) objectEditor?.editor.cancel();
    syncCameraInput();
  } }, () => engine.resize());
  workbench.connectResize(() => engine.resize());
  objectEditor = new LabObjectEditor(scene, objects, keyboard, { isInputPaused: () => viewport.isBabylonInputPaused,
    cameraInput(suspended) { editingInput = suspended; syncCameraInput(); }, report: (message, error) => ui.setStatus(message, error) });
  const transformPanel = ui.addPanel('object-transform', '对象变换', { category: 'modules' });
  const disposeTransformPanel = mountLabObjectEditorPanel(transformPanel.content, objectEditor);
  const disposeObjectTree = mountLabObjectTree(workbench.objects, objects, scene, cameraSystem.controller, keyboard, () => viewport.isBabylonInputPaused, objectEditor);
  const disposeMemoryPanel = createLabMemoryPanel(ui, viewport, memory, executionPlan.entries.map(entry => entry.module));
  const disposeCommunicationPanel = createLabCommunicationPanel(ui, viewport, communication);
  const disposePerformancePanel = createLabPerformancePanel(ui, viewport, performanceStats);
  stage.append(badge);
  const allModuleIds = new Set(executionPlan.entries.map(({ moduleId }) => moduleId));
  const context: LabContext = {
    objects: objects.scope('lab:host'),
    memory: memory.scope('lab:host'),
    scheduler: { get isPaused() { return runner.isPaused; }, register: task => registerTask('lab:host', task) },
    labState,
    engine,
    scene,
    camera,
    cameraController: cameraSystem.controller,
    canvas,
    viewport,
    keyboard,
    communication: hostCommunication,
    communicationJournal: communication.journal,
    services: services.scope('lab:host', allModuleIds),
    ui,
  };
  const activeModules: ActiveModule[] = [];

  const disposeModules = (): readonly unknown[] => {
    services.setPhase('dispose');
    const errors: unknown[] = [];
    [...activeModules].reverse().forEach(({ entry, communication: moduleCommunication, lifecycle }) => {
      executionMonitor.beginDispose(entry.moduleId);
      let failed = false;
      try {
        performanceStats.measure(entry.moduleId, 'dispose', () => lifecycle.dispose?.());
      } catch (error) {
        failed = true;
        errors.push(error);
        executionMonitor.fail(entry.moduleId, error);
      } finally {
        runner.removeOwner(entry.moduleId);
        services.removeOwner(entry.moduleId);
        memory.removeModule(entry.moduleId);
        objects.removeOwner(entry.moduleId);
        moduleCommunication.dispose();
        if (!failed) executionMonitor.completeDispose(entry.moduleId);
      }
    });
    activeModules.length = 0;
    return errors;
  };

  try {
    services.setPhase('setup');
    for (const entry of executionPlan.entries) {
      const moduleCommunication = communication.scope(entry.moduleId);
      executionMonitor.beginSetup(entry.moduleId);
      try {
        for (const event of entry.module.events ?? []) moduleCommunication.declareEvent(event.definition, { publishes: event.publishes });
        const result = await performanceStats.measure(entry.moduleId, 'setup', () => entry.module.setup({
          ...context,
          memory: memory.scope(entry.moduleId),
          objects: objects.scope(entry.moduleId),
          ui: ui.scope(entry.module),
          scheduler: { get isPaused() { return runner.isPaused; }, register: task => registerTask(entry.moduleId, task) },
          communication: moduleCommunication,
          services: services.scope(entry.moduleId, entry.module.manifest
            ? new Set(entry.dependencies) : collectDependencyIds(entry.moduleId, executionPlan)),
        }));
        activeModules.push({ entry, communication: moduleCommunication, lifecycle: normalizeLifecycle(result) });
        executionMonitor.completeSetup(entry.moduleId);
      } catch (error) {
        executionMonitor.fail(entry.moduleId, error);
        runner.removeOwner(entry.moduleId);
        services.removeOwner(entry.moduleId);
        memory.removeModule(entry.moduleId);
        objects.removeOwner(entry.moduleId);
        moduleCommunication.dispose();
        throw moduleFailure(entry, 'setup', error, options.modules, executionPlan);
      }
    }

    services.setPhase('restore');
    if (options.initialState !== undefined) await labState.restore(options.initialState);

    services.setPhase('start');
    for (const active of activeModules) {
      executionMonitor.beginStart(active.entry.moduleId);
      try {
        if (active.lifecycle.start) await performanceStats.measure(active.entry.moduleId, 'start', () => active.lifecycle.start!());
        executionMonitor.completeStart(active.entry.moduleId);
      } catch (error) {
        executionMonitor.fail(active.entry.moduleId, error);
        throw moduleFailure(active.entry, 'start', error, options.modules, executionPlan);
      }
    }

    services.setPhase('ready');
    engine.runRenderLoop(() => {
      const deltaSeconds = frameClock.next(engine.getDeltaTime() / 1000, document.hidden);
      if (deltaSeconds === null) return;
      if (deltaSeconds === 0) performanceStats.resetFrameTiming();
      performanceStats.frameStarted();
      performanceStats.beginFrame();
      try {
        performanceStats.measure('lab:host/scheduler', 'host', () => runner.update('simulation', deltaSeconds));
        performanceStats.measure('lab:host/camera', 'host', () => cameraSystem.update(deltaSeconds));
        if (!viewport.isBabylonRenderingPaused) {
          performanceStats.measure('lab:host/scheduler', 'host', () => runner.update('presentation', deltaSeconds));
          performanceStats.measure('lab:host/render', 'host', () => scene.render());
        }
        performanceStats.measure('lab:host/scheduler', 'host', () => runner.update('debug', deltaSeconds));
      } catch (error) {
        // Fail closed: never continue a partially executed simulation frame.
        runner.setPaused(true);
        if (error instanceof SystemTaskFailure) executionMonitor.fail(error.owner, error);
        context.ui.setStatus(error instanceof Error ? error.message : String(error), true);
        engine.stopRenderLoop();
        console.error(error);
      } finally {
        performanceStats.endFrame();
      }
    });
    context.ui.setStatus(`已组合 ${executionPlan.entries.length} 个 Lab 模块。`);
  } catch (error) {
    disposeFrameClock();
    disposeObjectTree();
    disposeTransformPanel(); objectEditor.dispose(); transformPanel.root.remove();
    const cleanupErrors = disposeModules();
    disposeLabStatePanel();
    disposeKeyboardPanel();
    disposeMemoryPanel();
    disposeCommunicationPanel();
    disposePerformancePanel(); performanceStats.dispose();
    memory.dispose();
    objects.dispose(); workbench.dispose();
    viewport.dispose();
    cameraSystem.dispose();
    keyboard.dispose();
    labState.dispose();
    disposeCommunicationLogPanel();
    disposeExecutionPlanPanel();
    communication.dispose();
    runner.dispose();
    services.clear();
    scene.dispose();
    engine.dispose();
    if (cleanupErrors.length) {
      throw new AggregateError([error, ...cleanupErrors], 'Lab 初始化失败，并且回滚期间发生错误。', { cause: error });
    }
    throw error;
  }

  let disposed = false;
  let finalPerformance: ReturnType<LabPerformance['inspect']> | undefined;
  return {
    performance: {
      start() { if (!disposed) performanceStats.start(); },
      stop() { if (!disposed) performanceStats.stop(); },
      clear() { if (!disposed) performanceStats.clear(); },
      inspect() { return finalPerformance ? structuredClone(finalPerformance) : performanceStats.inspect(); },
    },
    context,
    executionPlan,
    moduleIds: executionPlan.entries.map(({ moduleId }) => moduleId),
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeFrameClock();
      disposeObjectTree();
      disposeTransformPanel(); objectEditor.dispose(); transformPanel.root.remove();
      const cleanupErrors = disposeModules();
      performanceStats.stop(); finalPerformance = performanceStats.inspect();
      disposeLabStatePanel();
      disposeKeyboardPanel();
      disposeMemoryPanel();
      disposeCommunicationPanel();
      disposePerformancePanel(); performanceStats.dispose();
      memory.dispose();
      objects.dispose(); workbench.dispose();
      viewport.dispose();
      cameraSystem.dispose();
      keyboard.dispose();
      labState.dispose();
      disposeCommunicationLogPanel();
      disposeExecutionPlanPanel();
      communication.dispose();
      runner.dispose();
      services.clear();
      scene.dispose();
      engine.dispose();
      if (cleanupErrors.length) console.error(new AggregateError(cleanupErrors, 'Lab 模块释放期间发生错误。'));
    },
  };
};
