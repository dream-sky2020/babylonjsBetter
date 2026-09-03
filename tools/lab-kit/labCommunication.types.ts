declare const labRequestTypes: unique symbol;
declare const labEventPayload: unique symbol;

export type LabRequestDefinition<TInput, TOutput> = Readonly<{
  kind: 'request';
  type: string;
  version: number;
  /** 仅供 TypeScript 保留协议类型，不存在于运行时对象。 */
  [labRequestTypes]?: (input: TInput) => TOutput;
}>;

export type LabEventDefinition<TPayload> = Readonly<{
  kind: 'event';
  type: string;
  version: number;
  /** 仅供 TypeScript 保留协议类型，不存在于运行时对象。 */
  [labEventPayload]?: TPayload;
}>;

export type LabMessageEnvelope<TPayload> = Readonly<{
  id: string;
  kind: 'request' | 'event';
  type: string;
  version: number;
  sourceModuleId: string;
  timestamp: number;
  correlationId?: string;
  payload: TPayload;
}>;

export type LabRequestContext<TInput> = Readonly<{
  message: LabMessageEnvelope<TInput>;
  signal: AbortSignal;
}>;

export type LabRequestHandler<TInput, TOutput> = (
  input: TInput,
  context: LabRequestContext<TInput>,
) => TOutput | Promise<TOutput>;

export type LabEventListener<TPayload> = (
  payload: TPayload,
  message: LabMessageEnvelope<TPayload>,
) => void | Promise<void>;

export type LabRequestOptions = Readonly<{
  timeoutMs?: number;
  signal?: AbortSignal;
  correlationId?: string;
}>;

export type LabPublishOptions = Readonly<{
  correlationId?: string;
}>;

export type LabPublishFailure = Readonly<{
  moduleId: string;
  error: unknown;
}>;

export type LabPublishReport = Readonly<{
  delivered: number;
  failed: readonly LabPublishFailure[];
}>;

export type LabCommunicationErrorCode =
  | 'NO_HANDLER'
  | 'DUPLICATE_HANDLER'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'DISPOSED';

export class LabCommunicationError extends Error {
  readonly code: LabCommunicationErrorCode;
  readonly messageType: string;
  readonly requestId?: string;

  constructor(
    code: LabCommunicationErrorCode,
    message: string,
    messageType: string,
    requestId?: string,
  ) {
    super(message);
    this.name = 'LabCommunicationError';
    this.code = code;
    this.messageType = messageType;
    this.requestId = requestId;
  }
}

export const createLabRequest = <TInput, TOutput>(
  type: string,
  version = 1,
): LabRequestDefinition<TInput, TOutput> => Object.freeze({ kind: 'request', type, version });

export const createLabEvent = <TPayload>(
  type: string,
  version = 1,
): LabEventDefinition<TPayload> => Object.freeze({ kind: 'event', type, version });

