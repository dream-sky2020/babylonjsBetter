import type { Dispatch, SetStateAction } from 'react';
import type { ParticleEffectDefinition } from '@/core/particle';

export type ViewMode = '2d' | '3d';

export type ColorGradientNode = ParticleEffectDefinition['particles']['colorGradients'][number] & { id: string };
export type SizeGradientNode = ParticleEffectDefinition['particles']['sizeGradients'][number] & { id: string };

export type SetPresetState = Dispatch<SetStateAction<ParticleEffectDefinition>>;

export interface MessageApi {
  setMessage: (message: string) => void;
}
