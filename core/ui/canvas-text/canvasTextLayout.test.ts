import assert from 'node:assert/strict';
import test from 'node:test';
import { ellipsizeCanvasText, layoutCanvasText } from './canvasTextLayout.ts';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const measure = (text: string) => [...segmenter.segment(text)].reduce((width, { segment }) => width + (segment === 'i' ? 2 : segment === ' ' ? 3 : 10), 0);

test('single-line truncation measures actual width rather than a character count', () => {
  assert.equal(ellipsizeCanvasText('iiiiiiiiii', 20, measure), 'iiiiiiiiii');
  assert.equal(ellipsizeCanvasText('WWWWWWWWWW', 20, measure), 'W…');
  assert.equal(ellipsizeCanvasText('中文中文', 30, measure), '中文…');
  assert.equal(ellipsizeCanvasText('中文', 5, measure), '');
});

test('Chinese wraps to bounded lines with an ellipsis only on the last visible line', () => {
  const result = layoutCanvasText('北边树林里出现了魔物。若你愿意帮忙，村长会感谢你的。', { maxWidth: 80, maxLines: 3, measure });
  assert.equal(result.lines.length, 3); assert.equal(result.truncated, true);
  assert.ok(result.lines.at(-1)!.endsWith('…'));
  assert.ok(result.lines.every(line => measure(line) <= 80));
  assert.ok(result.lines.slice(0, -1).every(line => !line.endsWith('…')));
});

test('explicit line breaks including blank and trailing lines are preserved', () => {
  assert.deepEqual(layoutCanvasText('第一行\r\n\r\n第三行\n', { maxWidth: 100, maxLines: 5, measure }), { lines: ['第一行', '', '第三行', ''], truncated: false });
  assert.deepEqual(layoutCanvasText('第一行\n第二行', { maxWidth: 100, maxLines: 1, measure, wrap: false }), { lines: ['第一行…'], truncated: true });
});

test('English words stay together when possible and long words are split safely', () => {
  const result = layoutCanvasText('one two three', { maxWidth: 70, maxLines: 3, measure });
  assert.deepEqual(result.lines, ['one two', 'three']); assert.equal(result.truncated, false);
  const long = layoutCanvasText('abcdefghijklmnop', { maxWidth: 40, maxLines: 2, measure });
  assert.equal(long.truncated, true); assert.ok(long.lines.every(line => measure(line) <= 40));
});

test('emoji and combining sequences are never cut into incomplete graphemes', () => {
  assert.equal(ellipsizeCanvasText('👨‍👩‍👧‍👦👍🏽é中文', 30, measure), '👨‍👩‍👧‍👦👍🏽…');
  const wrapped = layoutCanvasText('👨‍👩‍👧‍👦👍🏽é中文', { maxWidth: 20, maxLines: 4, measure });
  assert.ok(wrapped.lines.every(line => measure(line) <= 20));
  assert.equal(wrapped.lines.join(''), '👨‍👩‍👧‍👦👍🏽é中文');
});

test('zero width, an oversized grapheme and overflow after the last explicit line remain bounded', () => {
  assert.deepEqual(layoutCanvasText('文字', { maxWidth: 0, maxLines: 3, measure }), { lines: [], truncated: true });
  assert.deepEqual(layoutCanvasText('👨‍👩‍👧‍👦', { maxWidth: 5, maxLines: 3, measure }), { lines: [''], truncated: true });
  const result = layoutCanvasText('a\nb\nc\nd', { maxWidth: 30, maxLines: 3, measure });
  assert.deepEqual(result, { lines: ['a', 'b', 'c…'], truncated: true });
});
