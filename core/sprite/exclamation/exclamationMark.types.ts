import type { SpriteProgressOptions } from '@/core/sprite/progress/spriteProgress.ts';

export type ExclamationMarkPreset = {
  presetKey: string;
  name: string;
  imagePath: string;
  sizeMode: 'fixed' | 'preserve-aspect';
  width: number;
  height: number;
  scale: number;
  position: [number, number, number];
  faceCamera: boolean;
  progress: SpriteProgressOptions;
  /** Legacy fields accepted only while old editors/configs are being migrated. */
  fillPercent?: number;
  fillDirection?: 'bottom-to-top' | 'top-to-bottom' | 'left-to-right' | 'right-to-left';
  fillMode?: 'color' | 'texture'; fillColor?: string; fillOpacity?: number;
  backgroundMode?: 'color' | 'texture'; backgroundColor?: string; backgroundOpacity?: number;
};

export type ExclamationMarkPresetMap = Record<string, ExclamationMarkPreset>;
