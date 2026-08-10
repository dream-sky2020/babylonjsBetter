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
  removeParticleVisualPreset,
  removeParticlePreset,
  saveLastParticlePresetKey,
  saveLastViewMode,
  saveParticlePreset,
  saveParticleVisualPreset,
  type ParticleEditorPreset,
  type ParticleVisualPreset
} from '@/core/particle';
import { createDefaultParticlePreset } from '@/core/particle/preset/particlePresetValidation.ts';
import { createDefaultParticleVisualPreset } from '@/core/particle/visual/particleVisualPresetValidation.ts';
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
  const skipActiveReloadRef = useRef(false);

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

  const hasKey = (key: string, keys: string[]) => keys.includes(key);
  const askUniqueKey = (label: string, suggested: string, keys: string[]) => {
    const key = (window.prompt(label, suggested) || '').trim();
    if (!key) return '';
    if (hasKey(key, keys)) { setMessage(`Key 已存在：${key}`); return ''; }
    return key;
  };

  const createEffectPreset = useCallback(() => {
    const key = askUniqueKey('输入新的粒子效果 Key（唯一）', 'particle_new', presetKeys);
    if (!key) return;
    const visualKey = `${key}-visual`;
    const nextVisual = createDefaultParticleVisualPreset(visualKey);
    const next = { ...createDefaultParticlePreset(key), visualPresetKey: visualKey };
    skipActiveReloadRef.current = true;
    setActivePresetKey(key);
    setPreset(next);
    setVisualPreset(nextVisual);
    setPresetKeys((keys) => [...keys, key].sort());
    setVisualPresetKeys((keys) => [...new Set([...keys, visualKey])].sort());
    setLoadedPresetVersion((value) => value + 1);
    setMessage(`已新建完整粒子预设 ${key}（包含独立视觉，未保存）`);
  }, [presetKeys]);

  const duplicateEffectPreset = useCallback(() => {
    const key = askUniqueKey('输入复制后的粒子效果 Key（唯一）', `${preset.presetKey}_copy`, presetKeys);
    if (!key) return;
    const visualKey = `${key}-visual`;
    const nextVisual = {
      ...visualPreset,
      presetKey: visualKey,
      name: `${visualPreset.name} 副本`,
      colorGradients: visualPreset.colorGradients.map((item) => ({ ...item, color: { ...item.color } })),
      sizeGradients: visualPreset.sizeGradients.map((item) => ({ ...item })),
      spriteSheet: visualPreset.spriteSheet ? { ...visualPreset.spriteSheet } : undefined
    };
    const next = { ...preset, presetKey: key, name: `${preset.name} 副本`, visualPresetKey: visualKey };
    skipActiveReloadRef.current = true;
    setActivePresetKey(key);
    setPreset(next);
    setVisualPreset(nextVisual);
    setPresetKeys((keys) => [...keys, key].sort());
    setVisualPresetKeys((keys) => [...new Set([...keys, visualKey])].sort());
    setLoadedPresetVersion((value) => value + 1);
    setMessage(`已复制完整粒子预设 ${key}（包含独立视觉，未保存）`);
  }, [preset, presetKeys, visualPreset]);

  const renameEffectPreset = useCallback(() => {
    void (async () => {
      const oldKey = preset.presetKey;
      const key = askUniqueKey('输入新的粒子效果 Key（唯一）', oldKey, presetKeys.filter((item) => item !== oldKey));
      if (!key || key === oldKey) return;
      const next = { ...preset, presetKey: key };
      try { await saveParticlePreset(next); if (hasKey(oldKey, presetKeys)) await removeParticlePreset(oldKey); await reloadParticlePresetStorage(); setActivePresetKey(key); setPreset(next); setPresetKeys(Object.keys(getAllParticlePresets()).sort()); setMessage(`已重命名粒子效果：${oldKey} → ${key}`); }
      catch (error) { setMessage(`重命名失败：${String(error)}`); }
    })();
  }, [preset, presetKeys]);

  const createVisualPreset = useCallback(() => {
    const key = askUniqueKey('输入新的视觉预设 Key（唯一）', 'particle_visual_new', visualPresetKeys);
    if (!key) return;
    const next = createDefaultParticleVisualPreset(key);
    setVisualPreset(next); setPreset((current) => ({ ...current, visualPresetKey: key })); setVisualPresetKeys((keys) => [...keys, key].sort()); setLoadedPresetVersion((value) => value + 1);
    setMessage(`已新建视觉预设 ${key}（未保存）`);
  }, [visualPresetKeys]);

  const duplicateVisualPreset = useCallback(() => {
    const key = askUniqueKey('输入复制后的视觉预设 Key（唯一）', `${visualPreset.presetKey}_copy`, visualPresetKeys);
    if (!key) return;
    const next = { ...visualPreset, presetKey: key, name: `${visualPreset.name} 副本`, colorGradients: visualPreset.colorGradients.map((item) => ({ ...item, color: { ...item.color } })), sizeGradients: visualPreset.sizeGradients.map((item) => ({ ...item })) };
    setVisualPreset(next); setPreset((current) => ({ ...current, visualPresetKey: key })); setVisualPresetKeys((keys) => [...keys, key].sort()); setLoadedPresetVersion((value) => value + 1);
    setMessage(`已复制视觉预设 ${key}（未保存）`);
  }, [visualPreset, visualPresetKeys]);

  const renameVisualPreset = useCallback(() => {
    void (async () => {
      const oldKey = visualPreset.presetKey;
      const key = askUniqueKey('输入新的视觉预设 Key（唯一）', oldKey, visualPresetKeys.filter((item) => item !== oldKey));
      if (!key || key === oldKey) return;
      try { const nextVisual = { ...visualPreset, presetKey: key }; await saveParticleVisualPreset(nextVisual); const affected = Object.values(getAllParticlePresets()).filter((item) => item.visualPresetKey === oldKey); await Promise.all(affected.map((item) => saveParticlePreset({ ...item, visualPresetKey: key }))); if (hasKey(oldKey, visualPresetKeys)) await removeParticleVisualPreset(oldKey); await Promise.all([reloadParticlePresetStorage(), reloadParticleVisualPresetStorage()]); const nextPreset = preset.visualPresetKey === oldKey ? { ...preset, visualPresetKey: key } : preset; setPreset(nextPreset); setVisualPreset(nextVisual); setVisualPresetKeys(Object.keys(getAllParticleVisualPresets()).sort()); setMessage(`已重命名视觉预设并更新 ${affected.length} 个引用：${oldKey} → ${key}`); }
      catch (error) { setMessage(`视觉重命名失败：${String(error)}`); }
    })();
  }, [preset, visualPreset, visualPresetKeys]);

  const deleteVisualPreset = useCallback(() => {
    void (async () => {
      const oldKey = visualPreset.presetKey, fallbackKey = visualPresetKeys.find((key) => key !== oldKey);
      if (!fallbackKey) { setMessage('至少需要保留一个视觉预设'); return; }
      if (!window.confirm(`确认删除视觉预设 ${oldKey}？引用它的粒子效果将改用 ${fallbackKey}`)) return;
      try { const affected = Object.values(getAllParticlePresets()).filter((item) => item.visualPresetKey === oldKey); await Promise.all(affected.map((item) => saveParticlePreset({ ...item, visualPresetKey: fallbackKey }))); await removeParticleVisualPreset(oldKey); await Promise.all([reloadParticlePresetStorage(), reloadParticleVisualPresetStorage()]); setVisualPresetKeys(Object.keys(getAllParticleVisualPresets()).sort()); setPreset((current) => ({ ...current, visualPresetKey: fallbackKey })); setVisualPreset(getParticleVisualPreset(fallbackKey)); setLoadedPresetVersion((value) => value + 1); setMessage(`已删除视觉预设 ${oldKey}，并迁移 ${affected.length} 个引用`); }
      catch (error) { setMessage(`删除视觉预设失败：${String(error)}`); }
    })();
  }, [visualPreset.presetKey, visualPresetKeys]);

  useEffect(() => {
    if (skipActiveReloadRef.current) { skipActiveReloadRef.current = false; return; }
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
    ,createEffectPreset, duplicateEffectPreset, renameEffectPreset
    ,createVisualPreset, duplicateVisualPreset, renameVisualPreset, deleteVisualPreset
  };
};
