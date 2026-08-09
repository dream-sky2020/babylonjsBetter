import type { Dispatch, SetStateAction } from 'react';
import type { ParticleVisualPreset } from '@/core/particle';

export type ViewMode = '2d' | '3d';

export type ColorGradientNode = ParticleVisualPreset['colorGradients'][number] & { id: string };
export type SizeGradientNode = ParticleVisualPreset['sizeGradients'][number] & { id: string };

export type SetPresetState = Dispatch<SetStateAction<ParticleVisualPreset>>;

export interface MessageApi {
  setMessage: (message: string) => void;
}
