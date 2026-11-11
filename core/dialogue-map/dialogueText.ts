import type { DialogueScalar, DialogueTextBinding, DialogueTextBindings } from './dialogueMap.types.ts';

export const isDialogueTextVariableName = (name: string) => /^[\p{L}\p{N}_-]{1,64}$/u.test(name);
const template = /\{\{([^{}]*)\}\}|\{([\p{L}\p{N}_-]{1,64})\}/gu;

export function dialogueTextVariableNames(text: string): string[] {
  return [...new Set([...text.matchAll(template)].flatMap(match => match[2] ? [match[2]] : []))];
}

export function renderDialogueText(
  text: string,
  bindings: DialogueTextBindings | undefined,
  read: (binding: DialogueTextBinding, name: string) => DialogueScalar | undefined,
  onMissing?: (name: string, binding: DialogueTextBinding | undefined, error?: unknown) => void,
): string {
  const values = new Map<string, string>();
  return text.replace(template, (_, literal: string | undefined, name: string) => {
    if (literal !== undefined) return `{${literal}}`;
    const cached = values.get(name);
    if (cached !== undefined) return cached;
    const binding = bindings && Object.hasOwn(bindings, name) ? bindings[name] : undefined;
    let value: DialogueScalar | undefined;
    let failure: unknown;
    try { if (binding) value = read(binding, name); } catch (error) { failure = error; }
    if (value === undefined) onMissing?.(name, binding, failure);
    const rendered = value === null || value === undefined ? '—' : String(value);
    values.set(name, rendered);
    return rendered;
  });
}
