export type LabKeyboardPhase = 'keydown' | 'keyup';
export type LabKeyboardHandleResult = 'handled' | 'ignored';
export type LabKeyboardTargetKind = 'canvas' | 'input' | 'textarea' | 'select' | 'contenteditable' | 'other';

export type LabKeyboardEvent = Readonly<{
  phase: LabKeyboardPhase;
  code: string;
  key: string;
  repeat: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  targetKind: LabKeyboardTargetKind;
  nativeEvent?: KeyboardEvent;
}>;

export type LabKeyboardConsumerOptions = {
  id: string;
  label: string;
  keys: readonly string[];
  enabled?: boolean;
  priority?: number;
  intercept?: boolean;
  preventDefault?: boolean;
  allowWhenEditing?: boolean;
  /** Babylon 等原生监听器仍需收到事件时设为 true；只影响 DOM，不影响 Router 内部拦截。 */
  allowNativePropagation?: boolean;
  onKeyDown?: (event: LabKeyboardEvent) => LabKeyboardHandleResult;
  onKeyUp?: (event: LabKeyboardEvent) => LabKeyboardHandleResult;
  onOwnershipChanged?: (ownedCodes: ReadonlySet<string>) => void;
};

export type LabKeyboardConsumerSnapshot = Readonly<{
  id: string;
  label: string;
  keys: readonly string[];
  enabled: boolean;
  priority: number;
  intercept: boolean;
  preventDefault: boolean;
  allowWhenEditing: boolean;
  ownedCodes: readonly string[];
}>;

export type LabKeyboardRouteDecision = Readonly<{
  consumerId: string;
  priority: number;
  decision: 'handled' | 'ignored' | 'intercepted' | 'editing-blocked';
}>;

export type LabKeyboardRouteRecord = Readonly<{
  sequence: number;
  timestamp: number;
  phase: LabKeyboardPhase;
  code: string;
  key: string;
  repeat: boolean;
  targetKind: LabKeyboardTargetKind;
  decisions: readonly LabKeyboardRouteDecision[];
  handledBy: readonly string[];
  interceptedBy?: string;
  defaultPrevented: boolean;
  globalEnabled: boolean;
}>;

export interface LabKeyboardConsumerHandle {
  readonly id: string;
  setEnabled(enabled: boolean): void;
  setPriority(priority: number): void;
  setIntercept(intercept: boolean): void;
  setPreventDefault(preventDefault: boolean): void;
  setKeys(keys: readonly string[]): void;
  owns(code: string): boolean;
  dispose(): void;
}
