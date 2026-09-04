import { ArcRotateCamera, Engine, Scene, Vector3 } from '@babylonjs/core';
import {
  LabExecutionMonitor,
  createLabExecutionPlanPanel,
  resolveLabExecutionPlan,
  type LabExecutionPlan,
  type LabExecutionPlanEntry,
} from './execution-plan';
import { createLabState, createLabStatePanel } from './lab-state';
import { LabCommunication } from './labCommunication';
import { createLabCommunicationLogPanel } from './labCommunicationLogPanel';
import { LabServiceRegistry } from './labServiceRegistry';
import type { CreateLabOptions, LabContext, LabHost, LabModuleLifecycle } from './labKit.types';
import { LabUi } from './labUi';
import { LabViewportManager } from './labViewportManager';

type ActiveModule = {
  readonly entry: LabExecutionPlanEntry;
  readonly communication: ReturnType<LabCommunication['scope']>;
  readonly lifecycle: LabModuleLifecycle;
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
  const layout = document.createElement('div');
  layout.className = 'lab-layout';
  const sidebar = document.createElement('aside');
  const heading = document.createElement('h1');
  heading.textContent = options.title;
  const description = document.createElement('p');
  description.className = 'lab-description';
  description.textContent = options.description;
  const status = document.createElement('div');
  status.className = 'lab-global-status';
  status.textContent = '正在初始化 Lab 模块……';
  const panels = document.createElement('div');
  panels.className = 'lab-panels';
  const home = document.createElement('a');
  home.className = 'lab-home-link';
  home.href = '../../index.html';
  home.textContent = '返回工具入口';
  sidebar.append(heading, description, status, panels, home);

  const stage = document.createElement('main');
  stage.className = 'lab-viewport';
  const canvas = document.createElement('canvas');
  canvas.className = 'lab-babylon-canvas';
  const badge = document.createElement('div');
  badge.className = 'lab-badge';
  badge.textContent = options.badge;
  stage.append(canvas);
  layout.append(sidebar, stage);
  options.root.replaceChildren(layout);

  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  const scene = new Scene(engine);
  const camera = new ArcRotateCamera('composableLabCamera', -Math.PI / 4, 1.08, 105, Vector3.Zero(), scene);
  camera.lowerRadiusLimit = 3;
  camera.upperRadiusLimit = 500;
  camera.wheelPrecision = 8;
  camera.attachControl(canvas, true);

  const viewport = new LabViewportManager(stage, canvas, camera, () => engine.resize());
  stage.append(badge);
  const communication = new LabCommunication();
  const services = new LabServiceRegistry();
  const ui = new LabUi(panels, status);
  const disposeExecutionPlanPanel = createLabExecutionPlanPanel(ui, executionMonitor);
  const disposeCommunicationLogPanel = createLabCommunicationLogPanel(ui, communication.journal);
  const labState = createLabState();
  const disposeLabStatePanel = createLabStatePanel(ui, labState);
  const allModuleIds = new Set(executionPlan.entries.map(({ moduleId }) => moduleId));
  const context: LabContext = {
    labState,
    engine,
    scene,
    camera,
    canvas,
    viewport,
    communication: communication.scope('lab:host'),
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
        lifecycle.dispose?.();
      } catch (error) {
        failed = true;
        errors.push(error);
        executionMonitor.fail(entry.moduleId, error);
      } finally {
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
        const result = await entry.module.setup({
          ...context,
          communication: moduleCommunication,
          services: services.scope(entry.moduleId, collectDependencyIds(entry.moduleId, executionPlan)),
        });
        activeModules.push({ entry, communication: moduleCommunication, lifecycle: normalizeLifecycle(result) });
        executionMonitor.completeSetup(entry.moduleId);
      } catch (error) {
        executionMonitor.fail(entry.moduleId, error);
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
        await active.lifecycle.start?.();
        executionMonitor.completeStart(active.entry.moduleId);
      } catch (error) {
        executionMonitor.fail(active.entry.moduleId, error);
        throw moduleFailure(active.entry, 'start', error, options.modules, executionPlan);
      }
    }

    services.setPhase('ready');
    engine.runRenderLoop(() => {
      if (!viewport.isBabylonRenderingPaused) scene.render();
    });
    context.ui.setStatus(`已组合 ${executionPlan.entries.length} 个 Lab 模块。`);
  } catch (error) {
    const cleanupErrors = disposeModules();
    disposeLabStatePanel();
    labState.dispose();
    viewport.dispose();
    disposeCommunicationLogPanel();
    disposeExecutionPlanPanel();
    communication.dispose();
    services.clear();
    scene.dispose();
    engine.dispose();
    if (cleanupErrors.length) {
      throw new AggregateError([error, ...cleanupErrors], 'Lab 初始化失败，并且回滚期间发生错误。', { cause: error });
    }
    throw error;
  }

  let disposed = false;
  return {
    context,
    executionPlan,
    moduleIds: executionPlan.entries.map(({ moduleId }) => moduleId),
    dispose() {
      if (disposed) return;
      disposed = true;
      const cleanupErrors = disposeModules();
      disposeLabStatePanel();
      labState.dispose();
      viewport.dispose();
      disposeCommunicationLogPanel();
      disposeExecutionPlanPanel();
      communication.dispose();
      services.clear();
      scene.dispose();
      engine.dispose();
      if (cleanupErrors.length) console.error(new AggregateError(cleanupErrors, 'Lab 模块释放期间发生错误。'));
    },
  };
};
