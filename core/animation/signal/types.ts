export type SignalValue = number | boolean | Readonly<{ x: number; y: number; z: number }> | null;

export type SignalGraphNode = Readonly<{
  id: string;
  typeId: string;
  version: number;
  label: string;
  position: Readonly<{ x: number; y: number }>;
  config: Readonly<Record<string, unknown>>;
}>;

export type SignalGraphConnection = Readonly<{
  id: string;
  source: Readonly<{ nodeId: string; portId: string }>;
  target: Readonly<{ nodeId: string; portId: string }>;
}>;

export type SignalParameter = Readonly<{
  id: string;
  name: string;
  valueTypeId: string;
  value: SignalValue;
}>;

export type SignalGraphOutput = Readonly<{
  id: string;
  name: string;
  valueTypeId: string;
  source: Readonly<{ nodeId: string; portId: string }>;
}>;

export type SignalGraphDocument = Readonly<{
  version: 1;
  nodes: readonly SignalGraphNode[];
  connections: readonly SignalGraphConnection[];
  parameters: readonly SignalParameter[];
  outputs: readonly SignalGraphOutput[];
}>;

export type SignalPortDefinition = Readonly<{
  id: string;
  label: string;
  valueTypeId: string;
  defaultValue?: SignalValue;
}>;

export type SignalEvaluationContext = Readonly<{
  time: number;
  deltaTime: number;
  parameters: ReadonlyMap<string, SignalValue>;
}>;

export type SignalNodeDefinition = Readonly<{
  typeId: string;
  version: number;
  label: string;
  category: string;
  inputs: readonly SignalPortDefinition[];
  outputs: readonly SignalPortDefinition[];
  createConfig(): Record<string, unknown>;
  evaluate(context: SignalEvaluationContext, inputs: Readonly<Record<string, SignalValue>>, config: Readonly<Record<string, unknown>>): Readonly<Record<string, SignalValue>>;
}>;

export type SignalGraphEvaluation = Readonly<{
  nodeValues: ReadonlyMap<string, Readonly<Record<string, SignalValue>>>;
  outputs: ReadonlyMap<string, SignalValue>;
  errors: readonly string[];
}>;
