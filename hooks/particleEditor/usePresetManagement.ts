import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ParticleEditorPreset } from '@app-types/particle-editor.types';
import {
  getAllParticlePresets,
  getLocalParticlePreset,
  getParticlePreset,
  hasLocalParticlePreset,
  removeParticlePreset,
  saveParticlePreset
} from '../../utils/particlePresetStorage';
import { getLastParticlePresetKey, getLastViewMode, saveLastParticlePresetKey, saveLastViewMode } from '../../utils/particleEditorHelpers';
import type { ViewMode } from './types';

interface UsePresetManagementResult {
  presetKeys: string[];
  activePresetKey: string;
  presetSourceLabel: string;
  message: string;
  viewMode: ViewMode;
  preset: ParticleEditorPreset;
  setMessage: (message: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setPreset: Dispatch<SetStateAction<ParticleEditorPreset>>;
  fallbackPreset: () => ParticleEditorPreset;
  loadedPresetVersion: number;
  refreshPresetState: (nextPreset: ParticleEditorPreset, sourceLabel: string) => void;
  handlePresetSelectionChange: (presetKey: string) => void;
  saveCurrentPreset: () => void;
  importCurrentLocalPreset: () => void;
  clearCurrentPreset: () => void;
}

export const usePresetManagement = (): UsePresetManagementResult => {
  const [presetKeys, setPresetKeys] = useState<string[]>(() => Object.keys(getAllParticlePresets()).sort());
  const [activePresetKey, setActivePresetKey] = useState(() => getLastParticlePresetKey());
  const [presetSourceLabel, setPresetSourceLabel] = useState('当前配置来源：项目默认/内置');
  const [message, setMessage] = useState('欢迎使用粒子效果编辑器');
  const [viewMode, setViewMode] = useState<ViewMode>(() => getLastViewMode());
  const [preset, setPreset] = useState<ParticleEditorPreset>(() => {
    const key = getLastParticlePresetKey();
    return getParticlePreset(key);
  });
  const [loadedPresetVersion, setLoadedPresetVersion] = useState(0);
  const fallbackPreset = useCallback((): ParticleEditorPreset => getParticlePreset('spark'), []);

  const refreshPresetState = useCallback((nextPreset: ParticleEditorPreset, sourceLabel: string) => {
    setPreset(nextPreset);
    setLoadedPresetVersion((prev) => prev + 1);
    setPresetSourceLabel(sourceLabel);
  }, []);

  const handlePresetSelectionChange = useCallback((presetKey: string) => {
    if (!presetKey) return;
    setActivePresetKey(presetKey);
    const resolved = getParticlePreset(presetKey);
    refreshPresetState(
      resolved,
      hasLocalParticlePreset(presetKey) ? '当前配置来源：本地配置（已自动导入）' : '当前配置来源：项目默认/内置'
    );
  }, [refreshPresetState]);

  const saveCurrentPreset = useCallback(() => {
    saveParticlePreset(preset);
    setPresetKeys(Object.keys(getAllParticlePresets()).sort());
    setPresetSourceLabel('当前配置来源：本地配置（已保存）');
    setMessage(`已保存：${preset.presetKey}`);
  }, [preset]);

  const importCurrentLocalPreset = useCallback(() => {
    const local = getLocalParticlePreset(activePresetKey);
    if (!local) {
      setMessage(`当前预设无本地覆盖：${activePresetKey}`);
      return;
    }
    refreshPresetState(local, '当前配置来源：本地配置（手动导入）');
    setMessage(`已导入本地配置：${activePresetKey}`);
  }, [activePresetKey, refreshPresetState]);

  const clearCurrentPreset = useCallback(() => {
    removeParticlePreset(activePresetKey);
    setPresetKeys(Object.keys(getAllParticlePresets()).sort());
    const defaultPreset = getParticlePreset(activePresetKey, 'config');
    refreshPresetState(defaultPreset, '当前配置来源：项目默认/内置');
    setMessage(`已清除本地覆盖：${activePresetKey}`);
  }, [activePresetKey, refreshPresetState]);

  useEffect(() => {
    saveLastParticlePresetKey(activePresetKey);
  }, [activePresetKey]);

  useEffect(() => {
    saveLastViewMode(viewMode);
  }, [viewMode]);

  return {
    presetKeys,
    activePresetKey,
    presetSourceLabel,
    message,
    viewMode,
    preset,
    setMessage,
    setViewMode,
    setPreset,
    fallbackPreset,
    loadedPresetVersion,
    refreshPresetState,
    handlePresetSelectionChange,
    saveCurrentPreset,
    importCurrentLocalPreset,
    clearCurrentPreset
  };
};
