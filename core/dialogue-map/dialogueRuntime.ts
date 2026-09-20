import type {
  DialogueEditorDocument, DialogueEditorLine, DialogueNoAvailableOutputPolicy, DialogueOutputPort,
} from './dialogueMap.types.ts';

export type DialogueRuntimeContext = Record<string, unknown>;
export type DialogueRuntimeOptions = {
  noAvailableOutput?: DialogueNoAvailableOutputPolicy;
  evaluateCondition?: (condition: string, context: DialogueRuntimeContext) => boolean;
};
export type DialogueSession = {
  document: DialogueEditorDocument;
  entryNodeId: string;
  currentNodeId: string;
  context: DialogueRuntimeContext;
  options: DialogueRuntimeOptions;
};
export type DialogueAvailableOutput = { port: DialogueOutputPort; targetNodeId: string };
export type DialogueStepResult =
  | { type: 'awaiting-choice'; nodeId: string; lines: DialogueEditorLine[]; outputs: DialogueAvailableOutput[] }
  | { type: 'awaiting-event'; nodeId: string; lines: DialogueEditorLine[]; eventIds: string[] }
  | { type: 'transition'; nodeId: string; outputId: string; targetNodeId: string; effects: string[] }
  | { type: 'ended'; nodeId: string; reason: 'no-outputs' | 'no-eligible-outputs' }
  | { type: 'unavailable'; nodeId: string; outputs: DialogueOutputPort[] }
  | { type: 'invalid'; nodeId: string; reason: 'missing-node' | 'dangling-output' | 'invalid-selection' | 'no-eligible-outputs' };

export const startDialogue = (document: DialogueEditorDocument, entryNodeId: string, context: DialogueRuntimeContext = {}, options: DialogueRuntimeOptions = {}): DialogueSession => {
  if (!document.graph.nodes.has(entryNodeId)) throw new Error(`对话入口“${entryNodeId}”不存在。`);
  return { document, entryNodeId, currentNodeId: entryNodeId, context, options };
};

const targetFor = (session: DialogueSession, outputId: string): string | undefined => [...session.document.graph.edges.values()].find((edge) => edge.from.nodeId === session.currentNodeId && edge.from.portId === outputId)?.to.nodeId;
const conditionPasses = (session: DialogueSession, output: DialogueOutputPort): boolean => !output.condition || (session.options.evaluateCondition?.(output.condition, session.context) ?? false);
const transition = (session: DialogueSession, output: DialogueOutputPort): DialogueStepResult => {
  const targetNodeId = targetFor(session, output.id); if (!targetNodeId || !session.document.graph.nodes.has(targetNodeId)) return { type: 'invalid', nodeId: session.currentNodeId, reason: 'dangling-output' };
  const nodeId = session.currentNodeId; session.currentNodeId = targetNodeId;
  return { type: 'transition', nodeId, outputId: output.id, targetNodeId, effects: [...(output.effects ?? [])] };
};

export const stepDialogue = (session: DialogueSession, input: { outputId?: string; eventId?: string } = {}): DialogueStepResult => {
  const node = session.document.graph.nodes.get(session.currentNodeId); if (!node) return { type: 'invalid', nodeId: session.currentNodeId, reason: 'missing-node' };
  const lines = node.lineOrder.flatMap((id) => node.lines.get(id) ?? []); const outputs = node.outputOrder.flatMap((id) => node.outputs.get(id) ?? []);
  if (!outputs.length) return { type: 'ended', nodeId: node.id, reason: 'no-outputs' };
  const eligible = outputs.filter((output) => conditionPasses(session, output));
  if (input.outputId) { const selected = eligible.find((output) => output.id === input.outputId && output.activation.type === 'choice'); return selected ? transition(session, selected) : { type: 'invalid', nodeId: node.id, reason: 'invalid-selection' }; }
  if (input.eventId) { const selected = eligible.find((output) => output.activation.type === 'event' && output.activation.eventId === input.eventId); return selected ? transition(session, selected) : { type: 'invalid', nodeId: node.id, reason: 'invalid-selection' }; }
  const automatic = eligible.filter((output) => output.activation.type === 'auto').sort((a, b) => (b.activation.type === 'auto' ? b.activation.priority ?? 0 : 0) - (a.activation.type === 'auto' ? a.activation.priority ?? 0 : 0));
  if (automatic[0]) return transition(session, automatic[0]);
  const choices = eligible.filter((output) => output.activation.type === 'choice').map((port) => ({ port, targetNodeId: targetFor(session, port.id) ?? '' })).filter((item) => item.targetNodeId);
  if (choices.length) return { type: 'awaiting-choice', nodeId: node.id, lines, outputs: choices };
  const eventIds = eligible.flatMap((output) => output.activation.type === 'event' ? [output.activation.eventId] : []); if (eventIds.length) return { type: 'awaiting-event', nodeId: node.id, lines, eventIds };
  const policy = node.noAvailableOutput ?? session.options.noAvailableOutput ?? 'end';
  if (policy === 'end') return { type: 'ended', nodeId: node.id, reason: 'no-eligible-outputs' };
  if (policy === 'show-unavailable') return { type: 'unavailable', nodeId: node.id, outputs };
  return { type: 'invalid', nodeId: node.id, reason: 'no-eligible-outputs' };
};
