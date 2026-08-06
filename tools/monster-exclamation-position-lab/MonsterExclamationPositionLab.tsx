import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Scene } from '@babylonjs/core';
import { createCameraLabController } from '@/core/camera/cameraLabController.ts';
import { createCameraLabScene } from '@/core/scene/createCameraLabScene.ts';
import { createFloatingCameraControlPanel } from '@/core/ui/FloatingCameraControlPanel.ts';
import {
  MONSTER_CONFIG_URL,
  MONSTER_STRIPE_PRESET_URL,
  STRIPE_PRESET_URL,
  createDefaultMonsterExclamationPosition,
  createLayeredMonster,
  normalizeMonsterConfigLibrary,
  normalizeMonsterExclamationPositions,
  normalizeMonsterStripePresetLibrary,
  normalizeStripePresetLibrary,
  type LayeredMonsterController,
  type MonsterDisplayConfigLibrary,
  type MonsterExclamationPositionConfig,
  type MonsterExclamationPositionLibrary,
  type MonsterStripePresetLibrary,
  type StripePresetLibrary
} from '@/core/monster';
import {
  EXCLAMATION_MARK_CONFIG_URL,
  createExclamationMarkSprite,
  normalizeExclamationMarkPresets,
  type ExclamationMarkPresetMap,
  type ExclamationMarkSpriteController,
  type SpriteProgressOptions
} from '@/core/sprite';
import { getResolvedDevServerPort, requestDevServer } from '@/core/network/devServerPortResolver.ts';
import { ExclamationProgressControls } from '@/tools/shared/ExclamationProgressControls.tsx';

const API_PATH = '/api/monster-exclamation-positions';
const sectionStyle: React.CSSProperties = { padding: 12, border: '1px solid #273348', borderRadius: 10, background: '#151d29' };

const fetchJson = async (url: string): Promise<unknown> => {
  const response = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
};

export const MonsterExclamationPositionLab: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const monsterRef = useRef<LayeredMonsterController | null>(null);
  const exclamationRef = useRef<ExclamationMarkSpriteController | null>(null);
  const [monsterConfigs, setMonsterConfigs] = useState<MonsterDisplayConfigLibrary>({});
  const [monsterStripePresets, setMonsterStripePresets] = useState<MonsterStripePresetLibrary>({});
  const [stripePresets, setStripePresets] = useState<StripePresetLibrary>({});
  const [exclamationPresets, setExclamationPresets] = useState<ExclamationMarkPresetMap>({});
  const [positions, setPositions] = useState<MonsterExclamationPositionLibrary>({});
  const [monsterKey, setMonsterKey] = useState('');
  const [monsterStripeKey, setMonsterStripeKey] = useState('');
  const [exclamationKey, setExclamationKey] = useState('');
  const [fillPercent, setFillPercent] = useState(1);
  const [previewProgress, setPreviewProgress] = useState<SpriteProgressOptions | null>(null);
  const selectedExclamationPreset = exclamationPresets[exclamationKey];

  useEffect(() => {
    setPreviewProgress(exclamationPresets[exclamationKey]?.progress ?? null);
  }, [exclamationKey]);
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [message, setMessage] = useState('正在加载只读视觉配置…');

  const positionConfig = useMemo(() => positions[monsterKey] ?? createDefaultMonsterExclamationPosition(monsterKey), [positions, monsterKey]);

  const loadAll = useCallback(async () => {
    try {
      const [rawMonsters, rawMonsterStripes, rawStripes, rawExclamations] = await Promise.all([
        fetchJson(MONSTER_CONFIG_URL), fetchJson(MONSTER_STRIPE_PRESET_URL), fetchJson(STRIPE_PRESET_URL), fetchJson(EXCLAMATION_MARK_CONFIG_URL)
      ]);
      const monsters = normalizeMonsterConfigLibrary(rawMonsters);
      const monsterStripes = normalizeMonsterStripePresetLibrary(rawMonsterStripes);
      const stripes = normalizeStripePresetLibrary(rawStripes);
      const exclamations = normalizeExclamationMarkPresets(rawExclamations);
      let savedPositions: MonsterExclamationPositionLibrary = {};
      try {
        const response = await requestDevServer(`${API_PATH}?t=${Date.now()}`, { method: 'GET' });
        const payload = await response.json();
        if (response.ok && payload.success !== false) savedPositions = normalizeMonsterExclamationPositions(payload.data);
        setServerPort(getResolvedDevServerPort());
      } catch {
        savedPositions = normalizeMonsterExclamationPositions(await fetchJson('/config/monsterExclamationPositions.json'));
        setServerPort(null);
      }
      setMonsterConfigs(monsters); setMonsterStripePresets(monsterStripes); setStripePresets(stripes); setExclamationPresets(exclamations); setPositions(savedPositions);
      const firstMonster = Object.keys(monsters)[0] ?? '';
      const firstExclamation = Object.keys(exclamations)[0] ?? '';
      setMonsterKey((current) => monsters[current] ? current : firstMonster);
      setExclamationKey((current) => exclamations[current] ? current : firstExclamation);
      const defaultStripe = monsters[firstMonster]?.monsterStripePresetKey;
      setMonsterStripeKey((current) => monsterStripes[current] ? current : (monsterStripes[defaultStripe] ? defaultStripe : Object.keys(monsterStripes)[0] ?? ''));
      setMessage(`已加载 ${Object.keys(monsters).length} 个怪物、${Object.keys(exclamations).length} 个感叹号预设。视觉预设为只读。`);
    } catch (error) { setMessage(`加载失败：${String(error)}`); }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const context = createCameraLabScene(canvas);
    const cameraController = createCameraLabController(context.camera);
    const cameraPanel = createFloatingCameraControlPanel(stage, cameraController);
    sceneRef.current = context.scene;
    monsterRef.current = createLayeredMonster(context.scene, 'monsterExclamationLabMonster');

    const drag = { active: false, pointerId: -1, x: 0, y: 0 };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (cameraController.state.lookControlMode === 'pointerLock') {
        void canvas.requestPointerLock?.();
        return;
      }
      drag.active = true; drag.pointerId = event.pointerId; drag.x = event.clientX; drag.y = event.clientY;
      canvas.style.cursor = 'grabbing';
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!drag.active || event.pointerId !== drag.pointerId) return;
      cameraController.handlePointerDelta(event.clientX - drag.x, event.clientY - drag.y);
      drag.x = event.clientX; drag.y = event.clientY;
      cameraPanel.syncFromController();
    };
    const endDrag = (event: PointerEvent) => {
      if (!drag.active || event.pointerId !== drag.pointerId) return;
      drag.active = false; drag.pointerId = -1; canvas.style.cursor = 'grab';
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    const onDocumentMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement === canvas) cameraController.handlePointerDelta(event.movementX || 0, event.movementY || 0);
    };
    const onPointerLockChange = () => { canvas.style.cursor = document.pointerLockElement === canvas ? 'none' : 'grab'; };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
      if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(event.code)) return;
      cameraController.keys.add(event.code);
      event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent) => cameraController.keys.delete(event.code);
    const onWheel = (event: WheelEvent) => {
      if (cameraController.state.mode !== 'orbit') return;
      event.preventDefault();
      cameraController.handleWheel(event.deltaY);
      cameraPanel.syncFromController();
    };
    const resize = () => context.engine.resize();
    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('mousemove', onDocumentMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', resize);

    let elapsed = 0;
    context.engine.runRenderLoop(() => {
      const dt = context.engine.getDeltaTime() / 1000;
      elapsed += dt;
      cameraController.update(dt);
      cameraPanel.updateStatus();
      monsterRef.current?.updateTime(elapsed);
      context.scene.render();
    });
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endDrag);
      canvas.removeEventListener('pointercancel', endDrag);
      canvas.removeEventListener('wheel', onWheel);
      document.removeEventListener('mousemove', onDocumentMouseMove);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', resize);
      exclamationRef.current?.dispose(); monsterRef.current?.dispose(); cameraPanel.dispose(); context.dispose(); sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const monster = monsterRef.current;
    const config = monsterConfigs[monsterKey];
    if (!monster || !config) return;
    monster.load(config, monsterStripePresets[monsterStripeKey] ?? null, stripePresets);
    monster.root.position.addInPlaceFromFloats(positionConfig.monsterPositionOffset[0], positionConfig.monsterPositionOffset[1], positionConfig.monsterPositionOffset[2]);
  }, [monsterConfigs, monsterStripePresets, stripePresets, monsterKey, monsterStripeKey, positionConfig.monsterPositionOffset]);

  useEffect(() => {
    const scene = sceneRef.current;
    const preset = exclamationPresets[exclamationKey];
    if (!scene || !preset) return;
    exclamationRef.current?.dispose();
    exclamationRef.current = createExclamationMarkSprite(scene, preset, preset.progress.progress ?? fillPercent);
    return () => { exclamationRef.current?.dispose(); exclamationRef.current = null; };
  }, [exclamationPresets, exclamationKey]);

  useEffect(() => { exclamationRef.current?.setFillPercent(fillPercent); }, [fillPercent]);

  useEffect(() => {
    const monster = monsterRef.current;
    const exclamation = exclamationRef.current;
    if (!monster || !exclamation) return;
    exclamation.mesh.position.copyFrom(monster.root.position).addInPlaceFromFloats(positionConfig.exclamationOffset[0], positionConfig.exclamationOffset[1], positionConfig.exclamationOffset[2]);
    exclamation.setScale(positionConfig.exclamationScale);
  }, [positionConfig, monsterKey, monsterStripeKey, exclamationKey, monsterConfigs, exclamationPresets]);

  const patchExclamationPreview = (patch: Partial<NonNullable<typeof selectedExclamationPreset>>) => {
    if (!selectedExclamationPreset) return;
    setExclamationPresets((current) => ({
      ...current,
      [exclamationKey]: { ...current[exclamationKey], ...patch }
    }));
  };

  const updateVector = (field: 'monsterPositionOffset' | 'exclamationOffset', axis: 0 | 1 | 2, value: number) => {
    if (!monsterKey) return;
    setPositions((current) => {
      const base = current[monsterKey] ?? createDefaultMonsterExclamationPosition(monsterKey);
      const vector: [number, number, number] = [...base[field]];
      vector[axis] = value;
      return { ...current, [monsterKey]: { ...base, monsterConfigKey: monsterKey, [field]: vector } };
    });
  };

  const updateExclamationScale = (value: number) => {
    if (!monsterKey || !Number.isFinite(value)) return;
    setPositions((current) => {
      const base = current[monsterKey] ?? createDefaultMonsterExclamationPosition(monsterKey);
      return { ...current, [monsterKey]: { ...base, monsterConfigKey: monsterKey, exclamationScale: Math.max(0.01, value) } };
    });
  };

  const save = async () => {
    try {
      const complete = { ...positions, [monsterKey]: positionConfig };
      const response = await requestDevServer(API_PATH, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(normalizeMonsterExclamationPositions(complete)) });
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.errors?.[0] || payload.message || `HTTP ${response.status}`);
      setPositions(normalizeMonsterExclamationPositions(complete)); setServerPort(getResolvedDevServerPort()); setMessage('已保存每个怪物通用的感叹号相对位置。');
    } catch (error) { setMessage(`保存失败：${String(error)}`); }
  };

  const renderVectorInputs = (label: string, field: 'monsterPositionOffset' | 'exclamationOffset', value: [number, number, number]) => <div><label>{label}</label><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>{(['X', 'Y', 'Z'] as const).map((axis, index) => <div key={axis}><label>{axis}</label><input type="number" step="0.1" value={value[index]} onChange={(event) => updateVector(field, index as 0 | 1 | 2, Number(event.target.value))} /></div>)}</div></div>;

  return <div style={{ height: '100vh', padding: 14, display: 'grid', gridTemplateColumns: '430px minmax(0, 1fr)', gap: 14 }}>
    <aside style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><h2 style={{ margin: '0 0 5px' }}>怪物 × 感叹号位置 Lab</h2><div style={{ color: '#8291a8', fontSize: 12 }}>只读组合怪物、条纹与感叹号预设；仅编辑位置映射。</div></div>
      <section style={sectionStyle}>
        <label>怪物显示配置（只读）</label><select value={monsterKey} onChange={(event) => { const key = event.target.value; setMonsterKey(key); const stripe = monsterConfigs[key]?.monsterStripePresetKey; if (monsterStripePresets[stripe]) setMonsterStripeKey(stripe); }}>{Object.entries(monsterConfigs).map(([key, item]) => <option key={key} value={key}>{key} · {item.name}</option>)}</select>
        <label>怪物条纹配置（只读）</label><select value={monsterStripeKey} onChange={(event) => setMonsterStripeKey(event.target.value)}>{Object.entries(monsterStripePresets).map(([key, item]) => <option key={key} value={key}>{key} · {item.name}</option>)}</select>
        <label>感叹号精灵配置（可随时更换，不与怪物绑定）</label><select value={exclamationKey} onChange={(event) => setExclamationKey(event.target.value)}>{Object.entries(exclamationPresets).map(([key, item]) => <option key={key} value={key}>{key} · {item.name}</option>)}</select>
        {selectedExclamationPreset ? <details open style={{ marginTop: 10, padding: 10, border: '1px solid #2d3b51', borderRadius: 8, background: '#101722' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>感叹号图片尺寸（仅当前预览）</summary>
          <label>图片尺寸模式</label>
          <select value={selectedExclamationPreset.sizeMode} onChange={(event) => patchExclamationPreview({ sizeMode: event.target.value as 'fixed' | 'preserve-aspect' })}>
            <option value="fixed">固定宽高（切换图片不改变尺寸）</option>
            <option value="preserve-aspect">保持图片原始比例</option>
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label>基础宽度</label><input type="number" min="0.01" step="0.1" disabled={selectedExclamationPreset.sizeMode !== 'fixed'} value={selectedExclamationPreset.width} onChange={(event) => patchExclamationPreview({ width: Math.max(0.01, Number(event.target.value) || 0.01) })} /></div>
            <div><label>基础高度</label><input type="number" min="0.01" step="0.1" value={selectedExclamationPreset.height} onChange={(event) => patchExclamationPreview({ height: Math.max(0.01, Number(event.target.value) || 0.01) })} /></div>
          </div>
          <label>感叹号预设缩放</label><input type="number" min="0.01" step="0.05" value={selectedExclamationPreset.scale} onChange={(event) => patchExclamationPreview({ scale: Math.max(0.01, Number(event.target.value) || 0.01) })} />
        </details> : null}
        {selectedExclamationPreset ? <ExclamationProgressControls
          title="感叹号进度遮罩（仅当前预览）"
          value={previewProgress ?? selectedExclamationPreset.progress}
          onChange={(progress) => {
            setFillPercent(progress.progress ?? 1);
            setPreviewProgress(progress);
            exclamationRef.current?.setProgress(progress);
          }}
        /> : null}
      </section>
      <section style={sectionStyle}>
        {renderVectorInputs('怪物场景位置偏移', 'monsterPositionOffset', positionConfig.monsterPositionOffset)}
        {renderVectorInputs('感叹号相对怪物位置（对所有感叹号通用）', 'exclamationOffset', positionConfig.exclamationOffset)}
        <label>感叹号缩放（对所有感叹号通用）</label>
        <input type="number" min="0.01" step="0.05" value={positionConfig.exclamationScale} onChange={(event) => updateExclamationScale(Number(event.target.value))} />
        <button style={{ width: '100%', marginTop: 12 }} onClick={() => void save()}>保存全部怪物位置配置</button>
      </section>
      <section style={sectionStyle}><div style={{ color: serverPort ? '#8bd8a4' : '#e8ad83', fontSize: 12 }}>Python 服务：{serverPort ? `已连接 ${serverPort}` : '未连接'}</div><div style={{ marginTop: 7, color: '#9dacbf', fontSize: 12, lineHeight: 1.5 }}>{message}</div></section>
    </aside>
    <main ref={stageRef} style={{ minWidth: 0, position: 'relative', border: '1px solid #273348', borderRadius: 12, overflow: 'hidden', background: '#080d14' }}><canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} /><div style={{ position: 'absolute', left: 10, bottom: 8, color: '#8291a8', fontSize: 11, pointerEvents: 'none' }}>左键旋转 · 滚轮缩放 · WASD/QE 移动 · 感叹号始终垂直地面</div></main>
  </div>;
};
