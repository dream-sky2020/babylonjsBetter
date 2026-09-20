export const DIALOGUE_MAP_GRID_SIZE = 24;
export type DialogueNodeShape = 'rectangle' | 'rounded' | 'diamond' | 'hexagon' | 'pill' | 'document';
export type DialogueNoAvailableOutputPolicy = 'end' | 'show-unavailable' | 'runtime-error';

export type DialogueNodeDisplay = {
  shape: DialogueNodeShape;
  colorToken: string;
  widthUnits: number;
  heightUnits: number;
  headerColorToken?: string;
  icon?: string;
  collapsed?: boolean;
  showSpeakerList?: boolean;
  showPreviewText?: boolean;
};

export type DialogueEditorLine = { id: string; speaker: string; text: string };
export type DialogueInputPort = { id: string; label?: string };
export type DialogueOutputActivation =
  | { type: 'choice' }
  | { type: 'auto'; priority?: number }
  | { type: 'event'; eventId: string };
export type DialogueOutputPort = {
  id: string;
  label?: string;
  activation: DialogueOutputActivation;
  condition?: string;
  effects?: string[];
};

export type DialogueEditorNode = {
  id: string;
  title: string;
  position: { x: number; y: number };
  display: DialogueNodeDisplay;
  lines: Map<string, DialogueEditorLine>;
  lineOrder: string[];
  inputs: Map<string, DialogueInputPort>;
  inputOrder: string[];
  outputs: Map<string, DialogueOutputPort>;
  outputOrder: string[];
  noAvailableOutput?: DialogueNoAvailableOutputPolicy;
  tags?: string[];
};

export type DialogueEditorEndpoint = { nodeId: string; portId: string };
export type DialogueEditorEdge = { id: string; from: DialogueEditorEndpoint; to: DialogueEditorEndpoint; label?: string };
export type DialogueEditorGraph = { nodes: Map<string, DialogueEditorNode>; edges: Map<string, DialogueEditorEdge> };
export type DialogueEditorDocument = { schemaVersion: 3; presetKey: string; name: string; graph: DialogueEditorGraph };
export type DialogueEditorDocumentLibrary = Record<string, DialogueEditorDocument>;
export type DialogueEditorWorkspaceState = { previewEntryByPreset: Record<string, string | undefined> };

export type DialogueEditorSelection =
  | { kind: 'node'; nodeId: string }
  | { kind: 'line'; nodeId: string; lineId: string }
  | { kind: 'input'; nodeId: string; portId: string }
  | { kind: 'output'; nodeId: string; portId: string }
  | { kind: 'edge'; edgeId: string };

export type DialogueEditorSelectionTarget =
  | { kind: 'node'; node: DialogueEditorNode }
  | { kind: 'line'; node: DialogueEditorNode; line: DialogueEditorLine }
  | { kind: 'input'; node: DialogueEditorNode; port: DialogueInputPort }
  | { kind: 'output'; node: DialogueEditorNode; port: DialogueOutputPort }
  | { kind: 'edge'; edge: DialogueEditorEdge };

export type DialogueMapValidationIssue = {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  nodeId?: string;
  lineId?: string;
  edgeId?: string;
  portId?: string;
};

export type DialogueMapPresetCatalogEntry = { presetKey: string; name: string; file: string };
export type DialogueMapPresetCatalog = { version: 1; presets: Record<string, DialogueMapPresetCatalogEntry> };

export type StoredDialogueEditorNode = Omit<DialogueEditorNode, 'lines' | 'inputs' | 'outputs'> & {
  lines: Record<string, DialogueEditorLine>;
  inputs: Record<string, DialogueInputPort>;
  outputs: Record<string, DialogueOutputPort>;
};
export type StoredDialogueEditorDocument = Omit<DialogueEditorDocument, 'graph'> & {
  graph: { nodes: Record<string, StoredDialogueEditorNode>; edges: Record<string, DialogueEditorEdge> };
};
export type StoredDialogueEditorDocumentLibrary = Record<string, StoredDialogueEditorDocument>;

/** V1 只用于兼容读取，编辑器不会再生成该结构。 */
export type LegacyDialogueMapPreset = {
  schemaVersion: 1;
  presetKey: string;
  name: string;
  startNodeId: string;
  nodes: Record<string, {
    id: string;
    kind: 'dialogue' | 'choice' | 'end';
    title: string;
    speaker: string;
    text: string;
    position: { x: number; y: number };
    choices: Array<{ id: string; text: string; targetNodeId?: string; condition?: string; event?: string }>;
    tags?: string[];
  }>;
};
