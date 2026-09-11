import assert from 'node:assert/strict';
import test from 'node:test';
import { mixNumericContributions, type NumericContribution } from './index.ts';

const source = (patch: Partial<NumericContribution>): NumericContribution => ({ id: 'source', sourceId: 'output', targetKey: 'object:position.y', value: 0, weight: 1, priority: 0, blendMode: 'additive', enabled: true, solo: false, ...patch });

test('同一目标的贡献会按优先级稳定混合', () => {
  const result = mixNumericContributions(new Map([['object:position.y', 10]]), [
    source({ id: 'add', value: 2, weight: 0.5 }),
    source({ id: 'override', value: 20, weight: 0.5, priority: 10, blendMode: 'override' }),
  ]);
  assert.equal(result.values.get('object:position.y'), 15.5);
});

test('Solo 会抑制同目标的非 Solo 贡献', () => {
  const result = mixNumericContributions(new Map([['target', 1]]), [source({ id: 'muted-by-solo', targetKey: 'target', value: 8 }), source({ id: 'solo', targetKey: 'target', value: 3, solo: true })]);
  assert.equal(result.values.get('target'), 4);
  assert.equal(result.groups.get('target')?.[0].suppressed, true);
});

test('Multiply 使用权重从单位倍率插值', () => {
  const result = mixNumericContributions(new Map([['target', 8]]), [source({ targetKey: 'target', value: 2, weight: 0.25, blendMode: 'multiply' })]);
  assert.equal(result.values.get('target'), 10);
});
