import type { ArcRotateCamera, Engine, Scene } from '@babylonjs/core';
import type { RuntimeDataStore, RuntimeScopeToken } from '@/core/runtime';
import type { LabCommunicationScope } from './labCommunication';
import type { LabCommunicationJournalReader } from './labCommunicationJournal';
import type { LabServiceRegistry } from './labServiceRegistry';
import type { LabUi } from './labUi';
import type { LabViewportManager } from './labViewportManager';

export type LabContext = {
  /** 当前 Lab 独占的中央 Runtime；同一页面内所有模块共享。 */
  runtime: RuntimeDataStore;
  /** Host 创建的稳定基础 Scope；模块不要自行创建第二个 game Scope。 */
  runtimeScopes: {
    readonly game: RuntimeScopeToken;
  };
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  /** Babylon.js 底层 Canvas；业务可视化覆盖层应通过 viewport 创建。 */
  canvas: HTMLCanvasElement;
  viewport: LabViewportManager;
  /** 类型化的请求/事件通信端点；每个模块获得独立作用域并由 Host 自动清理。 */
  communication: LabCommunicationScope;
  /** 当前 Lab 必备的只读通信日志仓库。 */
  communicationJournal: LabCommunicationJournalReader;
  services: LabServiceRegistry;
  ui: LabUi;
};

export type LabModule = {
  id: string;
  dependencies?: readonly string[];
  setup(context: LabContext): LabModuleSetupResult | Promise<LabModuleSetupResult>;
};

export type LabModuleLifecycle = {
  /** 所有模块 setup 完成后，按照依赖顺序启动。 */
  start?(): void | Promise<void>;
  dispose?(): void;
};

export type LabModuleSetupResult = void | (() => void) | LabModuleLifecycle;

export type LabModuleCatalog = Readonly<Record<string, LabModule>>;

export type CreateLabOptions = {
  root: HTMLElement;
  title: string;
  description: string;
  badge: string;
  modules: readonly string[];
  catalog: LabModuleCatalog;
};

export type LabHost = {
  context: LabContext;
  moduleIds: readonly string[];
  dispose(): void;
};
