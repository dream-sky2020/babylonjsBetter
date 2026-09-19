export const DIALOGUE_MAP_GRID_SIZE = 24;
export type DialogueNodeKind = 'dialogue' | 'choice' | 'end';
export type DialogueNodeShape = 'rectangle' | 'rounded' | 'diamond' | 'hexagon' | 'pill' | 'document';

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
export type DialogueEditorOption = { id: string; text: string; outputPortId: string; condition?: string; event?: string };
export type DialogueEditorPort = {
  id: string;
  direction: 'input' | 'output';
  role: 'flow' | 'option';
  lineId?: string;
  optionId?: string;
};

export type DialogueEditorNode = {
  id: string;
  kind: DialogueNodeKind;
  title: string;
  position: { x: number; y: number };
  display: DialogueNodeDisplay;
  lines: Map<string, DialogueEditorLine>;
  lineOrder: string[];
  options: Map<string, DialogueEditorOption>;
  optionOrder: string[];
  ports: Map<string, DialogueEditorPort>;
  tags?: string[];
};

export type DialogueEditorEndpoint = { nodeId: string; portId: string };
export type DialogueEditorEdge = { id: string; from: DialogueEditorEndpoint; to: DialogueEditorEndpoint; label?: string };
export type DialogueEditorGraph = {
  startNodeId: string;
  nodes: Map<string, DialogueEditorNode>;
  edges: Map<string, DialogueEditorEdge>;
};
export type DialogueEditorDocument = { schemaVersion: 2; presetKey: string; name: string; graph: DialogueEditorGraph };
export type DialogueEditorDocumentLibrary = Record<string, DialogueEditorDocument>;

export type DialogueEditorSelection =
  | { kind: 'node'; nodeId: string }
  | { kind: 'line'; nodeId: string; lineId: string }
  | { kind: 'option'; nodeId: string; optionId: string }
  | { kind: 'edge'; edgeId: string }
  | { kind: 'port'; nodeId: string; portId: string };

export type DialogueEditorSelectionTarget =
  | { kind: 'node'; node: DialogueEditorNode }
  | { kind: 'line'; node: DialogueEditorNode; line: DialogueEditorLine }
  | { kind: 'option'; node: DialogueEditorNode; option: DialogueEditorOption }
  | { kind: 'edge'; edge: DialogueEditorEdge }
  | { kind: 'port'; node: DialogueEditorNode; port: DialogueEditorPort };

export type DialogueMapValidationIssue = {
  code: string;
  message: string;
  nodeId?: string;
  lineId?: string;
  optionId?: string;
  edgeId?: string;
  portId?: string;
};

export type DialogueMapPresetCatalogEntry = { presetKey: string; name: string; file: string };
export type DialogueMapPresetCatalog = { version: 1; presets: Record<string, DialogueMapPresetCatalogEntry> };

export type StoredDialogueEditorNode = Omit<DialogueEditorNode, 'lines' | 'options' | 'ports'> & {
  lines: Record<string, DialogueEditorLine>;
  options: Record<string, DialogueEditorOption>;
  ports: Record<string, DialogueEditorPort>;
};
export type StoredDialogueEditorDocument = Omit<DialogueEditorDocument, 'graph'> & {
  graph: { startNodeId: string; nodes: Record<string, StoredDialogueEditorNode>; edges: Record<string, DialogueEditorEdge> };
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
    kind: DialogueNodeKind;
    title: string;
    speaker: string;
    text: string;
    position: { x: number; y: number };
    choices: Array<{ id: string; text: string; targetNodeId?: string; condition?: string; event?: string }>;
    tags?: string[];
  }>;
};
