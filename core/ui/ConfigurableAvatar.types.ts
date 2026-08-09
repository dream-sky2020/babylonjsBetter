export type AvatarContainerShape = 'square' | 'rounded' | 'circle' | 'ellipse';

export type AvatarContainerConfig = {
  width: number;
  height: number;
  shape: AvatarContainerShape;
  borderRadius: number;
};

export type AvatarAtlasSelection = {
  jsonPath: string;
  frameName: string;
};

export type AvatarExpressionConfig = {
  id: string;
  name: string;
  imagePath: string;
  offsetX: number;
  offsetY: number;
  scale: number;
  atlas?: AvatarAtlasSelection;
};

export type ResolvedAvatarAtlasFrame = {
  frame: { x: number; y: number; w: number; h: number };
  atlasSize: { w: number; h: number };
};

export const createDefaultAvatarContainer = (): AvatarContainerConfig => ({
  width: 320,
  height: 320,
  shape: 'rounded',
  borderRadius: 18
});
