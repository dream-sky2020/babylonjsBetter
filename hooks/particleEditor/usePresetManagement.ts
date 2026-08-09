import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  fetchParticlePresetServerConnection,
  getAllParticlePresets,
  getAllParticleVisualPresets,
  getLastParticlePresetKey,
  getLastViewMode,
  getParticlePreset,
  getParticleVisualPreset,
  hydrateParticlePresetStorage,
  hydrateParticleVisualPresetStorage,
  reloadParticlePresetStorage,
  reloadParticleVisualPresetStorage,
  removeParticlePreset,
  saveLastParticlePresetKey,
  saveLastViewMode,
  saveParticlePreset,
  saveParticleVisualPreset,
  type ParticleEditorPreset,
  type ParticleVisualPreset
} from '@/core/particle';
import type { ViewMode } from './types.ts';

export const usePresetManagement = () => {
  const initialPreset = getParticlePreset(getLastParticlePresetKey());
  const [presetKeys, setPresetKeys] = useState<string[]>(() => Object.keys(getAllParticlePresets()).sort());
  const [visualPresetKeys, setVisualPresetKeys] = useState<string[]>(() => Object.keys(getAllParticleVisualPresets()).sort());
  const [activePresetKey, setActivePresetKey] = useState(initialPreset.presetKey);
  const [preset, setPreset] = useState<ParticleEditorPreset>(initialPreset);
  const [visualPreset, setVisualPreset] = useState<ParticleVisualPreset>(() => getParticleVisualPreset(initialPreset.visualPresetKey));
  const [message, setMessage] = useState('欢迎使用粒子效果编辑器');
  const [viewMode, setViewMode] = useState<ViewMode>(() => getLastViewMode());
  const [loadedPresetVersion, setLoadedPresetVersion] = useState(0);
  const [serverConnected, setServerConnected] = useState(false);
  const [serverPort, setServerPort] = useState<number | null>(null);
  const probeInFlight = useRef(false);

  const refreshServerConnection = useCallback(async () => {
    if (probeInFlight.current) return;
    probeInFlight.current = true;
    const status = await fetchParticlePresetServerConnection();
    setServerConnected(status.connected);
    setServerPort(status.port);
    probeInFlight.current = false;
  }, []);

  const refreshPresetState = useCallback((nextPreset: ParticleEditorPreset, sourceLabel = '项目配置 JSON') => {
    setPreset(nextPreset);
    setVisualPreset(getParticleVisualPreset(nextPreset.visualPresetKey));
    setLoadedPresetVersion((value) => value + 1);
    setMessage(`已载入 ${nextPreset.presetKey}（${sourceLabel}）`);
  }, []);

  const handlePresetSelectionChange = useCallback((presetKey: string) => {
    if (!presetKey) return;
    setActivePresetKey(presetKey);
    refreshPresetState(getParticlePreset(presetKey));
  }, [refreshPresetState]);

  const handleVisualPresetSelectionChange = useCallback((visualPresetKey: string) => {
    if (!visualPresetKey) return;
    setPreset((current) => ({ ...current, visualPresetKey }));
    setVisualPreset(getParticleVisualPreset(visualPresetKey));
    setLoadedPresetVersion((value) => value + 1);
  }, []);

  const saveCurrentPreset = useCallback(() => {
    void (async () => {
      try {
        const normalizedVisual = { ...visualPreset, presetKey: preset.visualPresetKey };
        await saveParticleVisualPreset(normalizedVisual);
        await saveParticlePreset(preset);
        await Promise.all([reloadParticlePresetStorage(), reloadParticleVisualPresetStorage()]);
        setPresetKeys(Object.keys(getAllParticlePresets()).sort());
        setVisualPresetKeys(Object.keys(getAllParticleVisualPresets()).sort());
        await refreshServerConnection();
        setMessage(`已分别保存效果 ${preset.presetKey} 和视觉 ${normalizedVisual.presetKey}`);
      } catch (error) {
        setMessage(`保存失败，请确认 python/server.py 已重启：${String(error)}`);
      }
    })();
  }, [preset, refreshServerConnection, visualPreset]);

  const clearCurrentPreset = useCallback(() => {
    void (async () => {
      try {
        await removeParticlePreset(activePresetKey);
        await reloadParticlePresetStorage();
        const keys = Object.keys(getAllParticlePresets()).sort();
        setPresetKeys(keys);
        if (keys.length > 0) handlePresetSelectionChange(keys[0]);
        setMessage(`已删除效果预设 ${activePresetKey}；共享视觉预设未删除`);
      } catch (error) {
        setMessage(`删除失败：${String(error)}`);
      }
    })();
  }, [activePresetKey, handlePresetSelectionChange]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.all([hydrateParticlePresetStorage(), hydrateParticleVisualPresetStorage()]);
      if (cancelled) return;
      const effects = getAllParticlePresets();
      const visuals = getAllParticleVisualPresets();
      setPresetKeys(Object.keys(effects).sort());
      setVisualPresetKeys(Object.keys(visuals).sort());
      const resolved = getParticlePreset(activePresetKey);
      setPreset(resolved);
      setVisualPreset(getParticleVisualPreset(resolved.visualPresetKey));
      setLoadedPresetVersion((value) => value + 1);
      await refreshServerConnection();
    })();
    return () => { cancelled = true; };
  }, [activePresetKey, refreshServerConnection]);

  useEffect(() => {
    saveLastParticlePresetKey(activePresetKey);
  }, [activePresetKey]);
  useEffect(() => {
    saveLastViewMode(viewMode);
  }, [viewMode]);

  return {
    presetKeys,
    visualPresetKeys,
    activePresetKey,
    activeVisualPresetKey: preset.visualPresetKey,
    presetSourceLabel: `效果：config/particlePresets.json · 视觉：config/particleVisualPresets.json`,
    message,
    viewMode,
    preset,
    visualPreset,
    setMessage,
    setViewMode,
    setPreset: setPreset as Dispatch<SetStateAction<ParticleEditorPreset>>,
    setVisualPreset: setVisualPreset as Dispatch<SetStateAction<ParticleVisualPreset>>,
    fallbackPreset: () => getParticlePreset('spark'),
    loadedPresetVersion,
    serverConnected,
    serverPort,
    retryServerConnection: () => { void refreshServerConnection(); },
    refreshPresetState,
    handlePresetSelectionChange,
    handleVisualPresetSelectionChange,
    saveCurrentPreset,
    importCurrentLocalPreset: () => refreshPresetState(getParticlePreset(activePresetKey)),
    clearCurrentPreset
  };
};
