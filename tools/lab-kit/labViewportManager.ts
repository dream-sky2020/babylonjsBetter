import type { ArcRotateCamera } from '@babylonjs/core';
import type {
  LabCanvasRenderContext,
  LabViewportCanvasLayerHandle,
  LabViewportHtmlLayerHandle,
  LabViewportLayerMode,
  OpenLabCanvasLayerOptions,
  OpenLabHtmlLayerOptions,
} from './labViewport.types';

type LayerEntry = {
  id: string;
  mode: LabViewportLayerMode;
  root: HTMLDivElement;
  interactive: boolean;
  pauseBabylonRendering: boolean;
  visible: boolean;
  disposeContent?: () => void;
  resize?: () => void;
};

const requireLayerId = (value: string): string => {
  const id = value.trim();
  if (!id) throw new Error('Viewport Layer ID 不能为空。');
  return id;
};

export class LabViewportManager {
  private readonly overlayHost: HTMLDivElement;
  private readonly layers = new Map<string, LayerEntry>();
  private readonly resizeObserver: ResizeObserver;
  private exclusiveLayerId: string | null = null;
  private disposed = false;

  constructor(
    readonly root: HTMLElement,
    readonly babylonCanvas: HTMLCanvasElement,
    private readonly camera: ArcRotateCamera,
    private readonly resizeBabylon: () => void,
  ) {
    this.overlayHost = document.createElement('div');
    this.overlayHost.className = 'lab-viewport-overlays';
    root.append(this.overlayHost);
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeBabylon();
      this.layers.forEach((entry) => {
        if (entry.visible) entry.resize?.();
      });
    });
    this.resizeObserver.observe(root);
  }

  get isBabylonRenderingPaused(): boolean {
    return [...this.layers.values()].some((entry) => entry.visible && entry.pauseBabylonRendering);
  }

  get visibleLayerIds(): readonly string[] {
    return [...this.layers.values()].filter(({ visible }) => visible).map(({ id }) => id);
  }

  private requireAvailableId(idValue: string): string {
    if (this.disposed) throw new Error('LabViewportManager 已释放。');
    const id = requireLayerId(idValue);
    if (this.layers.has(id)) throw new Error(`Viewport Layer ID 重复：“${id}”。`);
    return id;
  }

  private createShell(options: OpenLabCanvasLayerOptions | OpenLabHtmlLayerOptions): LayerEntry & {
    body: HTMLDivElement;
  } {
    const id = this.requireAvailableId(options.id);
    const root = document.createElement('div');
    root.className = `lab-viewport-layer is-${options.mode}`;
    root.dataset.viewportLayer = id;
    root.hidden = true;
    root.style.pointerEvents = options.interactive === false ? 'none' : 'auto';

    const toolbar = document.createElement('div');
    toolbar.className = 'lab-viewport-layer-toolbar';
    const title = document.createElement('strong');
    title.textContent = options.title;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'lab-viewport-layer-close';
    close.textContent = '×';
    close.title = '关闭可视化面板';
    close.setAttribute('aria-label', `关闭“${options.title}”`);
    toolbar.append(title);
    if (options.closable !== false) toolbar.append(close);

    const body = document.createElement('div');
    body.className = 'lab-viewport-layer-body';
    root.append(toolbar, body);
    this.overlayHost.append(root);

    const entry: LayerEntry = {
      id,
      mode: options.mode,
      root,
      interactive: options.interactive !== false,
      pauseBabylonRendering: options.pauseBabylonRendering === true,
      visible: false,
    };
    close.addEventListener('click', () => this.hide(id));
    this.layers.set(id, entry);
    return { ...entry, body };
  }

  private syncBabylonInput(): void {
    const locked = [...this.layers.values()].some((entry) => entry.visible && entry.interactive);
    if (locked) this.camera.detachControl();
    else this.camera.attachControl(this.babylonCanvas, true);
  }

  private show(id: string): void {
    const entry = this.layers.get(id);
    if (!entry || entry.visible) return;
    if (entry.mode === 'exclusive' && this.exclusiveLayerId && this.exclusiveLayerId !== id) {
      this.hide(this.exclusiveLayerId);
    }
    entry.visible = true;
    entry.root.hidden = false;
    entry.root.classList.add('is-visible');
    if (entry.mode === 'exclusive') this.exclusiveLayerId = id;
    entry.resize?.();
    this.syncBabylonInput();
  }

  private hide(id: string): void {
    const entry = this.layers.get(id);
    if (!entry || !entry.visible) return;
    entry.visible = false;
    entry.root.hidden = true;
    entry.root.classList.remove('is-visible');
    if (this.exclusiveLayerId === id) this.exclusiveLayerId = null;
    this.syncBabylonInput();
  }

  openCanvasLayer(options: OpenLabCanvasLayerOptions): LabViewportCanvasLayerHandle {
    const shell = this.createShell(options);
    const entry = this.layers.get(shell.id)!;
    const canvas = document.createElement('canvas');
    canvas.className = 'lab-viewport-layer-canvas';
    shell.body.append(canvas);
    const context2d = canvas.getContext('2d');
    if (!context2d) {
      this.disposeLayer(shell.id);
      throw new Error(`Viewport Canvas“${shell.id}”无法创建 2D Context。`);
    }

    let renderFrame = 0;
    let continuousFrame = 0;
    let continuous = false;
    const render = () => {
      renderFrame = 0;
      if (!entry.visible) return;
      const rect = shell.body.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
      const pixelWidth = Math.round(width * pixelRatio);
      const pixelHeight = Math.round(height * pixelRatio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      context2d.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      if (options.clearColor) {
        context2d.fillStyle = options.clearColor;
        context2d.fillRect(0, 0, width, height);
      } else {
        context2d.clearRect(0, 0, width, height);
      }
      const payload: LabCanvasRenderContext = { canvas, context2d, width, height, pixelRatio };
      options.onRender?.(payload);
    };
    const requestRender = () => {
      if (renderFrame || !entry.visible) return;
      renderFrame = requestAnimationFrame(render);
    };
    const continuousTick = () => {
      if (!continuous || !entry.visible) {
        continuousFrame = 0;
        return;
      }
      render();
      continuousFrame = requestAnimationFrame(continuousTick);
    };
    entry.resize = requestRender;
    entry.disposeContent = () => {
      if (renderFrame) cancelAnimationFrame(renderFrame);
      if (continuousFrame) cancelAnimationFrame(continuousFrame);
      renderFrame = 0;
      continuousFrame = 0;
      continuous = false;
    };

    const handle: LabViewportCanvasLayerHandle = {
      id: entry.id,
      mode: entry.mode,
      root: entry.root,
      canvas,
      get visible() { return entry.visible; },
      show: () => { this.show(entry.id); requestRender(); if (continuous && !continuousFrame) continuousFrame = requestAnimationFrame(continuousTick); },
      hide: () => this.hide(entry.id),
      toggle: () => entry.visible ? this.hide(entry.id) : handle.show(),
      requestRender,
      setContinuousRendering: (enabled) => {
        continuous = enabled;
        if (continuous && entry.visible && !continuousFrame) continuousFrame = requestAnimationFrame(continuousTick);
        if (!continuous && continuousFrame) {
          cancelAnimationFrame(continuousFrame);
          continuousFrame = 0;
        }
      },
      dispose: () => this.disposeLayer(entry.id),
    };
    if (options.initiallyVisible) handle.show();
    return handle;
  }

  openHtmlLayer(options: OpenLabHtmlLayerOptions): LabViewportHtmlLayerHandle {
    const shell = this.createShell(options);
    const entry = this.layers.get(shell.id)!;
    const content = document.createElement('div');
    content.className = 'lab-viewport-layer-html';
    shell.body.append(content);
    const handle: LabViewportHtmlLayerHandle = {
      id: entry.id,
      mode: entry.mode,
      root: entry.root,
      content,
      get visible() { return entry.visible; },
      show: () => this.show(entry.id),
      hide: () => this.hide(entry.id),
      toggle: () => entry.visible ? this.hide(entry.id) : this.show(entry.id),
      dispose: () => this.disposeLayer(entry.id),
    };
    if (options.initiallyVisible) handle.show();
    return handle;
  }

  closeLayer(id: string): void {
    this.hide(id);
  }

  disposeLayer(id: string): void {
    const entry = this.layers.get(id);
    if (!entry) return;
    this.hide(id);
    entry.disposeContent?.();
    entry.root.remove();
    this.layers.delete(id);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver.disconnect();
    [...this.layers.keys()].forEach((id) => this.disposeLayer(id));
    this.camera.detachControl();
    this.overlayHost.remove();
  }
}
