import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  createDefaultParticleEffectDefinition,
  fetchParticleEffectServerConnection,
  getAllParticleEffectDefinitions,
  getLastParticleEffectKey,
  getLastViewMode,
  getParticleEffectDefinition,
  getStoredParticleEffectDefinition,
  hasStoredParticleEffectDefinition,
  hydrateParticleEffectStorage,
  reloadParticleEffectStorage,
  removeParticleEffectDefinition,
  saveLastParticleEffectKey,
  saveLastViewMode,
  saveParticleEffectDefinition,
  type ParticleEffectDefinition
} from '@/core/particle';
import type { ViewMode } from './types.ts';

interface UseParticleEffectManagementResult {
  presetKeys: string[]; activePresetKey: string; presetSourceLabel: string; message: string; viewMode: ViewMode;
  preset: ParticleEffectDefinition; setMessage: (message: string) => void; setViewMode: (mode: ViewMode) => void;
  setPreset: Dispatch<SetStateAction<ParticleEffectDefinition>>; fallbackPreset: () => ParticleEffectDefinition;
  loadedPresetVersion: number; serverConnected: boolean; serverPort: number | null; retryServerConnection: () => void;
  refreshPresetState: (nextPreset: ParticleEffectDefinition, sourceLabel: string) => void;
  handlePresetSelectionChange: (effectKey: string) => void; saveCurrentPreset: () => void; importCurrentLocalPreset: () => void; clearCurrentPreset: () => void;
}

export const useParticleEffectManagement = (): UseParticleEffectManagementResult => {
  const [presetKeys, setPresetKeys] = useState(() => Object.keys(getAllParticleEffectDefinitions()).sort());
  const [activePresetKey, setActivePresetKey] = useState(() => getLastParticleEffectKey());
  const [presetSourceLabel, setPresetSourceLabel] = useState('当前配置来源：项目配置(JSON)');
  const [message, setMessage] = useState('欢迎使用粒子效果编辑器');
  const [viewMode, setViewMode] = useState<ViewMode>(() => getLastViewMode());
  const [preset, setPreset] = useState(() => getParticleEffectDefinition(getLastParticleEffectKey()));
  const [loadedPresetVersion, setLoadedPresetVersion] = useState(0);
  const [serverConnected, setServerConnected] = useState(false);
  const [serverPort, setServerPort] = useState<number | null>(null);
  const probeRef = useRef(false); const failureCountRef = useRef(0);
  const fallbackPreset = useCallback(() => createDefaultParticleEffectDefinition('spark'), []);

  const refreshServerConnection = useCallback(async () => {
    if (probeRef.current) return; probeRef.current = true;
    const status = await fetchParticleEffectServerConnection();
    if (status.connected) { failureCountRef.current = 0; setServerConnected(true); setServerPort(status.port); }
    else if (++failureCountRef.current >= 2) { setServerConnected(false); setServerPort(null); }
    probeRef.current = false;
  }, []);

  const refreshPresetState = useCallback((nextPreset: ParticleEffectDefinition, sourceLabel: string) => {
    setPreset(nextPreset); setLoadedPresetVersion((value) => value + 1); setPresetSourceLabel(sourceLabel);
  }, []);

  const handlePresetSelectionChange = useCallback((effectKey: string) => {
    if (!effectKey) return; setActivePresetKey(effectKey);
    refreshPresetState(getParticleEffectDefinition(effectKey), hasStoredParticleEffectDefinition(effectKey) ? '当前配置来源：项目配置(JSON)' : '当前配置来源：默认模板（尚未写入 JSON）');
  }, [refreshPresetState]);

  const saveCurrentPreset = useCallback(() => { void (async () => {
    try {
      await saveParticleEffectDefinition(preset); await reloadParticleEffectStorage(); await refreshServerConnection();
      setPresetKeys(Object.keys(getAllParticleEffectDefinitions()).sort()); setPresetSourceLabel('当前配置来源：项目配置(JSON)');
      setMessage(`已写入 config/particleEffects.json：${preset.effectKey}`);
    } catch (error) { setMessage(`写入配置文件失败，请确认 python/server.py 已启动：${String(error)}`); }
  })(); }, [preset, refreshServerConnection]);

  const importCurrentLocalPreset = useCallback(() => {
    const stored = getStoredParticleEffectDefinition(activePresetKey);
    if (!stored) { setMessage(`当前特效暂无 JSON 记录：${activePresetKey}`); return; }
    refreshPresetState(stored, '当前配置来源：项目配置(JSON)'); setMessage(`已导入配置文件：${activePresetKey}`);
  }, [activePresetKey, refreshPresetState]);

  const clearCurrentPreset = useCallback(() => { void (async () => {
    try {
      await removeParticleEffectDefinition(activePresetKey); await reloadParticleEffectStorage(); await refreshServerConnection();
      setPresetKeys(Object.keys(getAllParticleEffectDefinitions()).sort());
      refreshPresetState(createDefaultParticleEffectDefinition(activePresetKey), '当前配置来源：默认模板（尚未写入 JSON）');
      setMessage(`已从配置文件移除：${activePresetKey}`);
    } catch (error) { setMessage(`删除配置失败，请确认 python/server.py 已启动：${String(error)}`); }
  })(); }, [activePresetKey, refreshPresetState, refreshServerConnection]);

  useEffect(() => { let cancelled = false; void (async () => {
    await hydrateParticleEffectStorage(); if (cancelled) return;
    const all = getAllParticleEffectDefinitions(); const keys = Object.keys(all).sort(); setPresetKeys(keys); await refreshServerConnection();
    setPreset((current) => getParticleEffectDefinition(current.effectKey));
    if (!all[activePresetKey] && keys[0]) { setActivePresetKey(keys[0]); refreshPresetState(getParticleEffectDefinition(keys[0]), hasStoredParticleEffectDefinition(keys[0]) ? '当前配置来源：项目配置(JSON)' : '当前配置来源：默认模板（尚未写入 JSON）'); }
  })(); return () => { cancelled = true; }; }, [activePresetKey, refreshPresetState, refreshServerConnection]);

  useEffect(() => { const timer = window.setInterval(() => void refreshServerConnection(), 3000); return () => window.clearInterval(timer); }, [refreshServerConnection]);
  useEffect(() => saveLastParticleEffectKey(activePresetKey), [activePresetKey]);
  useEffect(() => saveLastViewMode(viewMode), [viewMode]);

  return { presetKeys, activePresetKey, presetSourceLabel, message, viewMode, preset, setMessage, setViewMode, setPreset, fallbackPreset, loadedPresetVersion, serverConnected, serverPort, retryServerConnection: () => void refreshServerConnection(), refreshPresetState, handlePresetSelectionChange, saveCurrentPreset, importCurrentLocalPreset, clearCurrentPreset };
};
