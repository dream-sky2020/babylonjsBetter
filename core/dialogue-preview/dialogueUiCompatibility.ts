import { resolveUiNodeLayout } from '../ui-document/uiDocument.layout.ts';
import type { UiDocument } from '../ui-document/uiDocument.types.ts';

const bodyTypes = new Set(['dialogue-box', 'text', 'label', 'nameplate']);

/** Check the rendered tree so hidden groups and detached nodes cannot satisfy the contract. */
export function getDialogueUiIssues(document: UiDocument, needsChoices: boolean): string[] {
  let hasText = false, hasChoices = false;
  const visited = new Set<string>();
  const pending = [...document.rootIds];
  while (pending.length) {
    const id = pending.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = resolveUiNodeLayout(document, id);
    if (!node?.visible || node.opacity <= 0) continue;
    pending.push(...node.childIds);
    const { x, y, width, height } = node.layout;
    if (width <= 0 || height <= 0 || x >= document.canvas.width || y >= document.canvas.height || x + width <= 0 || y + height <= 0) continue;
    if (bodyTypes.has(node.type) && node.bindings?.text?.source === 'dialogue.text') hasText = true;
    if (node.type === 'dialogue-actions' && node.bindings?.choices?.source === 'dialogue.choices') hasChoices = true;
  }
  const issues: string[] = [];
  if (!hasText) issues.push('缺少可见的对白正文（绑定 dialogue.text）');
  if (needsChoices && !hasChoices) issues.push('缺少可见的对话选项（对话操作与选项需绑定 dialogue.choices）');
  return issues;
}

export function getDialogueUiOptions(library: Readonly<Record<string, UiDocument>>, needsChoices: boolean) {
  return Object.entries(library).map(([key, document]) => ({ key, name: document.name, issues: getDialogueUiIssues(document, needsChoices) }));
}
