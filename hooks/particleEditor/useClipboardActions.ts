import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ParticleEditorPreset, ParticleVisualPreset } from '@/core/particle';

interface UseClipboardActionsParams {
  preset: ParticleEditorPreset;
  visualPreset: ParticleVisualPreset;
  activePresetKey: string;
  fallbackPreset: () => ParticleEditorPreset;
  refreshPresetState: (nextPreset: ParticleEditorPreset, sourceLabel: string) => void;
  setVisualPreset: Dispatch<SetStateAction<ParticleVisualPreset>>;
  setMessage: (message: string) => void;
}

interface UseClipboardActionsResult {
  copyCurrentPreset: () => Promise<void>;
  pastePreset: () => Promise<void>;
}

export const useClipboardActions = ({
  preset,
  visualPreset,
  activePresetKey,
  fallbackPreset,
  refreshPresetState,
  setVisualPreset,
  setMessage
}: UseClipboardActionsParams): UseClipboardActionsResult => {
  const copyCurrentPreset = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ format: 'particle-lab-preset', version: 1, particle: preset, visual: visualPreset }, null, 2));
      setMessage('已复制粒子参数和视觉参数');
    } catch (error) {
      setMessage(`复制失败: ${String(error)}`);
    }
  }, [preset, visualPreset, setMessage]);

  const pastePreset = useCallback(async () => {
    try {
      const raw = await navigator.clipboard.readText();
      if (!raw) {
        setMessage('粘贴失败: 剪贴板为空');
        return;
      }
      const parsed = JSON.parse(raw) as ParticleEditorPreset | { particle?: Partial<ParticleEditorPreset>; visual?: Partial<ParticleVisualPreset> };
      const particle = 'particle' in parsed && parsed.particle ? parsed.particle : parsed as ParticleEditorPreset;
      const merged = { ...fallbackPreset(), ...particle, presetKey: particle.presetKey || activePresetKey };
      refreshPresetState(merged, '当前配置来源：从剪贴板粘贴（未保存）');
      if ('visual' in parsed && parsed.visual) {
        const visualKey = parsed.visual.presetKey || merged.visualPresetKey;
        setVisualPreset((current) => ({ ...current, ...parsed.visual, presetKey: visualKey }));
      }
      setMessage('已从剪贴板导入粒子/视觉配置，请确认后保存');
    } catch (error) {
      setMessage(`粘贴失败: ${String(error)}`);
    }
  }, [activePresetKey, fallbackPreset, refreshPresetState, setVisualPreset, setMessage]);

  return {
    copyCurrentPreset,
    pastePreset
  };
};
