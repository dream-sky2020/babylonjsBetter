import type { TransformNode } from '@babylonjs/core';

export type NumberSpriteGlyphSource =
  | { type: 'single'; imagePath: string }
  | { type: 'atlas'; atlasJsonPath: string; frameName: string };

export type NumberSpriteAlignment = 'left' | 'center' | 'right';

export type NumberSpritePreset = {
  presetKey: string;
  name: string;
  height: number;
  /** 每个相邻字符之间的基础间距。 */
  spacing: number;
  /** 是否在整数部分每三位之间增加额外视觉间距。 */
  groupingEnabled: boolean;
  /** 三位分组边界上额外增加的世界单位间距。 */
  groupingExtraSpacing: number;
  alignment: NumberSpriteAlignment;
  billboard: boolean;
  glyphs: Record<string, NumberSpriteGlyphSource>;
};

export type NumberSpritePresetMap = Record<string, NumberSpritePreset>;

export type NumberSprite = {
  root: TransformNode;
  preset: NumberSpritePreset;
  getText: () => string;
  setText: (text: string) => Promise<void>;
  isDebugVisible: () => boolean;
  /** 显示每个数字 Plane 的 Babylon Mesh 包围框。 */
  setDebugVisible: (visible: boolean) => void;
  dispose: () => void;
};
