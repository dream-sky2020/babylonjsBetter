import assert from 'node:assert/strict';
import test from 'node:test';
import { sampleNumberCurve, type NumberCurveKey } from './numberCurve.ts';

const keys = (interpolation: NumberCurveKey['interpolation']): NumberCurveKey[] => [
  { id: 'a', time: 0, value: 0, interpolation, tangentMode: 'broken', outTangent: 2 },
  { id: 'b', time: 1, value: 1, interpolation, tangentMode: 'broken', inTangent: 0 },
];

test('number curve supports constant, linear and smooth segments', () => {
  assert.equal(sampleNumberCurve(keys('constant'), .5), 0);
  assert.equal(sampleNumberCurve(keys('linear'), .5), .5);
  assert.equal(sampleNumberCurve(keys('smooth'), .25), .15625);
});

test('bezier curve uses authored incoming and outgoing slopes', () => {
  assert.equal(sampleNumberCurve(keys('bezier'), .5), .75);
});

test('legacy smoothstep curves remain compatible', () => {
  assert.equal(sampleNumberCurve(keys(undefined), .25, 'smoothstep'), .15625);
});
