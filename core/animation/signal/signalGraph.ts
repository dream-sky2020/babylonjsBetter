import type { SignalGraphDocument, SignalGraphEvaluation, SignalGraphNode, SignalValue } from './types.ts';
import type { SignalNodeRegistry } from './SignalNodeRegistry.ts';

export const createDefaultSignalGraph = (): SignalGraphDocument => ({
  version: 1,
  nodes: [
    { id: 'time', typeId: 'core.time', version: 1, label: 'Time', position: { x: 36, y: 42 }, config: {} },
    { id: 'curve', typeId: 'core.curve.number', version: 1, label: 'Motion Curve', position: { x: 260, y: 42 }, config: { keys: [{ id: 'key-0', time: 0, value: 0 }, { id: 'key-1', time: 1, value: 1 }, { id: 'key-2', time: 2, value: 0 }] } },
  ],
  connections: [{ id: 'time-to-curve', source: { nodeId: 'time', portId: 'time' }, target: { nodeId: 'curve', portId: 'time' } }],
  parameters: [{ id: 'strength', name: 'Strength', valueTypeId: 'core.number', value: 1 }],
  outputs: [{ id: 'motion-value', name: 'Motion Value', valueTypeId: 'core.number', source: { nodeId: 'curve', portId: 'value' } }],
});

export const evaluateSignalGraph = (document: SignalGraphDocument, registry: SignalNodeRegistry, time: number, deltaTime = 0): SignalGraphEvaluation => {
  const nodeById = new Map(document.nodes.map(node => [node.id, node]));
  const parameters = new Map(document.parameters.map(parameter => [parameter.id, parameter.value]));
  const nodeValues = new Map<string, Readonly<Record<string, SignalValue>>>();
  const visiting = new Set<string>();
  const errors: string[] = [];
  const incoming = new Map(document.connections.map(connection => [`${connection.target.nodeId}:${connection.target.portId}`, connection]));

  const evaluateNode = (node: SignalGraphNode): Readonly<Record<string, SignalValue>> => {
    const cached = nodeValues.get(node.id); if (cached) return cached;
    if (visiting.has(node.id)) { errors.push(`检测到 Signal Graph 循环：${node.label}`); return {}; }
    const definition = registry.get(node.typeId);
    if (!definition) { errors.push(`未注册 Signal Node：${node.typeId}`); return {}; }
    visiting.add(node.id);
    const inputs: Record<string, SignalValue> = {};
    definition.inputs.forEach(port => {
      const connection = incoming.get(`${node.id}:${port.id}`);
      if (!connection) {
        const inputDefaults = node.config.inputDefaults;
        const configuredValue = inputDefaults && typeof inputDefaults === 'object' && !Array.isArray(inputDefaults)
          ? (inputDefaults as Record<string, SignalValue>)[port.id]
          : undefined;
        inputs[port.id] = configuredValue ?? port.defaultValue ?? null;
        return;
      }
      const sourceNode = nodeById.get(connection.source.nodeId);
      if (!sourceNode) { errors.push(`连接 ${connection.id} 的来源节点不存在`); inputs[port.id] = port.defaultValue ?? null; return; }
      inputs[port.id] = evaluateNode(sourceNode)[connection.source.portId] ?? port.defaultValue ?? null;
    });
    let values: Readonly<Record<string, SignalValue>> = {};
    try { values = definition.evaluate({ time, deltaTime, parameters }, inputs, node.config); }
    catch (error) { errors.push(`${node.label}：${error instanceof Error ? error.message : String(error)}`); }
    visiting.delete(node.id); nodeValues.set(node.id, values); return values;
  };

  document.nodes.forEach(evaluateNode);
  const outputs = new Map<string, SignalValue>();
  document.outputs.forEach(output => {
    const node = nodeById.get(output.source.nodeId);
    outputs.set(output.id, node ? evaluateNode(node)[output.source.portId] ?? null : null);
  });
  return { nodeValues, outputs, errors };
};

export const parseSignalGraphDocument = (value: unknown): SignalGraphDocument => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Signal Graph 必须为对象');
  const graph = value as Partial<SignalGraphDocument>;
  if (graph.version !== 1 || !Array.isArray(graph.nodes) || !Array.isArray(graph.connections) || !Array.isArray(graph.parameters) || !Array.isArray(graph.outputs)) throw new Error('Signal Graph 结构无效');
  const nodeIds = new Set<string>();
  graph.nodes.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`Signal Node ${index} 无效`);
    const node = entry as Partial<SignalGraphNode>;
    if (!node.id || typeof node.id !== 'string' || nodeIds.has(node.id) || !node.typeId || typeof node.typeId !== 'string' || typeof node.label !== 'string' || typeof node.version !== 'number') throw new Error(`Signal Node ${index} 的定义无效`);
    if (!node.position || typeof node.position.x !== 'number' || !Number.isFinite(node.position.x) || typeof node.position.y !== 'number' || !Number.isFinite(node.position.y)) throw new Error(`Signal Node ${node.id} 的位置无效`);
    if (!node.config || typeof node.config !== 'object' || Array.isArray(node.config)) throw new Error(`Signal Node ${node.id} 的配置无效`);
    nodeIds.add(node.id);
  });
  const connectionIds = new Set<string>();
  graph.connections.forEach((connection, index) => {
    if (!connection || typeof connection !== 'object' || !connection.id || connectionIds.has(connection.id) || !connection.source || !connection.target || !nodeIds.has(connection.source.nodeId) || !nodeIds.has(connection.target.nodeId) || typeof connection.source.portId !== 'string' || typeof connection.target.portId !== 'string') throw new Error(`Signal 连接 ${index} 无效`);
    connectionIds.add(connection.id);
  });
  const parameterIds = new Set<string>();
  graph.parameters.forEach((parameter, index) => {
    if (!parameter || typeof parameter !== 'object' || !parameter.id || parameterIds.has(parameter.id) || typeof parameter.name !== 'string' || typeof parameter.valueTypeId !== 'string') throw new Error(`Signal 参数 ${index} 无效`);
    parameterIds.add(parameter.id);
  });
  const outputIds = new Set<string>();
  graph.outputs.forEach((output, index) => {
    if (!output || typeof output !== 'object' || !output.id || outputIds.has(output.id) || typeof output.name !== 'string' || typeof output.valueTypeId !== 'string' || !output.source || !nodeIds.has(output.source.nodeId) || typeof output.source.portId !== 'string') throw new Error(`Signal 输出 ${index} 无效`);
    outputIds.add(output.id);
  });
  return graph as SignalGraphDocument;
};
