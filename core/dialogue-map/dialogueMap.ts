import { type DialogueEditorDocument, type DialogueEditorDocumentLibrary, type DialogueEditorNode, type DialogueEditorEdge, type DialogueEditorSelection, type DialogueEditorSelectionTarget, type DialogueNodeDisplay, type DialogueNodeKind, type DialogueOutputPort, type DialogueMapValidationIssue, type StoredDialogueEditorDocument, type StoredDialogueEditorDocumentLibrary, type StoredDialogueEditorNode } from './dialogueMap.types.ts';
import { computeDialogueNodeLayout } from './dialogueNodeLayout.ts';
import { parseDialogueCondition, parseDialogueEffect } from './dialogueRules.ts';

export const DIALOGUE_NODE_KIND_LABEL: Record<DialogueNodeKind, string> = { dialogue: '对话', condition: '判断', choice: '选项', event: '事件' };
export const createDefaultDialogueNodeDisplay = (): DialogueNodeDisplay => ({ shape: 'rectangle', colorToken: 'blue-muted', widthUnits: 10, heightUnits: 6, showSpeakerList: true, showPreviewText: true });
export const dialogueNodeInputPortId = (id: string) => `port:${id}:in`;
export const dialogueOutputPortId = (id: string, suffix: string) => `port:${id}:output:${suffix}`;
export const dialogueLineId = (id: string, suffix = 'main') => `line:${id}:${suffix}`;
export const dialogueEdgeId = (id: string, suffix: string) => `edge:${id}:${suffix}`;
export const createDialogueEditorNode = (id: string, position: { x: number; y: number }, kind: DialogueNodeKind = 'dialogue'): DialogueEditorNode => {
  const inputId = dialogueNodeInputPortId(id), lineId = dialogueLineId(id);
  const base = { id, title: `新${DIALOGUE_NODE_KIND_LABEL[kind]}节点`, position, display: createDefaultDialogueNodeDisplay(), lines: new Map<string, { id: string; speaker: string; text: string }>(), lineOrder: [] as string[], inputs: new Map([[inputId, { id: inputId }]]), inputOrder: [inputId], outputs: new Map<string, DialogueOutputPort>(), outputOrder: [] as string[] };
  base.display.colorToken = { dialogue: 'blue-muted', condition: 'violet-muted', choice: 'green-muted', event: 'red-muted' }[kind];
  const add = (branch: DialogueOutputPort['branch'], label: string, suffix: string = branch) => {
    const portId = dialogueOutputPortId(id, suffix); base.outputs.set(portId, { id: portId, label, branch }); base.outputOrder.push(portId);
  };
  if (kind === 'condition') { add('true', '成立'); add('false', '不成立'); return { ...base, kind, condition: { type: 'compare', left: { type: 'memory', key: '', path: [] }, operator: 'eq', right: { type: 'literal', value: 0 } } }; }
  if (kind === 'event') { add('next', '完成后继续'); return { ...base, kind, mode: 'send', event: { type: 'event', eventType: '', version: 1 } }; }
  if (kind === 'choice') { add('choice', '选项一', 'first'); add('choice', '选项二', 'second'); return { ...base, kind }; }
  base.lines.set(lineId, { id: lineId, speaker: '', text: '' }); base.lineOrder.push(lineId); add('next', '继续'); return { ...base, kind };
};
export const createDialogueEditorDocument = (presetKey: string, name: string): DialogueEditorDocument => {
  const node = createDialogueEditorNode('start', { x: 96, y: 96 }); node.title = '开场'; node.lines.get(node.lineOrder[0])!.text = '在这里写下第一句对话。';
  return { schemaVersion: 5, presetKey, name, graph: { nodes: new Map([[node.id, node]]), edges: new Map() } };
};
const object = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}必须是对象。`); return value as Record<string, unknown>;
};
const string = (value: unknown): string => { if (typeof value !== 'string') throw new Error('字段必须是字符串。'); return value; };
const list = (value: unknown): string[] => { if (!Array.isArray(value)) throw new Error('顺序必须是数组。'); return value.map(string); };
const parseNode = (value: unknown): DialogueEditorNode => {
  const raw = object(value, '节点'), pos = object(raw.position, '位置'), display = object(raw.display, '显示');
  if (!['rectangle', 'rounded', 'diamond', 'hexagon', 'pill', 'document'].includes(string(display.shape)) || typeof display.colorToken !== 'string') throw new Error('显示字段无效。');
  const ports = (name: string) => new Map(Object.entries(object(raw[name], name)).map(([key, value]) => {
    const port = object(value, '端口');
    if (name === 'outputs' && !['next', 'true', 'false', 'choice'].includes(string(port.branch))) throw new Error('未知出口分支。');
    return [key, { id: string(port.id), ...(port.label === undefined ? {} : { label: string(port.label) }), ...(name === 'outputs' ? { branch: port.branch } : {}) }];
  }));
  const base = { id: string(raw.id), title: string(raw.title), position: { x: Number(pos.x), y: Number(pos.y) }, display: structuredClone(display) as DialogueNodeDisplay,
    lines: new Map(Object.entries(object(raw.lines, '对白')).map(([key, value]) => { const line = object(value, '对白'); return [key, { id: string(line.id), speaker: string(line.speaker), text: string(line.text) }]; })), lineOrder: list(raw.lineOrder),
    inputs: ports('inputs'), inputOrder: list(raw.inputOrder), outputs: ports('outputs') as Map<string, DialogueOutputPort>, outputOrder: list(raw.outputOrder), ...(raw.tags === undefined ? {} : { tags: list(raw.tags) }) };
  if (raw.kind === 'dialogue' || raw.kind === 'choice') return { ...base, kind: raw.kind };
  if (raw.kind === 'condition') return { ...base, kind: raw.kind, ...(raw.condition === undefined ? {} : { condition: parseDialogueCondition(raw.condition) }) };
  if (raw.kind === 'event' && (raw.mode === 'send' || raw.mode === 'wait')) return { ...base, kind: raw.kind, mode: raw.mode, event: parseDialogueEffect(raw.event) };
  throw new Error('不支持的节点类型或事件模式。');
};
export const parseDialogueEditorDocument = (value: unknown, expectedKey?: string): DialogueEditorDocument => {
  const raw = object(value, '对话图'); if (raw.schemaVersion !== 5) throw new Error('只支持 V5 四类节点数据，请使用新预设。');
  const presetKey = string(raw.presetKey); if (expectedKey && expectedKey !== presetKey) throw new Error('预设 Key 不一致。'); const graph = object(raw.graph, '图');
  const document: DialogueEditorDocument = { schemaVersion: 5, presetKey, name: string(raw.name), graph: {
    nodes: new Map(Object.entries(object(graph.nodes, '节点')).map(([key, node]) => [key, parseNode(node)])),
    edges: new Map(Object.entries(object(graph.edges, '连线')).map(([key, value]) => { const edge = object(value, '连线'), from = object(edge.from, '起点'), to = object(edge.to, '终点'); return [key, { id: string(edge.id), from: { nodeId: string(from.nodeId), portId: string(from.portId) }, to: { nodeId: string(to.nodeId), portId: string(to.portId) }, ...(edge.label === undefined ? {} : { label: string(edge.label) }) }]; })),
  } };
  const errors = validateDialogueEditorDocument(document); if (errors.length) throw new Error(errors[0].message); return document;
};
const encodeNode = (node: DialogueEditorNode): StoredDialogueEditorNode => {
  const copy = structuredClone(node); return { ...copy, lines: Object.fromEntries(copy.lines), inputs: Object.fromEntries(copy.inputs), outputs: Object.fromEntries(copy.outputs) };
};
export const encodeDialogueEditorDocument = (document: DialogueEditorDocument): StoredDialogueEditorDocument => ({ schemaVersion: 5, presetKey: document.presetKey, name: document.name, graph: { nodes: Object.fromEntries([...document.graph.nodes].map(([id, node]) => [id, encodeNode(node)])), edges: Object.fromEntries(structuredClone(document.graph.edges)) } });
export const encodeDialogueEditorDocumentLibrary = (library: DialogueEditorDocumentLibrary): StoredDialogueEditorDocumentLibrary => Object.fromEntries(Object.entries(library).map(([key, document]) => [key, encodeDialogueEditorDocument(document)]));
export const cloneDialogueEditorDocument = (document: DialogueEditorDocument) => structuredClone(document);
export const resolveDialogueEditorSelection = (document: DialogueEditorDocument, selection: DialogueEditorSelection): DialogueEditorSelectionTarget | undefined => {
  if (selection.kind === 'edge') { const edge = document.graph.edges.get(selection.edgeId); return edge ? { kind: 'edge', edge } : undefined; }
  const node = document.graph.nodes.get(selection.nodeId); if (!node) return;
  if (selection.kind === 'node') return { kind: 'node', node };
  if (selection.kind === 'line') { const line = node.lines.get(selection.lineId); return line ? { kind: 'line', node, line } : undefined; }
  const port = selection.kind === 'input' ? node.inputs.get(selection.portId) : node.outputs.get(selection.portId);
  return port ? { kind: selection.kind, node, port } as DialogueEditorSelectionTarget : undefined;
};
const issue = (code: string, message: string, severity: DialogueMapValidationIssue['severity'], extra: Partial<DialogueMapValidationIssue> = {}): DialogueMapValidationIssue => ({ code, message, severity, ...extra });
/** Storage validation ignores graph topology and unfinished rule values. */
export const validateDialogueEditorDocument = (document: DialogueEditorDocument): DialogueMapValidationIssue[] => {
  const issues: DialogueMapValidationIssue[] = [];
  if (document.schemaVersion !== 5 || !/^[A-Za-z0-9_-]+$/.test(document.presetKey) || !document.name.trim()) issues.push(issue('invalid-document', '文档版本、名称或 Key 无效。', 'error'));
  document.graph.nodes.forEach((node, key) => {
    if (key !== node.id || !key.trim()) issues.push(issue('node-key-mismatch', '节点 ID 与索引不一致。', 'error', { nodeId: key }));
    if (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y) || !Number.isInteger(node.display.widthUnits) || !Number.isInteger(node.display.heightUnits) || node.display.widthUnits < 4 || node.display.widthUnits > 40 || node.display.heightUnits < 3 || node.display.heightUnits > 40) issues.push(issue('invalid-geometry', '节点位置或尺寸无效。', 'error', { nodeId: key }));
    for (const [items, order] of [[node.lines, node.lineOrder], [node.inputs, node.inputOrder], [node.outputs, node.outputOrder]] as const) {
      if (order.length !== items.size || new Set(order).size !== order.length || order.some(id => !items.has(id)) || [...items].some(([id, item]) => item.id !== id)) issues.push(issue('invalid-order', '节点内容顺序或 ID 无效。', 'error', { nodeId: key }));
    }
  });
  document.graph.edges.forEach((edge, key) => { if (key !== edge.id || !key.trim()) issues.push(issue('edge-key-mismatch', '连线 ID 与索引不一致。', 'error', { edgeId: key })); }); return issues;
};
export const diagnoseDialogueEditorDocument = (document: DialogueEditorDocument, layoutForNode = computeDialogueNodeLayout): DialogueMapValidationIssue[] => {
  const issues: DialogueMapValidationIssue[] = [];
  document.graph.nodes.forEach(node => { const layout = layoutForNode(node); if (layout.actualHeightUnits > layout.requestedHeightUnits) issues.push(issue('auto-expanded-node-height', `“${node.title}”已自动适应内容高度。`, 'info', { nodeId: node.id })); }); return issues;
};
export const diagnoseDialogueEntry = (document: DialogueEditorDocument, entryNodeId: string): DialogueMapValidationIssue[] => {
  if (!document.graph.nodes.has(entryNodeId)) return [issue('missing-entry', '入口不存在。', 'error', { nodeId: entryNodeId })];
  const reached = new Set<string>(), queue = [entryNodeId];
  while (queue.length) { const id = queue.pop()!; if (reached.has(id)) continue; reached.add(id); document.graph.edges.forEach(edge => { if (edge.from.nodeId === id && document.graph.nodes.has(edge.to.nodeId)) queue.push(edge.to.nodeId); }); }
  return [...document.graph.nodes.values()].filter(node => !reached.has(node.id)).map(node => issue('entry-unreachable-node', `“${node.title}”无法从入口到达。`, 'warning', { nodeId: node.id }));
};
/** Add without replacing existing targets. */
export const connectDialogueNodes = (document: DialogueEditorDocument, from: DialogueEditorEdge['from'], to: DialogueEditorEdge['to']): string => {
  let id = dialogueEdgeId(from.nodeId, from.portId.split(':').at(-1) ?? 'next'); const base = id;
  for (let index = 1; document.graph.edges.has(id); index++) id = `${base}_${index}`;
  document.graph.edges.set(id, { id, from: { ...from }, to: { ...to } }); return id;
};
export const parseDialogueMapPreset = parseDialogueEditorDocument;
export const validateDialogueMapPreset = validateDialogueEditorDocument;
export const createDialogueMapPreset = createDialogueEditorDocument;
export const cloneDialogueMapPreset = cloneDialogueEditorDocument;
