import React, { useEffect, useState } from 'react';

export type CommitNumberInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange'> & {
  value: number;
  onCommit: (value: number) => void;
};

export const CommitNumberInput: React.FC<CommitNumberInputProps> = ({ value, onCommit, ...props }) => {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    onCommit(parsed);
    setDraft(String(parsed));
  };

  return <input {...props} type="number" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      setDraft(String(value));
      event.currentTarget.blur();
    }
  }} />;
};
