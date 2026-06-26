import type { SpriteAnchorPresetMap } from '@app-types/sprite-anchors.types';

export const spriteAnchorPresets: SpriteAnchorPresetMap = {
  'resources/优势.png': {
    presetKey: 'resources/优势.png',
    imagePath: 'resources/优势.png',
    bodyBounds: {
      minU: 0.24,
      maxU: 0.72,
      minV: 0.08,
      maxV: 0.96
    },
    bodyAxisX: 0.48,
    anchors: {
      head: { u: 0.48, v: 0.12 },
      foot: { u: 0.48, v: 0.95 },
      center: { u: 0.48, v: 0.54 }
    }
  }
};
