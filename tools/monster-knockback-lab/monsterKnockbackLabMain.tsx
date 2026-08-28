/* eslint-disable react-refresh/only-export-components, react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadConfigFromUrl } from '@/core/config';
import { createRoot } from 'react-dom/client';
import { createCameraLabController } from '@/core/camera/cameraLabController.ts';
import { createCameraLabScene } from '@/core/scene/createCameraLabScene.ts';
import { createFloatingCameraControlPanel } from '@/core/ui/FloatingCameraControlPanel.ts';
import { requestDevServer } from '@/core/network/devServerPortResolver.ts';
import {
  MONSTER_CONFIG_URL,
  MONSTER_STRIPE_PRESET_URL,
  STRIPE_PRESET_URL,
  MonsterVisualManager,
  normalizeMonsterConfigLibrary,
  normalizeMonsterStripePresetLibrary,
  normalizeStripePresetLibrary,
  type MonsterDisplayConfigLibrary,
  type MonsterStripePresetLibrary,
  type StripePresetLibrary
} from '@/core/monster';
import {
  createDefaultMonsterDeathParameters,
  getMonsterDeathDefinition,
  normalizeMonsterDeathParameters,
  type MonsterDeathPreset,
  type MonsterDeathPresetLibrary
} from '@/core/monster-death-motion';

const DEATH_URL = '/config/monsterDeathConfigs.json';
const DEATH_API = '/api/monster-death-configs';
const PREVIEW_MONSTER_ID = 'deathPreviewMonster';
const KNOCKBACK_MODE_ID = 'knockback';
const knockbackDefinition = getMonsterDeathDefinition(KNOCKBACK_MODE_ID);

const fetchJson = async (url: string) => {
  return loadConfigFromUrl(url);
};

const normalizePreset = (key: string, value: unknown): MonsterDeathPreset => {
  const raw = value && typeof value === 'object' ? value as Partial<MonsterDeathPreset> : {};
  const definition = knockbackDefinition;
  return {
    presetKey: key,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : definition.name || key,
    modeId: definition.id,
    parameters: normalizeMonsterDeathParameters(definition.parameters, raw.parameters)
  };
};

const CommitNumberInput: React.FC<{
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => void;
}> = ({ value, min, max, step, onCommit }) => {
  const [draft, setDraft] = useState(String(value));
  const editing = useRef(false);
  useEffect(() => { if (!editing.current) setDraft(String(value)); }, [value]);
  const commit = () => {
    editing.current = false;
    const parsed = Number(draft);
    if (draft.trim() && Number.isFinite(parsed)) onCommit(Math.max(min, Math.min(max, parsed)));
    else setDraft(String(value));
  };
  return <input type="number" value={draft} min={min} max={max} step={step}
    onFocus={() => { editing.current = true; }} onChange={(event) => setDraft(event.target.value)}
    onBlur={commit} onKeyDown={(event) => {
      if (event.key === 'Enter') event.currentTarget.blur();
      if (event.key === 'Escape') { setDraft(String(value)); event.currentTarget.blur(); }
    }} />;
};

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const managerRef = useRef<MonsterVisualManager | null>(null);
  const activePresetRef = useRef<MonsterDeathPreset | undefined>(undefined);
  const otherDeathPresetsRef = useRef<MonsterDeathPresetLibrary>({});
  const resourcesRef = useRef<{ configs: MonsterDisplayConfigLibrary; monsterStripes: MonsterStripePresetLibrary; stripes: StripePresetLibrary }>({ configs: {}, monsterStripes: {}, stripes: {} });
  const [configs, setConfigs] = useState<MonsterDisplayConfigLibrary>({});
  const [monsterStripes, setMonsterStripes] = useState<MonsterStripePresetLibrary>({});
  const [presets, setPresets] = useState<MonsterDeathPresetLibrary>({});
  const [monsterKey, setMonsterKey] = useState('');
  const [stripeKey, setStripeKey] = useState('');
  const [presetKey, setPresetKey] = useState('');
  const [message, setMessage] = useState('正在加载配置…');
  const [isError, setIsError] = useState(false);
  const activePreset = presets[presetKey] || Object.values(presets)[0];
  const definition = knockbackDefinition;
  const parameters = activePreset?.parameters || createDefaultMonsterDeathParameters(definition.parameters);
  const groups = useMemo(() => [...new Set(Object.values(definition.parameters).map((item) => item.group || '参数'))], [definition]);

  const renderMonster = (nextMonsterKey = monsterKey, nextStripeKey = stripeKey) => {
    const manager = managerRef.current;
    const resources = resourcesRef.current;
    if (!manager || !resources.configs[nextMonsterKey]) return;
    manager.stopMonsterDeath(PREVIEW_MONSTER_ID);
    manager.sync({ id: 'deathPreview', name: '死亡预览', width: 1, cellSize: 2.5, rowSpacing: 4, monsters: [{
      id: PREVIEW_MONSTER_ID,
      typeId: nextMonsterKey,
      monsterConfigKey: nextMonsterKey,
      monsterStripePresetKey: nextStripeKey,
      chaos: { value: 0, threshold: 100, duration: 0 },
      position: { row: 0, column: 0, size: 1, isOccupyingFullRowCentered: true }
    }] }, resources, '');
  };

  useEffect(() => { activePresetRef.current = activePreset; }, [activePreset]);

  const playDeath = (preset?: MonsterDeathPreset) => {
    const manager = managerRef.current;
    const selectedPreset = preset || activePresetRef.current;
    if (!manager || !selectedPreset) return;
    manager.stopMonsterDeath(PREVIEW_MONSTER_ID);
    manager.playMonsterDeath(PREVIEW_MONSTER_ID, selectedPreset, () => setMessage(`播放完成：${selectedPreset.name}`));
    setIsError(false);
    setMessage(`正在播放：${selectedPreset.name} · ${getMonsterDeathDefinition(selectedPreset.modeId).name}`);
  };

  const updatePreset = (next: MonsterDeathPreset, preview = true) => {
    const normalized = normalizePreset(next.presetKey, next);
    setPresets((current) => ({ ...current, [normalized.presetKey]: normalized }));
    if (preview) queueMicrotask(() => playDeath(normalized));
  };

  useEffect(() => {
    Promise.all([fetchJson(MONSTER_CONFIG_URL), fetchJson(MONSTER_STRIPE_PRESET_URL), fetchJson(STRIPE_PRESET_URL), fetchJson(DEATH_URL)])
      .then(([rawConfigs, rawMonsterStripes, rawStripes, rawDeaths]) => {
        const nextConfigs = normalizeMonsterConfigLibrary(rawConfigs);
        const nextMonsterStripes = normalizeMonsterStripePresetLibrary(rawMonsterStripes);
        const nextStripes = normalizeStripePresetLibrary(rawStripes);
        const rawPresetEntries = Object.entries(rawDeaths || {}) as [string, MonsterDeathPreset][];
        const nextPresets = Object.fromEntries(rawPresetEntries
          .filter(([, value]) => value?.modeId === KNOCKBACK_MODE_ID)
          .map(([key, value]) => [key, normalizePreset(key, value)] as const));
        otherDeathPresetsRef.current = Object.fromEntries(rawPresetEntries
          .filter(([, value]) => value?.modeId !== KNOCKBACK_MODE_ID));
        resourcesRef.current = { configs: nextConfigs, monsterStripes: nextMonsterStripes, stripes: nextStripes };
        setConfigs(nextConfigs);
        setMonsterStripes(nextMonsterStripes);
        setPresets(nextPresets);
        setMonsterKey(Object.keys(nextConfigs)[0] || '');
        setStripeKey(Object.keys(nextMonsterStripes)[0] || '');
        setPresetKey(Object.keys(nextPresets)[0] || '');
        setMessage(`已加载 ${Object.keys(nextPresets).length} 个死亡动画配置。`);
      }).catch((error) => { setIsError(true); setMessage(`加载失败：${String(error)}`); });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const context = createCameraLabScene(canvas);
    const camera = createCameraLabController(context.camera);
    const panel = createFloatingCameraControlPanel(stage, camera);
    const manager = new MonsterVisualManager(context.scene);
    manager.setHelpersVisible(false);
    managerRef.current = manager;
    const drag = { active: false, id: -1, x: 0, y: 0, moved: false };
    const down = (event: PointerEvent) => { if (event.button !== 0) return; drag.active = true; drag.id = event.pointerId; drag.x = event.clientX; drag.y = event.clientY; drag.moved = false; canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing'; };
    const move = (event: PointerEvent) => { if (!drag.active || drag.id !== event.pointerId) return; const dx = event.clientX - drag.x; const dy = event.clientY - drag.y; drag.moved ||= Math.hypot(dx, dy) > 3; drag.x = event.clientX; drag.y = event.clientY; camera.handlePointerDelta(dx, dy); panel.syncFromController(); };
    const up = (event: PointerEvent) => { if (!drag.active || drag.id !== event.pointerId) return; drag.active = false; canvas.style.cursor = 'grab'; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); };
    const click = () => { if (!drag.moved) playDeath(); };
    const wheel = (event: WheelEvent) => { if (camera.state.mode !== 'orbit') return; event.preventDefault(); camera.handleWheel(event.deltaY); panel.syncFromController(); };
    const resize = () => context.engine.resize();
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('click', click); canvas.addEventListener('wheel', wheel, { passive: false }); window.addEventListener('resize', resize);
    context.engine.runRenderLoop(() => { const dt = context.engine.getDeltaTime() / 1000; camera.update(dt); panel.updateStatus(); manager.update(dt); context.scene.render(); });
    return () => { canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('click', click); canvas.removeEventListener('wheel', wheel); window.removeEventListener('resize', resize); manager.dispose(); panel.dispose(); context.dispose(); managerRef.current = null; };
  }, []);

  useEffect(() => { renderMonster(); }, [monsterKey, stripeKey, configs, monsterStripes]);

  const patchParameter = (key: string, value: number | boolean | string) => {
    if (!activePreset) return;
    updatePreset({ ...activePreset, parameters: { ...activePreset.parameters, [key]: value } });
  };
  const addPreset = () => {
    const key = `death_${Date.now().toString(36)}`;
    const next = { presetKey: key, name: '新击飞效果', modeId: KNOCKBACK_MODE_ID, parameters: createDefaultMonsterDeathParameters(knockbackDefinition.parameters) };
    setPresets((current) => ({ ...current, [key]: next })); setPresetKey(key);
  };
  const duplicatePreset = () => {
    if (!activePreset) return;
    const key = `${activePreset.presetKey}_copy_${Date.now().toString(36)}`;
    setPresets((current) => ({ ...current, [key]: { ...activePreset, presetKey: key, name: `${activePreset.name} 副本`, parameters: { ...activePreset.parameters } } })); setPresetKey(key);
  };
  const deletePreset = () => {
    if (!activePreset || Object.keys(presets).length <= 1) return;
    const next = { ...presets }; delete next[activePreset.presetKey]; setPresets(next); setPresetKey(Object.keys(next)[0] || '');
  };
  const save = async () => {
    try {
      const knockbackPayload = Object.fromEntries(Object.entries(presets).map(([key, value]) => [key, normalizePreset(key, value)]));
      const payload = { ...otherDeathPresetsRef.current, ...knockbackPayload };
      const response = await requestDevServer(DEATH_API, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok || result.success === false) throw new Error(result.errors?.[0] || result.message || `HTTP ${response.status}`);
      setIsError(false); setMessage(`已保存 ${Object.keys(knockbackPayload).length} 个击飞效果配置。`);
    } catch (error) { setIsError(true); setMessage(`保存失败：${String(error)}`); }
  };

  return <div className="death-lab">
    <aside className="panel">
      <h1>怪物击飞效果 Lab</h1><div className="subtle">专门编辑和预览怪物旋转击飞、落地与淡出的动作参数。</div>
      <label>怪物显示配置</label><select value={monsterKey} onChange={(event) => setMonsterKey(event.target.value)}>{Object.entries(configs).map(([key, value]) => <option key={key} value={key}>{value.name} · {key}</option>)}</select>
      <label>怪物条纹配置</label><select value={stripeKey} onChange={(event) => setStripeKey(event.target.value)}>{Object.entries(monsterStripes).map(([key, value]) => <option key={key} value={key}>{value.name} · {key}</option>)}</select>
      <section className="section"><div className="section-head"><strong>击飞效果配置</strong><button onClick={addPreset}>新增</button></div>
        <label>预设</label><select value={activePreset?.presetKey || ''} onChange={(event) => setPresetKey(event.target.value)}>{Object.values(presets).map((item) => <option key={item.presetKey} value={item.presetKey}>{item.name} · {item.presetKey}</option>)}</select>
        {activePreset && <><label>配置名称</label><input type="text" value={activePreset.name} onChange={(event) => updatePreset({ ...activePreset, name: event.target.value }, false)} />
          <label>动作模式</label><div className="description">{definition.name} · {definition.id}</div>
          <div className="description">{definition.description}</div>
          {groups.map((group) => <div className="parameter-group" key={group}><strong>{group}</strong><div className="grid-2">{Object.entries(definition.parameters).filter(([, item]) => (item.group || '参数') === group).map(([key, item]) => <div key={key}>{item.type === 'number' ? <><label>{item.label}</label><CommitNumberInput value={Number(parameters[key])} min={item.min} max={item.max} step={item.step} onCommit={(value) => patchParameter(key, value)} /></> : item.type === 'boolean' ? <label><input type="checkbox" checked={Boolean(parameters[key])} onChange={(event) => patchParameter(key, event.target.checked)} /> {item.label}</label> : item.type === 'color' ? <><label>{item.label}</label><input type="color" value={String(parameters[key])} onChange={(event) => patchParameter(key, event.target.value)} /></> : <><label>{item.label}</label><select value={String(parameters[key])} onChange={(event) => patchParameter(key, event.target.value)}>{item.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></>}</div>)}</div></div>)}
          <div className="grid-2 section"><button onClick={duplicatePreset}>复制配置</button><button disabled={Object.keys(presets).length <= 1} onClick={deletePreset}>删除配置</button></div></>}
      </section>
      <section className="section grid-2"><button className="primary" disabled={!activePreset} onClick={() => playDeath()}>播放击飞</button><button onClick={() => { managerRef.current?.stopMonsterDeath(PREVIEW_MONSTER_ID); setMessage('已重置怪物。'); }}>重置怪物</button></section>
      <section className="section"><button className="save" onClick={() => void save()}>保存全部击飞配置</button><div className={`status${isError ? ' error' : ''}`}>{message}</div></section>
    </aside>
    <main className="stage" ref={stageRef}><canvas ref={canvasRef} /><a className="top-link" href="/">返回调试入口</a><div className="stage-hint">单击场景播放 · 拖动旋转视角 · 滚轮缩放</div></main>
  </div>;
};

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
