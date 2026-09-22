import { useState, type ReactNode } from 'react';

export function InspectorPanel({ eyebrow = 'INSPECTOR', title = '对象属性', status, action, footer, className = '', children }: { eyebrow?: string; title?: string; status?: ReactNode; action?: ReactNode; footer?: ReactNode; className?: string; children: ReactNode }) {
  return <aside className={`editor-inspector ${className}`.trim()}><header className="editor-inspector-heading"><div><b>{eyebrow}</b><span>{title}</span></div><div>{status && <em>{status}</em>}{action}</div></header><div className="editor-inspector-scroll">{children}</div>{footer && <footer>{footer}</footer>}</aside>;
}

export function InspectorSection({ title, subtitle, defaultOpen = true, children, className = '' }: { title: string; subtitle?: ReactNode; defaultOpen?: boolean; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return <section className={`editor-inspector-section${open ? ' open' : ''} ${className}`.trim()}><button className="editor-inspector-section-heading" onClick={() => setOpen(value => !value)} aria-expanded={open}><svg viewBox="0 0 16 16"><path d="m5 3 5 5-5 5" /></svg><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</button>{open && <div className="editor-inspector-section-body">{children}</div>}</section>;
}

export function InspectorEmpty({ title = '未选择对象', children }: { title?: string; children?: ReactNode }) {
  return <div className="editor-inspector-empty"><strong>{title}</strong>{children && <p>{children}</p>}</div>;
}
