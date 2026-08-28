import type { TransformNode } from '@babylonjs/core';
import type { ShadowQualityReference } from './shadowQualityPreset.types';

export type SceneEnvironmentVector3 = readonly [number, number, number];

export type SceneEnvironmentGeometry =
  | { primitive: 'ground'; width: number; height: number }
  | { primitive: 'box'; width: number; height: number; depth: number }
  | {
      primitive: 'cylinder';
      height: number;
      diameterTop: number;
      diameterBottom: number;
      tessellation?: number;
    };

export type SceneEnvironmentObject = {
  id: string;
  /** 仅供人和编辑器辨认，不参与渲染分派。 */
  name: string;
  geometry: SceneEnvironmentGeometry;
  position: SceneEnvironmentVector3;
  rotation?: SceneEnvironmentVector3;
  color: string;
  shadow?: {
    cast?: boolean;
    receive?: boolean;
  };
};

type SceneEnvironmentLightBase = {
  id: string;
  name: string;
  intensity: number;
  color: string;
};

export type SceneEnvironmentLightShadow = ShadowQualityReference;

export type SceneEnvironmentLight =
  | (SceneEnvironmentLightBase & {
      light: {
        primitive: 'hemispheric';
        direction: SceneEnvironmentVector3;
        groundColor: string;
      };
    })
  | (SceneEnvironmentLightBase & {
      light: {
        primitive: 'directional';
        direction: SceneEnvironmentVector3;
        position?: SceneEnvironmentVector3;
      };
      shadow?: SceneEnvironmentLightShadow;
    })
  | (SceneEnvironmentLightBase & {
      light: {
        primitive: 'point';
        position: SceneEnvironmentVector3;
        range?: number;
      };
      shadow?: SceneEnvironmentLightShadow;
    });

export type SceneEnvironmentPreset = {
  presetKey: string;
  name: string;
  clearColor: string;
  lights: readonly SceneEnvironmentLight[];
  objects: readonly SceneEnvironmentObject[];
};

export type SceneEnvironmentPresetLibrary = Record<string, SceneEnvironmentPreset>;

export type SceneEnvironmentInstance = {
  presetKey: string;
  root: TransformNode;
  dispose: () => void;
};
