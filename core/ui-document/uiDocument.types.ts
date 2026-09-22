export type UiPoint = { x: number; y: number };

export type UiAbsoluteLayout = {
  mode: 'absolute';
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
};

export type UiRectTransformLayout = {
  mode: 'rect-transform';
  anchorMin: UiPoint;
  anchorMax: UiPoint;
  pivot: UiPoint;
  anchoredPosition: UiPoint;
  sizeDelta: UiPoint;
  relativeTo: 'parent' | 'safe-area';
  zIndex: number;
};

export type UiLayout = UiAbsoluteLayout | UiRectTransformLayout;
export type UiResolvedNode = Omit<UiNode, 'layout'> & { layout: UiAbsoluteLayout };

export type UiBinding = {
  source: string;
  fallback?: unknown;
};

export type UiNode = {
  id: string;
  type: string;
  definitionVersion: number;
  name: string;
  parentId: string | null;
  childIds: string[];
  layout: UiLayout;
  visible: boolean;
  locked: boolean;
  opacity: number;
  props: Record<string, unknown>;
  bindings?: Record<string, UiBinding>;
};

export type UiCanvasSettings = {
  width: number;
  height: number;
  backgroundTop: string;
  backgroundBottom: string;
  gridSize: number;
  safeArea?: { top: number; right: number; bottom: number; left: number };
};

export type UiDocument = {
  schemaVersion: 2;
  presetKey: string;
  name: string;
  canvas: UiCanvasSettings;
  rootIds: string[];
  nodes: Record<string, UiNode>;
  previewContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type UiDocumentLibrary = Record<string, UiDocument>;

export type UiDiagnostic = {
  severity: 'warning' | 'error';
  message: string;
  nodeId?: string;
};

export type UiPropertyOption = { value: string; label: string };

export type UiPropertyField = {
  path: string;
  label: string;
  control: 'text' | 'textarea' | 'number' | 'color' | 'checkbox' | 'select';
  group?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: UiPropertyOption[];
};

export type UiRenderRuntime = {
  mode: 'edit' | 'preview' | 'runtime';
  assets: {
    getImage(assetId: string): CanvasImageSource | undefined;
  };
  resolveBinding(path: string, fallback?: unknown): unknown;
  requestRender(): void;
};

export type UiDefinition<TProps extends Record<string, unknown> = Record<string, unknown>> = {
  type: string;
  version: number;
  label: string;
  category: string;
  description?: string;
  defaultSize: { width: number; height: number };
  fields: UiPropertyField[];
  createDefaultProps(): TProps;
  normalizeProps(value: unknown): TProps;
  migrateProps?(value: unknown, fromVersion: number): TProps;
  validate?(props: TProps): UiDiagnostic[];
  render(ctx: CanvasRenderingContext2D, node: UiNode & { props: TProps }, runtime: UiRenderRuntime): void;
  hitTest?(point: UiPoint, node: UiNode & { props: TProps }): boolean;
};
