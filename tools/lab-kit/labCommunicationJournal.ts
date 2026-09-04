export type LabCommunicationLogKind = 'request' | 'event';

export type LabCommunicationLogPhase =
  | 'request-started'
  | 'request-completed'
  | 'request-failed'
  | 'event-published'
  | 'event-completed'
  | 'event-listener-failed';

export type LabCommunicationLogStatus =
  | 'pending'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export type LabCommunicationLogError = Readonly<{
  name: string;
  message: string;
  code?: string;
}>;

export type LabCommunicationLogEntry = Readonly<{
  sequence: number;
  timestamp: number;
  messageId: string;
  correlationId?: string;
  kind: LabCommunicationLogKind;
  phase: LabCommunicationLogPhase;
  type: string;
  version: number;
  sourceModuleId: string;
  targetModuleId?: string;
  durationMs?: number;
  status: LabCommunicationLogStatus;
  payloadPreview?: unknown;
  resultPreview?: unknown;
  error?: LabCommunicationLogError;
  listenerCount?: number;
  deliveredCount?: number;
  failedCount?: number;
}>;

export type LabCommunicationLogInput = Omit<LabCommunicationLogEntry, 'sequence' | 'timestamp'> & {
  timestamp?: number;
};

export type LabCommunicationJournalListener = () => void;

export interface LabCommunicationJournalReader {
  readonly capacity: number;
  getEntries(): readonly LabCommunicationLogEntry[];
  subscribe(listener: LabCommunicationJournalListener): () => void;
  clear(): void;
  exportJson(): string;
}

type PreviewState = {
  seen: WeakSet<object>;
  nodes: number;
};

const PREVIEW_MAX_DEPTH = 3;
const PREVIEW_MAX_ITEMS = 12;
const PREVIEW_MAX_NODES = 120;
const PREVIEW_MAX_STRING = 240;

const previewValue = (value: unknown, depth: number, state: PreviewState): unknown => {
  state.nodes += 1;
  if (state.nodes > PREVIEW_MAX_NODES) return '[节点数量已截断]';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.length > PREVIEW_MAX_STRING
    ? `${value.slice(0, PREVIEW_MAX_STRING)}…`
    : value;
  if (typeof value === 'bigint') return `${String(value)}n`;
  if (typeof value === 'undefined') return '[undefined]';
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  if (typeof value === 'symbol') return String(value);
  if (depth >= PREVIEW_MAX_DEPTH) {
    if (Array.isArray(value)) return `[Array(${value.length})]`;
    if (value instanceof Map) return `[Map(${value.size})]`;
    if (value instanceof Set) return `[Set(${value.size})]`;
    return `[${value.constructor?.name ?? 'Object'}]`;
  }
  if (state.seen.has(value)) return '[循环引用]';
  state.seen.add(value);
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) {
    const result = value.slice(0, PREVIEW_MAX_ITEMS).map((item) => previewValue(item, depth + 1, state));
    if (value.length > PREVIEW_MAX_ITEMS) result.push(`[其余 ${value.length - PREVIEW_MAX_ITEMS} 项已截断]`);
    return result;
  }
  if (value instanceof Map) {
    return {
      $type: 'Map',
      size: value.size,
      entries: [...value.entries()].slice(0, PREVIEW_MAX_ITEMS)
        .map(([key, item]) => [previewValue(key, depth + 1, state), previewValue(item, depth + 1, state)]),
    };
  }
  if (value instanceof Set) {
    return {
      $type: 'Set',
      size: value.size,
      values: [...value].slice(0, PREVIEW_MAX_ITEMS).map((item) => previewValue(item, depth + 1, state)),
    };
  }
  const entries = Object.entries(value).slice(0, PREVIEW_MAX_ITEMS);
  const result: Record<string, unknown> = {};
  const constructorName = value.constructor?.name;
  if (constructorName && constructorName !== 'Object') result.$type = constructorName;
  entries.forEach(([key, item]) => { result[key] = previewValue(item, depth + 1, state); });
  const remaining = Object.keys(value).length - entries.length;
  if (remaining > 0) result.$truncated = `${remaining} 个字段未显示`;
  return result;
};

/** 创建不会保留业务对象引用的有限深度日志摘要。 */
export const createLabCommunicationLogPreview = (value: unknown): unknown => previewValue(value, 0, {
  seen: new WeakSet<object>(),
  nodes: 0,
});

export const createLabCommunicationLogError = (error: unknown): LabCommunicationLogError => {
  if (error instanceof Error) {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
    return { name: error.name, message: error.message, ...(code ? { code } : {}) };
  }
  return { name: 'UnknownError', message: String(error) };
};

/** Lab 生命周期内的有界通信日志；与 LabState 数据注册彼此独立。 */
export class LabCommunicationJournal implements LabCommunicationJournalReader {
  readonly capacity: number;
  private readonly entries: LabCommunicationLogEntry[] = [];
  private readonly listeners = new Set<LabCommunicationJournalListener>();
  private nextSequence = 1;

  constructor(capacity = 500) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new RangeError('Lab 通信日志 capacity 必须是大于 0 的安全整数。');
    }
    this.capacity = capacity;
  }

  append(input: LabCommunicationLogInput): LabCommunicationLogEntry {
    const entry = Object.freeze({
      ...input,
      sequence: this.nextSequence,
      timestamp: input.timestamp ?? Date.now(),
    });
    this.nextSequence += 1;
    this.entries.push(entry);
    if (this.entries.length > this.capacity) this.entries.splice(0, this.entries.length - this.capacity);
    this.notify();
    return entry;
  }

  getEntries(): readonly LabCommunicationLogEntry[] {
    return [...this.entries];
  }

  subscribe(listener: LabCommunicationJournalListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clear(): void {
    if (!this.entries.length) return;
    this.entries.length = 0;
    this.notify();
  }

  exportJson(): string {
    return JSON.stringify(this.entries, null, 2);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}
