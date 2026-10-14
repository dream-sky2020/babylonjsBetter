import React, { useEffect, useState } from 'react';

export const InspectorGroup: React.FC<{
  title: string;
  count?: number;
  defaultOpen?: boolean;
  className?: string;
  focused?: boolean;
  focusToken?: unknown;
  children: React.ReactNode;
}> = ({ title, count, defaultOpen = true, className = '', focused = false, focusToken, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { if (focused) setOpen(true); }, [focused, focusToken]);
  return <section style={{ order: focused ? -10 : 0 }} className={`inspector-group ${className} ${focused ? 'inspector-group--focused' : ''}`}>
    <button type="button" className="inspector-group__heading" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span className="inspector-group__chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
      <strong>{title}</strong>
      {count !== undefined ? <small>{count}</small> : null}
    </button>
    {open ? <div className="inspector-group__body">{children}</div> : null}
  </section>;
};
