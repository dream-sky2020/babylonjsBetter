export const DIALOGUE_MAP_GRID_SIZE = 24;
export type DialogueNodeShape = 'rectangle' | 'rounded' | 'diamond' | 'hexagon' | 'pill' | 'document';
export type DialogueNodeKind = 'condition' | 'choice' | 'event';

/** Missing flags retain the original editor spacing. */
export const DIALOGUE_NODE_WHITESPACE_DEFAULTS = Object.freeze({
  header: true, content: true, outputs: true, top: true, sections: true, bottom: true, height: true,
});
export type DialogueNodeWhitespace = Record<keyof typeof DIALOGUE_NODE_WHITESPACE_DEFAULTS, boolean>;

export type DialogueNodeDisplay = {
  whitespace?: Partial<DialogueNodeWhitespace>;
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
export type DialogueScalar = string | number | boolean | null;
export type DialogueValue =
  | { type: 'literal'; value: DialogueScalar }
  | { type: 'memory'; key: string; path: string[] };
export type DialogueComparison = { type: 'compare'; left: DialogueValue; operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'; right: DialogueValue };
export type DialogueCondition = DialogueComparison | { type: 'all' | 'any'; conditions: DialogueComparison[] };
export type DialogueEffect = { type: 'event'; eventType: string; version: number; payload?: Record<string, DialogueValue> };
export type DialogueMemoryCatalogEntry = {
  key: string; label: string;
  fields: Array<{ path: string[]; label: string; valueType: 'number' | 'string' | 'boolean' | 'null'; nullable?: boolean }>;
};
export type DialogueEventCatalogEntry = {
  eventType: string; version: number; label: string;
  fields: Array<{ name: string; valueType: 'number' | 'string' | 'boolean' | 'null'; nullable?: boolean; required?: boolean }>;
};
export type DialogueRuleCatalog = { memories: readonly DialogueMemoryCatalogEntry[]; events: readonly DialogueEventCatalogEntry[] };
export type DialogueOutputPort = {
  id: string;
  label?: string;
  branch: 'next' | 'true' | 'false' | 'choice';
};

type DialogueNodeBase = {
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
  tags?: string[];
};
export type DialogueEditorNode = DialogueNodeBase & (
  | { kind: 'condition'; condition?: DialogueCondition }
  | { kind: 'choice' }
  | { kind: 'event'; mode: 'send' | 'wait'; events: DialogueEffect[] }
);

export type DialogueEditorEndpoint = { nodeId: string; portId: string };
export type DialogueEditorEdge = { id: string; from: DialogueEditorEndpoint; to: DialogueEditorEndpoint; label?: string };
export type DialogueEditorGraph = { nodes: Map<string, DialogueEditorNode>; edges: Map<string, DialogueEditorEdge> };
export type DialogueEditorDocument = { schemaVersion: 5; presetKey: string; name: string; graph: DialogueEditorGraph };
export type DialogueEditorDocumentLibrary = Record<string, DialogueEditorDocument>;
export type DialogueEditorWorkspaceState = { previewEntryByPreset: Record<string, string | undefined> };

export type DialogueEditorSelection =
  | { kind: 'node'; nodeId: string }
  | { kind: 'spacing'; nodeId: string }
  | { kind: 'event'; nodeId: string; eventIndex?: number }
  | { kind: 'event-mode'; nodeId: string }
  | { kind: 'condition-mode'; nodeId: string }
  | { kind: 'condition'; nodeId: string; conditionIndex: number }
  | { kind: 'line'; nodeId: string; lineId: string }
  | { kind: 'input'; nodeId: string; portId: string }
  | { kind: 'output'; nodeId: string; portId: string }
  | { kind: 'edge'; edgeId: string };

export type DialogueEditorSelectionTarget =
  | { kind: 'node'; node: DialogueEditorNode }
  | { kind: 'spacing'; node: DialogueEditorNode }
  | { kind: 'event'; node: DialogueEditorNode; eventIndex: number }
  | { kind: 'event-mode'; node: DialogueEditorNode }
  | { kind: 'condition-mode'; node: DialogueEditorNode }
  | { kind: 'condition'; node: DialogueEditorNode; conditionIndex: number }
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

type StoredNode<T> = T extends DialogueEditorNode ? Omit<T, 'lines' | 'inputs' | 'outputs'> & {
  lines: Record<string, DialogueEditorLine>;
  inputs: Record<string, DialogueInputPort>;
  outputs: Record<string, DialogueOutputPort>;
} : never;
export type StoredDialogueEditorNode = StoredNode<DialogueEditorNode>;
export type StoredDialogueEditorDocument = Omit<DialogueEditorDocument, 'graph'> & {
  graph: { nodes: Record<string, StoredDialogueEditorNode>; edges: Record<string, DialogueEditorEdge> };
};
export type StoredDialogueEditorDocumentLibrary = Record<string, StoredDialogueEditorDocument>;

