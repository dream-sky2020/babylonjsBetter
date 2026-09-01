export type LabViewportLayerMode = 'overlay' | 'exclusive';

export type LabViewportLayerOptions = {
  id: string;
  title: string;
  mode: LabViewportLayerMode;
  interactive?: boolean;
  initiallyVisible?: boolean;
  pauseBabylonRendering?: boolean;
  closable?: boolean;
};

export type LabCanvasRenderContext = {
  canvas: HTMLCanvasElement;
  context2d: CanvasRenderingContext2D;
  width: number;
  height: number;
  pixelRatio: number;
};

export type OpenLabCanvasLayerOptions = LabViewportLayerOptions & {
  clearColor?: string;
  onRender?: (context: LabCanvasRenderContext) => void;
};

export type OpenLabHtmlLayerOptions = LabViewportLayerOptions;

export type LabViewportLayerHandle = {
  readonly id: string;
  readonly mode: LabViewportLayerMode;
  readonly root: HTMLDivElement;
  readonly visible: boolean;
  show(): void;
  hide(): void;
  toggle(): void;
  dispose(): void;
};

export type LabViewportCanvasLayerHandle = LabViewportLayerHandle & {
  readonly canvas: HTMLCanvasElement;
  requestRender(): void;
  setContinuousRendering(enabled: boolean): void;
};

export type LabViewportHtmlLayerHandle = LabViewportLayerHandle & {
  readonly content: HTMLDivElement;
};
