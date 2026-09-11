import { useCallback, useReducer, type SetStateAction } from 'react';
import type { AnimationWorkspace } from './animationWorkspace.ts';

export type WorkspaceHistoryState = Readonly<{
  past: readonly AnimationWorkspace[];
  present: AnimationWorkspace;
  future: readonly AnimationWorkspace[];
  transactionStart: AnimationWorkspace | null;
}>;

type WorkspaceHistoryAction =
  | Readonly<{ type: 'commit'; update: SetStateAction<AnimationWorkspace> }>
  | Readonly<{ type: 'begin' }>
  | Readonly<{ type: 'end' }>
  | Readonly<{ type: 'undo' }>
  | Readonly<{ type: 'redo' }>;

const HISTORY_LIMIT = 100;
const append = (items: readonly AnimationWorkspace[], workspace: AnimationWorkspace) => [...items.slice(-(HISTORY_LIMIT - 1)), workspace];

export function workspaceHistoryReducer(state: WorkspaceHistoryState, action: WorkspaceHistoryAction): WorkspaceHistoryState {
  if (action.type === 'commit') {
    const next = typeof action.update === 'function' ? action.update(state.present) : action.update;
    if (Object.is(next, state.present)) return state;
    if (state.transactionStart) return { ...state, present: next };
    return { past: append(state.past, state.present), present: next, future: [], transactionStart: null };
  }
  if (action.type === 'begin') return state.transactionStart ? state : { ...state, transactionStart: state.present };
  if (action.type === 'end') {
    if (!state.transactionStart) return state;
    if (Object.is(state.transactionStart, state.present)) return { ...state, transactionStart: null };
    return { past: append(state.past, state.transactionStart), present: state.present, future: [], transactionStart: null };
  }
  if (action.type === 'undo') {
    const previous = state.past.at(-1); if (!previous) return state;
    return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future], transactionStart: null };
  }
  const next = state.future[0]; if (!next) return state;
  return { past: append(state.past, state.present), present: next, future: state.future.slice(1), transactionStart: null };
}

export function useWorkspaceHistory(initial: AnimationWorkspace) {
  const [state, dispatch] = useReducer(workspaceHistoryReducer, { past: [], present: initial, future: [], transactionStart: null });
  const setWorkspace = useCallback((update: SetStateAction<AnimationWorkspace>) => dispatch({ type: 'commit', update }), []);
  return {
    workspace: state.present,
    setWorkspace,
    undo: useCallback(() => dispatch({ type: 'undo' }), []),
    redo: useCallback(() => dispatch({ type: 'redo' }), []),
    beginTransaction: useCallback(() => dispatch({ type: 'begin' }), []),
    endTransaction: useCallback(() => dispatch({ type: 'end' }), []),
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
