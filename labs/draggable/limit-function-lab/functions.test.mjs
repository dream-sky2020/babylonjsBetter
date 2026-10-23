import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { axisPosition, axisX, DEFAULT_DRAFT, evaluate, fitHalfX, formatGap, formula, milestoneX, MODELS, resolveDraft, updateDraft, xAtProgress } from './functions.ts';
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const params = model => ({ model, start: 10, limit: 100, halfX: 50, power: 2 });

test('integer mode normalizes toggling, numeric input and linear/log dragging; disabling restores fractional inputs', () => {
  let draft = { ...DEFAULT_DRAFT, x: '12.7' };
  draft = updateDraft(draft, { integerX: true }); assert.equal(draft.x, '13'); assert.equal(resolveDraft(draft).x, 13);
  draft = updateDraft(draft, { x: '4.2' }); assert.equal(draft.x, '4');
  for (const logarithmic of [false, true]) for (const t of [.001, .123, .456, 1]) {
    const x = axisX(t, 123.6, 12.25, logarithmic);
    draft = updateDraft(draft, { x: String(x) }); assert.ok(Number.isInteger(Number(draft.x))); assert.ok(Number.isInteger(resolveDraft(draft).x));
  }
  assert.equal(resolveDraft({ ...draft, x: '10.6' }).x, 11);
  assert.equal(updateDraft(draft, { x: '1e12' }).x, '1000000000000');
  assert.throws(() => resolveDraft(updateDraft(draft, { x: '-0.2' })));
  draft = updateDraft(draft, { integerX: false, x: '4.2' }); assert.equal(resolveDraft(draft).x, 4.2);
});
test('integer milestones round upward without adding an extra step for floating-point noise', () => {
  assert.equal(milestoneX({ ...params('rational'), start: 0 }, .9, true), 450);
  assert.equal(milestoneX({ ...params('rational'), halfX: 2.5 }, .5, true), 3);
  for (const model of Object.keys(MODELS)) for (const progress of [.5, .9, .99]) {
    const p = { ...params(model), halfX: 12.7 }, x = milestoneX(p, progress, true);
    assert.ok(Number.isInteger(x)); assert.ok(evaluate(p, x).progress >= progress - 1e-14);
    near(milestoneX(p, progress, false), xAtProgress(p, progress));
  }
});

test('all families start at Y0, pass the midpoint at H and approach either an upper or a lower limit monotonically', () => {
  for (const model of Object.keys(MODELS)) for (const downward of [false, true]) {
    const p = { ...params(model), start: downward ? 100 : 10, limit: downward ? 10 : 100 };
    assert.equal(evaluate(p, 0).value, p.start); near(evaluate(p, 50).value, 55);
    let previous = p.start;
    for (const x of [1, 10, 50, 100, 1000, 1e6]) {
      const r = evaluate(p, x); assert.ok(Number.isFinite(r.value) && Number.isFinite(r.logGap));
      assert.ok(downward ? r.value <= previous : r.value >= previous); previous = r.value;
      assert.ok(r.value >= Math.min(p.start, p.limit) && r.value <= Math.max(p.start, p.limit));
    }
    assert.ok(evaluate(p, 1e6).progress > .999);
  }
});
test('inverse milestones evaluate to the requested progress for all models', () => {
  for (const model of Object.keys(MODELS)) for (const progress of [0, .1, .5, .9, .99, .999]) {
    const p = params(model), x = xAtProgress(p, progress);
    near(evaluate(p, x).progress, progress);
  }
});
test('calibrating a reference point recovers the scale for rising and falling curves', () => {
  for (const model of Object.keys(MODELS)) for (const downward of [false, true]) {
    const p = { ...params(model), start: downward ? 100 : 10, limit: downward ? 10 : 100 };
    const y = evaluate(p, 75).value;
    near(fitHalfX({ ...p, halfX: 1 }, 75, y), p.halfX);
  }
  const fitted = resolveDraft({ ...DEFAULT_DRAFT, fit: true, halfX: '', pointX: '100', pointY: '80' });
  near(fitted.parameters.halfX, 25); near(evaluate(fitted.parameters, 100).value, 80);
});
test('remaining gap survives display rounding and exponential underflow without claiming mathematical equality', () => {
  const p = { ...params('exponential'), halfX: 1e-12 };
  const r = evaluate(p, 1e12);
  assert.equal(r.value, p.limit); assert.equal(r.roundedToLimit, true); assert.equal(r.gap, 0);
  assert.ok(Number.isFinite(r.logGap) && r.logGap < -700); assert.match(formatGap(r.logGap), /10\^/);
  for (const model of Object.keys(MODELS)) {
    const tiny = evaluate({ ...params(model), halfX: 1e12 }, 1e-12);
    assert.ok(tiny.progress > 0 && tiny.progress < 1e-20);
    assert.ok(evaluate({ ...params(model), halfX: 1e-12 }, 1e12).progress <= 1);
  }
});
test('generated JS expressions agree with calculation across both directions and all curve types', () => {
  for (const model of Object.keys(MODELS)) for (const limit of [-20, 100]) {
    const p = { ...params(model), limit, halfX: 37.89123456789123 };
    const fn = runInNewContext(`(x) => ${formula(p, true)}`);
    for (const x of [0, .1, 25, 500, 1e12]) near(fn(x), evaluate(p, x).value);
  }
});
test('linear and log axes round-trip and the maximum log endpoint stays in the supported domain', () => {
  for (const log of [false, true]) for (const half of [1e-12, 50, 1e12]) for (const t of [0, .1, .5, .99, 1]) {
    const x = axisX(t, 1e12, half, log);
    assert.ok(x >= 0 && x <= 1e12); near(axisPosition(x, 1e12, half, log), t);
  }
});
test('invalid parameters, out-of-domain values and unreachable calibration points are rejected', () => {
  for (const patch of [{ limit: '0', start: '0' }, { halfX: '0' }, { limit: '' }, { limit: '1e30' }, { x: '-1' }, { maxX: '0' }, { model: 'hill', power: '0' }, { fit: true, pointY: '100' }, { fit: true, pointY: '-1' }, { fit: true, pointX: '0' }]) assert.throws(() => resolveDraft({ ...DEFAULT_DRAFT, ...patch }));
  assert.throws(() => evaluate(params('rational'), Infinity)); assert.throws(() => xAtProgress(params('rational'), 1));
  assert.equal(resolveDraft({ ...DEFAULT_DRAFT, x: '1000', maxX: '200' }).maxX, 1000);
});
