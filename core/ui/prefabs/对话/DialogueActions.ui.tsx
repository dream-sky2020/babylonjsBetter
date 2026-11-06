import type { CSSProperties } from 'react';
import type { UiReactComponentProps } from '../../../ui-document/uiDocument.types';
import { dialogueUiMetadata } from '../metadata';

export default function DialogueActions({ node, runtime, onAction }: UiReactComponentProps) {
  const bound = (key: string, fallback: unknown) => runtime.resolveBinding(node.bindings?.[key]?.source ?? '', node.bindings?.[key]?.fallback ?? fallback);
  let choices: { id: string; text: string }[] = [];
  try {
    const value = JSON.parse(String(bound('choices', '[]')));
    if (Array.isArray(value)) choices = value.filter(item => item && typeof item.id === 'string' && typeof item.text === 'string');
  } catch { /* Malformed preview data leaves the choice list empty. */ }
  const p = node.props;
  const button: CSSProperties = { padding: '12px 18px', borderRadius: Number(p.cornerRadius),
    border: `${p.strokeWidth}px solid ${p.stroke}`, background: String(p.fill), color: String(p.textColor),
    font: `500 ${p.fontSize}px "Microsoft YaHei",sans-serif`, cursor: 'pointer', textAlign: 'left', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };
  return <div aria-label="对话操作" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 10, overflowY: 'auto' }}>
    {choices.map((choice, index) => <button key={choice.id} type="button" data-dialogue-choice={choice.id} style={button}
      onClick={event => { event.stopPropagation(); onAction?.(`dialogue.choose:${encodeURIComponent(choice.id)}`); }}>{index + 1}. {choice.text}</button>)}
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
      <button type="button" data-dialogue-cancel="" style={{ ...button, opacity: .8 }} onClick={event => { event.stopPropagation(); onAction?.('dialogue.cancel'); }}>结束对话</button>
      {Number(bound('canAdvance', 1)) > 0 && <button type="button" data-dialogue-next="" style={button}
        onClick={event => { event.stopPropagation(); onAction?.('dialogue.next'); }}>{String(bound('text', p.content) || '继续')} →</button>}
    </div>
  </div>;
}
// eslint-disable-next-line react-refresh/only-export-components
export const ui = { ...dialogueUiMetadata('dialogue-actions', '对话操作与选项', { width: 560, height: 250 }, { content: '继续', fontSize: 24, cornerRadius: 12 }),
  bindableFields: [
    { key: 'text', label: '继续按钮文字', propertyPath: 'content', valueType: 'string' as const },
    { key: 'choices', label: '选项列表（JSON）', propertyPath: 'content', valueType: 'string' as const },
    { key: 'canAdvance', label: '允许继续（0/1）', propertyPath: 'content', valueType: 'number' as const },
  ],
};
