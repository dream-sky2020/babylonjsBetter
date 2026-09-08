import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mixDungeonMapEntityColors,
  resolveDungeonMapEntityAppearance,
} from './DungeonMapSvgTintCache.ts';

test('单一 Entity 颜色保持不变，多类型混色与输入顺序无关', () => {
  assert.equal(mixDungeonMapEntityColors(['#ff0000']), '#ff0000');
  assert.equal(
    mixDungeonMapEntityColors(['#ff0000', '#0000ff']),
    mixDungeonMapEntityColors(['#0000ff', '#ff0000']),
  );
});

test('基础结构 Entity 被忽略，业务 Entity 按唯一类型生成稳定颜色组成', () => {
  const colors = { tile: '#4ade80', obstacle: '#fb7185' };
  const appearance = resolveDungeonMapEntityAppearance({
    entities: [
      { id: 'tile', entityType: 'tile', components: [] },
      { id: 'obstacle-a', entityType: 'obstacle', components: [] },
      { id: 'obstacle-b', entityType: 'obstacle', components: [] },
    ],
  }, colors);
  assert.deepEqual(appearance?.entityTypes, ['obstacle']);
  assert.deepEqual(appearance?.colors, ['#fb7185']);
  assert.match(appearance?.mixedColor ?? '', /^#[0-9a-f]{6}$/);
});

test('空 Entity 容器不着色，未知旧数据使用统一灰色', () => {
  assert.equal(resolveDungeonMapEntityAppearance({ entities: [] }, {}), undefined);
  assert.equal(resolveDungeonMapEntityAppearance({
    entities: [{
      id: 'base-edge',
      entityType: 'tile-edge',
      components: [{ id: 'legacy', type: 'legacy-data', version: 1 }],
    }],
  }, { 'tile-edge': '#facc15' }), undefined);
  assert.deepEqual(resolveDungeonMapEntityAppearance({ legacy: true }, {}), {
    colors: ['#94a3b8'],
    mixedColor: '#94a3b8',
    entityTypes: ['未注册数据'],
  });
});
