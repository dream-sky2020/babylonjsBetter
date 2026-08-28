/* eslint-disable react-refresh/only-export-components, react-hooks/exhaustive-deps, react-hooks/refs */
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
  createLayeredMonster,
  normalizeMonsterConfigLibrary,
  normalizeMonsterStripePresetLibrary,
  normalizeStripePresetLibrary,
  type LayeredMonsterController,
  type MonsterDisplayConfigLibrary,
  type MonsterStripePresetLibrary,
  type StripePresetLibrary
} from '@/core/monster';
import {
  normalizeSpriteAshPresetLibrary,
  normalizeSpriteAshPreset,
  SPRITE_ASH_PARAMETER_DEFINITIONS,
  SPRITE_ASH_GROUP_FEATURES,
  type SpriteAshPreset,
  type SpriteAshPresetLibrary
} from '@/core/sprite';
import {
  createSpriteDissolveParticles,
  type SpriteDissolveParticleController
} from '@/core/sprite/ash/createSpriteDissolveParticles.ts';
import { createSpriteNoiseErodeOptions } from '@/core/sprite/dissolve/createSpriteNoiseErodeOptions.ts';

const PRESET_URL = '/config/monsterDissolvePresets.json';
const SPRITE_PRESET_URL = '/config/spriteAshPresets.json';
const PRESET_API = '/api/monster-dissolve-presets';
const fetchJson = async (url: string) => {
  return loadConfigFromUrl(url);
};
const particleModeOptions: [SpriteAshPreset['particleMode'], string][] = [
  ['none', '无'], ['ash', '灰烬'], ['blackShards', '黑色碎片'], ['embers', '余烬'], ['pixel', '像素块']
];

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const monsterRef = useRef<LayeredMonsterController | null>(null);
  const particlesRef = useRef<SpriteDissolveParticleController | null>(null);
  const presetRef = useRef<SpriteAshPreset | undefined>(undefined);
  const progressRef = useRef(0);
  const playingRef = useRef(false);
  const [configs, setConfigs] = useState<MonsterDisplayConfigLibrary>({});
  const [monsterStripes, setMonsterStripes] = useState<MonsterStripePresetLibrary>({});
  const [stripes, setStripes] = useState<StripePresetLibrary>({});
  const [presets, setPresets] = useState<SpriteAshPresetLibrary>({});
  const [monsterKey, setMonsterKey] = useState('');
  const [stripeKey, setStripeKey] = useState('');
  const [presetKey, setPresetKey] = useState('');
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState('正在加载怪物与精灵消散预设…');
  const [isError, setIsError] = useState(false);
  const activePreset = presets[presetKey] || Object.values(presets)[0];
  const groups = useMemo(() => [...new Set(SPRITE_ASH_PARAMETER_DEFINITIONS.map((item) => item.group))], []);

  useEffect(() => { presetRef.current = activePreset; }, [activePreset]);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  const applyProgress = (value: number) => {
    const next = Math.max(0, Math.min(1, value));
    progressRef.current = next;
    setProgress(next);
    const preset = presetRef.current;
    if (!preset) return;
    monsterRef.current?.setNoiseErode(createSpriteNoiseErodeOptions(preset, next));
    particlesRef.current?.setProgress(next);
  };

  useEffect(() => {
    Promise.all([
      fetchJson(MONSTER_CONFIG_URL), fetchJson(MONSTER_STRIPE_PRESET_URL),
      fetchJson(STRIPE_PRESET_URL), fetchJson(PRESET_URL), fetchJson(SPRITE_PRESET_URL)
    ]).then(([rawConfigs, rawMonsterStripes, rawStripes, rawMonsterPresets, rawSpritePresets]) => {
      const nextConfigs = normalizeMonsterConfigLibrary(rawConfigs);
      const nextMonsterStripes = normalizeMonsterStripePresetLibrary(rawMonsterStripes);
      const nextStripes = normalizeStripePresetLibrary(rawStripes);
      const savedMonsterPresets = normalizeSpriteAshPresetLibrary(rawMonsterPresets);
      const nextPresets = Object.keys(savedMonsterPresets).length
        ? savedMonsterPresets
        : normalizeSpriteAshPresetLibrary(rawSpritePresets);
      setConfigs(nextConfigs); setMonsterStripes(nextMonsterStripes); setStripes(nextStripes); setPresets(nextPresets);
      setMonsterKey(Object.keys(nextConfigs)[0] || '');
      setStripeKey(Object.keys(nextMonsterStripes)[0] || '');
      setPresetKey(Object.keys(nextPresets)[0] || '');
      setMessage(Object.keys(savedMonsterPresets).length
        ? `已加载 ${Object.keys(nextPresets).length} 个怪物专属消散预设。`
        : `已从精灵预设初始化 ${Object.keys(nextPresets).length} 个怪物消散模板，请保存以建立独立配置。`);
    }).catch((error) => { setIsError(true); setMessage(`加载失败：${String(error)}`); });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const context = createCameraLabScene(canvas);
    const camera = createCameraLabController(context.camera);
    const panel = createFloatingCameraControlPanel(stage, camera);
    const monster = createLayeredMonster(context.scene, 'monsterDissolvePreview');
    monsterRef.current = monster;
    const drag = { active: false, id: -1, x: 0, y: 0 };
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (camera.state.lookControlMode === 'pointerLock') {
        void canvas.requestPointerLock?.();
        return;
      }
      drag.active = true;
      drag.id = event.pointerId;
      drag.x = event.clientX;
      drag.y = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
    };
    const move = (event: PointerEvent) => {
      if (!drag.active || drag.id !== event.pointerId) return;
      camera.handlePointerDelta(event.clientX - drag.x, event.clientY - drag.y);
      drag.x = event.clientX;
      drag.y = event.clientY;
      panel.syncFromController();
    };
    const up = (event: PointerEvent) => {
      if (!drag.active || drag.id !== event.pointerId) return;
      drag.active = false;
      canvas.style.cursor = 'grab';
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    const locked = (event: MouseEvent) => {
      if (document.pointerLockElement === canvas) camera.handlePointerDelta(event.movementX, event.movementY);
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement
        || !['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(event.code)) return;
      camera.keys.add(event.code);
      event.preventDefault();
    };
    const keyUp = (event: KeyboardEvent) => camera.keys.delete(event.code);
    const wheel = (event: WheelEvent) => {
      if (camera.state.mode !== 'orbit') return;
      event.preventDefault();
      camera.handleWheel(event.deltaY);
      panel.syncFromController();
    };
    const resize = () => context.engine.resize();
    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    document.addEventListener('mousemove', locked);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('resize', resize);
    let time = 0;
    context.engine.runRenderLoop(() => {
      const dt = context.engine.getDeltaTime() / 1000;
      time += dt; camera.update(dt); panel.updateStatus(); monster.updateTime(time);
      particlesRef.current?.updateTime(time);
      if (playingRef.current && presetRef.current) {
        const duration = Math.max(.1, presetRef.current.duration);
        const next = Math.min(1, progressRef.current + dt / duration);
        applyProgress(next);
        if (next >= 1) { playingRef.current = false; setPlaying(false); setMessage(`预览完成：${presetRef.current.name}`); }
      }
      context.scene.render();
    });
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
      document.removeEventListener('mousemove', locked);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('resize', resize);
      particlesRef.current?.dispose(); particlesRef.current = null;
      monster.dispose(); panel.dispose(); context.dispose(); monsterRef.current = null;
    };
  }, []);

  useEffect(() => {
    const monster = monsterRef.current;
    const config = configs[monsterKey];
    if (!monster || !config) return;
    particlesRef.current?.dispose(); particlesRef.current = null;
    monster.load(config, monsterStripes[stripeKey] ?? null, stripes);
    const body = monster.getLayerMesh('body');
    if (activePreset && body) {
      particlesRef.current = createSpriteDissolveParticles(body.getScene(), body, activePreset);
      particlesRef.current.setDisplayScale(2.8);
    }
    applyProgress(progressRef.current);
  // 消散预设是常驻材质的运行时参数，切换时不能重新 load 怪物。
  // 否则四层怪物纹理和粒子纹理会反复销毁、重新请求，快速切换时容易进入错误占位纹理。
  }, [monsterKey, stripeKey, configs, monsterStripes, stripes]);

  useEffect(() => {
    if (!activePreset) return;
    particlesRef.current?.setPreset(activePreset);
    applyProgress(progressRef.current);
  }, [activePreset]);

  const updatePreset = (next: SpriteAshPreset) => {
    const normalized = normalizeSpriteAshPreset(next.presetKey, next);
    setPresets((current) => ({ ...current, [normalized.presetKey]: normalized }));
    particlesRef.current?.setPreset(normalized);
    queueMicrotask(() => applyProgress(progressRef.current));
  };
  const addPreset = () => {
    if (!activePreset) return;
    const key = `monster_dissolve_${Date.now().toString(36)}`;
    setPresets((current) => ({ ...current, [key]: { ...activePreset, presetKey: key, name: '新怪物消散预设' } }));
    setPresetKey(key);
  };
  const duplicatePreset = () => {
    if (!activePreset) return;
    const key = `${activePreset.presetKey}_copy_${Date.now().toString(36)}`;
    setPresets((current) => ({ ...current, [key]: { ...activePreset, presetKey: key, name: `${activePreset.name} 副本` } }));
    setPresetKey(key);
  };
  const deletePreset = () => {
    if (!activePreset || Object.keys(presets).length <= 1) return;
    const next = { ...presets };
    delete next[activePreset.presetKey];
    setPresets(next);
    setPresetKey(Object.keys(next)[0] || '');
  };
  const save = async () => {
    try {
      const payload = Object.fromEntries(Object.entries(presets).map(([key, value]) => [key, normalizeSpriteAshPreset(key, value)]));
      const response = await requestDevServer(PRESET_API, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok || result.success === false) throw new Error(result.errors?.[0] || result.message || `HTTP ${response.status}`);
      setIsError(false); setMessage(`已保存 ${Object.keys(payload).length} 个怪物消散预设。`);
    } catch (error) { setIsError(true); setMessage(`保存失败：${String(error)}`); }
  };

  const replay = () => { applyProgress(0); setPlaying(true); setMessage(`正在预览：${activePreset?.name || ''}`); };
  const reset = () => { setPlaying(false); applyProgress(0); setMessage('已重置怪物。'); };

  return <div className="death-lab">
    <aside className="panel">
      <h1>怪物消散效果 Lab</h1>
      <div className="subtle">编辑怪物专属消散预设。首次使用会以“精灵消散效果 Lab”的预设作为模板，之后两边独立保存。</div>
      <label>怪物显示配置</label><select value={monsterKey} onChange={(event) => setMonsterKey(event.target.value)}>{Object.entries(configs).map(([key, value]) => <option key={key} value={key}>{value.name} · {key}</option>)}</select>
      <label>怪物条纹配置</label><select value={stripeKey} onChange={(event) => setStripeKey(event.target.value)}>{Object.entries(monsterStripes).map(([key, value]) => <option key={key} value={key}>{value.name} · {key}</option>)}</select>
      <section className="section">
        <div className="section-head"><strong>怪物消散预设</strong><button onClick={addPreset} disabled={!activePreset}>新增</button></div>
        <label>预设</label><select value={activePreset?.presetKey || ''} onChange={(event) => { setPresetKey(event.target.value); setPlaying(false); progressRef.current = 0; setProgress(0); }}>{Object.values(presets).map((item) => <option key={item.presetKey} value={item.presetKey}>{item.name} · {item.presetKey}</option>)}</select>
        {activePreset && <>
          <label>边缘粒子</label><select value={activePreset.particleMode} onChange={(event) => updatePreset({ ...activePreset, particleMode: event.target.value as SpriteAshPreset['particleMode'] })}>{particleModeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <label>预设名称</label><input type="text" value={activePreset.name} onChange={(event) => updatePreset({ ...activePreset, name: event.target.value })} />
          <div className="grid-2 section"><button onClick={duplicatePreset}>复制</button><button onClick={deletePreset} disabled={Object.keys(presets).length <= 1}>删除</button></div>
        </>}
      </section>
      <section className="section"><strong>播放预览</strong><label>消散进度</label><div className="progress-row"><input type="range" min="0" max="1" step="0.001" value={progress} onChange={(event) => { setPlaying(false); applyProgress(Number(event.target.value)); }} /><input type="text" readOnly value={progress.toFixed(3)} /></div><div className="grid-2 section"><button className="primary" disabled={!activePreset} onClick={replay}>从头播放</button><button onClick={reset}>重置怪物</button></div></section>
      {activePreset && groups.map((group) => {
        const featureKey = SPRITE_ASH_GROUP_FEATURES[group];
        const featureEnabled = featureKey ? activePreset[featureKey] : true;
        return <section className={`section feature-group${featureEnabled ? '' : ' disabled'}`} key={group}>
          <div className="section-head"><strong>{group}</strong>{featureKey && <label className="feature-toggle"><input type="checkbox" checked={featureEnabled} onChange={(event) => updatePreset({ ...activePreset, [featureKey]: event.target.checked })} />启用</label>}</div>
          <fieldset disabled={!featureEnabled}><div className="grid-2">{SPRITE_ASH_PARAMETER_DEFINITIONS.filter((item) => item.group === group).map((item) => <div key={item.key}><label>{item.label}</label>{item.type === 'color' ? <input type="color" value={String(activePreset[item.key])} onChange={(event) => updatePreset({ ...activePreset, [item.key]: event.target.value })} /> : item.type === 'select' ? <select value={String(activePreset[item.key])} onChange={(event) => updatePreset({ ...activePreset, [item.key]: event.target.value })}>{item.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input type="number" min={item.min} max={item.max} step={item.step} value={Number(activePreset[item.key])} onChange={(event) => updatePreset({ ...activePreset, [item.key]: Number(event.target.value) })} />}</div>)}</div></fieldset>
        </section>;
      })}
      <section className="section"><button className="save" onClick={() => void save()}>保存全部怪物消散预设</button><div className={`status${isError ? ' error' : ''}`}>{message}</div></section>
    </aside>
    <main className="stage" ref={stageRef}><canvas ref={canvasRef} /><a className="top-link" href="../../index.html">返回调试入口</a><div className="stage-hint">怪物消散预设独立编辑 · 拖动旋转视角 · 滚轮缩放</div></main>
  </div>;
};

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
