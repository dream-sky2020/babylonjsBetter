export type DialogueNodeKind = 'dialogue' | 'choice' | 'end';

export type DialogueChoice = {
  id: string;
  text: string;
  targetNodeId?: string;
  condition?: string;
  event?: string;
};

export type DialogueMapNode = {
  id: string;
  kind: DialogueNodeKind;
  title: string;
  speaker: string;
  text: string;
  position: { x: number; y: number };
  choices: DialogueChoice[];
  tags?: string[];
};

export type DialogueMapPreset = {
  schemaVersion: 1;
  presetKey: string;
  name: string;
  startNodeId: string;
  nodes: Record<string, DialogueMapNode>;
};

export type DialogueMapPresetLibrary = Record<string, DialogueMapPreset>;

export type DialogueMapPresetCatalogEntry = {
  presetKey: string;
  name: string;
  file: string;
};

export type DialogueMapPresetCatalog = {
  version: 1;
  presets: Record<string, DialogueMapPresetCatalogEntry>;
};

export type DialogueMapValidationIssue = {
  code: string;
  message: string;
  nodeId?: string;
  choiceId?: string;
};
