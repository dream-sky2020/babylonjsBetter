import { SignalNodeRegistry } from './SignalNodeRegistry.ts';
import type { SignalNodeDefinition, SignalValue } from './types.ts';

const number = (value: SignalValue, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const configNumber = (config: Readonly<Record<string, unknown>>, key: string, fallback = 0) => typeof config[key] === 'number' && Number.isFinite(config[key]) ? config[key] : fallback;

const definition = (value: SignalNodeDefinition): SignalNodeDefinition => value;

const timeNode = definition({
  typeId: 'core.time', version: 1, label: 'Time', category: 'Input', inputs: [],
  outputs: [{ id: 'time', label: 'Time', valueTypeId: 'core.number' }], createConfig: () => ({}),
  evaluate: context => ({ time: context.time }),
});

const numberNode = definition({
  typeId: 'core.number', version: 1, label: 'Number', category: 'Input', inputs: [],
  outputs: [{ id: 'value', label: 'Value', valueTypeId: 'core.number' }], createConfig: () => ({ value: 1 }),
  evaluate: (_context, _inputs, config) => ({ value: configNumber(config, 'value', 1) }),
});

const parameterNode = definition({
  typeId: 'core.parameter', version: 1, label: 'Parameter', category: 'Input', inputs: [],
  outputs: [{ id: 'value', label: 'Value', valueTypeId: 'core.number' }], createConfig: () => ({ parameterId: '' }),
  evaluate: (context, _inputs, config) => ({ value: context.parameters.get(String(config.parameterId ?? '')) ?? 0 }),
});

const addNode = definition({
  typeId: 'core.math.add', version: 1, label: 'Add', category: 'Math',
  inputs: [{ id: 'a', label: 'A', valueTypeId: 'core.number', defaultValue: 0 }, { id: 'b', label: 'B', valueTypeId: 'core.number', defaultValue: 0 }],
  outputs: [{ id: 'value', label: 'Value', valueTypeId: 'core.number' }], createConfig: () => ({}),
  evaluate: (_context, inputs) => ({ value: number(inputs.a) + number(inputs.b) }),
});

const multiplyNode = definition({
  typeId: 'core.math.multiply', version: 1, label: 'Multiply', category: 'Math',
  inputs: [{ id: 'a', label: 'A', valueTypeId: 'core.number', defaultValue: 1 }, { id: 'b', label: 'B', valueTypeId: 'core.number', defaultValue: 1 }],
  outputs: [{ id: 'value', label: 'Value', valueTypeId: 'core.number' }], createConfig: () => ({}),
  evaluate: (_context, inputs) => ({ value: number(inputs.a, 1) * number(inputs.b, 1) }),
});

const sineNode = definition({
  typeId: 'core.wave.sine', version: 1, label: 'Sine', category: 'Generator',
  inputs: [{ id: 'time', label: 'Time', valueTypeId: 'core.number', defaultValue: 0 }, { id: 'frequency', label: 'Frequency', valueTypeId: 'core.number', defaultValue: 1 }, { id: 'amplitude', label: 'Amplitude', valueTypeId: 'core.number', defaultValue: 1 }, { id: 'phase', label: 'Phase', valueTypeId: 'core.number', defaultValue: 0 }],
  outputs: [{ id: 'value', label: 'Value', valueTypeId: 'core.number' }], createConfig: () => ({}),
  evaluate: (_context, inputs) => ({ value: Math.sin((number(inputs.time) * number(inputs.frequency, 1) + number(inputs.phase)) * Math.PI * 2) * number(inputs.amplitude, 1) }),
});

const curveNode = definition({
  typeId: 'core.curve.number', version: 1, label: 'Number Curve', category: 'Animation',
  inputs: [{ id: 'time', label: 'Time', valueTypeId: 'core.number', defaultValue: 0 }],
  outputs: [{ id: 'value', label: 'Value', valueTypeId: 'core.number' }],
  createConfig: () => ({ keys: [{ id: 'key-0', time: 0, value: 0 }, { id: 'key-1', time: 1, value: 1 }] }),
  evaluate: (_context, inputs, config) => {
    const rawKeys = Array.isArray(config.keys) ? config.keys : [];
    const keys = rawKeys.flatMap(raw => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
      const key = raw as Record<string, unknown>;
      return typeof key.time === 'number' && Number.isFinite(key.time) && typeof key.value === 'number' && Number.isFinite(key.value) ? [{ time: key.time, value: key.value }] : [];
    }).sort((left, right) => left.time - right.time);
    if (!keys.length) return { value: 0 };
    const time = number(inputs.time);
    if (time <= keys[0].time) return { value: keys[0].value };
    const last = keys[keys.length - 1]; if (time >= last.time) return { value: last.value };
    const rightIndex = keys.findIndex(key => key.time >= time); const left = keys[rightIndex - 1]; const right = keys[rightIndex];
    const rawAmount = (time - left.time) / Math.max(0.000001, right.time - left.time);
    const amount = config.interpolation === 'smoothstep' ? rawAmount * rawAmount * (3 - 2 * rawAmount) : rawAmount;
    return { value: left.value + (right.value - left.value) * amount };
  },
});

export const createCoreSignalNodeRegistry = (): SignalNodeRegistry => new SignalNodeRegistry()
  .register(timeNode).register(numberNode).register(parameterNode).register(curveNode)
  .register(addNode).register(multiplyNode).register(sineNode);
