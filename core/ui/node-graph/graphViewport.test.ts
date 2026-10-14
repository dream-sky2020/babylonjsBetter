import assert from 'node:assert/strict';
import test from 'node:test';
import { graphScreenPoint, graphWorldPoint, normalizeGraphWheelDelta, zoomGraphViewAtPoint, zoomGraphViewWithWheel } from './graphViewport.ts';

const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('mouse anchor stays fixed after zoom at any corner or center of a panned canvas', () => {
  for (const view of [{ x: 48, y: 48, scale: 1 }, { x: -980, y: 312, scale: .6 }]) {
    for (const anchor of [{ x: 0, y: 0 }, { x: 710, y: 560 }, { x: 350, y: 280 }]) {
      const world = graphWorldPoint(anchor, view);
      for (const scale of [.3, .85, 1.6, 2.2]) {
        const next = zoomGraphViewAtPoint(view, anchor, scale);
        const point = graphScreenPoint(world, next);
        near(point.x, anchor.x); near(point.y, anchor.y);
      }
    }
  }
});

test('opposite wheel movements recover the same view without drifting', () => {
  const view = { x: -280, y: 113, scale: 1 }, anchor = { x: 320, y: 410 };
  const larger = zoomGraphViewWithWheel(view, anchor, { deltaY: -100, deltaMode: 0 }, 600);
  assert.ok(larger.scale > view.scale);
  const restored = zoomGraphViewWithWheel(larger, anchor, { deltaY: 100, deltaMode: 0 }, 600);
  near(restored.x, view.x); near(restored.y, view.y); near(restored.scale, view.scale);
});

test('wheel units are normalized and extreme input is bounded', () => {
  assert.equal(normalizeGraphWheelDelta({ deltaY: 3, deltaMode: 1 }, 600), 48);
  assert.equal(normalizeGraphWheelDelta({ deltaY: .1, deltaMode: 2 }, 600), 60);
  assert.equal(normalizeGraphWheelDelta({ deltaY: 48, deltaMode: 0 }, 600), 48);
  assert.equal(normalizeGraphWheelDelta({ deltaY: -99999, deltaMode: 0 }, 600), -200);
  assert.equal(normalizeGraphWheelDelta({ deltaY: NaN, deltaMode: 0 }, 600), 0);
});

test('touchpad fractional deltas produce a small zoom and zero deltas do nothing', () => {
  const view = { x: 20, y: -80, scale: 1 }, anchor = { x: 240, y: 110 };
  const next = zoomGraphViewWithWheel(view, anchor, { deltaY: -.5, deltaMode: 0 }, 600);
  assert.ok(next.scale > 1 && next.scale < 1.001);
  assert.strictEqual(zoomGraphViewWithWheel(view, anchor, { deltaY: 0, deltaMode: 0 }, 600), view);
});

test('zoom limits stop both scale and translation, including when the mouse moves', () => {
  for (const [scale, deltaY] of [[.3, 100], [2.2, -100]]) {
    const view = { x: -50, y: 84, scale };
    for (const anchor of [{ x: 20, y: 300 }, { x: 710, y: 40 }]) assert.strictEqual(
      zoomGraphViewWithWheel(view, anchor, { deltaY, deltaMode: 0 }, 600), view,
    );
  }
  assert.equal(zoomGraphViewAtPoint({ x: 0, y: 0, scale: 1 }, { x: 0, y: 0 }, 10).scale, 2.2);
});
