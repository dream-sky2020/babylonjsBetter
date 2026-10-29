import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCameraDeadZoneTarget, smoothCameraFollow, validateCameraDeadZone } from './dungeonCameraDeadZone.ts';

test('跟随区域内保持中心不动，越界只移动超出部分，零尺寸连续跟随', () => {
  assert.equal(resolveCameraDeadZoneTarget(10, 13, 8), 10);
  assert.equal(resolveCameraDeadZoneTarget(10, 14, 8), 10);
  assert.equal(resolveCameraDeadZoneTarget(10, 16, 8), 12);
  assert.equal(resolveCameraDeadZoneTarget(10, 4, 8), 8);
  assert.equal(resolveCameraDeadZoneTarget(10, 4, 0), 4);
  assert.throws(() => validateCameraDeadZone({ enabled: true, debug: true, width: -1, depth: 4 }, 1));
});

test('平滑跟随由静止渐进启动、无超调，固定目标下帧率变化不影响结果', () => {
  const run = (dt: number, steps: number) => {
    let position = 0, velocity = 0;
    for (let i = 0; i < steps; i++) {
      const next = smoothCameraFollow(position, 10, velocity, 14, dt);
      assert.ok(next.position >= position && next.position <= 10);
      position = next.position; velocity = next.velocity;
    }
    return { position, velocity };
  };
  const first = run(1 / 60, 1), second = run(1 / 60, 2);
  assert.ok(first.position > 0 && second.position - first.position > first.position);
  const sixty = run(1 / 60, 30), thirty = run(1 / 30, 15);
  assert.ok(Math.abs(sixty.position - thirty.position) < 1e-8);
  assert.ok(Math.abs(sixty.velocity - thirty.velocity) < 1e-8);
  assert.deepEqual(smoothCameraFollow(0, 5, 0, 0, .016), { position: 5, velocity: 0 });
  assert.deepEqual(smoothCameraFollow(5, 5, 20, 14, .016), { position: 5, velocity: 0 });
  let reversed = smoothCameraFollow(2, -3, 10, 14, 1 / 60);
  for (let i = 0; i < 180; i++) {
    reversed = smoothCameraFollow(reversed.position, -3, reversed.velocity, 14, 1 / 60);
    assert.ok(reversed.position >= -3);
  }
  assert.ok(Math.abs(reversed.position + 3) < 1e-6);
});
