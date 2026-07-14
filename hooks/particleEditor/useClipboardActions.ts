import { useCallback } from 'react';
import type { ParticleEditorPreset } from '@/core/particle';

interface UseClipboardActionsParams {
  preset: ParticleEditorPreset;
  activePresetKey: string;
  fallbackPreset: () => ParticleEditorPreset;
  refreshPresetState: (nextPreset: ParticleEditorPreset, sourceLabel: string) => void;
  setMessage: (message: string) => void;
}

interface UseClipboardActionsResult {
  copyCurrentPreset: () => Promise<void>;
  pastePreset: () => Promise<void>;
}

export const useClipboardActions = ({
  preset,
  activePresetKey,
  fallbackPreset,
  refreshPresetState,
  setMessage
}: UseClipboardActionsParams): UseClipboardActionsResult => {
  const copyCurrentPreset = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(preset, null, 2));
      setMessage('已复制当前粒子配置');
    } catch (error) {
      setMessage(`复制失败: ${String(error)}`);
    }
  }, [preset, setMessage]);

  const pastePreset = useCallback(async () => {
    try {
      const raw = await navigator.clipboard.readText();
      if (!raw) {
        setMessage('粘贴失败: 剪贴板为空');
        return;
      }
      const parsed = JSON.parse(raw) as ParticleEditorPreset;
      const merged = { ...fallbackPreset(), ...parsed, presetKey: activePresetKey };
      refreshPresetState(merged, '当前配置来源：从剪贴板粘贴（未保存）');
      setMessage('已粘贴配置，请确认后保存');
    } catch (error) {
      setMessage(`粘贴失败: ${String(error)}`);
    }
  }, [activePresetKey, fallbackPreset, refreshPresetState, setMessage]);

  return {
    copyCurrentPreset,
    pastePreset
  };
};
