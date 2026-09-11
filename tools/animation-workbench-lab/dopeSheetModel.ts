import type { SignalGraphDocument, SignalGraphNode } from '@/core/animation/signal';
import type { PreviewSignalBinding } from './animationWorkspace.ts';

export type DopeSheetKey = Readonly<{ id: string; time: number; value: number }>;
export type DopeSheetKeyRef = Readonly<{ nodeId: string; keyId: string }>;
export type DopeSheetTrack = Readonly<{ bindingId: string; nodeId: string; path: string; label: string; keys: readonly DopeSheetKey[] }>;

export const dopeKeyToken = (nodeId: string, keyId: string) => `${nodeId}:${keyId}`;
export const snapTime = (time: number, framesPerSecond: number) => Math.round(time * framesPerSecond) / framesPerSecond;

export function readDopeKeys(node: SignalGraphNode): DopeSheetKey[] {
  if (!Array.isArray(node.config.keys)) return [];
  return node.config.keys.flatMap(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const key = raw as Partial<DopeSheetKey>;
    return typeof key.id === 'string' && typeof key.time === 'number' && Number.isFinite(key.time) && typeof key.value === 'number' && Number.isFinite(key.value) ? [key as DopeSheetKey] : [];
  }).sort((left, right) => left.time - right.time);
}

export function collectDopeSheetTracks(graph: SignalGraphDocument, bindings: readonly PreviewSignalBinding[], objectId: string | null): DopeSheetTrack[] {
  if (!objectId) return [];
  return bindings.flatMap(binding => {
    if (binding.objectId !== objectId || binding.adapterTypeId !== 'babylon.transform-component.number') return [];
    const output = graph.outputs.find(item => item.id === binding.outputId);
    const node = output ? graph.nodes.find(item => item.id === output.source.nodeId && item.typeId === 'core.curve.number') : undefined;
    return node ? [{ bindingId: binding.id, nodeId: node.id, path: String(binding.config.path ?? ''), label: node.label, keys: readDopeKeys(node) }] : [];
  }).sort((left, right) => left.path.localeCompare(right.path));
}

export function moveDopeSheetKeys(graph: SignalGraphDocument, selected: ReadonlySet<string>, deltaTime: number, duration: number, framesPerSecond: number | null): SignalGraphDocument {
  return { ...graph, nodes: graph.nodes.map(node => {
    if (node.typeId !== 'core.curve.number') return node;
    const keys = readDopeKeys(node);
    if (!keys.some(key => selected.has(dopeKeyToken(node.id, key.id)))) return node;
    return { ...node, config: { ...node.config, keys: keys.map(key => {
      if (!selected.has(dopeKeyToken(node.id, key.id))) return key;
      const moved = Math.min(duration, Math.max(0, key.time + deltaTime));
      return { ...key, time: Number((framesPerSecond ? snapTime(moved, framesPerSecond) : moved).toFixed(4)) };
    }).sort((left, right) => left.time - right.time) } };
  }) };
}

export function deleteDopeSheetKeys(graph: SignalGraphDocument, selected: ReadonlySet<string>): SignalGraphDocument {
  return { ...graph, nodes: graph.nodes.map(node => node.typeId === 'core.curve.number' ? { ...node, config: { ...node.config, keys: readDopeKeys(node).filter(key => !selected.has(dopeKeyToken(node.id, key.id))) } } : node) };
}
