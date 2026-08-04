import type { Mesh, TransformNode } from '@babylonjs/core';
import type { NumberSprite, NumberSpritePreset } from '@/core/sprite';

export type SpecialStatus3dVector = [number, number, number];
export type SpecialStatus3dFacingAxis = '+Z' | '-Z';
export type SpecialStatus3dValues = [number | string, number | string, number | string, number | string];
export type SpecialStatus3dVisibility = [boolean, boolean, boolean, boolean];

export type SpecialStatus3dConfig = {
  iconPath: string;
  numberPreset: NumberSpritePreset;
  statusHeight: number;
  statusScale: number;
  numberScale: number;
  cornerInset: number;
  position: SpecialStatus3dVector;
  numberOffsets: [SpecialStatus3dVector, SpecialStatus3dVector, SpecialStatus3dVector, SpecialStatus3dVector];
  billboard: boolean;
  facingAxis?: SpecialStatus3dFacingAxis;
};

export type SpecialStatus3dState = {
  values: SpecialStatus3dValues;
  visible: SpecialStatus3dVisibility;
  debug: boolean;
  enabled: boolean;
};

export type SpecialStatus3dController = {
  root: TransformNode;
  getIconMesh: () => Mesh | null;
  getNumberSprites: () => ReadonlyArray<NumberSprite | null>;
  getConfig: () => SpecialStatus3dConfig;
  getState: () => SpecialStatus3dState;
  setConfig: (config: SpecialStatus3dConfig) => Promise<void>;
  setValues: (values: SpecialStatus3dValues, visible?: SpecialStatus3dVisibility) => Promise<void>;
  setPosition: (position: SpecialStatus3dVector) => void;
  setDebugVisible: (visible: boolean) => void;
  setEnabled: (enabled: boolean) => void;
  dispose: () => void;
};
