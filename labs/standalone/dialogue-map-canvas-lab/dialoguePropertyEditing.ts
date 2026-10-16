import { DIALOGUE_NODE_WHITESPACE_DEFAULTS, type DialogueEditorDocument, type DialogueEditorNode, type DialogueNodeDisplay, type DialogueNodeWhitespace, type DialogueEditorLine, type DialogueCondition, type DialogueEffect } from '../../../core/dialogue-map/dialogueMap.types.ts';
import { dialogueLineId, dialogueOutputPortId } from '../../../core/dialogue-map/dialogueMap.ts';
import { freshDialogueId } from './dialogueGraphEditing.ts';

export type DialoguePropertyScope = 'node' | 'appearance' | 'spacing' | 'line' | 'lines' | 'output' | 'outputs' | 'input' | 'condition' | 'conditions' | 'events' | 'event';
export type DialoguePropertyTarget = { nodeId: string; scope: DialoguePropertyScope; id?: string; index?: number };
export type DialoguePropertySnapshot = {
  scope: DialoguePropertyScope; title?: string; tags?: string[]; display?: DialogueNodeDisplay; whitespace?: Partial<DialogueNodeWhitespace>;
  lines?: Array<Omit<DialogueEditorLine, 'id'>>; labels?: string[]; condition?: DialogueCondition; event?: DialogueEffect; events?: DialogueEffect[]; mode?: 'send' | 'wait';
};
const comparisons = (node: DialogueEditorNode) => node.kind === 'condition' && node.condition ? node.condition.type === 'compare' ? [node.condition] : node.condition.conditions : [];
export function captureDialogueProperties(document: DialogueEditorDocument, target: DialoguePropertyTarget): DialoguePropertySnapshot {
  const node = document.graph.nodes.get(target.nodeId);
  if (!node) throw new Error('属性所属节点已不存在。');
  const result: DialoguePropertySnapshot = { scope: target.scope };
  switch (target.scope) {
    case 'node': result.title = node.title; result.tags = node.tags; break;
    case 'appearance': result.display = node.display; break;
    case 'spacing': result.whitespace = { ...DIALOGUE_NODE_WHITESPACE_DEFAULTS, ...node.display.whitespace }; break;
    case 'lines': if (node.kind !== 'choice') throw new Error('仅选项节点支持对白。'); result.lines = node.lineOrder.map(id => { const line = node.lines.get(id)!; return { speaker: line.speaker, text: line.text }; }); break;
    case 'line': { const line = node.lines.get(target.id ?? ''); if (!line) throw new Error('对白已不存在。'); result.lines = [{ speaker: line.speaker, text: line.text }]; break; }
    case 'outputs': if (node.kind === 'condition') throw new Error('判断出口为固定只读属性。'); result.labels = node.outputOrder.map(id => node.outputs.get(id)?.label ?? ''); break;
    case 'output': if (node.kind === 'condition') throw new Error('判断出口为固定只读属性。'); if (!node.outputs.has(target.id ?? '')) throw new Error('出口已不存在。'); result.labels = [node.outputs.get(target.id!)?.label ?? '']; break;
    case 'input': if (!node.inputs.has(target.id ?? '')) throw new Error('入口已不存在。'); result.labels = [node.inputs.get(target.id!)?.label ?? '']; break;
    case 'conditions': if (node.kind !== 'condition') throw new Error('仅判断节点支持条件。'); result.condition = node.condition ?? { type: 'all', conditions: [] }; break;
    case 'condition': { const item = comparisons(node)[target.index ?? -1]; if (!item) throw new Error('条件已不存在。'); result.condition = item; break; }
    case 'events': if (node.kind !== 'event') throw new Error('仅事件节点支持事件。'); result.events = node.events; result.mode = node.mode; break;
    case 'event': if (node.kind !== 'event' || !node.events[target.index ?? -1]) throw new Error('事件已不存在。'); result.event = node.events[target.index!]; break;
  }
  return structuredClone(result);
}

export function dialoguePropertyPasteReason(document: DialogueEditorDocument, target: DialoguePropertyTarget, clipboard?: DialoguePropertySnapshot, append = false): string | undefined {
  if (!clipboard) return '请先复制同类属性。';
  if (clipboard.scope !== target.scope) return '属性类型不兼容，请复制同类面板。';
  try { captureDialogueProperties(document, target); } catch (error) { return (error as Error).message; }
  const node = document.graph.nodes.get(target.nodeId)!;
  if (append && !['lines', 'outputs', 'conditions', 'events'].includes(target.scope)) return '该面板不支持追加。';
  if (target.scope === 'outputs') {
    if (append && node.kind !== 'choice') return '只有选项节点支持追加选项。';
    if (!append && clipboard.labels?.length !== node.outputOrder.length) return '选项数量不同：请使用“追加为新选项”，不会替换现有端口或连线。';
  }
  if (target.scope === 'events' && node.kind === 'event' && append && node.mode === 'wait') return '等待节点只能保留一个事件。';
  return undefined;
}

/** Only editable fields change. Port identities and graph edges are never replaced. */
export function applyDialogueProperties(document: DialogueEditorDocument, target: DialoguePropertyTarget, clipboard: DialoguePropertySnapshot, append = false): void {
  const reason = dialoguePropertyPasteReason(document, target, clipboard, append);
  if (reason) throw new Error(reason);
  const node = document.graph.nodes.get(target.nodeId)!, data = structuredClone(clipboard);
  switch (target.scope) {
    case 'node': node.title = data.title!; if (data.tags) node.tags = data.tags; else delete node.tags; break;
    case 'appearance': node.display = data.display!; break;
    case 'spacing': node.display.whitespace = data.whitespace; break;
    case 'input': node.inputs.get(target.id!)!.label = data.labels![0] || undefined; break;
    case 'output': node.outputs.get(target.id!)!.label = data.labels![0] || undefined; break;
    case 'outputs':
      if (append) { for (const label of data.labels!) { const id = freshDialogueId(dialogueOutputPortId(node.id, 'choice'), new Set(node.outputs.keys())); node.outputs.set(id, { id, label, branch: 'choice' }); node.outputOrder.push(id); } }
      else node.outputOrder.forEach((id, index) => { node.outputs.get(id)!.label = data.labels![index] || undefined; });
      break;
    case 'line': Object.assign(node.lines.get(target.id!)!, data.lines![0]); break;
    case 'lines':
      if (!append) { node.lines.clear(); node.lineOrder = []; }
      for (const line of data.lines!) { const id = freshDialogueId(dialogueLineId(node.id, 'line'), new Set(node.lines.keys())); node.lines.set(id, { ...line, id }); node.lineOrder.push(id); }
      break;
    case 'conditions': if (node.kind === 'condition') { if (append) { const incoming = data.condition!.type === 'compare' ? [data.condition as Extract<DialogueCondition, { type: 'compare' }>] : data.condition!.conditions; node.condition = { type: node.condition?.type === 'any' ? 'any' : 'all', conditions: [...comparisons(node), ...incoming] }; } else node.condition = data.condition; } break;
    case 'condition': if (node.kind === 'condition') { const items = comparisons(node); items[target.index!] = data.condition as Extract<DialogueCondition, { type: 'compare' }>; node.condition = { type: node.condition?.type === 'any' ? 'any' : 'all', conditions: items }; } break;
    case 'events': if (node.kind === 'event') { node.events = append ? [...node.events, ...data.events!] : data.events!; if (!append) node.mode = data.mode!; } break;
    case 'event': if (node.kind === 'event') node.events[target.index!] = data.event!; break;
  }
}
