export type CanvasTextLayout = { lines: string[]; truncated: boolean };
export type CanvasTextMeasure = (text: string) => number;
export type CanvasTextLayoutOptions = { maxWidth: number; maxLines: number; measure: CanvasTextMeasure; wrap?: boolean };

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
const graphemes = (text: string) => [...graphemeSegmenter.segment(text)].map(item => item.segment);

/** Width-based ellipsis. Never splits an emoji or combining sequence. */
export const ellipsizeCanvasText = (text: string, maxWidth: number, measure: CanvasTextMeasure, force = false): string => {
  if (!force && measure(text) <= maxWidth) return text;
  if (maxWidth <= 0 || measure('…') > maxWidth) return '';
  const units = graphemes(text.trimEnd());
  let low = 0, high = units.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measure(`${units.slice(0, mid).join('')}…`) <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return `${units.slice(0, low).join('').trimEnd()}…`;
};

/** Pure text layout: explicit newlines, word boundaries and bounded output. */
export const layoutCanvasText = (text: string, options: CanvasTextLayoutOptions): CanvasTextLayout => {
  const { maxWidth, measure } = options;
  const maxLines = Math.max(0, Math.floor(options.maxLines));
  if (!(maxWidth > 0) || !maxLines) return { lines: [], truncated: !!text };
  const paragraphs = text.replace(/\r\n?/g, '\n').split('\n');
  if (options.wrap === false) {
    const truncated = paragraphs.length > 1 || measure(paragraphs[0]) > maxWidth;
    return { lines: [ellipsizeCanvasText(paragraphs[0], maxWidth, measure, paragraphs.length > 1)], truncated };
  }
  const lines: string[] = [];
  let current = '';
  // Produce only one overflow line, even for very large dialogue strings.
  const push = (): boolean => { lines.push(current.trimEnd()); current = ''; return lines.length <= maxLines; };
  for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex++) {
    const paragraph = paragraphs[paragraphIndex];
    for (const { segment } of wordSegmenter.segment(paragraph)) {
      const whitespace = /^\s+$/.test(segment);
      if (!current && whitespace) continue;
      if (measure(current + segment) <= maxWidth) { current += segment; continue; }
      if (current) {
        if (!push()) return finish(lines, maxLines, maxWidth, measure);
        if (whitespace) continue;
      }
      if (measure(segment) <= maxWidth) { current = segment; continue; }
      for (const unit of graphemes(segment)) {
        if (measure(current + unit) > maxWidth) {
          if (current && !push()) return finish(lines, maxLines, maxWidth, measure);
          if (measure(unit) > maxWidth) {
            // A grapheme wider than the entire region cannot be drawn safely.
            lines.push('');
            return finish(lines, Math.min(maxLines, lines.length), maxWidth, measure, true);
          }
        }
        current += unit;
      }
    }
    if (!push()) return finish(lines, maxLines, maxWidth, measure);
  }
  return { lines, truncated: false };
};

const finish = (lines: string[], maxLines: number, maxWidth: number, measure: CanvasTextMeasure, force = false): CanvasTextLayout => {
  const result = lines.slice(0, maxLines);
  if (result.length && (force || lines.length > maxLines)) result[result.length - 1] = ellipsizeCanvasText(result.at(-1)!, maxWidth, measure, true);
  return { lines: result, truncated: true };
};
