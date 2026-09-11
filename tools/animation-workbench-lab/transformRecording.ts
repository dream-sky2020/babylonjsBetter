import type { SignalGraphNode } from '@/core/animation/signal';
import type { AnimationWorkspace } from './animationWorkspace.ts';

export type TransformRecordMode = 'off' | 'auto' | 'record';
export type TransformPropertyPath = `${'position' | 'rotation' | 'scaling'}.${'x' | 'y' | 'z'}`;

const makeId = (prefix: string) => globalThis.crypto?.randomUUID?.() ?? `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const labelForPath = (path: TransformPropertyPath) => path.replace('position', 'Position').replace('rotation', 'Rotation').replace('scaling', 'Scale');

/** Records into a dedicated override contribution, never into the mixed final value. */
export function recordTransformKey(workspace: AnimationWorkspace, objectId: string, path: TransformPropertyPath, value: number, baseValue: number, time: number, mode: TransformRecordMode): AnimationWorkspace {
  if (mode === 'off') return workspace;
  const binding = workspace.previewBindings.find(item => item.objectId === objectId && item.adapterTypeId === 'babylon.transform-component.number' && item.config.path === path && item.config.operation === 'override');
  const output = binding ? workspace.signalGraph.outputs.find(item => item.id === binding.outputId) : undefined;
  const curve = output ? workspace.signalGraph.nodes.find(node => node.id === output.source.nodeId && node.typeId === 'core.curve.number') : undefined;
  if (mode === 'auto' && !curve) return workspace;

  if (curve) {
    const rawKeys = Array.isArray(curve.config.keys) ? curve.config.keys : [];
    const keys = rawKeys.flatMap(raw => raw && typeof raw === 'object' && !Array.isArray(raw) ? [raw as { id?: unknown; time?: unknown; value?: unknown }] : []);
    const existing = keys.find(key => typeof key.time === 'number' && Math.abs(key.time - time) < .0005);
    const nextKeys = existing
      ? keys.map(key => key === existing ? { ...key, value } : key)
      : [...keys, { id: makeId('key'), time: Number(time.toFixed(3)), value }];
    return { ...workspace, signalGraph: { ...workspace.signalGraph, nodes: workspace.signalGraph.nodes.map(node => node.id === curve.id ? { ...node, config: { ...node.config, keys: nextKeys.sort((left, right) => Number(left.time) - Number(right.time)) } } : node) } };
  }

  const timeNode = workspace.signalGraph.nodes.find(node => node.typeId === 'core.time');
  const timeNodeId = timeNode?.id ?? makeId('time');
  const curveId = makeId('curve'); const outputId = makeId('output');
  const curveKeys = time > .0005
    ? [{ id: makeId('key'), time: 0, value: baseValue }, { id: makeId('key'), time: Number(time.toFixed(3)), value }]
    : [{ id: makeId('key'), time: 0, value }];
  const curveNode: SignalGraphNode = { id: curveId, typeId: 'core.curve.number', version: 1, label: labelForPath(path), position: { x: 260 + (workspace.signalGraph.nodes.length % 4) * 205, y: 42 + Math.floor(workspace.signalGraph.nodes.length / 4) * 120 }, config: { interpolation: 'smoothstep', keys: curveKeys } };
  return {
    ...workspace,
    signalGraph: {
      ...workspace.signalGraph,
      nodes: [...workspace.signalGraph.nodes, ...(timeNode ? [] : [{ id: timeNodeId, typeId: 'core.time', version: 1, label: 'Time', position: { x: 32, y: 42 }, config: {} } as SignalGraphNode]), curveNode],
      connections: [...workspace.signalGraph.connections, { id: makeId('connection'), source: { nodeId: timeNodeId, portId: 'time' }, target: { nodeId: curveId, portId: 'time' } }],
      outputs: [...workspace.signalGraph.outputs, { id: outputId, name: `${objectId} ${path}`, valueTypeId: 'core.number', source: { nodeId: curveId, portId: 'value' } }],
    },
    previewBindings: [...workspace.previewBindings, { id: makeId('binding'), outputId, objectId, adapterTypeId: 'babylon.transform-component.number', config: { path, operation: 'override', weight: 1, priority: 0, scale: 1, offset: 0, enabled: true, solo: false } }],
  };
}
