import { createContext } from 'react';
import type { DialoguePropertySnapshot, DialoguePropertyTarget } from './dialoguePropertyEditing.ts';

export const DialoguePropertyClipboardContext = createContext<{
  clipboard?: DialoguePropertySnapshot;
  copy(target: DialoguePropertyTarget): void;
  paste(target: DialoguePropertyTarget, append?: boolean): void;
  reason(target: DialoguePropertyTarget, append?: boolean): string | undefined;
} | null>(null);
