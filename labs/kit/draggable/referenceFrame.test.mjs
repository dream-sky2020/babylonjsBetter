import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultReferenceFrame, parseReferenceFrame, defaultGridSettings, parseGridSettings } from './settings.ts';
import { defaultGrid as equipment, parseGrid as parseEquipment } from '../../draggable/equipment-lab/layouts.ts';
import { defaultGrid as warehouse, parseGrid as parseWarehouse } from '../../draggable/warehouse-lab/layouts.ts';
import { defaultGrid as press, parseGrid as parsePress } from '../../draggable/press-turn-lab/layouts.ts';
import { defaultGridLayout as clash, parseGridLayout as parseClash } from '../../draggable/clash-lab/grid/gridLayoutData.ts';
test('旧设置补1920×1080参考尺寸，并拒绝无效尺寸和开关', () => {
  const old = defaultGridSettings(); delete old.referenceFrame;
  assert.deepEqual(parseGridSettings(old).referenceFrame, defaultReferenceFrame());
  for (const patch of [{ width: 0 }, { height: -1 }, { width: 1.5 }, { width: Infinity }, { height: 16385 }, { visible: 'true' }, { layer: 'invalid' }]) assert.throws(() => parseReferenceFrame({ ...defaultReferenceFrame(), ...patch }));
  assert.equal(parseReferenceFrame({ visible: true, width: 1280, height: 720 }).layer, 'back');
  for (const value of [null, [], 10]) assert.throws(() => parseReferenceFrame(value));
});
test('四个 Lab 导入导出保留参考设置，面板几何不变，坏数据不覆盖原布局', () => {
  for (const [defaults, parse] of [[equipment, parseEquipment], [warehouse, parseWarehouse], [press, parsePress], [clash, parseClash]]) {
    const original = parse(defaults()); const geometry = structuredClone(original.items);
    const frame = { visible: false, width: 2560, height: 1440, layer: 'front' };
    const settings = { ...defaultGridSettings(), precision: 1, threshold: 4, collision: 'overlap', referenceFrame: frame };
    const data = { ...original, settings, ...(Object.hasOwn(original, 'free') ? { free: true, precision: 48, threshold: 4 } : {}) };
    const restored = parse(JSON.parse(JSON.stringify(data)));
    assert.deepEqual(restored.settings.referenceFrame, frame); assert.deepEqual(restored.items, geometry);
    assert.throws(() => parse({ ...data, settings: { ...settings, referenceFrame: { ...frame, width: -1 } } }));
    assert.deepEqual(original.items, geometry);
  }
});
