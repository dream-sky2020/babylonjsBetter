import type { Mesh, Texture } from '@babylonjs/core';
import type { SpriteVisualSurface } from '../render/spriteVisualSurface.ts';

export type SpriteFrameRegion = {
  frameName?: string;
  frame: { x: number; y: number; w: number; h: number };
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
  atlasSize: { w: number; h: number };
  rotated: boolean;
  trimmed: boolean;
};

export type IconPlaneController = {
  mesh: Mesh;
  texture: Texture;
  /** 材质无关的视觉能力入口；创建者不需要知道具体 Shader。 */
  surface: SpriteVisualSurface;
  getDisplayScale: () => number;
  setDisplayScale: (scale: number) => void;
  getSubdivisions: () => number;
  setSubdivisions: (subdivisions: number) => void;
  getFrameRegion: () => SpriteFrameRegion | null;
  setFrameRegion: (region: SpriteFrameRegion | null) => void;
  dispose?: () => void;
};
