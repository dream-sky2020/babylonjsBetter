import {
  DIALOGUE_MAP_GRID_SIZE,
  type DialogueEditorDocument, type DialogueEditorDocumentLibrary, type DialogueEditorEdge,
  type DialogueEditorLine, type DialogueEditorNode, type DialogueEditorOption, type DialogueEditorPort,
  type DialogueEditorSelection, type DialogueEditorSelectionTarget, type DialogueMapValidationIssue,
  type DialogueNodeDisplay, type DialogueNodeKind, type LegacyDialogueMapPreset,
  type StoredDialogueEditorDocument, type StoredDialogueEditorDocumentLibrary, type StoredDialogueEditorNode,
} from './dialogueMap.types.ts';

const NODE_KINDS = new Set<DialogueNodeKind>(['dialogue', 'choice', 'end']);
const NODE_SHAPES = new Set<DialogueNodeDisplay['shape']>(['rectangle', 'rounded', 'diamond', 'hexagon', 'pill', 'document']);
const requireText = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}不能为空。`);
  return value.trim();
};
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const optionalText = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const record = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}必须是对象。`);
  return value as Record<string, unknown>;
};

export const createDefaultDialogueNodeDisplay = (kind: DialogueNodeKind): DialogueNodeDisplay => {
  if (kind === 'choice') return { shape: 'rectangle', colorToken: 'violet-muted', headerColorToken: 'violet-header', widthUnits: 11, heightUnits: 7, showSpeakerList: true, showPreviewText: true };
  if (kind === 'end') return { shape: 'rectangle', colorToken: 'red-muted', headerColorToken: 'red-header', widthUnits: 9, heightUnits: 5, showSpeakerList: true, showPreviewText: true };
  return { shape: 'rectangle', colorToken: 'blue-muted', headerColorToken: 'blue-header', widthUnits: 10, heightUnits: 6, showSpeakerList: true, showPreviewText: true };
};

export const dialogueNodeInputPortId = (nodeId: string): string => `port:${nodeId}:in`;
export const dialogueOptionOutputPortId = (nodeId: string, optionId: string): string => `port:${nodeId}:option:${optionId}`;
export const dialogueLineId = (nodeId: string, suffix = 'main'): string => `line:${nodeId}:${suffix}`;
export const dialogueEdgeId = (nodeId: string, optionId: string): string => `edge:${nodeId}:${optionId}`;

export const createDialogueEditorNode = (id: string, kind: DialogueNodeKind, position: { x: number; y: number }): DialogueEditorNode => {
  const inputPortId = dialogueNodeInputPortId(id);
  const lineId = dialogueLineId(id);
  return {
    id, kind, title: kind === 'choice' ? '新选择' : kind === 'end' ? '结束' : '新对话', position,
    display: createDefaultDialogueNodeDisplay(kind),
    lines: new Map([[lineId, { id: lineId, speaker: '', text: '' }]]), lineOrder: [lineId],
    options: new Map(), optionOrder: [],
    ports: new Map([[inputPortId, { id: inputPortId, direction: 'input', role: 'flow' }]]),
  };
};

export const createDialogueEditorDocument = (presetKey: string, name: string): DialogueEditorDocument => {
  const start = createDialogueEditorNode('start', 'dialogue', { x: 96, y: 96 });
  const line = start.lines.get(start.lineOrder[0])!;
  start.title = '开场'; line.speaker = '旁白'; line.text = '在这里写下第一句对话。';
  return { schemaVersion: 2, presetKey, name, graph: { startNodeId: start.id, nodes: new Map([[start.id, start]]), edges: new Map() } };
};

const parseDisplay = (value: unknown, kind: DialogueNodeKind): DialogueNodeDisplay => {
  const raw = record(value, '节点显示数据');
  const defaults = createDefaultDialogueNodeDisplay(kind);
  return {
    shape: NODE_SHAPES.has(raw.shape as DialogueNodeDisplay['shape']) ? raw.shape as DialogueNodeDisplay['shape'] : defaults.shape,
    colorToken: optionalText(raw.colorToken) ?? defaults.colorToken,
    widthUnits: Number(raw.widthUnits), heightUnits: Number(raw.heightUnits),
    ...(optionalText(raw.headerColorToken) ? { headerColorToken: raw.headerColorToken as string } : {}),
    ...(optionalText(raw.icon) ? { icon: raw.icon as string } : {}),
    ...(typeof raw.collapsed === 'boolean' ? { collapsed: raw.collapsed } : {}),
    ...(typeof raw.showSpeakerList === 'boolean' ? { showSpeakerList: raw.showSpeakerList } : {}),
    ...(typeof raw.showPreviewText === 'boolean' ? { showPreviewText: raw.showPreviewText } : {}),
  };
};
const parseLine = (value: unknown, key: string): DialogueEditorLine => {
  const raw = record(value, `对白“${key}”`);
  return { id: requireText(raw.id, '对白 ID'), speaker: text(raw.speaker), text: text(raw.text) };
};
const parseOption = (value: unknown, key: string): DialogueEditorOption => {
  const raw = record(value, `选项“${key}”`);
  return { id: requireText(raw.id, '选项 ID'), text: text(raw.text), outputPortId: requireText(raw.outputPortId, '选项输出端口 ID'), ...(optionalText(raw.condition) ? { condition: raw.condition as string } : {}), ...(optionalText(raw.event) ? { event: raw.event as string } : {}) };
};
const parsePort = (value: unknown, key: string): DialogueEditorPort => {
  const raw = record(value, `端口“${key}”`);
  return { id: requireText(raw.id, '端口 ID'), direction: raw.direction === 'output' ? 'output' : 'input', role: raw.role === 'option' ? 'option' : 'flow', ...(optionalText(raw.lineId) ? { lineId: raw.lineId as string } : {}), ...(optionalText(raw.optionId) ? { optionId: raw.optionId as string } : {}) };
};
const parseStoredNode = (value: unknown, key: string): DialogueEditorNode => {
  const raw = record(value, `节点“${key}”`);
  const kind = NODE_KINDS.has(raw.kind as DialogueNodeKind) ? raw.kind as DialogueNodeKind : 'dialogue';
  const position = record(raw.position, `节点“${key}”的位置`);
  const lines = record(raw.lines, `节点“${key}”的对白`);
  const options = record(raw.options, `节点“${key}”的选项`);
  const ports = record(raw.ports, `节点“${key}”的端口`);
  return {
    id: requireText(raw.id, '节点 ID'), kind, title: text(raw.title), position: { x: Number(position.x), y: Number(position.y) }, display: parseDisplay(raw.display, kind),
    lines: new Map(Object.entries(lines).map(([id, item]) => [id, parseLine(item, id)])), lineOrder: Array.isArray(raw.lineOrder) ? raw.lineOrder.filter((id): id is string => typeof id === 'string') : Object.keys(lines),
    options: new Map(Object.entries(options).map(([id, item]) => [id, parseOption(item, id)])), optionOrder: Array.isArray(raw.optionOrder) ? raw.optionOrder.filter((id): id is string => typeof id === 'string') : Object.keys(options),
    ports: new Map(Object.entries(ports).map(([id, item]) => [id, parsePort(item, id)])),
    ...(Array.isArray(raw.tags) ? { tags: raw.tags.filter((tag): tag is string => typeof tag === 'string') } : {}),
  };
};
const parseEdge = (value: unknown, key: string): DialogueEditorEdge => {
  const raw = record(value, `连线“${key}”`); const from = record(raw.from, '连线起点'); const to = record(raw.to, '连线终点');
  return { id: requireText(raw.id, '连线 ID'), from: { nodeId: requireText(from.nodeId, '起点节点 ID'), portId: requireText(from.portId, '起点端口 ID') }, to: { nodeId: requireText(to.nodeId, '终点节点 ID'), portId: requireText(to.portId, '终点端口 ID') }, ...(optionalText(raw.label) ? { label: raw.label as string } : {}) };
};

const parseV2Document = (value: unknown, expectedKey?: string): DialogueEditorDocument => {
  const raw = record(value, '对话编辑器文档'); const presetKey = requireText(raw.presetKey, '对话预设 Key');
  if (raw.schemaVersion !== 2) throw new Error('对话编辑器文档 schemaVersion 必须为 2。');
  if (expectedKey && expectedKey !== presetKey) throw new Error(`对话预设“${expectedKey}”的 presetKey 不一致。`);
  const graph = record(raw.graph, '对话图'); const nodes = record(graph.nodes, '对话图节点'); const edges = record(graph.edges, '对话图连线');
  return { schemaVersion: 2, presetKey, name: requireText(raw.name, '对话预设名称'), graph: { startNodeId: requireText(graph.startNodeId, '起始节点 ID'), nodes: new Map(Object.entries(nodes).map(([key, node]) => [key, parseStoredNode(node, key)])), edges: new Map(Object.entries(edges).map(([key, edge]) => [key, parseEdge(edge, key)])) } };
};

export const migrateLegacyDialogueMapPreset = (value: unknown, expectedKey?: string): DialogueEditorDocument => {
  const raw = record(value, '旧对话预设') as Partial<LegacyDialogueMapPreset> & Record<string, unknown>;
  if (raw.schemaVersion !== 1) throw new Error('旧对话预设 schemaVersion 必须为 1。');
  const presetKey = requireText(raw.presetKey, '对话预设 Key');
  if (expectedKey && expectedKey !== presetKey) throw new Error(`对话预设“${expectedKey}”的 presetKey 不一致。`);
  const legacyNodes = record(raw.nodes, '旧对话节点'); const nodes = new Map<string, DialogueEditorNode>(); const edges = new Map<string, DialogueEditorEdge>();
  Object.entries(legacyNodes).forEach(([nodeKey, value]) => {
    const legacy = record(value, `旧节点“${nodeKey}”`); const id = requireText(legacy.id, '旧节点 ID');
    const kind = NODE_KINDS.has(legacy.kind as DialogueNodeKind) ? legacy.kind as DialogueNodeKind : 'dialogue'; const position = record(legacy.position, '旧节点位置');
    const node = createDialogueEditorNode(id, kind, { x: Number(position.x), y: Number(position.y) });
    node.title = text(legacy.title); node.tags = Array.isArray(legacy.tags) ? legacy.tags.filter((tag): tag is string => typeof tag === 'string') : undefined;
    const line = node.lines.get(node.lineOrder[0])!; line.speaker = text(legacy.speaker); line.text = text(legacy.text);
    const choices = Array.isArray(legacy.choices) ? legacy.choices : [];
    choices.forEach((choiceValue, index) => {
      const choice = record(choiceValue, `旧节点“${id}”的第 ${index + 1} 个选项`); const optionId = requireText(choice.id, '旧选项 ID'); const portId = dialogueOptionOutputPortId(id, optionId);
      node.options.set(optionId, { id: optionId, text: text(choice.text), outputPortId: portId, ...(optionalText(choice.condition) ? { condition: choice.condition as string } : {}), ...(optionalText(choice.event) ? { event: choice.event as string } : {}) });
      node.optionOrder.push(optionId); node.ports.set(portId, { id: portId, direction: 'output', role: 'option', optionId });
      const targetNodeId = optionalText(choice.targetNodeId);
      if (targetNodeId) { const edgeId = dialogueEdgeId(id, optionId); edges.set(edgeId, { id: edgeId, from: { nodeId: id, portId }, to: { nodeId: targetNodeId, portId: dialogueNodeInputPortId(targetNodeId) } }); }
    });
    node.display.heightUnits = Math.max(node.display.heightUnits, 5 + node.optionOrder.length); nodes.set(nodeKey, node);
  });
  return { schemaVersion: 2, presetKey, name: requireText(raw.name, '对话预设名称'), graph: { startNodeId: requireText(raw.startNodeId, '起始节点 ID'), nodes, edges } };
};

export const parseDialogueEditorDocument = (value: unknown, expectedKey?: string): DialogueEditorDocument => record(value, '对话预设').schemaVersion === 1 ? migrateLegacyDialogueMapPreset(value, expectedKey) : parseV2Document(value, expectedKey);
const encodeNode = (node: DialogueEditorNode): StoredDialogueEditorNode => ({ ...node, position: { ...node.position }, display: { ...node.display }, lines: Object.fromEntries(node.lines), lineOrder: [...node.lineOrder], options: Object.fromEntries(node.options), optionOrder: [...node.optionOrder], ports: Object.fromEntries(node.ports), ...(node.tags ? { tags: [...node.tags] } : {}) });
export const encodeDialogueEditorDocument = (document: DialogueEditorDocument): StoredDialogueEditorDocument => ({ schemaVersion: 2, presetKey: document.presetKey, name: document.name, graph: { startNodeId: document.graph.startNodeId, nodes: Object.fromEntries([...document.graph.nodes].map(([key, node]) => [key, encodeNode(node)])), edges: Object.fromEntries([...document.graph.edges].map(([key, edge]) => [key, { ...edge, from: { ...edge.from }, to: { ...edge.to } }])) } });
export const encodeDialogueEditorDocumentLibrary = (library: DialogueEditorDocumentLibrary): StoredDialogueEditorDocumentLibrary => Object.fromEntries(Object.entries(library).map(([key, document]) => [key, encodeDialogueEditorDocument(document)]));
export const cloneDialogueEditorDocument = (document: DialogueEditorDocument): DialogueEditorDocument => parseDialogueEditorDocument(encodeDialogueEditorDocument(document), document.presetKey);

export const resolveDialogueEditorSelection = (document: DialogueEditorDocument, selection: DialogueEditorSelection): DialogueEditorSelectionTarget | undefined => {
  if (selection.kind === 'edge') { const edge = document.graph.edges.get(selection.edgeId); return edge ? { kind: 'edge', edge } : undefined; }
  const node = document.graph.nodes.get(selection.nodeId); if (!node) return undefined;
  if (selection.kind === 'node') return { kind: 'node', node };
  if (selection.kind === 'line') { const line = node.lines.get(selection.lineId); return line ? { kind: 'line', node, line } : undefined; }
  if (selection.kind === 'option') { const option = node.options.get(selection.optionId); return option ? { kind: 'option', node, option } : undefined; }
  const port = node.ports.get(selection.portId); return port ? { kind: 'port', node, port } : undefined;
};

export const validateDialogueEditorDocument = (document: DialogueEditorDocument): DialogueMapValidationIssue[] => {
  const issues: DialogueMapValidationIssue[] = []; const { nodes, edges, startNodeId } = document.graph;
  if (!nodes.has(startNodeId)) issues.push({ code: 'missing-start', message: `起始节点“${startNodeId}”不存在。` });
  const nodeIds = new Set<string>();
  nodes.forEach((node, key) => {
    if (key !== node.id) issues.push({ code: 'node-key-mismatch', message: `节点索引“${key}”与 ID“${node.id}”不一致。`, nodeId: node.id });
    if (nodeIds.has(node.id)) issues.push({ code: 'duplicate-node-id', message: `节点 ID“${node.id}”重复。`, nodeId: node.id }); nodeIds.add(node.id);
    if (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y) || node.position.x % DIALOGUE_MAP_GRID_SIZE !== 0 || node.position.y % DIALOGUE_MAP_GRID_SIZE !== 0) issues.push({ code: 'off-grid-position', message: `节点“${node.id}”的位置必须对齐 ${DIALOGUE_MAP_GRID_SIZE}px 网格。`, nodeId: node.id });
    const { widthUnits, heightUnits } = node.display;
    if (!Number.isInteger(widthUnits) || !Number.isInteger(heightUnits) || widthUnits < 4 || heightUnits < 3 || widthUnits > 40 || heightUnits > 40) issues.push({ code: 'invalid-node-size', message: `节点“${node.id}”的宽高必须是 4–40 范围内的整数网格单位。`, nodeId: node.id });
    const lineIds = new Set<string>(); node.lines.forEach((line, lineKey) => { if (lineKey !== line.id || lineIds.has(line.id)) issues.push({ code: 'invalid-line-id', message: `节点“${node.id}”的对白 ID“${line.id}”不唯一或与索引不一致。`, nodeId: node.id, lineId: line.id }); lineIds.add(line.id); });
    node.lineOrder.forEach((lineId) => { if (!node.lines.has(lineId)) issues.push({ code: 'missing-line', message: `节点“${node.id}”引用了不存在的对白“${lineId}”。`, nodeId: node.id, lineId }); });
    const optionIds = new Set<string>(); node.options.forEach((option, optionKey) => {
      if (optionKey !== option.id || optionIds.has(option.id)) issues.push({ code: 'invalid-option-id', message: `节点“${node.id}”的选项 ID“${option.id}”不唯一或与索引不一致。`, nodeId: node.id, optionId: option.id }); optionIds.add(option.id);
      const port = node.ports.get(option.outputPortId); if (!port || port.direction !== 'output' || port.optionId !== option.id) issues.push({ code: 'invalid-option-port', message: `选项“${option.id}”没有引用有效的输出端口。`, nodeId: node.id, optionId: option.id, portId: option.outputPortId });
    });
    node.optionOrder.forEach((optionId) => { if (!node.options.has(optionId)) issues.push({ code: 'missing-option', message: `节点“${node.id}”引用了不存在的选项“${optionId}”。`, nodeId: node.id, optionId }); });
    node.ports.forEach((port, portKey) => { if (portKey !== port.id) issues.push({ code: 'port-key-mismatch', message: `节点“${node.id}”的端口索引与 ID 不一致。`, nodeId: node.id, portId: port.id }); });
  });
  const edgeIds = new Set<string>();
  edges.forEach((edge, key) => {
    if (key !== edge.id || edgeIds.has(edge.id)) issues.push({ code: 'duplicate-edge-id', message: `连线 ID“${edge.id}”重复或与索引不一致。`, edgeId: edge.id }); edgeIds.add(edge.id);
    const fromNode = nodes.get(edge.from.nodeId); const toNode = nodes.get(edge.to.nodeId);
    if (!fromNode) issues.push({ code: 'missing-edge-from-node', message: `连线“${edge.id}”的起点节点不存在。`, edgeId: edge.id, nodeId: edge.from.nodeId });
    if (!toNode) issues.push({ code: 'missing-edge-to-node', message: `连线“${edge.id}”的终点节点不存在。`, edgeId: edge.id, nodeId: edge.to.nodeId });
    const fromPort = fromNode?.ports.get(edge.from.portId); const toPort = toNode?.ports.get(edge.to.portId);
    if (!fromPort || fromPort.direction !== 'output') issues.push({ code: 'dangling-edge-from-port', message: `连线“${edge.id}”的起点端口无效。`, edgeId: edge.id, portId: edge.from.portId });
    if (!toPort || toPort.direction !== 'input') issues.push({ code: 'dangling-edge-to-port', message: `连线“${edge.id}”的终点端口无效。`, edgeId: edge.id, portId: edge.to.portId });
    if (fromNode?.kind === 'end') issues.push({ code: 'end-has-output-edge', message: `结束节点“${fromNode.id}”不应拥有输出连线。`, edgeId: edge.id, nodeId: fromNode.id });
  });
  if (nodes.has(startNodeId)) {
    const reached = new Set<string>(); const queue = [startNodeId];
    while (queue.length) { const nodeId = queue.shift()!; if (reached.has(nodeId) || !nodes.has(nodeId)) continue; reached.add(nodeId); edges.forEach((edge) => { if (edge.from.nodeId === nodeId && nodes.has(edge.to.nodeId)) queue.push(edge.to.nodeId); }); }
    nodes.forEach((node) => { if (!reached.has(node.id)) issues.push({ code: 'unreachable-node', message: `节点“${node.id}”无法从起始节点到达。`, nodeId: node.id }); });
  }
  return issues;
};

export const parseDialogueMapPreset = parseDialogueEditorDocument;
export const validateDialogueMapPreset = validateDialogueEditorDocument;
export const createDialogueMapPreset = createDialogueEditorDocument;
export const cloneDialogueMapPreset = cloneDialogueEditorDocument;
