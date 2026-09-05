import type {
  LabKeyboardConsumerHandle,
  LabKeyboardConsumerOptions,
  LabKeyboardConsumerSnapshot,
  LabKeyboardEvent,
  LabKeyboardPhase,
  LabKeyboardRouteDecision,
  LabKeyboardRouteRecord,
  LabKeyboardTargetKind,
} from './labKeyboard.types.ts';

type Consumer = {
  order: number;
  options: LabKeyboardConsumerOptions;
  keys: Set<string>;
  enabled: boolean;
  priority: number;
  intercept: boolean;
  preventDefault: boolean;
  allowWhenEditing: boolean;
};

export type LabKeyboardRouterOptions = {
  recordCapacity?: number;
  onGlobalEnabledChanged?: (enabled: boolean) => void;
  onSettingsChanged?: (consumer: LabKeyboardConsumerSnapshot) => void;
  onConflictChanged?: (code: string, consumerIds: readonly string[]) => void;
};

export type LabKeyboardRouteInput = Omit<LabKeyboardEvent, 'nativeEvent'> & {
  preventDefault?: () => void;
  stopImmediatePropagation?: () => void;
  nativeEvent?: KeyboardEvent;
};

const normalizeId = (value: string): string => {
  const id = value.trim();
  if (!id) throw new Error('键盘消费者 ID 不能为空。');
  return id;
};

const isEditingTarget = (kind: LabKeyboardTargetKind): boolean => (
  kind === 'input' || kind === 'textarea' || kind === 'select' || kind === 'contenteditable'
);

const targetKindOf = (target: EventTarget | null): LabKeyboardTargetKind => {
  if (!(target instanceof Element)) return 'other';
  if (target instanceof HTMLCanvasElement) return 'canvas';
  if (target instanceof HTMLInputElement) return 'input';
  if (target instanceof HTMLTextAreaElement) return 'textarea';
  if (target instanceof HTMLSelectElement) return 'select';
  if (target.closest('[contenteditable="true"]')) return 'contenteditable';
  return 'other';
};

export class LabKeyboardRouter {
  private readonly eventTarget: Window | null;
  private readonly options: LabKeyboardRouterOptions;
  private readonly consumers = new Map<string, Consumer>();
  private readonly listeners = new Set<() => void>();
  private readonly records: LabKeyboardRouteRecord[] = [];
  private readonly pressedCodes = new Set<string>();
  private readonly conflicts = new Map<string, string>();
  private readonly recordCapacity: number;
  private order = 0;
  private sequence = 0;
  private disposed = false;
  private enabled = true;

  constructor(
    eventTarget: Window | null = typeof window === 'undefined' ? null : window,
    options: LabKeyboardRouterOptions = {},
  ) {
    this.eventTarget = eventTarget;
    this.options = options;
    this.recordCapacity = Math.max(1, Math.floor(options.recordCapacity ?? 100));
    this.eventTarget?.addEventListener('keydown', this.onKeyDown, { capture: true });
    this.eventTarget?.addEventListener('keyup', this.onKeyUp, { capture: true });
    this.eventTarget?.addEventListener('blur', this.onBlur);
  }

  get globalEnabled(): boolean { return this.enabled; }
  get pressed(): ReadonlySet<string> { return this.pressedCodes; }
  get routeRecords(): readonly LabKeyboardRouteRecord[] { return this.records; }

  setGlobalEnabled(enabled: boolean): void {
    this.requireActive();
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.pressedCodes.clear();
    this.options.onGlobalEnabledChanged?.(enabled);
    this.emit();
  }

  configureConsumer(
    id: string,
    change: Partial<Pick<LabKeyboardConsumerSnapshot, 'enabled' | 'priority' | 'intercept' | 'preventDefault'>>,
  ): void {
    this.requireActive();
    const consumer = this.consumers.get(id);
    if (!consumer) throw new Error(`键盘消费者“${id}”不存在。`);
    if (change.priority !== undefined && !Number.isFinite(change.priority)) {
      throw new RangeError('键盘优先级必须是有限数。');
    }
    if (change.enabled !== undefined) consumer.enabled = change.enabled;
    if (change.priority !== undefined) consumer.priority = change.priority;
    if (change.intercept !== undefined) consumer.intercept = change.intercept;
    if (change.preventDefault !== undefined) consumer.preventDefault = change.preventDefault;
    this.options.onSettingsChanged?.(this.snapshotOf(consumer));
    this.recalculateOwnership();
  }

  register(options: LabKeyboardConsumerOptions): LabKeyboardConsumerHandle {
    this.requireActive();
    const id = normalizeId(options.id);
    if (this.consumers.has(id)) throw new Error(`键盘消费者“${id}”已经注册。`);
    const consumer: Consumer = {
      order: this.order++,
      options: { ...options, id },
      keys: new Set(options.keys.filter(Boolean)),
      enabled: options.enabled !== false,
      priority: Number.isFinite(options.priority) ? options.priority! : 50,
      intercept: options.intercept !== false,
      preventDefault: options.preventDefault === true,
      allowWhenEditing: options.allowWhenEditing === true,
    };
    this.consumers.set(id, consumer);
    this.options.onSettingsChanged?.(this.snapshotOf(consumer));
    this.recalculateOwnership();
    let active = true;
    const update = (change: Partial<Pick<Consumer, 'enabled' | 'priority' | 'intercept' | 'preventDefault'>>): void => {
      if (!active || this.consumers.get(id) !== consumer) throw new Error(`键盘消费者“${id}”已经释放。`);
      Object.assign(consumer, change);
      this.options.onSettingsChanged?.(this.snapshotOf(consumer));
      this.recalculateOwnership();
    };
    return Object.freeze({
      id,
      setEnabled: (value: boolean) => update({ enabled: value }),
      setPriority: (value: number) => {
        if (!Number.isFinite(value)) throw new RangeError('键盘优先级必须是有限数。');
        update({ priority: value });
      },
      setIntercept: (value: boolean) => update({ intercept: value }),
      setPreventDefault: (value: boolean) => update({ preventDefault: value }),
      setKeys: (keys: readonly string[]) => {
        if (!active || this.consumers.get(id) !== consumer) throw new Error(`键盘消费者“${id}”已经释放。`);
        consumer.keys = new Set(keys.filter(Boolean));
        this.options.onSettingsChanged?.(this.snapshotOf(consumer));
        this.recalculateOwnership();
      },
      owns: (code: string) => this.getOwner(code)?.id === id,
      dispose: () => {
        if (!active) return;
        active = false;
        this.consumers.delete(id);
        this.recalculateOwnership();
      },
    });
  }

  getConsumers(): readonly LabKeyboardConsumerSnapshot[] {
    this.requireActive();
    return this.sortedConsumers().map((consumer) => this.snapshotOf(consumer));
  }

  getConsumer(id: string): LabKeyboardConsumerSnapshot | null {
    this.requireActive();
    const consumer = this.consumers.get(id);
    return consumer ? this.snapshotOf(consumer) : null;
  }

  getOwner(code: string): LabKeyboardConsumerSnapshot | null {
    this.requireActive();
    const consumer = this.sortedConsumers().find((candidate) => candidate.enabled && candidate.keys.has(code));
    return consumer ? this.snapshotOf(consumer) : null;
  }

  subscribe(listener: () => void): () => void {
    this.requireActive();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clearRouteRecords(): void {
    this.requireActive();
    this.records.length = 0;
    this.emit();
  }

  route(input: LabKeyboardRouteInput): LabKeyboardRouteRecord {
    this.requireActive();
    if (input.phase === 'keydown') this.pressedCodes.add(input.code);
    else this.pressedCodes.delete(input.code);
    const candidates = this.sortedConsumers().filter((consumer) => consumer.enabled && consumer.keys.has(input.code));
    const decisions: LabKeyboardRouteDecision[] = [];
    const handledBy: string[] = [];
    let interceptedBy: string | undefined;
    let defaultPrevented = false;
    let nativePropagationClaimed = false;
    if (this.enabled) {
      for (const consumer of candidates) {
        if (interceptedBy) {
          decisions.push({ consumerId: consumer.options.id, priority: consumer.priority, decision: 'intercepted' });
          continue;
        }
        if (isEditingTarget(input.targetKind) && !consumer.allowWhenEditing) {
          decisions.push({ consumerId: consumer.options.id, priority: consumer.priority, decision: 'editing-blocked' });
          continue;
        }
        const handler = input.phase === 'keydown' ? consumer.options.onKeyDown : consumer.options.onKeyUp;
        const result = handler?.({ ...input, nativeEvent: input.nativeEvent }) ?? 'ignored';
        decisions.push({ consumerId: consumer.options.id, priority: consumer.priority, decision: result });
        if (result !== 'handled') continue;
        handledBy.push(consumer.options.id);
        if (consumer.options.allowNativePropagation) nativePropagationClaimed = true;
        if (consumer.preventDefault) {
          input.preventDefault?.();
          defaultPrevented = true;
        }
        if (consumer.intercept) {
          interceptedBy = consumer.options.id;
          if (!nativePropagationClaimed) input.stopImmediatePropagation?.();
        }
      }
    }
    const record: LabKeyboardRouteRecord = Object.freeze({
      sequence: ++this.sequence,
      timestamp: Date.now(),
      phase: input.phase,
      code: input.code,
      key: input.key,
      repeat: input.repeat,
      targetKind: input.targetKind,
      decisions: Object.freeze(decisions),
      handledBy: Object.freeze(handledBy),
      ...(interceptedBy ? { interceptedBy } : {}),
      defaultPrevented,
      globalEnabled: this.enabled,
    });
    this.records.push(record);
    if (this.records.length > this.recordCapacity) this.records.splice(0, this.records.length - this.recordCapacity);
    this.emit();
    return record;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.eventTarget?.removeEventListener('keydown', this.onKeyDown, { capture: true });
    this.eventTarget?.removeEventListener('keyup', this.onKeyUp, { capture: true });
    this.eventTarget?.removeEventListener('blur', this.onBlur);
    this.consumers.clear();
    this.pressedCodes.clear();
    this.records.length = 0;
    this.listeners.clear();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => this.routeDom('keydown', event);
  private readonly onKeyUp = (event: KeyboardEvent): void => this.routeDom('keyup', event);
  private readonly onBlur = (): void => { this.pressedCodes.clear(); this.emit(); };

  private routeDom(phase: LabKeyboardPhase, event: KeyboardEvent): void {
    this.route({
      phase,
      code: event.code || event.key,
      key: event.key,
      repeat: event.repeat,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      targetKind: targetKindOf(event.target),
      nativeEvent: event,
      preventDefault: () => event.preventDefault(),
      stopImmediatePropagation: () => event.stopImmediatePropagation(),
    });
  }

  private sortedConsumers(): Consumer[] {
    return [...this.consumers.values()].sort((left, right) => right.priority - left.priority || left.order - right.order);
  }

  private snapshotOf(consumer: Consumer): LabKeyboardConsumerSnapshot {
    const ownedCodes = [...consumer.keys].filter((code) => this.sortedConsumers()
      .find((candidate) => candidate.enabled && candidate.keys.has(code)) === consumer);
    return Object.freeze({
      id: consumer.options.id,
      label: consumer.options.label,
      keys: Object.freeze([...consumer.keys]),
      enabled: consumer.enabled,
      priority: consumer.priority,
      intercept: consumer.intercept,
      preventDefault: consumer.preventDefault,
      allowWhenEditing: consumer.allowWhenEditing,
      ownedCodes: Object.freeze(ownedCodes),
    });
  }

  private recalculateOwnership(): void {
    const codes = new Set([...this.consumers.values()].flatMap((consumer) => [...consumer.keys]));
    this.consumers.forEach((consumer) => consumer.options.onOwnershipChanged?.(
      new Set([...consumer.keys].filter((code) => this.getOwner(code)?.id === consumer.options.id)),
    ));
    codes.forEach((code) => {
      const ids = this.sortedConsumers().filter((consumer) => consumer.enabled && consumer.keys.has(code)).map((consumer) => consumer.options.id);
      const signature = ids.join('|');
      if (this.conflicts.get(code) === signature) return;
      this.conflicts.set(code, signature);
      if (ids.length > 1) this.options.onConflictChanged?.(code, ids);
    });
    this.emit();
  }

  private emit(): void { this.listeners.forEach((listener) => listener()); }
  private requireActive(): void { if (this.disposed) throw new Error('LabKeyboardRouter 已释放。'); }
}
