import assert from 'node:assert/strict';
import test from 'node:test';
import { createCoreSignalNodeRegistry, createDefaultSignalGraph, evaluateSignalGraph } from './index.ts';

test('默认 Signal Graph 会按时间计算公开输出', () => {
  const graph = createDefaultSignalGraph();
  const registry = createCoreSignalNodeRegistry();
  assert.equal(evaluateSignalGraph(graph, registry, 0).outputs.get('motion-value'), 0);
  assert.equal(evaluateSignalGraph(graph, registry, 0.5).outputs.get('motion-value'), 0.5);
  assert.equal(evaluateSignalGraph(graph, registry, 1).outputs.get('motion-value'), 1);
});

test('未连接端口可用节点级动态默认值', () => {
  const graph = createDefaultSignalGraph();
  const registry = createCoreSignalNodeRegistry();
  const multiply = {
    id: 'multiply', typeId: 'core.math.multiply', version: 1, label: 'Multiply', position: { x: 0, y: 0 },
    config: { inputDefaults: { a: 3, b: 4 } },
  };
  const next = { ...graph, nodes: [multiply], connections: [], outputs: [{ id: 'result', name: 'Result', valueTypeId: 'core.number', source: { nodeId: 'multiply', portId: 'value' } }] };
  assert.equal(evaluateSignalGraph(next, registry, 0).outputs.get('result'), 12);
});
