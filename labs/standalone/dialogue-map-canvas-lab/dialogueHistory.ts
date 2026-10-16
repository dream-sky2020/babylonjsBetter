import type { DialogueEditorDocumentLibrary } from '../../../core/dialogue-map/dialogueMap.types.ts';

export type DialogueHistory = { present: DialogueEditorDocumentLibrary; past: DialogueEditorDocumentLibrary[]; future: DialogueEditorDocumentLibrary[] };
export const createDialogueHistory = (present: DialogueEditorDocumentLibrary = {}): DialogueHistory => ({ present, past: [], future: [] });
export const commitDialogueHistory = (history: DialogueHistory, present: DialogueEditorDocumentLibrary): DialogueHistory => present === history.present ? history : ({
  present, past: [...history.past, history.present].slice(-100), future: [],
});
export const undoDialogueHistory = (history: DialogueHistory): DialogueHistory => !history.past.length ? history : ({
  present: history.past.at(-1)!, past: history.past.slice(0, -1), future: [history.present, ...history.future],
});
export const redoDialogueHistory = (history: DialogueHistory): DialogueHistory => !history.future.length ? history : ({
  present: history.future[0], past: [...history.past, history.present], future: history.future.slice(1),
});
