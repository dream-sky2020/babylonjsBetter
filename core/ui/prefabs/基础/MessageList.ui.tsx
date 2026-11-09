import type { CSSProperties } from 'react';
import type { UiReactComponentProps } from '../../../ui-document/uiDocument.types';
import { basicUiMetadata } from '../metadata';

type MessageRow = { id: string; text: string };

export default function MessageList({ node, runtime }: UiReactComponentProps) {
  const binding = node.bindings?.items;
  const bound = runtime.resolveBinding(binding?.source ?? '', binding?.fallback ?? '[]');
  let messages: MessageRow[] = [];
  try {
    const value: unknown = typeof bound === 'string' ? JSON.parse(bound) : bound;
    if (Array.isArray(value)) messages = value.filter(item => item && typeof item.id === 'string' && typeof item.text === 'string');
  } catch { /* Invalid preview data leaves the list empty. */ }

  const p = node.props;
  const itemStyle: CSSProperties = {
    boxSizing: 'border-box', padding: '8px 12px',
    border: `${p.strokeWidth}px solid ${p.stroke}`, borderLeft: `3px solid ${p.accent}`,
    borderRadius: Number(p.cornerRadius), background: String(p.fill), color: String(p.textColor),
    fontSize: Number(p.fontSize), lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
  };
  return <div role="log" aria-label="消息栏" className="lab-message-bar"
    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, width: 'max-content', maxWidth: '100%', pointerEvents: 'none' }}>
    {messages.map(message => <div key={message.id} className="lab-message-bar-item" style={{ ...itemStyle, maxWidth: '100%' }}>{message.text}</div>)}
  </div>;
}

const base = basicUiMetadata('label');
// eslint-disable-next-line react-refresh/only-export-components
export const ui = {
  ...base, type: 'message-list', label: '消息列表', defaultSize: { width: 360, height: 260 },
  fields: base.fields.filter(field => field.group === '外观'),
  bindableFields: [{ key: 'items', label: '消息列表（JSON）', propertyPath: 'content', valueType: 'string' as const }],
};
