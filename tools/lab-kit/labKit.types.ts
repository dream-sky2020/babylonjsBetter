import type { ArcRotateCamera, Engine, Scene } from '@babylonjs/core';
import type { LabState, LabStateSnapshot } from './lab-state';
import type { LabCommunicationScope } from './labCommunication';
import type { LabCommunicationJournalReader } from './labCommunicationJournal';
import type { LabServiceScope } from './labServiceRegistry';
import type { LabExecutionPlan } from './execution-plan';
import type { LabUi } from './labUi';
import type { LabViewportManager } from './labViewportManager';
import type { LabKeyboardRouter } from './keyboard';
import type { CameraLabController } from '@/core/camera/cameraLabController.ts';

export type LabContext = {
  /** 当前 Lab 独占的活数据引用注册中心；模块仍直接使用自己持有的引用。 */
  labState: LabState;
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  /** 当前活动相机及其模式、姿态和输入控制。 */
  cameraController: CameraLabController;
  /** Babylon.js 底层 Canvas；业务可视化覆盖层应通过 viewport 创建。 */
  canvas: HTMLCanvasElement;
  viewport: LabViewportManager;
  /** Host 必备的同步键盘输入仲裁器。 */
  keyboard: LabKeyboardRouter;
  /** 类型化的请求/事件通信端点；每个模块获得独立作用域并由 Host 自动清理。 */
  communication: LabCommunicationScope;
  /** 当前 Lab 必备的只读通信日志仓库。 */
  communicationJournal: LabCommunicationJournalReader;
  /** 当前模块的服务作用域；只能在 setup 注册服务，并只能读取依赖模块拥有的服务。 */
  services: LabServiceScope;
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
  /** 在全部模块 setup 并注册引用后、所有 start 执行前恢复。 */
  initialState?: LabStateSnapshot;
};

export type LabHost = {
  context: LabContext;
  executionPlan: LabExecutionPlan;
  moduleIds: readonly string[];
  dispose(): void;
};
