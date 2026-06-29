import type { Dispatch, SetStateAction } from 'react';
import type { ParticleEditorPreset } from '@app-types/particle-editor.types';

export type ViewMode = '2d' | '3d';

export type ColorGradientNode = ParticleEditorPreset['colorGradients'][number] & { id: string };
export type SizeGradientNode = ParticleEditorPreset['sizeGradients'][number] & { id: string };

export type SetPresetState = Dispatch<SetStateAction<ParticleEditorPreset>>;

export interface MessageApi {
  setMessage: (message: string) => void;
}
