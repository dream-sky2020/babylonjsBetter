import React, { useEffect, useMemo, useState } from 'react';
import { loadConfig } from '@/core/config';
import type { DungeonMapPresetLibrary } from '@/core/map';
import { requestDevServer } from '@/core/network/devServerPortResolver';
import { parseWorldPresetLibrary, resolveInitialDungeon, type WorldPreset, type WorldPresetLibrary } from '@/core/world';
import { EntityContainerEditor, createEntityFromDefinition, entityTypeRegistry } from '@/tools/entity-container-editor';
import './world-preset-editor-lab.css';

const createWorldPreset = (presetKey: string, name: string): WorldPreset => {
  const definition = entityTypeRegistry.get('initial-dungeon');
  if (!definition) throw new Error('首次地牢加载 Entity 定义未注册。');
  return { presetKey, name, data: { entities: [createEntityFromDefinition(definition)] } };
};
const normalizeKey = (value: string) => value.trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');

export const WorldPresetEditorLab = () => {
  const [worlds, setWorlds] = useState<WorldPresetLibrary>({});
  const [activeKey, setActiveKey] = useState('');
  const [dungeons, setDungeons] = useState<DungeonMapPresetLibrary>({});
  const [newKey, setNewKey] = useState('new_world');
  const [newName, setNewName] = useState('新世界');
  const [message, setMessage] = useState('正在读取世界预设……');
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const active = worlds[activeKey];

  useEffect(() => {
    let mounted = true;
    Promise.all([
      requestDevServer(`/api/world-presets?t=${Date.now()}`, { method: 'GET' }).then(async (response) => {
        const result = await response.json() as { success?: boolean; data?: unknown; message?: string };
        if (!response.ok || result.success === false) throw new Error(result.message ?? `HTTP ${response.status}`);
        return parseWorldPresetLibrary(result.data);
      }),
      loadConfig<DungeonMapPresetLibrary>('dungeonMapPresets.json'),
    ]).then(([library, dungeonLibrary]) => {
      if (!mounted) return;
      setWorlds(library); setActiveKey(Object.keys(library)[0] ?? ''); setDungeons(dungeonLibrary);
      setMessage(`已载入 ${Object.keys(library).length} 个世界预设。`); setError(false);
    }).catch((reason: unknown) => {
      if (!mounted) return;
      setMessage(`世界预设加载失败：${reason instanceof Error ? reason.message : String(reason)}`); setError(true);
    });
    return () => { mounted = false; };
  }, []);

  const validation = useMemo(() => {
    if (!active) return '';
    try {
      const reference = resolveInitialDungeon(active);
      return dungeons[reference.dungeonPresetKey]
        ? `首次加载：${dungeons[reference.dungeonPresetKey].name} (${reference.dungeonPresetKey})`
        : `引用的地牢预设不存在：${reference.dungeonPresetKey}`;
    } catch (reason) { return reason instanceof Error ? reason.message : String(reason); }
  }, [active, dungeons]);

  const updateActive = (updater: (preset: WorldPreset) => WorldPreset) => {
    if (active) setWorlds((current) => ({ ...current, [activeKey]: updater(current[activeKey]) }));
  };

  const addWorld = () => {
    const base = normalizeKey(newKey) || 'new_world'; let key = base; let suffix = 2;
    while (worlds[key]) key = `${base}_${suffix++}`;
    const preset = createWorldPreset(key, newName.trim() || '新世界');
    setWorlds((current) => ({ ...current, [key]: preset })); setActiveKey(key); setNewKey(`${base}_copy`);
    setMessage(`已创建 ${preset.name}，尚未保存。`); setError(false);
  };
  const duplicateWorld = () => {
    if (!active) return;
    const base = `${activeKey}_copy`; let key = base; let suffix = 2;
    while (worlds[key]) key = `${base}_${suffix++}`;
    const copied = structuredClone(active); copied.presetKey = key; copied.name = `${active.name} 副本`;
    setWorlds((current) => ({ ...current, [key]: copied })); setActiveKey(key);
    setMessage(`已复制为 ${copied.name}，尚未保存。`);
  };
  const deleteWorld = () => {
    if (!active || !window.confirm(`删除世界预设“${active.name}”？`)) return;
    const next = { ...worlds }; delete next[activeKey]; setWorlds(next); setActiveKey(Object.keys(next)[0] ?? '');
    setMessage(`已删除 ${active.name}，尚未保存。`);
  };
  const save = async () => {
    try {
      Object.values(worlds).forEach(resolveInitialDungeon); setSaving(true);
      const response = await requestDevServer('/api/world-presets', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(worlds) });
      const result = await response.json() as { success?: boolean; message?: string };
      if (!response.ok || result.success === false) throw new Error(result.message ?? `HTTP ${response.status}`);
      setMessage(`已保存 ${Object.keys(worlds).length} 个世界预设到 config/worldPresets.json。`); setError(false);
    } catch (reason) {
      setMessage(`保存失败：${reason instanceof Error ? reason.message : String(reason)}`); setError(true);
    } finally { setSaving(false); }
  };
  return <div className="world-editor-lab">
    <header className="world-editor-header"><div><span>WORLD PRESET</span><h1>世界预设编辑 Lab</h1><p>世界与地牢解耦；这里只编辑世界唯一数据容器中的 Entity / Component。</p></div><button type="button" disabled={saving || !Object.keys(worlds).length} onClick={() => void save()}>{saving ? '正在保存…' : '保存全部世界预设'}</button></header>
    <div className="world-editor-layout">
      <aside className="world-editor-sidebar">
        <section><h2>世界预设</h2><select value={activeKey} onChange={(event) => setActiveKey(event.target.value)}>{Object.values(worlds).map((preset) => <option key={preset.presetKey} value={preset.presetKey}>{preset.name} · {preset.presetKey}</option>)}</select><div className="world-editor-actions"><button type="button" disabled={!active} onClick={duplicateWorld}>复制</button><button type="button" className="danger" disabled={!active} onClick={deleteWorld}>删除</button></div></section>
        <section><h2>新建世界</h2><label><span>presetKey</span><input value={newKey} onChange={(event) => setNewKey(event.target.value)} /></label><label><span>名称</span><input value={newName} onChange={(event) => setNewName(event.target.value)} /></label><button type="button" onClick={addWorld}>＋ 新建世界预设</button></section>
        <p className={error ? 'world-editor-message is-error' : 'world-editor-message'}>{message}</p>
      </aside>
      <main className="world-editor-main">{active ? <>
        <section className="world-editor-meta"><label><span>世界名称</span><input value={active.name} onChange={(event) => updateActive((preset) => ({ ...preset, name: event.target.value }))} /></label><label><span>presetKey</span><input value={active.presetKey} readOnly /></label><p>{validation}</p></section>
        <section className="world-editor-container"><div className="world-editor-section-title"><div><h2>世界数据容器</h2><p>字段 UI 来自自动扫描的 Entity / Component 定义，与地牢地图编辑器共用注册表。</p></div><span>{active.data.entities.length} Entity</span></div>
          <EntityContainerEditor containerKind="world" value={active.data} lockedEntityTypes={['initial-dungeon']} fieldOptions={(component, field) => component.type === 'initial-dungeon-load' && field.path === 'dungeonPresetKey' ? Object.values(dungeons).map((preset) => ({ value: preset.presetKey, label: `${preset.name} · ${preset.presetKey}` })) : undefined} onChange={(data) => updateActive((preset) => ({ ...preset, data }))} />
        </section>
      </> : <div className="world-editor-empty">暂无世界预设，请从左侧新建。</div>}</main>
    </div>
  </div>;
};
