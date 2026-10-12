import {
  LabCommunicationError,
  type LabEventDefinition,
  type LabEventListener,
  type LabMessageEnvelope,
  type LabPublishOptions,
  type LabPublishReport,
  type LabRequestDefinition,
  type LabRequestHandler,
  type LabRequestOptions,
} from './labCommunication.types.ts';
import {
  createLabCommunicationLogError,
  createLabCommunicationLogPreview,
  LabCommunicationJournal,
} from './labCommunicationJournal.ts';

type AnyRequestHandler = LabRequestHandler<unknown, unknown>;
type AnyEventListener = LabEventListener<unknown>;

type RegisteredRequestHandler = {
  moduleId: string;
  handler: AnyRequestHandler;
};

type RegisteredEventListener = {
  listenerId: string;
  moduleId: string;
  listener: AnyEventListener;
};

const protocolKey = (definition: { type: string; version: number }): string => (
  `${definition.type}@${definition.version}`
);

let nextMessageId = 1;
const createMessageId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const id = nextMessageId;
  nextMessageId += 1;
  return `lab-message:${id}`;
};

const monotonicNow = (): number => globalThis.performance?.now() ?? Date.now();

const failureStatus = (error: unknown): 'failed' | 'cancelled' | 'timeout' => {
  if (!(error instanceof LabCommunicationError)) return 'failed';
  if (error.code === 'TIMEOUT') return 'timeout';
  if (error.code === 'ABORTED' || error.code === 'DISPOSED') return 'cancelled';
  return 'failed';
};

export type LabCommunicationOptions = Readonly<{
  journalCapacity?: number;
}>;

/** Lab 内部通信路由；业务模块通过 scope() 获得带来源身份的端点。 */
export class LabCommunication {
  readonly journal: LabCommunicationJournal;
  private readonly requestHandlers = new Map<string, RegisteredRequestHandler>();
  private readonly eventListeners = new Map<string, Set<RegisteredEventListener>>();
  private readonly eventDefinitions = new Map<string, {
    definition: LabEventDefinition<any>; declaredPublishers: Map<string, number>; observedPublishers: Set<string>;
  }>();
  private readonly bindingListeners = new Set<() => void>();
  private nextListenerId = 1;
  private readonly activeRequests = new Set<AbortController>();
  private disposed = false;

  constructor(options: LabCommunicationOptions = {}) {
    this.journal = new LabCommunicationJournal(options.journalCapacity);
  }

  /** Installed routing, independent of traffic frequency and journal retention. */
  inspectBindings() {
    return {
      requests: [...this.requestHandlers].map(([protocol, handler]) => ({ protocol, owner: handler.moduleId })),
      events: [...this.eventListeners].map(([protocol, listeners]) => ({
        protocol, consumers: [...new Set([...listeners].map(listener => listener.moduleId))],
      })),
    };
  }

  inspectEvents() {
    return [...this.eventDefinitions].map(([protocol, entry]) => {
      const listeners = [...(this.eventListeners.get(protocol) ?? [])];
      return { protocol, definition: entry.definition,
        declaredPublishers: [...entry.declaredPublishers.keys()], observedPublishers: [...entry.observedPublishers],
        listeners: listeners.map(({ listenerId, moduleId }) => ({ listenerId, moduleId })),
        listenerCount: listeners.length, moduleCount: new Set(listeners.map(listener => listener.moduleId)).size };
    });
  }

  subscribeBindings(listener: () => void): () => void {
    this.bindingListeners.add(listener); return () => { this.bindingListeners.delete(listener); };
  }

  private bindingsChanged() { this.bindingListeners.forEach(listener => listener()); }

  private rememberEvent<T>(definition: LabEventDefinition<T>) {
    const key = protocolKey(definition), existing = this.eventDefinitions.get(key);
    if (existing) {
      if (existing.definition === definition) return existing;
      if (definition.metadata && existing.definition.metadata
        && JSON.stringify(definition.metadata) !== JSON.stringify(existing.definition.metadata)) {
        throw new Error(`事件协议“${key}”存在冲突定义，请导入同一份协议。`);
      }
      if (definition.metadata && !existing.definition.metadata) { existing.definition = definition; this.bindingsChanged(); }
      return existing;
    }
    const entry = { definition, declaredPublishers: new Map<string, number>(), observedPublishers: new Set<string>() };
    this.eventDefinitions.set(key, entry); this.bindingsChanged(); return entry;
  }

  /** Declaration describes design; it never grants or checks publish permission. */
  declareEvent<T>(moduleId: string, definition: LabEventDefinition<T>, publishes = false): () => void {
    this.requireActive(definition.type);
    const entry = this.rememberEvent(definition);
    if (publishes) { entry.declaredPublishers.set(moduleId, (entry.declaredPublishers.get(moduleId) ?? 0) + 1); this.bindingsChanged(); }
    let active = true;
    return () => {
      if (!active) return; active = false;
      if (publishes) {
        const count = entry.declaredPublishers.get(moduleId) ?? 0;
        if (count <= 1) entry.declaredPublishers.delete(moduleId); else entry.declaredPublishers.set(moduleId, count - 1);
        this.bindingsChanged();
      }
    };
  }

  scope(moduleId: string): LabCommunicationScope {
    const id = moduleId.trim();
    if (!id) throw new Error('Lab 通信作用域的 moduleId 不能为空。');
    this.requireActive('scope');
    return new LabCommunicationScope(this, id);
  }

  hasRequestHandler<TInput, TOutput>(definition: LabRequestDefinition<TInput, TOutput>): boolean {
    this.requireActive(definition.type);
    return this.requestHandlers.has(protocolKey(definition));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.activeRequests.forEach((controller) => controller.abort());
    this.activeRequests.clear();
    this.requestHandlers.clear();
    this.eventListeners.clear();
    this.eventDefinitions.clear(); this.bindingListeners.clear();
  }

  registerRequest<TInput, TOutput>(
    moduleId: string,
    definition: LabRequestDefinition<TInput, TOutput>,
    handler: LabRequestHandler<TInput, TOutput>,
  ): () => void {
    this.requireActive(definition.type);
    const key = protocolKey(definition);
    const existing = this.requestHandlers.get(key);
    if (existing) {
      throw new LabCommunicationError(
        'DUPLICATE_HANDLER',
        `Lab 请求“${key}”已由模块“${existing.moduleId}”处理。`,
        definition.type,
      );
    }
    const registered: RegisteredRequestHandler = {
      moduleId,
      handler: handler as AnyRequestHandler,
    };
    this.requestHandlers.set(key, registered);
    return () => {
      if (this.requestHandlers.get(key) === registered) this.requestHandlers.delete(key);
    };
  }

  registerEvent<TPayload>(
    moduleId: string,
    definition: LabEventDefinition<TPayload>,
    listener: LabEventListener<TPayload>,
  ): () => void {
    this.requireActive(definition.type);
    this.rememberEvent(definition);
    const key = protocolKey(definition);
    const listeners = this.eventListeners.get(key) ?? new Set<RegisteredEventListener>();
    const registered = { listenerId: `listener:${this.nextListenerId++}`, moduleId, listener: listener as AnyEventListener };
    listeners.add(registered);
    this.eventListeners.set(key, listeners);
    this.bindingsChanged();
    return () => {
      if (!listeners.delete(registered)) return;
      if (!listeners.size) this.eventListeners.delete(key);
      this.bindingsChanged();
    };
  }

  async request<TInput, TOutput>(
    sourceModuleId: string,
    definition: LabRequestDefinition<TInput, TOutput>,
    input: TInput,
    options: LabRequestOptions = {},
  ): Promise<TOutput> {
    this.requireActive(definition.type);
    const key = protocolKey(definition);
    const registered = this.requestHandlers.get(key);
    const requestId = createMessageId();
    const startedAt = monotonicNow();
    const message: LabMessageEnvelope<TInput> = Object.freeze({
      id: requestId,
      kind: 'request',
      type: definition.type,
      version: definition.version,
      sourceModuleId,
      timestamp: Date.now(),
      ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      payload: input,
    });
    this.journal.append({
      messageId: requestId,
      ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      kind: 'request',
      phase: 'request-started',
      type: definition.type,
      version: definition.version,
      sourceModuleId,
      ...(registered ? { targetModuleId: registered.moduleId } : {}),
      status: 'pending',
      payloadPreview: createLabCommunicationLogPreview(input),
    });
    const logFailure = (error: unknown): void => {
      this.journal.append({
        messageId: requestId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
        kind: 'request',
        phase: 'request-failed',
        type: definition.type,
        version: definition.version,
        sourceModuleId,
        ...(registered ? { targetModuleId: registered.moduleId } : {}),
        durationMs: monotonicNow() - startedAt,
        status: failureStatus(error),
        error: createLabCommunicationLogError(error),
      });
    };
    if (!registered) {
      const error = new LabCommunicationError(
        'NO_HANDLER', `Lab 请求“${key}”没有处理模块。`, definition.type, requestId,
      );
      logFailure(error);
      throw error;
    }
    if (options.signal?.aborted) {
      const error = new LabCommunicationError('ABORTED', `Lab 请求“${key}”已取消。`, definition.type, requestId);
      logFailure(error);
      throw error;
    }
    if (options.timeoutMs !== undefined
      && (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 0)) {
      const error = new RangeError('Lab 请求 timeoutMs 必须是非负有限数。');
      logFailure(error);
      throw error;
    }
    const controller = new AbortController();
    this.activeRequests.add(controller);
    let timedOut = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const abortFromCaller = () => controller.abort();
    options.signal?.addEventListener('abort', abortFromCaller, { once: true });
    if (options.timeoutMs !== undefined) {
      timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, options.timeoutMs);
    }
    const aborted = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(new LabCommunicationError(
        timedOut ? 'TIMEOUT' : 'ABORTED',
        timedOut ? `Lab 请求“${key}”超时。` : `Lab 请求“${key}”已取消。`,
        definition.type,
        requestId,
      )), { once: true });
    });
    try {
      const handled = Promise.resolve(registered.handler(input, { message, signal: controller.signal })) as Promise<TOutput>;
      const result = await Promise.race([handled, aborted]);
      this.journal.append({
        messageId: requestId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
        kind: 'request',
        phase: 'request-completed',
        type: definition.type,
        version: definition.version,
        sourceModuleId,
        targetModuleId: registered.moduleId,
        durationMs: monotonicNow() - startedAt,
        status: 'success',
        resultPreview: createLabCommunicationLogPreview(result),
      });
      return result;
    } catch (error) {
      logFailure(error);
      throw error;
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abortFromCaller);
      this.activeRequests.delete(controller);
    }
  }

  async publish<TPayload>(
    sourceModuleId: string,
    definition: LabEventDefinition<TPayload>,
    payload: TPayload,
    options: LabPublishOptions = {},
  ): Promise<LabPublishReport> {
    this.requireActive(definition.type);
    const registeredEvent = this.rememberEvent(definition);
    if (!registeredEvent.observedPublishers.has(sourceModuleId)) {
      registeredEvent.observedPublishers.add(sourceModuleId); this.bindingsChanged();
    }
    const startedAt = monotonicNow();
    const message: LabMessageEnvelope<TPayload> = Object.freeze({
      id: createMessageId(),
      kind: 'event',
      type: definition.type,
      version: definition.version,
      sourceModuleId,
      timestamp: Date.now(),
      ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      payload,
    });
    const listeners = [...(this.eventListeners.get(protocolKey(definition)) ?? [])];
    const recipients = Object.freeze(listeners.map(({ listenerId, moduleId }) => Object.freeze({ listenerId, moduleId })));
    this.journal.append({
      messageId: message.id,
      ...(message.correlationId ? { correlationId: message.correlationId } : {}),
      kind: 'event',
      phase: 'event-published',
      type: definition.type,
      version: definition.version,
      sourceModuleId,
      status: 'pending',
      listenerCount: listeners.length,
      recipients,
      payloadPreview: createLabCommunicationLogPreview(payload),
    });
    const results = await Promise.allSettled(listeners.map(({ listener }) => (
      Promise.resolve().then(() => listener(payload, message))
    )));
    const report = {
      delivered: results.filter(({ status }) => status === 'fulfilled').length,
      failed: results.flatMap((result, index) => result.status === 'rejected'
        ? [{ moduleId: listeners[index].moduleId, error: result.reason }]
        : []),
    };
    report.failed.forEach(({ moduleId, error }) => {
      this.journal.append({
        messageId: message.id,
        ...(message.correlationId ? { correlationId: message.correlationId } : {}),
        kind: 'event',
        phase: 'event-listener-failed',
        type: definition.type,
        version: definition.version,
        sourceModuleId,
        targetModuleId: moduleId,
        durationMs: monotonicNow() - startedAt,
        status: 'failed',
        error: createLabCommunicationLogError(error),
      });
    });
    this.journal.append({
      messageId: message.id,
      ...(message.correlationId ? { correlationId: message.correlationId } : {}),
      kind: 'event',
      phase: 'event-completed',
      type: definition.type,
      version: definition.version,
      sourceModuleId,
      durationMs: monotonicNow() - startedAt,
      status: report.failed.length ? 'failed' : 'success',
      listenerCount: listeners.length,
      deliveredCount: report.delivered,
      failedCount: report.failed.length,
      recipients,
      listenerResults: Object.freeze(results.map((result, index) => Object.freeze({
        ...recipients[index], status: result.status === 'fulfilled' ? 'success' as const : 'failed' as const,
        ...(result.status === 'rejected' ? { error: createLabCommunicationLogError(result.reason) } : {}),
      }))),
    });
    return report;
  }

  private requireActive(messageType: string): void {
    if (this.disposed) {
      throw new LabCommunicationError('DISPOSED', 'Lab 通信路由已经销毁。', messageType);
    }
  }
}

export class LabCommunicationScope {
  private readonly communication: LabCommunication;
  readonly moduleId: string;
  private readonly cleanups = new Set<() => void>();
  private readonly requests = new Set<AbortController>();
  private disposed = false;

  constructor(
    communication: LabCommunication,
    moduleId: string,
  ) {
    this.communication = communication;
    this.moduleId = moduleId;
  }

  handle<TInput, TOutput>(
    definition: LabRequestDefinition<TInput, TOutput>,
    handler: LabRequestHandler<TInput, TOutput>,
  ): () => void {
    this.requireActive(definition.type);
    return this.track(this.communication.registerRequest(this.moduleId, definition, handler));
  }

  hasHandler<TInput, TOutput>(definition: LabRequestDefinition<TInput, TOutput>): boolean {
    this.requireActive(definition.type);
    return this.communication.hasRequestHandler(definition);
  }

  on<TPayload>(definition: LabEventDefinition<TPayload>, listener: LabEventListener<TPayload>): () => void {
    this.requireActive(definition.type);
    return this.track(this.communication.registerEvent(this.moduleId, definition, listener));
  }

  declareEvent<T>(definition: LabEventDefinition<T>, options: { publishes?: boolean } = {}): () => void {
    this.requireActive(definition.type);
    return this.track(this.communication.declareEvent(this.moduleId, definition, options.publishes));
  }

  request<TInput, TOutput>(
    definition: LabRequestDefinition<TInput, TOutput>,
    input: TInput,
    options: LabRequestOptions = {},
  ): Promise<TOutput> {
    this.requireActive(definition.type);
    const controller = new AbortController();
    this.requests.add(controller);
    const relayAbort = () => controller.abort();
    options.signal?.addEventListener('abort', relayAbort, { once: true });
    return this.communication.request(this.moduleId, definition, input, {
      ...options,
      signal: controller.signal,
    }).finally(() => {
      options.signal?.removeEventListener('abort', relayAbort);
      this.requests.delete(controller);
    });
  }

  publish<TPayload>(
    definition: LabEventDefinition<TPayload>,
    payload: TPayload,
    options?: LabPublishOptions,
  ): Promise<LabPublishReport> {
    this.requireActive(definition.type);
    return this.communication.publish(this.moduleId, definition, payload, options);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.requests.forEach((controller) => controller.abort());
    this.requests.clear();
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups.clear();
  }

  private track(cleanup: () => void): () => void {
    let active = true;
    const tracked = () => {
      if (!active) return;
      active = false;
      this.cleanups.delete(tracked);
      cleanup();
    };
    this.cleanups.add(tracked);
    return tracked;
  }

  private requireActive(messageType: string): void {
    if (this.disposed) {
      throw new LabCommunicationError('DISPOSED', `Lab 模块“${this.moduleId}”的通信作用域已经销毁。`, messageType);
    }
  }
}
