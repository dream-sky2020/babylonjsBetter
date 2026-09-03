import { ArcRotateCamera, Engine, Scene, Vector3 } from '@babylonjs/core';
import { createRuntimeDataStore } from '@/core/runtime';
import { LabCommunication } from './labCommunication';
import { createLabCommunicationLogPanel } from './labCommunicationLogPanel';
import { LabServiceRegistry } from './labServiceRegistry';
import type { CreateLabOptions, LabContext, LabHost, LabModule } from './labKit.types';
import { LabUi } from './labUi';
import { LabViewportManager } from './labViewportManager';

const resolveModules = (requested: readonly string[], catalog: CreateLabOptions['catalog']): LabModule[] => {
  const result: LabModule[] = [];
  const complete = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string) => {
    if (complete.has(id)) return;
    if (visiting.has(id)) throw new Error(`Lab 模块存在循环依赖：“${[...visiting, id].join(' → ')}”。`);
    const module = catalog[id];
    if (!module) throw new Error(`找不到 Lab 模块“${id}”。`);
    visiting.add(id);
    module.dependencies?.forEach(visit);
    visiting.delete(id);
    complete.add(id);
    result.push(module);
  };
  requested.forEach(visit);
  return result;
};

export const createLab = async (options: CreateLabOptions): Promise<LabHost> => {
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
  const disposeCommunicationLogPanel = createLabCommunicationLogPanel(ui, communication.journal);
  const runtime = createRuntimeDataStore();
  const runtimeScopes = Object.freeze({
    game: runtime.createScope({ kind: 'game', key: 'main' }),
  });
  const context: LabContext = {
    runtime,
    runtimeScopes,
    engine,
    scene,
    camera,
    canvas,
    viewport,
    communication: communication.scope('lab:host'),
    communicationJournal: communication.journal,
    services,
    ui,
  };
  const modules = resolveModules(options.modules, options.catalog);
  const cleanups: Array<() => void> = [];
  const starts: Array<() => void | Promise<void>> = [];

  try {
    for (const module of modules) {
      const moduleCommunication = communication.scope(module.id);
      let cleanup: void | (() => void);
      try {
        const result = await module.setup({ ...context, communication: moduleCommunication });
        if (typeof result === 'function') cleanup = result;
        else if (result) {
          cleanup = result.dispose;
          if (result.start) starts.push(result.start);
        }
      } catch (error) {
        moduleCommunication.dispose();
        throw error;
      }
      cleanups.unshift(() => {
        try { cleanup?.(); } finally { moduleCommunication.dispose(); }
      });
    }
    for (const start of starts) await start();
    engine.runRenderLoop(() => {
      if (!viewport.isBabylonRenderingPaused) scene.render();
    });
    context.ui.setStatus(`已组合 ${modules.length} 个 Lab 模块。`);
  } catch (error) {
    cleanups.forEach((cleanup) => cleanup());
    runtime.dispose();
    viewport.dispose();
    disposeCommunicationLogPanel();
    communication.dispose();
    services.clear();
    scene.dispose();
    engine.dispose();
    throw error;
  }

  let disposed = false;
  return {
    context,
    moduleIds: modules.map(({ id }) => id),
    dispose() {
      if (disposed) return;
      disposed = true;
      cleanups.forEach((cleanup) => cleanup());
      runtime.dispose();
      viewport.dispose();
      disposeCommunicationLogPanel();
      communication.dispose();
      services.clear();
      scene.dispose();
      engine.dispose();
    },
  };
};
