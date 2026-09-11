export { SignalNodeRegistry } from './SignalNodeRegistry.ts';
export { createCoreSignalNodeRegistry } from './builtins.ts';
export { createDefaultSignalGraph, evaluateSignalGraph, parseSignalGraphDocument } from './signalGraph.ts';
export { automaticNumberCurveTangent, readNumberCurveKeys, sampleNumberCurve } from './numberCurve.ts';
export type { NumberCurveInterpolation, NumberCurveKey, NumberCurveTangentMode } from './numberCurve.ts';
export type {
  SignalEvaluationContext, SignalGraphConnection, SignalGraphDocument, SignalGraphEvaluation,
  SignalGraphNode, SignalGraphOutput, SignalNodeDefinition, SignalParameter, SignalPortDefinition, SignalValue,
} from './types.ts';
