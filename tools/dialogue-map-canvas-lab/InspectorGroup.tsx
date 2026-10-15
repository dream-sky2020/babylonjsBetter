import { DialoguePropertyActions } from './DialoguePropertyClipboard';
import type { DialoguePropertyTarget } from './dialoguePropertyEditing';
import React, { useState } from 'react';

export const InspectorGroup: React.FC<{
  title: string;
  property?: DialoguePropertyTarget;
  onSelect?: () => void;
  count?: number;
  defaultOpen?: boolean;
  className?: string;
  focused?: boolean;
  focusToken?: unknown;
  children: React.ReactNode;
}> = ({ title, property, onSelect, count, defaultOpen = true, className = '', focused = false, focusToken, children }) => {
  const [state, setState] = useState({ open: defaultOpen || focused, focused, focusToken });
  if (state.focused !== focused || state.focusToken !== focusToken) {
    setState({ focused, focusToken, open: focused ? true : state.open });
  }
  const open = state.open;
  return <section style={{ order: focused ? -10 : 0 }} className={`inspector-group ${className} ${focused ? 'inspector-group--focused' : ''}`}>
    <button type="button" className="inspector-group__heading" aria-expanded={open} onClick={() => { onSelect?.(); setState(current => ({ ...current, open: !current.open })); }}>
      <span className="inspector-group__chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
      <strong>{title}</strong>
      {count !== undefined ? <small>{count}</small> : null}
    </button>
    {open ? <div className="inspector-group__body">{property ? <DialoguePropertyActions target={property} /> : null}{children}</div> : null}
  </section>;
};
