import type { Mesh, Texture } from '@babylonjs/core';

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
  getFrameRegion: () => SpriteFrameRegion | null;
  setFrameRegion: (region: SpriteFrameRegion | null) => void;
};
