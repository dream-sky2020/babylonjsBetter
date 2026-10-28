export type LabViewportLayerMode = 'overlay' | 'exclusive';

export type LabViewportInputGate = {
  setInputEnabled(enabled: boolean): void;
};

export type LabViewportLayerOptions = {
  id: string;
  title: string;
  mode: LabViewportLayerMode;
  interactive?: boolean;
  /** HUD: empty space passes input through; interactive descendants may receive it. */
  inputMode?: 'modal' | 'passthrough';
  /** Hide the standard viewport layer title and close controls. */
  chrome?: boolean;
  initiallyVisible?: boolean;
  pauseBabylonRendering?: boolean;
  closable?: boolean;
  /** System workspaces may cover the complete Lab instead of only its 3D stage. */
  fullWindow?: boolean;
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
