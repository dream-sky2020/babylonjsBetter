import type {
  DialogueChoice,
  DialogueMapNode,
  DialogueMapPreset,
  DialogueMapValidationIssue,
  DialogueNodeKind,
} from './dialogueMap.types';

const NODE_KINDS = new Set<DialogueNodeKind>(['dialogue', 'choice', 'end']);

const cloneJson = <T>(value: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
};

const requireText = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}不能为空。`);
  return value;
};

const optionalText = (value: unknown): string | undefined => (
  typeof value === 'string' && value.trim() ? value : undefined
);

const parseChoice = (value: unknown, nodeId: string, index: number): DialogueChoice => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`节点“${nodeId}”的第 ${index + 1} 个出口无效。`);
  }
  const raw = value as Partial<DialogueChoice>;
  return {
    id: requireText(raw.id, `节点“${nodeId}”的出口 ID`),
    text: typeof raw.text === 'string' ? raw.text : '',
    ...(optionalText(raw.targetNodeId) ? { targetNodeId: raw.targetNodeId!.trim() } : {}),
    ...(optionalText(raw.condition) ? { condition: raw.condition!.trim() } : {}),
    ...(optionalText(raw.event) ? { event: raw.event!.trim() } : {}),
  };
};

const parseNode = (value: unknown, key: string): DialogueMapNode => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`对话节点“${key}”必须是对象。`);
  }
  const raw = value as Partial<DialogueMapNode>;
  const kind = NODE_KINDS.has(raw.kind as DialogueNodeKind) ? raw.kind as DialogueNodeKind : 'dialogue';
  const x = Number(raw.position?.x);
  const y = Number(raw.position?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`节点“${key}”缺少有效 Canvas 坐标。`);
  if (raw.id !== key) throw new Error(`节点索引“${key}”与节点 ID 不一致。`);
  return {
    id: key,
    kind,
    title: typeof raw.title === 'string' ? raw.title : key,
    speaker: typeof raw.speaker === 'string' ? raw.speaker : '',
    text: typeof raw.text === 'string' ? raw.text : '',
    position: { x, y },
    choices: Array.isArray(raw.choices) ? raw.choices.map((choice, index) => parseChoice(choice, key, index)) : [],
    ...(Array.isArray(raw.tags) ? { tags: raw.tags.filter((tag): tag is string => typeof tag === 'string') } : {}),
  };
};

export const parseDialogueMapPreset = (value: unknown, expectedKey?: string): DialogueMapPreset => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('对话预设必须是对象。');
  const raw = value as Partial<DialogueMapPreset>;
  if (raw.schemaVersion !== 1) throw new Error('对话预设 schemaVersion 必须为 1。');
  const presetKey = requireText(raw.presetKey, '对话预设 Key');
  if (expectedKey && presetKey !== expectedKey) throw new Error(`对话预设“${expectedKey}”的 presetKey 不一致。`);
  if (!raw.nodes || typeof raw.nodes !== 'object' || Array.isArray(raw.nodes)) throw new Error('对话预设 nodes 必须是对象。');
  const preset: DialogueMapPreset = {
    schemaVersion: 1,
    presetKey,
    name: requireText(raw.name, '对话预设名称'),
    startNodeId: requireText(raw.startNodeId, '起始节点 ID'),
    nodes: Object.fromEntries(Object.entries(raw.nodes).map(([key, node]) => [key, parseNode(node, key)])),
  };
  const fatalIssues = validateDialogueMapPreset(preset).filter((issue) => issue.code !== 'unreachable-node');
  if (fatalIssues.length) throw new Error(fatalIssues.map((issue) => issue.message).join('\n'));
  return preset;
};

export const validateDialogueMapPreset = (preset: DialogueMapPreset): DialogueMapValidationIssue[] => {
  const issues: DialogueMapValidationIssue[] = [];
  const nodes = preset.nodes;
  if (!nodes[preset.startNodeId]) issues.push({ code: 'missing-start', message: `起始节点“${preset.startNodeId}”不存在。` });
  Object.values(nodes).forEach((node) => {
    const choiceIds = new Set<string>();
    node.choices.forEach((choice) => {
      if (choiceIds.has(choice.id)) issues.push({ code: 'duplicate-choice', message: `节点“${node.id}”存在重复出口 ID“${choice.id}”。`, nodeId: node.id, choiceId: choice.id });
      choiceIds.add(choice.id);
      if (choice.targetNodeId && !nodes[choice.targetNodeId]) issues.push({ code: 'missing-target', message: `节点“${node.id}”的出口指向不存在的“${choice.targetNodeId}”。`, nodeId: node.id, choiceId: choice.id });
    });
    if (node.kind === 'choice' && node.choices.length < 2) issues.push({ code: 'choice-count', message: `选择节点“${node.id}”至少需要两个出口。`, nodeId: node.id });
    if (node.kind === 'end' && node.choices.length > 0) issues.push({ code: 'end-has-choice', message: `结束节点“${node.id}”不能继续连接其他节点。`, nodeId: node.id });
  });
  if (nodes[preset.startNodeId]) {
    const reached = new Set<string>();
    const queue = [preset.startNodeId];
    while (queue.length) {
      const id = queue.shift()!;
      if (reached.has(id) || !nodes[id]) continue;
      reached.add(id);
      nodes[id].choices.forEach((choice) => { if (choice.targetNodeId) queue.push(choice.targetNodeId); });
    }
    Object.keys(nodes).forEach((id) => {
      if (!reached.has(id)) issues.push({ code: 'unreachable-node', message: `节点“${id}”无法从起始节点到达。`, nodeId: id });
    });
  }
  return issues;
};

export const createDialogueMapPreset = (presetKey: string, name: string): DialogueMapPreset => {
  const start: DialogueMapNode = {
    id: 'start', kind: 'dialogue', title: '开场', speaker: '旁白', text: '在这里写下第一句对话。',
    position: { x: 80, y: 100 }, choices: [],
  };
  return { schemaVersion: 1, presetKey, name, startNodeId: start.id, nodes: { [start.id]: start } };
};

export const cloneDialogueMapPreset = (preset: DialogueMapPreset): DialogueMapPreset => cloneJson(preset);
