import type { DialogueEditorDocument, DialogueEditorNode } from '../../../core/dialogue-map/dialogueMap.types.ts';

export type DialogueFlowPreviewState = { nodeId?: string; lineIndex: number; ended?: string; events: string[] };
export const previewNode = (document: DialogueEditorDocument, state: DialogueFlowPreviewState): DialogueEditorNode | undefined => state.nodeId ? document.graph.nodes.get(state.nodeId) : undefined;
const route = (document: DialogueEditorDocument, state: DialogueFlowPreviewState, portId?: string): DialogueFlowPreviewState => {
  if (!portId) return { ...state, nodeId: undefined, ended: '对话已结束。' };
  const edges = [...document.graph.edges.values()].filter(edge => edge.from.nodeId === state.nodeId && edge.from.portId === portId);
  if (!edges.length) return { ...state, nodeId: undefined, ended: '对话已结束。' };
  if (edges.length > 1) return { ...state, nodeId: undefined, ended: '出口存在多条连线，预览已停止。' };
  const target = document.graph.nodes.get(edges[0].to.nodeId);
  if (!target?.inputs.has(edges[0].to.portId)) return { ...state, nodeId: undefined, ended: '目标节点或输入不存在，预览已停止。' };
  return { ...state, nodeId: target.id, lineIndex: 0 };
};
/** Simulation only: event cards never dispatch events or read shared memory. */
export const settleDialogueFlowPreview = (document: DialogueEditorDocument, initial: DialogueFlowPreviewState): DialogueFlowPreviewState => {
  let state = initial;
  for (let step = 0; step < 100; step++) {
    if (!state.nodeId) return state;
    const node = previewNode(document, state);
    if (!node) return { ...state, nodeId: undefined, ended: '起始节点不存在，预览已停止。' };
    if (node.kind !== 'event') return state;
    const events = [...state.events, ...node.events.map(event => `${node.mode === 'wait' ? '等待已放行' : '模拟触发'}：${event.eventType || '未命名事件'}`)].slice(-100);
    state = route(document, { ...state, events }, node.outputOrder[0]);
  }
  return { ...state, nodeId: undefined, ended: '连续事件形成循环或超过 100 步，预览已停止。' };
};
export const startDialogueFlowPreview = (document: DialogueEditorDocument, nodeId: string) => settleDialogueFlowPreview(document, { nodeId, lineIndex: 0, events: [] });
export const chooseDialogueFlowPreview = (document: DialogueEditorDocument, state: DialogueFlowPreviewState, portId?: string) => settleDialogueFlowPreview(document, route(document, state, portId));
export const nextDialogueFlowPreviewLine = (document: DialogueEditorDocument, state: DialogueFlowPreviewState): DialogueFlowPreviewState => {
  const node = previewNode(document, state);
  return node?.kind === 'choice' && state.lineIndex + 1 < node.lineOrder.length ? { ...state, lineIndex: state.lineIndex + 1 } : state;
};
