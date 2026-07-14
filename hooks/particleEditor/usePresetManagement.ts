import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ParticleEditorPreset } from '@/core/particle';
import {
  getAllParticlePresets,
  fetchParticlePresetServerConnection,
  hydrateParticlePresetStorage,
  getLocalParticlePreset,
  getParticlePreset,
  hasLocalParticlePreset,
  removeParticlePreset,
  reloadParticlePresetStorage,
  saveParticlePreset,
  getLastParticlePresetKey,
  getLastViewMode,
  saveLastParticlePresetKey,
  saveLastViewMode
} from '@/core/particle';
import type { ViewMode } from './types.ts';

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
  serverConnected: boolean;
  serverPort: number | null;
  retryServerConnection: () => void;
  refreshPresetState: (nextPreset: ParticleEditorPreset, sourceLabel: string) => void;
  handlePresetSelectionChange: (presetKey: string) => void;
  saveCurrentPreset: () => void;
  importCurrentLocalPreset: () => void;
  clearCurrentPreset: () => void;
}

export const usePresetManagement = (): UsePresetManagementResult => {
  const [presetKeys, setPresetKeys] = useState<string[]>(() => Object.keys(getAllParticlePresets()).sort());
  const [activePresetKey, setActivePresetKey] = useState(() => getLastParticlePresetKey());
  const [presetSourceLabel, setPresetSourceLabel] = useState('当前配置来源：项目配置(JSON)');
  const [message, setMessage] = useState('欢迎使用粒子效果编辑器');
  const [viewMode, setViewMode] = useState<ViewMode>(() => getLastViewMode());
  const [preset, setPreset] = useState<ParticleEditorPreset>(() => {
    const key = getLastParticlePresetKey();
    return getParticlePreset(key);
  });
  const [loadedPresetVersion, setLoadedPresetVersion] = useState(0);
  const [serverConnected, setServerConnected] = useState(false);
  const [serverPort, setServerPort] = useState<number | null>(null);
  const serverProbeInFlightRef = useRef(false);
  const serverProbeFailureCountRef = useRef(0);
  const fallbackPreset = useCallback((): ParticleEditorPreset => getParticlePreset('spark'), []);

  const refreshServerConnection = useCallback(async () => {
    if (serverProbeInFlightRef.current) return;
    serverProbeInFlightRef.current = true;
    const status = await fetchParticlePresetServerConnection();
    if (status.connected) {
      serverProbeFailureCountRef.current = 0;
      setServerConnected(true);
      setServerPort(status.port);
    } else {
      serverProbeFailureCountRef.current += 1;
      if (serverProbeFailureCountRef.current >= 2) {
        setServerConnected(false);
        setServerPort(null);
      }
    }
    serverProbeInFlightRef.current = false;
  }, []);

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
      hasLocalParticlePreset(presetKey) ? '当前配置来源：项目配置(JSON)' : '当前配置来源：默认模板（尚未写入 JSON）'
    );
  }, [refreshPresetState]);

  const saveCurrentPreset = useCallback(() => {
    void (async () => {
      try {
        await saveParticlePreset(preset);
        await reloadParticlePresetStorage();
        await refreshServerConnection();
        setPresetKeys(Object.keys(getAllParticlePresets()).sort());
        setPresetSourceLabel('当前配置来源：项目配置(JSON)');
        setMessage(`已写入 config/particlePresets.json：${preset.presetKey}`);
      } catch (error) {
        setMessage(`写入配置文件失败，请确认 python/server.py 已启动：${String(error)}`);
      }
    })();
  }, [preset, refreshServerConnection]);

  const importCurrentLocalPreset = useCallback(() => {
    const local = getLocalParticlePreset(activePresetKey);
    if (!local) {
      setMessage(`当前预设暂无 JSON 记录：${activePresetKey}`);
      return;
    }
    refreshPresetState(local, '当前配置来源：项目配置(JSON)');
    setMessage(`已导入配置文件：${activePresetKey}`);
  }, [activePresetKey, refreshPresetState]);

  const clearCurrentPreset = useCallback(() => {
    void (async () => {
      try {
        await removeParticlePreset(activePresetKey);
        await reloadParticlePresetStorage();
        await refreshServerConnection();
        setPresetKeys(Object.keys(getAllParticlePresets()).sort());
        const defaultPreset = getParticlePreset(activePresetKey, 'config');
        refreshPresetState(defaultPreset, '当前配置来源：默认模板（尚未写入 JSON）');
        setMessage(`已从配置文件移除：${activePresetKey}`);
      } catch (error) {
        setMessage(`删除配置失败，请确认 python/server.py 已启动：${String(error)}`);
      }
    })();
  }, [activePresetKey, refreshPresetState, refreshServerConnection]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await hydrateParticlePresetStorage();
      if (cancelled) return;
      const allPresets = getAllParticlePresets();
      const keys = Object.keys(allPresets).sort();
      setPresetKeys(keys);
      await refreshServerConnection();
      setPreset((prev) => getParticlePreset(prev.presetKey));
      if (!allPresets[activePresetKey] && keys.length > 0) {
        const fallbackKey = keys[0];
        setActivePresetKey(fallbackKey);
        refreshPresetState(getParticlePreset(fallbackKey), hasLocalParticlePreset(fallbackKey)
          ? '当前配置来源：项目配置(JSON)'
          : '当前配置来源：默认模板（尚未写入 JSON）');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activePresetKey, refreshPresetState, refreshServerConnection]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshServerConnection();
    }, 3000);
    return () => {
      window.clearInterval(timer);
    };
  }, [refreshServerConnection]);

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
    serverConnected,
    serverPort,
    retryServerConnection: () => { void refreshServerConnection(); },
    refreshPresetState,
    handlePresetSelectionChange,
    saveCurrentPreset,
    importCurrentLocalPreset,
    clearCurrentPreset
  };
};
