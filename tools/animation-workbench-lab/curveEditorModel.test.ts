import assert from 'node:assert/strict';
import test from 'node:test';
import { moveCurveKeys, panCurveView, pasteCurveKeys, selectCurveKeysInRect, zoomCurveView } from './curveEditorModel.ts';

test('selected curve keys move together with time and value snapping', () => {
  const curves = new Map([
    ['curve-a', [{ id: 'a', time: .1, value: .15 }, { id: 'b', time: .4, value: 1 }]],
    ['curve-b', [{ id: 'c', time: .2, value: -.15 }]],
  ]);
  const moved = moveCurveKeys(curves, [{ curveId: 'curve-a', keyId: 'a' }, { curveId: 'curve-b', keyId: 'c' }], .13, .12, 1, 10, .1);
  assert.deepEqual(moved.get('curve-a'), [{ id: 'a', time: .2, value: .3 }, { id: 'b', time: .4, value: 1 }]);
  assert.deepEqual(moved.get('curve-b'), [{ id: 'c', time: .3, value: 0 }]);
});

test('group movement clamps keys to the animation duration', () => {
  const curves = new Map([['curve', [{ id: 'a', time: .9, value: 0 }]]]);
  assert.equal(moveCurveKeys(curves, [{ curveId: 'curve', keyId: 'a' }], .5, 0, 1, null, null).get('curve')?.[0].time, 1);
});

test('marquee selection returns keys from multiple visible curves', () => {
  assert.deepEqual(selectCurveKeysInRect([
    { curveId: 'a', keyId: '1', x: 20, y: 20 },
    { curveId: 'b', keyId: '2', x: 35, y: 25 },
    { curveId: 'b', keyId: '3', x: 80, y: 25 },
  ], { left: 10, top: 10, right: 50, bottom: 40 }), [{ curveId: 'a', keyId: '1' }, { curveId: 'b', keyId: '2' }]);
});

test('clipboard paste preserves curve ownership and relative timing', () => {
  let id = 0;
  const curves = new Map([['a', [{ id: 'a1', time: .2, value: 1 }]], ['b', [{ id: 'b1', time: .5, value: 2 }]]]);
  const result = pasteCurveKeys(curves, [{ curveId: 'a', key: curves.get('a')![0] }, { curveId: 'b', key: curves.get('b')![0] }], 1, 2, () => `new-${++id}`);
  assert.equal(result.curves.get('a')?.at(-1)?.time, 1);
  assert.equal(result.curves.get('b')?.at(-1)?.time, 1.3);
  assert.deepEqual(result.selection.map(item => item.curveId), ['a', 'b']);
});

test('curve view zooms around an anchor and pans within the duration', () => {
  const zoomed = zoomCurveView({ timeMin: 0, timeMax: 2, valueMin: -1, valueMax: 1 }, 'time', 1, .5, 2);
  assert.deepEqual(zoomed, { timeMin: .5, timeMax: 1.5, valueMin: -1, valueMax: 1 });
  assert.deepEqual(panCurveView(zoomed, 4, .5, 2), { timeMin: 1, timeMax: 2, valueMin: -.5, valueMax: 1.5 });
});
