import { compileDialogueFormula } from '@/core/dialogue-map/dialogueFormula';
import type { DialogueTextBindings } from '@/core/dialogue-map/dialogueMap.types';
import { DialogueLineTextEditor } from './DialogueTextEditors';
import { dialogueRuleCatalog } from './dialogueRuleCatalog';

export function DialogueFormulaEditor({ formula, bindings, onChange, manage }: {
  formula: string; bindings?: DialogueTextBindings; onChange(formula: string): void; manage(): void;
}) {
  let error = '';
  if (formula.trim()) {
    try {
      compileDialogueFormula(formula, bindings, binding => dialogueRuleCatalog.memories.find(item => item.key === binding.key)
        ?.fields.find(field => JSON.stringify(field.path) === JSON.stringify(binding.path))?.valueType);
    } catch (failure) { error = failure instanceof Error ? failure.message : String(failure); }
  }
  return <>
    <DialogueLineTextEditor label="判断公式" rows={2} text={formula} bindings={bindings} onChange={onChange} manage={manage} showMissing={false} />
    {error ? <p role="alert">{error}</p> : null}
    <p>例如 <code>{'{石障计数} >= 3'}</code>。可用括号、四则运算、比较、<code>&amp;&amp;</code>、<code>||</code> 和 <code>!</code>。</p>
  </>;
}
