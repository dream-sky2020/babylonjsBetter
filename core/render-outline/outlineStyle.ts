export const outlineBrushes = ['hard', 'pressure', 'dry', 'wash'] as const;
export type OutlineBrush = typeof outlineBrushes[number];

export type OutlineStyle = {
  width: number;
  color: string;
  brush: OutlineBrush;
  minWidth?: number;
  maxWidth?: number;
  smooth: boolean;
};

const brushWidthLoss = 1;
const brushWidthGain = 2;
export const outlineWidthLimit = 4;
export const pressureWidthLimit = outlineWidthLimit + brushWidthGain;
export const outlineAntialiasRadius = 0.5;
export const defaultOutlineStyle: Readonly<OutlineStyle> = Object.freeze({
  width: 1, color: '#10121a', brush: 'hard', smooth: false,
});

export function outlineWidthRange(style: Readonly<OutlineStyle>) {
  return {
    min: style.minWidth ?? Math.max(1, style.width - brushWidthLoss),
    max: style.maxWidth ?? style.width + brushWidthGain,
  };
}
