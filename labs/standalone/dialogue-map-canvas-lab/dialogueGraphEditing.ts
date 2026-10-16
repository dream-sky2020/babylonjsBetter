import { cloneDialogueEditorDocument, dialogueLineId, dialogueNodeInputPortId, dialogueOutputPortId } from '../../../core/dialogue-map/dialogueMap.ts';
import { DIALOGUE_MAP_GRID_SIZE as GRID, type DialogueEditorDocument, type DialogueEditorNode, type DialogueEditorEdge } from '../../../core/dialogue-map/dialogueMap.types.ts';
import type { GraphPoint, GraphRect } from '../../../core/ui/node-graph/graphViewport.ts';

export const freshDialogueId = (prefix: string, used: ReadonlySet<string>): string => {
  let id = prefix;
  for (let index = 1; used.has(id); index++) id = `${prefix}_${index}`;
  return id;
};
export type DialogueGraphClipboard = { nodes: DialogueEditorNode[]; edges: DialogueEditorEdge[] };
/** A detached snapshot: later source edits, deletion and undo never change the clipboard. */
export function copyDialogueGraph(document: DialogueEditorDocument, ids: readonly string[]): DialogueGraphClipboard {
  const included = new Set(ids);
  const nodes = [...document.graph.nodes.values()].filter(node => included.has(node.id));
  if (!nodes.length) throw new Error('请先选择节点。');
  return structuredClone({ nodes, edges: [...document.graph.edges.values()].filter(edge => included.has(edge.from.nodeId) && included.has(edge.to.nodeId)) });
}

/** Build all objects before publishing them to the caller's transaction. */
export function pasteDialogueGraph(document: DialogueEditorDocument, clipboard: DialogueGraphClipboard, at: GraphPoint): { document: DialogueEditorDocument; ids: string[] } {
  if (!clipboard.nodes.length || !Number.isFinite(at.x) || !Number.isFinite(at.y)) throw new Error('无法粘贴空选区或无效位置。');
  const draft = cloneDialogueEditorDocument(document);
  const used = new Set(draft.graph.nodes.keys());
  const nodeIds = new Map<string, string>(), portIds = new Map<string, string>();
  const minX = Math.min(...clipboard.nodes.map(node => node.position.x));
  const minY = Math.min(...clipboard.nodes.map(node => node.position.y));
  const dx = Math.round((at.x - minX) / GRID) * GRID, dy = Math.round((at.y - minY) / GRID) * GRID;
  for (const original of clipboard.nodes) {
    const node = structuredClone(original);
    node.id = freshDialogueId(`${original.id}_copy`, used); used.add(node.id); nodeIds.set(original.id, node.id);
    node.position = { x: original.position.x + dx, y: original.position.y + dy };
    const lines = [...node.lines.values()];
    const lineIds = new Map(lines.map((line, index) => [line.id, dialogueLineId(node.id, `line_${index + 1}`)]));
    node.lines = new Map(lines.map(line => { const id = lineIds.get(line.id)!; return [id, { ...line, id }]; }));
    node.lineOrder = original.lineOrder.map(id => lineIds.get(id)!);
    node.inputs = new Map([...original.inputs].map(([old, port]) => { const id = dialogueNodeInputPortId(node.id); portIds.set(JSON.stringify([original.id, old]), id); return [id, { ...port, id }]; }));
    node.inputOrder = original.inputOrder.map(id => portIds.get(JSON.stringify([original.id, id]))!);
    node.outputs = new Map([...original.outputs].map(([old, port], index) => {
      const suffix = original.kind === 'condition' ? port.branch : `output_${index + 1}`;
      const id = dialogueOutputPortId(node.id, suffix); portIds.set(JSON.stringify([original.id, old]), id);
      return [id, { ...port, id }];
    }));
    node.outputOrder = original.outputOrder.map(id => portIds.get(JSON.stringify([original.id, id]))!);
    draft.graph.nodes.set(node.id, node);
  }
  for (const edge of clipboard.edges) {
    const fromNode = nodeIds.get(edge.from.nodeId), toNode = nodeIds.get(edge.to.nodeId);
    const fromPort = portIds.get(JSON.stringify([edge.from.nodeId, edge.from.portId])), toPort = portIds.get(JSON.stringify([edge.to.nodeId, edge.to.portId]));
    if (!fromNode || !toNode || !fromPort || !toPort) throw new Error('复制的连线端口不存在，粘贴已取消。');
    const id = freshDialogueId(`${edge.id}_copy`, new Set(draft.graph.edges.keys()));
    draft.graph.edges.set(id, { ...structuredClone(edge), id, from: { nodeId: fromNode, portId: fromPort }, to: { nodeId: toNode, portId: toPort } });
  }
  return { document: draft, ids: [...nodeIds.values()] };
}

export function deleteDialogueNodes(draft: DialogueEditorDocument, ids: readonly string[]): void {
  const removed = new Set(ids);
  for (const id of removed) draft.graph.nodes.delete(id);
  for (const [id, edge] of draft.graph.edges) if (removed.has(edge.from.nodeId) || removed.has(edge.to.nodeId)) draft.graph.edges.delete(id);
}

export const normalizedSelectionRect = (a: GraphPoint, b: GraphPoint): GraphRect => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) });
export const dialogueRectsIntersect = (a: GraphRect, b: GraphRect): boolean => a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
export type DialogueSelectionMode = 'replace' | 'add' | 'subtract' | 'toggle';
/** Resolve once on pointer down so releasing a modifier mid-drag cannot change the operation. */
export const dialogueSelectionMode = (keys: { altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }): DialogueSelectionMode => keys.altKey ? 'subtract' : keys.ctrlKey || keys.metaKey ? 'add' : keys.shiftKey ? 'toggle' : 'replace';
export function applyDialogueSelection(base: readonly string[], hit: readonly string[], mode: DialogueSelectionMode): string[] {
  if (mode === 'replace') return [...new Set(hit)];
  const ids = new Set(base);
  for (const id of new Set(hit)) {
    if (mode === 'subtract' || (mode === 'toggle' && ids.has(id))) ids.delete(id);
    else ids.add(id);
  }
  return [...ids];
}
export const toggleDialogueSelection = (base: readonly string[], hit: readonly string[]): string[] => applyDialogueSelection(base, hit, 'toggle');
export type DialogueArrange = 'left' | 'right' | 'top' | 'bottom' | 'horizontal' | 'vertical';
export function arrangeDialogueNodes(draft: DialogueEditorDocument, ids: readonly string[], mode: DialogueArrange, size: (node: DialogueEditorNode) => { width: number; height: number }): void {
  const nodes = ids.flatMap(id => { const node = draft.graph.nodes.get(id); return node ? [node] : []; });
  if (nodes.length < (mode === 'horizontal' || mode === 'vertical' ? 3 : 2)) return;
  if (mode === 'horizontal' || mode === 'vertical') {
    const axis = mode === 'horizontal' ? 'x' : 'y', dimension = axis === 'x' ? 'width' : 'height';
    nodes.sort((a, b) => a.position[axis] - b.position[axis]);
    const start = nodes[0].position[axis], last = nodes.at(-1)!;
    const extent = last.position[axis] + size(last)[dimension] - start;
    const gap = (extent - nodes.reduce((sum, node) => sum + size(node)[dimension], 0)) / (nodes.length - 1);
    let cursor = start;
    nodes.slice(0, -1).forEach(node => { node.position[axis] = cursor; cursor += size(node)[dimension] + gap; });
    return;
  }
  const axis = mode === 'left' || mode === 'right' ? 'x' : 'y', dimension = axis === 'x' ? 'width' : 'height';
  const trailing = mode === 'right' || mode === 'bottom';
  const target = trailing ? Math.max(...nodes.map(node => node.position[axis] + size(node)[dimension])) : Math.min(...nodes.map(node => node.position[axis]));
  nodes.forEach(node => { node.position[axis] = target - (trailing ? size(node)[dimension] : 0); });
}
