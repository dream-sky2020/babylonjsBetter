import type { DialogueEditorDocument, DialogueEditorNode, DialogueMapValidationIssue, DialogueRuleCatalog, DialogueCondition, DialogueEffect, DialogueEditorLine, DialogueEventWait, DialogueMapAction } from './dialogueMap.types.ts';
import { diagnoseDialogueEntry, validateDialogueEditorDocument } from './dialogueMap.ts';
import { validateDialogueNodeRules } from './dialogueRules.ts';
import { dialogueTextVariableNames } from './dialogueText.ts';
import type { DialogueTextBindings } from './dialogueMap.types.ts';
import { compileDialogueFormula, type DialogueFormula } from './dialogueFormula.ts';

type InstructionBase = { id: string; routes: Record<string, string>; labels: Record<string, string> };
export type DialogueInstruction = InstructionBase & (
  | ({ kind: 'condition'; branches: Record<string, 'true' | 'false'> } & ({ formula: DialogueFormula } | { condition: DialogueCondition }))
  | { kind: 'choice'; lines: DialogueEditorLine[]; choices: Array<{ id: string; text: string }> }
  | { kind: 'event'; mode: 'send'; events: DialogueEffect[]; next?: string }
  | { kind: 'event'; mode: 'wait'; events: DialogueEffect[]; wait: DialogueEventWait; next?: string; timeout?: string }
  | { kind: 'action'; action: DialogueMapAction; next?: string }
);
export type CompiledDialogue = { version: 1; presetKey: string; entryNodeId: string; textVariables?: DialogueTextBindings; instructions: Record<string, DialogueInstruction> };
export type DialogueCompileResult = { issues: DialogueMapValidationIssue[]; program?: CompiledDialogue };

/** Compile a snapshot; never edits or executes the author's graph. */
export const compileDialogueEditorDocument = (document: DialogueEditorDocument, entryNodeId: string, catalog?: DialogueRuleCatalog): DialogueCompileResult => {
  const issues = [...validateDialogueEditorDocument(document), ...diagnoseDialogueEntry(document, entryNodeId)];
  const report = (code: string, message: string, severity: 'error' | 'warning', nodeId?: string, portId?: string, edgeId?: string) => issues.push({ code, message, severity, nodeId, portId, edgeId });
  const outgoing = new Map<string, Map<string, string>>();
  const formulas = new Map<string, DialogueFormula>();
  document.graph.edges.forEach(edge => {
    const source = document.graph.nodes.get(edge.from.nodeId), target = document.graph.nodes.get(edge.to.nodeId);
    if (!source?.outputs.has(edge.from.portId)) report('invalid-source', '连线起点或输出端口不存在。', 'error', edge.from.nodeId, edge.from.portId, edge.id);
    if (!target?.inputs.has(edge.to.portId)) report('invalid-target', '连线终点或输入端口不存在。', 'error', edge.to.nodeId, edge.to.portId, edge.id);
    const routes = outgoing.get(edge.from.nodeId) ?? new Map<string, string>(); outgoing.set(edge.from.nodeId, routes);
    if (routes.has(edge.from.portId)) report('ambiguous-route', '同一出口存在多条连线，编译无法确定唯一去向。', 'error', edge.from.nodeId, edge.from.portId, edge.id);
    routes.set(edge.from.portId, edge.to.nodeId);
  });
  document.graph.nodes.forEach(node => {
    node.lines.forEach(line => {
      for (const name of dialogueTextVariableNames(line.text)) {
        const binding = document.textVariables && Object.hasOwn(document.textVariables, name) ? document.textVariables[name] : undefined;
        const message = !binding ? `对白变量「${name}」未绑定。` :
          !binding.key.trim() || binding.path.some(field => !field.trim()) ? `对白变量「${name}」的 Key 或字段路径不完整。` : undefined;
        if (message) issues.push({ code: 'text-variable', message, severity: 'warning', nodeId: node.id, lineId: line.id });
      }
    });
    validateDialogueNodeRules(node, catalog).forEach(item => issues.push({ ...item, code: 'node-rule', nodeId: node.id }));
    if (node.kind !== 'choice' && node.lines.size) report('unexpected-lines', '此类型节点不能包含对白，请使用对话卡片。', 'error', node.id);
    if (node.kind === 'event' || node.kind === 'action') {
      const ports = [...node.outputs.values()];
      if (ports.filter(port => port.branch === 'next').length > 1 || ports.filter(port => port.branch === 'timeout').length > 1) report('ambiguous-continuation', '同一种结果只能有一个出口。', 'error', node.id);
    }
    if (node.kind === 'condition') {
      if (node.formula !== undefined) {
        try {
          formulas.set(node.id, compileDialogueFormula(node.formula, document.textVariables, binding => catalog?.memories.find(item => item.key === binding.key)
            ?.fields.find(field => JSON.stringify(field.path) === JSON.stringify(binding.path))?.valueType));
        } catch (error) {
          report('condition-formula', error instanceof Error ? error.message : String(error), 'error', node.id);
        }
      }
      for (const branch of ['true', 'false'] as const) {
        const ports = [...node.outputs.values()].filter(port => port.branch === branch);
        if (ports.length !== 1) report('condition-branch', `判断节点需要一个“${branch === 'true' ? '成立' : '不成立'}”出口。`, 'error', node.id);
      }
    }
    node.outputs.forEach(port => {
      const valid = node.kind === 'condition' ? ['true', 'false'].includes(port.branch) : port.branch === (node.kind === 'choice' ? 'choice' : 'next')
        || (node.kind === 'event' && node.mode === 'wait' && port.branch === 'timeout' && node.wait.timeoutMs !== undefined);
      if (!valid) report('invalid-branch', '出口分支与节点类型不匹配。', 'error', node.id, port.id);
      if (node.kind === 'choice' && !port.label?.trim()) report('empty-choice-text', '选项文本不能为空。', 'error', node.id, port.id);
      if (!outgoing.get(node.id)?.has(port.id)) report('unconnected-output', '出口尚未连接；编译后此分支结束。', 'warning', node.id, port.id);
    });
  });
  // A reverse reachability pass distinguishes closed loops from menus that can exit.
  const canEnd = new Set<string>();
  document.graph.nodes.forEach(node => { if (!node.outputs.size || node.outputOrder.some(id => !outgoing.get(node.id)?.has(id))) canEnd.add(node.id); });
  let changed = true;
  while (changed) { changed = false; document.graph.edges.forEach(edge => { if (canEnd.has(edge.to.nodeId) && !canEnd.has(edge.from.nodeId)) { canEnd.add(edge.from.nodeId); changed = true; } }); }
  document.graph.nodes.forEach(node => { if (!canEnd.has(node.id)) report('closed-flow', '此节点所在流程没有可到达的结束出口，请确认循环是预期行为。', 'warning', node.id); });
  if (issues.some(item => item.severity === 'error')) return { issues };
  const instruction = (node: DialogueEditorNode): DialogueInstruction => {
    const base = { id: node.id, routes: Object.fromEntries(outgoing.get(node.id) ?? []), labels: Object.fromEntries([...node.outputs].map(([id, port]) => [id, port.label ?? ''])) };
    if (node.kind === 'condition') {
      const formula = formulas.get(node.id);
      const branches = Object.fromEntries([...node.outputs].map(([id, port]) => [id, port.branch])) as Record<string, 'true' | 'false'>;
      return formula ? { ...base, kind: node.kind, formula, branches } :
        { ...base, kind: node.kind, condition: structuredClone(node.condition!), branches };
    }
    if (node.kind === 'choice') return { ...base, kind: node.kind, lines: node.lineOrder.map(id => structuredClone(node.lines.get(id)!)), choices: node.outputOrder.map(id => ({ id, text: node.outputs.get(id)!.label! })) };
    const target = (branch: 'next' | 'timeout') => base.routes[[...node.outputs.values()].find(port => port.branch === branch)?.id ?? ''];
    const next = target('next');
    if (node.kind === 'action') return { ...base, kind: node.kind, action: structuredClone(node.action!), next };
    const events = structuredClone(node.events);
    if (node.mode === 'wait') return { ...base, kind: node.kind, mode: node.mode, events, wait: structuredClone(node.wait), next, timeout: target('timeout') };
    return { ...base, kind: node.kind, mode: node.mode, events, next };
  };
  return { issues, program: { version: 1, presetKey: document.presetKey, entryNodeId,
    ...(document.textVariables === undefined ? {} : { textVariables: structuredClone(document.textVariables) }),
    instructions: Object.fromEntries([...document.graph.nodes].map(([id, node]) => [id, instruction(node)])) } };
};
