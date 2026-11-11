import assert from 'node:assert/strict';
import test from 'node:test';
import { compileDialogueFormula, evaluateDialogueFormula } from './dialogueFormula.ts';

const bindings = { 石障计数: { key: 'gate.count', path: [] }, 钥匙: { key: 'key', path: ['obtained'] } };

test('formula reads scalars, applies precedence and short-circuits unneeded reads', () => {
  const formula = compileDialogueFormula('({石障计数} + 1) * 2 >= 8 || !{钥匙}', bindings);
  assert.equal(evaluateDialogueFormula(formula, (binding, name) => {
    assert.equal(name, '石障计数');
    assert.deepEqual(binding, bindings.石障计数);
    return 3;
  }), true);
  assert.equal(evaluateDialogueFormula(formula, (_binding, name) => name === '石障计数' ? 2 : true), false);
});

test('formula diagnostics reject unsupported syntax, unknown variables and invalid result types', () => {
  for (const source of ['{未声明} >= 3', 'Math.max(1, 2) > 0', '{石障计数} = 3', '3 + 4', '"3" >= 3', 'true &&']) {
    assert.throws(() => compileDialogueFormula(source, bindings), /第 \d+ 列/);
  }
  const formula = compileDialogueFormula('{石障计数} >= 3', bindings);
  assert.throws(() => evaluateDialogueFormula(formula, () => '3'), /需要有限数字/);
  assert.throws(() => evaluateDialogueFormula(formula, () => undefined), /不可读/);
});
