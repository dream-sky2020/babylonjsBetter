import type { ArcRotateCamera, Engine, Scene } from '@babylonjs/core';
import type { LabEventBus } from './labEventBus';
import type { LabServiceRegistry } from './labServiceRegistry';
import type { LabUi } from './labUi';

export type LabContext = {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  canvas: HTMLCanvasElement;
  events: LabEventBus;
  services: LabServiceRegistry;
  ui: LabUi;
};

export type LabModule = {
  id: string;
  dependencies?: readonly string[];
  setup(context: LabContext): void | (() => void) | Promise<void | (() => void)>;
};

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
