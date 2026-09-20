import {
  DIALOGUE_MAP_GRID_SIZE,
  type DialogueEditorDocument, type DialogueEditorDocumentLibrary, type DialogueEditorEdge,
  type DialogueEditorLine, type DialogueEditorNode, type DialogueEditorSelection,
  type DialogueEditorSelectionTarget, type DialogueInputPort, type DialogueMapValidationIssue,
  type DialogueNodeDisplay, type DialogueNoAvailableOutputPolicy, type DialogueOutputActivation,
  type DialogueOutputPort, type StoredDialogueEditorDocument, type StoredDialogueEditorDocumentLibrary,
  type StoredDialogueEditorNode,
} from './dialogueMap.types.ts';
import { computeDialogueNodeLayout } from './dialogueNodeLayout.ts';

const NODE_SHAPES = new Set<DialogueNodeDisplay['shape']>(['rectangle', 'rounded', 'diamond', 'hexagon', 'pill', 'document']);
const POLICIES = new Set<DialogueNoAvailableOutputPolicy>(['end', 'show-unavailable', 'runtime-error']);
const record = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}必须是对象。`);
  return value as Record<string, unknown>;
};
const requireText = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}不能为空。`);
  return value.trim();
};
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const optionalText = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const stringList = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export const createDefaultDialogueNodeDisplay = (): DialogueNodeDisplay => ({
  shape: 'rectangle', colorToken: 'blue-muted', headerColorToken: 'blue-header', widthUnits: 10, heightUnits: 6,
  showSpeakerList: true, showPreviewText: true,
});
export const dialogueNodeInputPortId = (nodeId: string): string => `port:${nodeId}:in`;
export const dialogueOutputPortId = (nodeId: string, outputId: string): string => `port:${nodeId}:output:${outputId}`;
/** 兼容旧调用方；V3 中选项已经统一为输出端口。 */
export const dialogueOptionOutputPortId = dialogueOutputPortId;
export const dialogueLineId = (nodeId: string, suffix = 'main'): string => `line:${nodeId}:${suffix}`;
export const dialogueEdgeId = (nodeId: string, outputId: string): string => `edge:${nodeId}:${outputId}`;

export const createDialogueEditorNode = (id: string, position: { x: number; y: number }): DialogueEditorNode => {
  const inputId = dialogueNodeInputPortId(id); const lineId = dialogueLineId(id);
  return {
    id, title: '新节点', position, display: createDefaultDialogueNodeDisplay(),
    lines: new Map([[lineId, { id: lineId, speaker: '', text: '' }]]), lineOrder: [lineId],
    inputs: new Map([[inputId, { id: inputId }]]), inputOrder: [inputId], outputs: new Map(), outputOrder: [],
  };
};

export const createDialogueEditorDocument = (presetKey: string, name: string): DialogueEditorDocument => {
  const node = createDialogueEditorNode('start', { x: 96, y: 96 }); const line = node.lines.get(node.lineOrder[0])!;
  node.title = '开场'; line.speaker = '旁白'; line.text = '在这里写下第一句对话。';
  return { schemaVersion: 3, presetKey, name, graph: { nodes: new Map([[node.id, node]]), edges: new Map() } };
};

const parseDisplay = (value: unknown): DialogueNodeDisplay => {
  const raw = record(value, '节点显示数据'); const defaults = createDefaultDialogueNodeDisplay();
  return {
    shape: NODE_SHAPES.has(raw.shape as DialogueNodeDisplay['shape']) ? raw.shape as DialogueNodeDisplay['shape'] : defaults.shape,
    colorToken: optionalText(raw.colorToken) ?? defaults.colorToken, widthUnits: Number(raw.widthUnits), heightUnits: Number(raw.heightUnits),
    ...(optionalText(raw.headerColorToken) ? { headerColorToken: raw.headerColorToken as string } : {}),
    ...(optionalText(raw.icon) ? { icon: raw.icon as string } : {}),
    ...(typeof raw.collapsed === 'boolean' ? { collapsed: raw.collapsed } : {}),
    ...(typeof raw.showSpeakerList === 'boolean' ? { showSpeakerList: raw.showSpeakerList } : {}),
    ...(typeof raw.showPreviewText === 'boolean' ? { showPreviewText: raw.showPreviewText } : {}),
  };
};
const parseLine = (value: unknown, key: string): DialogueEditorLine => { const raw = record(value, `对白“${key}”`); return { id: requireText(raw.id, '对白 ID'), speaker: text(raw.speaker), text: text(raw.text) }; };
const parseInput = (value: unknown, key: string): DialogueInputPort => { const raw = record(value, `输入端口“${key}”`); return { id: requireText(raw.id, '输入端口 ID'), ...(optionalText(raw.label) ? { label: raw.label as string } : {}) }; };
const parseActivation = (value: unknown): DialogueOutputActivation => {
  const raw = record(value, '输出端口激活方式');
  if (raw.type === 'auto') return { type: 'auto', ...(Number.isFinite(raw.priority) ? { priority: Number(raw.priority) } : {}) };
  if (raw.type === 'event') return { type: 'event', eventId: requireText(raw.eventId, '事件 ID') };
  return { type: 'choice' };
};
const parseOutput = (value: unknown, key: string): DialogueOutputPort => {
  const raw = record(value, `输出端口“${key}”`);
  return { id: requireText(raw.id, '输出端口 ID'), ...(optionalText(raw.label) ? { label: raw.label as string } : {}), activation: parseActivation(raw.activation), ...(optionalText(raw.condition) ? { condition: raw.condition as string } : {}), ...(stringList(raw.effects).length ? { effects: stringList(raw.effects) } : {}) };
};
const parseEdge = (value: unknown, key: string): DialogueEditorEdge => {
  const raw = record(value, `连线“${key}”`); const from = record(raw.from, '连线起点'); const to = record(raw.to, '连线终点');
  return { id: requireText(raw.id, '连线 ID'), from: { nodeId: requireText(from.nodeId, '起点节点 ID'), portId: requireText(from.portId, '起点端口 ID') }, to: { nodeId: requireText(to.nodeId, '终点节点 ID'), portId: requireText(to.portId, '终点端口 ID') }, ...(optionalText(raw.label) ? { label: raw.label as string } : {}) };
};
const parseV3Node = (value: unknown, key: string): DialogueEditorNode => {
  const raw = record(value, `节点“${key}”`); const position = record(raw.position, '节点位置'); const lines = record(raw.lines, '对白'); const inputs = record(raw.inputs, '输入端口'); const outputs = record(raw.outputs, '输出端口');
  return {
    id: requireText(raw.id, '节点 ID'), title: text(raw.title), position: { x: Number(position.x), y: Number(position.y) }, display: parseDisplay(raw.display),
    lines: new Map(Object.entries(lines).map(([id, item]) => [id, parseLine(item, id)])), lineOrder: Array.isArray(raw.lineOrder) ? stringList(raw.lineOrder) : Object.keys(lines),
    inputs: new Map(Object.entries(inputs).map(([id, item]) => [id, parseInput(item, id)])), inputOrder: Array.isArray(raw.inputOrder) ? stringList(raw.inputOrder) : Object.keys(inputs),
    outputs: new Map(Object.entries(outputs).map(([id, item]) => [id, parseOutput(item, id)])), outputOrder: Array.isArray(raw.outputOrder) ? stringList(raw.outputOrder) : Object.keys(outputs),
    ...(POLICIES.has(raw.noAvailableOutput as DialogueNoAvailableOutputPolicy) ? { noAvailableOutput: raw.noAvailableOutput as DialogueNoAvailableOutputPolicy } : {}),
    ...(stringList(raw.tags).length ? { tags: stringList(raw.tags) } : {}),
  };
};
const parseV3Document = (value: unknown, expectedKey?: string): DialogueEditorDocument => {
  const raw = record(value, '对话编辑器文档'); const presetKey = requireText(raw.presetKey, '对话预设 Key');
  if (expectedKey && expectedKey !== presetKey) throw new Error(`对话预设“${expectedKey}”的 presetKey 不一致。`);
  const graph = record(raw.graph, '对话图'); const nodes = record(graph.nodes, '对话图节点'); const edges = record(graph.edges, '对话图连线');
  return { schemaVersion: 3, presetKey, name: requireText(raw.name, '对话预设名称'), graph: { nodes: new Map(Object.entries(nodes).map(([key, node]) => [key, parseV3Node(node, key)])), edges: new Map(Object.entries(edges).map(([key, edge]) => [key, parseEdge(edge, key)])) } };
};

const migrateOldNode = (rawNode: Record<string, unknown>, id: string, position: { x: number; y: number }): DialogueEditorNode => {
  const node = createDialogueEditorNode(id, position); node.title = text(rawNode.title); node.tags = stringList(rawNode.tags);
  const legacyLines = rawNode.lines && typeof rawNode.lines === 'object' && !Array.isArray(rawNode.lines) ? record(rawNode.lines, '旧对白') : undefined;
  if (legacyLines) { node.lines = new Map(Object.entries(legacyLines).map(([key, item]) => [key, parseLine(item, key)])); node.lineOrder = Array.isArray(rawNode.lineOrder) ? stringList(rawNode.lineOrder) : Object.keys(legacyLines); }
  else { const line = node.lines.get(node.lineOrder[0])!; line.speaker = text(rawNode.speaker); line.text = text(rawNode.text); }
  if (rawNode.display) node.display = parseDisplay(rawNode.display);
  return node;
};
const addMigratedOutput = (node: DialogueEditorNode, id: string, label: string, condition?: string, event?: string): DialogueOutputPort => {
  const portId = dialogueOutputPortId(node.id, id); const output: DialogueOutputPort = { id: portId, label, activation: { type: 'choice' }, ...(condition ? { condition } : {}), ...(event ? { effects: [event] } : {}) };
  node.outputs.set(portId, output); node.outputOrder.push(portId); return output;
};
const migrateV1 = (raw: Record<string, unknown>, expectedKey?: string): DialogueEditorDocument => {
  const presetKey = requireText(raw.presetKey, '对话预设 Key'); if (expectedKey && expectedKey !== presetKey) throw new Error(`对话预设“${expectedKey}”的 presetKey 不一致。`);
  const oldNodes = record(raw.nodes, '旧对话节点'); const nodes = new Map<string, DialogueEditorNode>(); const edges = new Map<string, DialogueEditorEdge>();
  Object.entries(oldNodes).forEach(([key, value]) => { const old = record(value, `旧节点“${key}”`); const id = requireText(old.id, '节点 ID'); const pos = record(old.position, '节点位置'); nodes.set(key, migrateOldNode(old, id, { x: Number(pos.x), y: Number(pos.y) })); });
  Object.entries(oldNodes).forEach(([key, value]) => { const old = record(value, `旧节点“${key}”`); const node = nodes.get(key)!; (Array.isArray(old.choices) ? old.choices : []).forEach((item) => { const choice = record(item, '旧选项'); const id = requireText(choice.id, '选项 ID'); const output = addMigratedOutput(node, id, text(choice.text), optionalText(choice.condition), optionalText(choice.event)); const target = optionalText(choice.targetNodeId); if (target) { const edgeId = dialogueEdgeId(node.id, id); edges.set(edgeId, { id: edgeId, from: { nodeId: node.id, portId: output.id }, to: { nodeId: target, portId: dialogueNodeInputPortId(target) } }); } }); });
  return { schemaVersion: 3, presetKey, name: requireText(raw.name, '对话预设名称'), graph: { nodes, edges } };
};
const migrateV2 = (raw: Record<string, unknown>, expectedKey?: string): DialogueEditorDocument => {
  const presetKey = requireText(raw.presetKey, '对话预设 Key'); if (expectedKey && expectedKey !== presetKey) throw new Error(`对话预设“${expectedKey}”的 presetKey 不一致。`);
  const graph = record(raw.graph, '旧对话图'); const oldNodes = record(graph.nodes, '旧节点'); const oldEdges = record(graph.edges, '旧连线'); const nodes = new Map<string, DialogueEditorNode>(); const portMap = new Map<string, string>();
  Object.entries(oldNodes).forEach(([key, value]) => {
    const old = record(value, `旧节点“${key}”`); const id = requireText(old.id, '节点 ID'); const pos = record(old.position, '节点位置'); const node = migrateOldNode(old, id, { x: Number(pos.x), y: Number(pos.y) });
    const ports = old.ports && typeof old.ports === 'object' && !Array.isArray(old.ports) ? record(old.ports, '旧端口') : {};
    const oldInputs = Object.entries(ports).filter(([, item]) => record(item, '旧端口').direction === 'input');
    if (oldInputs.length) { node.inputs = new Map(oldInputs.map(([portId, item]) => [portId, { id: requireText(record(item, '旧输入端口').id, '旧输入端口 ID') }])); node.inputOrder = oldInputs.map(([portId]) => portId); }
    const options = old.options && typeof old.options === 'object' && !Array.isArray(old.options) ? record(old.options, '旧选项') : {}; const order = Array.isArray(old.optionOrder) ? stringList(old.optionOrder) : Object.keys(options);
    order.forEach((optionId) => { const option = record(options[optionId], `旧选项“${optionId}”`); const output = addMigratedOutput(node, optionId, text(option.text), optionalText(option.condition), optionalText(option.event)); portMap.set(requireText(option.outputPortId, '旧输出端口 ID'), output.id); });
    Object.entries(ports).forEach(([portId, item]) => { const port = record(item, '旧端口'); if (port.direction === 'output' && !portMap.has(portId)) { node.outputs.set(portId, { id: portId, activation: { type: 'auto', priority: 0 } }); node.outputOrder.push(portId); portMap.set(portId, portId); } });
    nodes.set(key, node);
  });
  const edges = new Map(Object.entries(oldEdges).map(([key, value]) => { const edge = parseEdge(value, key); return [key, { ...edge, from: { ...edge.from, portId: portMap.get(edge.from.portId) ?? edge.from.portId } }] as const; }));
  return { schemaVersion: 3, presetKey, name: requireText(raw.name, '对话预设名称'), graph: { nodes, edges } };
};
export const migrateLegacyDialogueMapPreset = (value: unknown, expectedKey?: string): DialogueEditorDocument => migrateV1(record(value, '旧对话预设'), expectedKey);
export const parseDialogueEditorDocument = (value: unknown, expectedKey?: string): DialogueEditorDocument => {
  const raw = record(value, '对话预设'); if (raw.schemaVersion === 1) return migrateV1(raw, expectedKey); if (raw.schemaVersion === 2) return migrateV2(raw, expectedKey); if (raw.schemaVersion === 3) return parseV3Document(raw, expectedKey); throw new Error('不支持的对话预设版本。');
};

const encodeNode = (node: DialogueEditorNode): StoredDialogueEditorNode => ({ ...node, position: { ...node.position }, display: { ...node.display }, lines: Object.fromEntries(node.lines), lineOrder: [...node.lineOrder], inputs: Object.fromEntries(node.inputs), inputOrder: [...node.inputOrder], outputs: Object.fromEntries([...node.outputs].map(([id, output]) => [id, { ...output, activation: { ...output.activation }, ...(output.effects ? { effects: [...output.effects] } : {}) }])), outputOrder: [...node.outputOrder], ...(node.tags ? { tags: [...node.tags] } : {}) });
export const encodeDialogueEditorDocument = (document: DialogueEditorDocument): StoredDialogueEditorDocument => ({ schemaVersion: 3, presetKey: document.presetKey, name: document.name, graph: { nodes: Object.fromEntries([...document.graph.nodes].map(([id, node]) => [id, encodeNode(node)])), edges: Object.fromEntries([...document.graph.edges].map(([id, edge]) => [id, { ...edge, from: { ...edge.from }, to: { ...edge.to } }])) } });
export const encodeDialogueEditorDocumentLibrary = (library: DialogueEditorDocumentLibrary): StoredDialogueEditorDocumentLibrary => Object.fromEntries(Object.entries(library).map(([key, document]) => [key, encodeDialogueEditorDocument(document)]));
export const cloneDialogueEditorDocument = (document: DialogueEditorDocument): DialogueEditorDocument => parseDialogueEditorDocument(encodeDialogueEditorDocument(document), document.presetKey);

export const resolveDialogueEditorSelection = (document: DialogueEditorDocument, selection: DialogueEditorSelection): DialogueEditorSelectionTarget | undefined => {
  if (selection.kind === 'edge') { const edge = document.graph.edges.get(selection.edgeId); return edge ? { kind: 'edge', edge } : undefined; }
  const node = document.graph.nodes.get(selection.nodeId); if (!node) return undefined;
  if (selection.kind === 'node') return { kind: 'node', node };
  if (selection.kind === 'line') { const line = node.lines.get(selection.lineId); return line ? { kind: 'line', node, line } : undefined; }
  if (selection.kind === 'input') { const port = node.inputs.get(selection.portId); return port ? { kind: 'input', node, port } : undefined; }
  const port = node.outputs.get(selection.portId); return port ? { kind: 'output', node, port } : undefined;
};

const issue = (code: string, message: string, severity: DialogueMapValidationIssue['severity'], extra: Omit<DialogueMapValidationIssue, 'code' | 'message' | 'severity'> = {}): DialogueMapValidationIssue => ({ code, message, severity, ...extra });
const validateOrder = <T>(map: Map<string, T>, order: string[], label: string, nodeId: string, issues: DialogueMapValidationIssue[]) => { const seen = new Set<string>(); order.forEach((id) => { if (!map.has(id)) issues.push(issue(`missing-${label}`, `节点“${nodeId}”的顺序引用不存在的${label}“${id}”。`, 'error', { nodeId, portId: label === 'line' ? undefined : id, lineId: label === 'line' ? id : undefined })); if (seen.has(id)) issues.push(issue(`duplicate-${label}-order`, `节点“${nodeId}”的${label}顺序重复引用“${id}”。`, 'error', { nodeId })); seen.add(id); }); map.forEach((_value, id) => { if (!seen.has(id)) issues.push(issue(`unordered-${label}`, `节点“${nodeId}”的${label}“${id}”未加入顺序。`, 'error', { nodeId })); }); };

export const validateDialogueEditorDocument = (document: DialogueEditorDocument): DialogueMapValidationIssue[] => {
  const issues: DialogueMapValidationIssue[] = []; const { nodes, edges } = document.graph; const nodeIds = new Set<string>(); const outgoing = new Map<string, string>();
  if (!nodes.size) issues.push(issue('empty-graph', '对话图至少需要一个节点。', 'error'));
  nodes.forEach((node, key) => {
    if (key !== node.id) issues.push(issue('node-key-mismatch', `节点索引“${key}”与 ID“${node.id}”不一致。`, 'error', { nodeId: node.id }));
    if (nodeIds.has(node.id)) issues.push(issue('duplicate-node-id', `节点 ID“${node.id}”重复。`, 'error', { nodeId: node.id })); nodeIds.add(node.id);
    if (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y) || node.position.x % DIALOGUE_MAP_GRID_SIZE || node.position.y % DIALOGUE_MAP_GRID_SIZE) issues.push(issue('off-grid-position', `节点“${node.id}”的位置必须对齐 ${DIALOGUE_MAP_GRID_SIZE}px 网格。`, 'error', { nodeId: node.id }));
    if (!Number.isInteger(node.display.widthUnits) || !Number.isInteger(node.display.heightUnits) || node.display.widthUnits < 4 || node.display.heightUnits < 3 || node.display.widthUnits > 40 || node.display.heightUnits > 40) issues.push(issue('invalid-node-size', `节点“${node.id}”的宽高必须是 4–40 范围内的整数网格单位。`, 'error', { nodeId: node.id }));
    node.lines.forEach((line, keyId) => { if (keyId !== line.id) issues.push(issue('invalid-line-id', `节点“${node.id}”的对白索引与 ID 不一致。`, 'error', { nodeId: node.id, lineId: line.id })); });
    node.inputs.forEach((port, keyId) => { if (keyId !== port.id) issues.push(issue('invalid-input-id', `节点“${node.id}”的输入端口索引与 ID 不一致。`, 'error', { nodeId: node.id, portId: port.id })); });
    node.outputs.forEach((port, keyId) => { if (keyId !== port.id) issues.push(issue('invalid-output-id', `节点“${node.id}”的输出端口索引与 ID 不一致。`, 'error', { nodeId: node.id, portId: port.id })); if (port.activation.type === 'event' && !port.activation.eventId.trim()) issues.push(issue('missing-event-id', `输出端口“${port.id}”缺少事件 ID。`, 'error', { nodeId: node.id, portId: port.id })); });
    validateOrder(node.lines, node.lineOrder, 'line', node.id, issues); validateOrder(node.inputs, node.inputOrder, 'input', node.id, issues); validateOrder(node.outputs, node.outputOrder, 'output', node.id, issues);
  });
  edges.forEach((edge, key) => {
    if (key !== edge.id) issues.push(issue('edge-key-mismatch', `连线索引“${key}”与 ID“${edge.id}”不一致。`, 'error', { edgeId: edge.id }));
    const fromNode = nodes.get(edge.from.nodeId); const toNode = nodes.get(edge.to.nodeId); const from = fromNode?.outputs.get(edge.from.portId); const to = toNode?.inputs.get(edge.to.portId);
    if (!fromNode) issues.push(issue('missing-edge-from-node', `连线“${edge.id}”的起点节点不存在。`, 'error', { edgeId: edge.id, nodeId: edge.from.nodeId }));
    if (!toNode) issues.push(issue('missing-edge-to-node', `连线“${edge.id}”的终点节点不存在。`, 'error', { edgeId: edge.id, nodeId: edge.to.nodeId }));
    if (!from) issues.push(issue('dangling-edge-from-port', `连线“${edge.id}”的输出端口无效。`, 'error', { edgeId: edge.id, portId: edge.from.portId }));
    if (!to) issues.push(issue('dangling-edge-to-port', `连线“${edge.id}”的输入端口无效。`, 'error', { edgeId: edge.id, portId: edge.to.portId }));
    const outputKey = `${edge.from.nodeId}\0${edge.from.portId}`; if (outgoing.has(outputKey)) issues.push(issue('multiple-output-targets', `输出端口“${edge.from.portId}”连接了多个目标。`, 'error', { edgeId: edge.id, nodeId: edge.from.nodeId, portId: edge.from.portId })); else outgoing.set(outputKey, edge.id);
  });
  return issues;
};

export const diagnoseDialogueEditorDocument = (document: DialogueEditorDocument): DialogueMapValidationIssue[] => {
  const issues: DialogueMapValidationIssue[] = []; const connected = new Set([...document.graph.edges.values()].map((edge) => `${edge.from.nodeId}\0${edge.from.portId}`));
  document.graph.nodes.forEach((node) => {
    const layout = computeDialogueNodeLayout(node);
    if (layout.requestedHeightUnits < layout.minimumHeightUnits) issues.push(issue('auto-expanded-node-height', `节点“${node.id}”的设定高度为 ${layout.requestedHeightUnits} 格，内容布局将自动撑开到 ${layout.minimumHeightUnits} 格。`, 'info', { nodeId: node.id }));
    if (!node.outputs.size) issues.push(issue('runtime-terminal', `节点“${node.id}”没有输出，运行到此将正常结束。`, 'info', { nodeId: node.id }));
    node.outputs.forEach((output) => { if (!connected.has(`${node.id}\0${output.id}`)) issues.push(issue('dangling-output', `输出端口“${output.id}”尚未连接。`, 'warning', { nodeId: node.id, portId: output.id })); });
    const conditional = [...node.outputs.values()].filter((output) => output.condition); if (conditional.length && conditional.length === node.outputs.size) issues.push(issue('missing-fallback-output', `节点“${node.id}”的所有输出都有条件，建议增加兜底出口。`, 'warning', { nodeId: node.id }));
  });
  return issues;
};

export const diagnoseDialogueEntry = (document: DialogueEditorDocument, entryNodeId: string): DialogueMapValidationIssue[] => {
  if (!document.graph.nodes.has(entryNodeId)) return [issue('missing-entry', `预览入口“${entryNodeId}”不存在。`, 'error', { nodeId: entryNodeId })];
  const reached = new Set<string>(); const queue = [entryNodeId];
  while (queue.length) { const id = queue.shift()!; if (reached.has(id)) continue; reached.add(id); document.graph.edges.forEach((edge) => { if (edge.from.nodeId === id && document.graph.nodes.has(edge.to.nodeId)) queue.push(edge.to.nodeId); }); }
  const issues: DialogueMapValidationIssue[] = []; document.graph.nodes.forEach((node) => { if (!reached.has(node.id)) issues.push(issue('entry-unreachable-node', `节点“${node.id}”无法从预览入口“${entryNodeId}”到达。`, 'info', { nodeId: node.id })); }); return issues;
};

export const parseDialogueMapPreset = parseDialogueEditorDocument;
export const validateDialogueMapPreset = validateDialogueEditorDocument;
export const createDialogueMapPreset = createDialogueEditorDocument;
export const cloneDialogueMapPreset = cloneDialogueEditorDocument;
