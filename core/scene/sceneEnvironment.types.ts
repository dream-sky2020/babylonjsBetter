import type { TransformNode, Node, Mesh } from '@babylonjs/core';
import type { ModelEntity } from '../model/types/model.types';
import type { ModelTransparencyPolicy } from '../model/material/applyModelMaterialPolicy';
import type { ShadowQualityReference } from './shadowQualityPreset.types';

export type SceneEnvironmentVector3 = readonly [number, number, number];

export type SceneEnvironmentHierarchy = {
  /** Stable, type-prefixed declaration ID. Missing/null means the environment root. */
  parentId?: string | null;
  order?: number;
};

export type SceneEnvironmentTransformNode = SceneEnvironmentHierarchy & {
  id: string;
  name: string;
  role?: 'empty' | 'rig' | 'socket';
  position: SceneEnvironmentVector3;
  rotation?: SceneEnvironmentVector3;
  scaling?: SceneEnvironmentVector3;
};

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

export type SceneEnvironmentObject = SceneEnvironmentHierarchy & {
  id: string;
  /** 仅供人和编辑器辨认，不参与渲染分派。 */
  name: string;
  geometry: SceneEnvironmentGeometry;
  position: SceneEnvironmentVector3;
  rotation?: SceneEnvironmentVector3;
  scaling?: SceneEnvironmentVector3;
  color: string;
  shadow?: {
    cast?: boolean;
    receive?: boolean;
  };
};

export type SceneEnvironmentModel = SceneEnvironmentHierarchy & {
  id: string;
  name: string;
  modelPath: string;
  position: SceneEnvironmentVector3;
  rotation?: SceneEnvironmentVector3;
  scaling?: SceneEnvironmentVector3;
  transparencyPolicy?: ModelTransparencyPolicy;
  animation?: {
    name?: string;
    autoplay?: boolean;
    loop?: boolean;
  };
  shadow?: {
    cast?: boolean;
    receive?: boolean;
  };
};

type SceneEnvironmentLightBase = SceneEnvironmentHierarchy & {
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
  models: readonly SceneEnvironmentModel[];
  transformNodes?: readonly SceneEnvironmentTransformNode[];
};

export type SceneEnvironmentPresetLibrary = Record<string, SceneEnvironmentPreset>;

export type SceneEnvironmentInstance = {
  presetKey: string;
  root: TransformNode;
  models: readonly { definition: SceneEnvironmentModel; entity: ModelEntity }[];
  /** Stable declaration identities; imported render children are intentionally not edit targets. */
  nodes: ReadonlyMap<string, Node>;
  /** Ground visuals are separate from their logical parent so display scaling never stretches children. */
  groundMeshes?: ReadonlyMap<string, Mesh>;
  dispose: () => void;
};
