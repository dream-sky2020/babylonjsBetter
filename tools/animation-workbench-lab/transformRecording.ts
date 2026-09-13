import type { SignalGraphNode } from '@/core/animation/signal';
import type { AnimationWorkspace } from './animationWorkspace.ts';

export type TransformRecordMode = 'off' | 'auto' | 'record';
export type TransformPropertyPath = `${'position' | 'rotation' | 'scaling'}.${'x' | 'y' | 'z'}`;
export type ContributionOperation = 'additive' | 'override' | 'multiply';
export type ContributionRecordProperty = 'value' | 'weight' | 'scale' | 'offset' | 'modulation';

const makeId = (prefix: string) => globalThis.crypto?.randomUUID?.() ?? `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const labelForPath = (path: TransformPropertyPath) => path.replace('position', 'Position').replace('rotation', 'Rotation').replace('scaling', 'Scale');

const curveForOutput = (workspace: AnimationWorkspace, outputId: unknown) => {
  if (typeof outputId !== 'string') return undefined;
  const output = workspace.signalGraph.outputs.find(item => item.id === outputId);
  return output ? workspace.signalGraph.nodes.find(node => node.id === output.source.nodeId && node.typeId === 'core.curve.number') : undefined;
};

const writeCurveKey = (workspace: AnimationWorkspace, curveId: string, value: number, time: number): AnimationWorkspace => {
  const curve = workspace.signalGraph.nodes.find(node => node.id === curveId);
  if (!curve) return workspace;
  const keys = (Array.isArray(curve.config.keys) ? curve.config.keys : []).flatMap(raw => raw && typeof raw === 'object' && !Array.isArray(raw) ? [raw as { id?: unknown; time?: unknown; value?: unknown }] : []);
  const existing = keys.find(key => typeof key.time === 'number' && Math.abs(key.time - time) < .0005);
  const nextKeys = existing ? keys.map(key => key === existing ? { ...key, value } : key) : [...keys, { id: makeId('key'), time: Number(time.toFixed(3)), value }];
  return { ...workspace, signalGraph: { ...workspace.signalGraph, nodes: workspace.signalGraph.nodes.map(node => node.id === curveId ? { ...node, config: { ...node.config, keys: nextKeys.sort((left, right) => Number(left.time) - Number(right.time)) } } : node) } };
};

const addCurveOutput = (workspace: AnimationWorkspace, label: string, initialValue: number, value: number, time: number) => {
  const timeNode = workspace.signalGraph.nodes.find(node => node.typeId === 'core.time');
  const timeNodeId = timeNode?.id ?? makeId('time'); const curveId = makeId('curve'); const outputId = makeId('output');
  const keys = time > .0005 ? [{ id: makeId('key'), time: 0, value: initialValue }, { id: makeId('key'), time: Number(time.toFixed(3)), value }] : [{ id: makeId('key'), time: 0, value }];
  const curveNode: SignalGraphNode = { id: curveId, typeId: 'core.curve.number', version: 1, label, position: { x: 260 + (workspace.signalGraph.nodes.length % 4) * 205, y: 42 + Math.floor(workspace.signalGraph.nodes.length / 4) * 120 }, config: { interpolation: 'smoothstep', keys } };
  return {
    workspace: { ...workspace, signalGraph: { ...workspace.signalGraph, nodes: [...workspace.signalGraph.nodes, ...(timeNode ? [] : [{ id: timeNodeId, typeId: 'core.time', version: 1, label: 'Time', position: { x: 32, y: 42 }, config: {} } as SignalGraphNode]), curveNode], connections: [...workspace.signalGraph.connections, { id: makeId('connection'), source: { nodeId: timeNodeId, portId: 'time' }, target: { nodeId: curveId, portId: 'time' } }], outputs: [...workspace.signalGraph.outputs, { id: outputId, name: label, valueTypeId: 'core.number', source: { nodeId: curveId, portId: 'value' } }] } },
    outputId,
  };
};

const sourceValueForDesired = (desired: number, base: number, config: Readonly<Record<string, unknown>>, operation: ContributionOperation) => {
  const weight = Math.max(.000001, typeof config.weight === 'number' ? config.weight : 1);
  const rawScale = typeof config.scale === 'number' && Number.isFinite(config.scale) ? config.scale : 1;
  const scale = Math.abs(rawScale) < .000001 ? 1 : rawScale;
  const offset = typeof config.offset === 'number' ? config.offset : 0;
  const mixedSource = operation === 'additive' ? (desired - base) / weight
    : operation === 'override' ? (desired - base * (1 - weight)) / weight
      : Math.abs(base) < .000001 ? 1 : 1 + (desired / base - 1) / weight;
  return (mixedSource - offset) / scale;
};

/** Records only into the armed source for this target; ambiguous legacy sources are never chosen. */
export function recordTransformKey(workspace: AnimationWorkspace, objectId: string, path: TransformPropertyPath, value: number, baseValue: number, time: number, mode: TransformRecordMode, newOperation: ContributionOperation = 'override'): AnimationWorkspace {
  if (mode === 'off') return workspace;
  const matching = workspace.previewBindings.filter(item => item.objectId === objectId && item.adapterTypeId === 'babylon.transform-component.number' && item.config.path === path);
  const explicitlyArmed = matching.find(item => item.config.recordArmed === true && (item.config.recordProperty ?? 'value') === 'value');
  const legacy = matching.length === 1 && matching[0].config.recordArmed === undefined ? matching[0] : undefined;
  const binding = explicitlyArmed ?? legacy;
  const curve = binding ? curveForOutput(workspace, binding.outputId) : undefined;
  if (mode === 'auto' && !curve) return workspace;
  if (curve && binding) return writeCurveKey(workspace, curve.id, sourceValueForDesired(value, baseValue, binding.config, String(binding.config.operation ?? 'additive') as ContributionOperation), time);
  if (binding) {
    const operation = String(binding.config.operation ?? 'additive') as ContributionOperation;
    const created = addCurveOutput(workspace, labelForPath(path), sourceValueForDesired(baseValue, baseValue, binding.config, operation), sourceValueForDesired(value, baseValue, binding.config, operation), time);
    return { ...created.workspace, previewBindings: created.workspace.previewBindings.map(item => item.id === binding.id ? { ...item, outputId: created.outputId, config: { ...item.config, recordArmed: true, recordProperty: 'value' } } : item) };
  }
  if (matching.length) return workspace;
  const initial = sourceValueForDesired(baseValue, baseValue, { weight: 1, scale: 1, offset: 0 }, newOperation);
  const recorded = sourceValueForDesired(value, baseValue, { weight: 1, scale: 1, offset: 0 }, newOperation);
  const created = addCurveOutput(workspace, labelForPath(path), initial, recorded, time);
  return {
    ...created.workspace,
    previewBindings: [...workspace.previewBindings, { id: makeId('binding'), outputId: created.outputId, objectId, adapterTypeId: 'babylon.transform-component.number', config: { path, operation: newOperation, weight: 1, priority: 0, scale: 1, offset: 0, modulation: 1, enabled: true, solo: false, recordArmed: true, recordProperty: 'value' } }],
  };
}

const propertyOutputKey = (property: Exclude<ContributionRecordProperty, 'value'>) => property === 'modulation' ? 'modulationValueOutputId' : `${property}OutputId`;

export function recordContributionProperty(workspace: AnimationWorkspace, bindingId: string, property: Exclude<ContributionRecordProperty, 'value'>, value: number, time: number, mode: TransformRecordMode): AnimationWorkspace {
  const binding = workspace.previewBindings.find(item => item.id === bindingId);
  if (!binding) return workspace;
  let next: AnimationWorkspace = { ...workspace, previewBindings: workspace.previewBindings.map(item => item.id === bindingId ? { ...item, config: { ...item.config, [property]: value } } : item) };
  if (mode === 'off' || binding.config.recordArmed !== true || binding.config.recordProperty !== property) return next;
  const outputKey = propertyOutputKey(property);
  const curve = curveForOutput(workspace, binding.config[outputKey]);
  if (curve) return writeCurveKey(next, curve.id, value, time);
  if (mode === 'auto') return next;
  const initial = typeof binding.config[property] === 'number' ? binding.config[property] : property === 'offset' ? 0 : 1;
  const created = addCurveOutput(next, `${String(binding.config.path ?? 'property')} · ${property}`, initial, value, time);
  next = created.workspace;
  return { ...next, previewBindings: next.previewBindings.map(item => item.id === bindingId ? { ...item, config: { ...item.config, [outputKey]: created.outputId } } : item) };
}

export function setContributionArmed(bindings: AnimationWorkspace['previewBindings'], bindingId: string, armed: boolean) {
  const target = bindings.find(item => item.id === bindingId);
  if (!target) return bindings;
  return bindings.map(item => {
    const sameTarget = item.objectId === target.objectId && item.adapterTypeId === target.adapterTypeId && item.config.path === target.config.path;
    if (item.id === bindingId) return { ...item, config: { ...item.config, recordArmed: armed } };
    return sameTarget && armed ? { ...item, config: { ...item.config, recordArmed: false } } : item;
  });
}
