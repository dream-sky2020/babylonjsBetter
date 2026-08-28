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
  normalizeMonsterConfigLibrary,
  normalizeMonsterStripePresetLibrary,
  normalizeStripePresetLibrary,
  type MonsterDisplayConfigLibrary,
  type MonsterStripePresetLibrary,
  type StripePresetLibrary
} from '@/core/monster';
import {
  MonsterVisualManager,
  normalizeDistanceStripeRuleConfig,
  resolveDistanceStripePresetKey,
  type BattlefieldDistanceStripeRuleConfig as BattlefieldStripeRuleConfig,
  type VisualBattlefield as Battlefield,
  type VisualMonster as MonsterPlacement,
  type MonsterDistanceStripeRule as StripeRule
} from '@/core/monster';


const FORMATION_CONFIG_URL = '/config/monsterBattlefieldFormations.json';
const RULE_CONFIG_URL = '/config/monsterBattlefieldStripeRules.json';
const RULE_API_PATH = '/api/monster-battlefield-stripe-rules';
const STORAGE_KEY = 'monster-battlefield-stripe-rules-lab:draft:v1';
const section: React.CSSProperties = { padding: 12, border: '1px solid #273348', borderRadius: 8, background: '#151d29' };
const uid = (prefix = 'item') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const numberOr = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const positiveInt = (value: unknown, fallback = 1) => Math.max(1, Math.round(numberOr(value, fallback)));
const indexInt = (value: unknown, fallback = 0) => Math.max(0, Math.round(numberOr(value, fallback)));

const normalizeBattlefield = (value: Partial<Battlefield>, fallbackId: string): Battlefield => ({
  id: typeof value.id === 'string' && value.id.trim() ? value.id.trim() : fallbackId,
  name: typeof value.name === 'string' && value.name.trim() ? value.name : fallbackId,
  width: positiveInt(value.width, 6),
  cellSize: Math.max(0.01, numberOr(value.cellSize, 2.5)),
  rowSpacing: Math.max(0.01, numberOr(value.rowSpacing, 4)),
  monsters: Array.isArray(value.monsters) ? value.monsters.map((monster, index) => ({
    id: typeof monster.id === 'string' && monster.id ? monster.id : `${fallbackId}_${index}`,
    monsterConfigKey: typeof monster.monsterConfigKey === 'string' ? monster.monsterConfigKey : '',
    monsterStripePresetKey: typeof monster.monsterStripePresetKey === 'string' ? monster.monsterStripePresetKey : '',
    chaos: monster.chaos ?? { value: 0, threshold: 100, duration: 0 },
    position: {
      row: indexInt(monster.position?.row ?? monster.row),
      column: indexInt(monster.position?.column ?? monster.column, index),
      size: positiveInt(monster.position?.size ?? monster.slots),
      isOccupyingFullRowCentered: Boolean(monster.position?.isOccupyingFullRowCentered ?? monster.positionMode === 'center')
    }
  })) : []
});

const fetchJson = async (url: string) => {
  return loadConfigFromUrl(url);
};

const loadRules = async (): Promise<Record<string, BattlefieldStripeRuleConfig>> => {
  try {
    const response = await requestDevServer(`${RULE_API_PATH}?t=${Date.now()}`, { method: 'GET' });
    const payload = await response.json();
    if (!response.ok || payload.success === false) throw new Error(payload.message || `HTTP ${response.status}`);
    const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
    return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, normalizeDistanceStripeRuleConfig(key, value as Partial<BattlefieldStripeRuleConfig>)]));
  } catch {
    const data = await fetchJson(RULE_CONFIG_URL);
    return Object.fromEntries(Object.entries(data && typeof data === 'object' ? data : {}).map(([key, value]) => [key, normalizeDistanceStripeRuleConfig(key, value as Partial<BattlefieldStripeRuleConfig>)]));
  }
};

type CommitNumberInputProps = { value: number; onCommit: (value: number) => void; min?: number; step?: number; disabled?: boolean };
const CommitNumberInput: React.FC<CommitNumberInputProps> = ({ value, onCommit, min, step, disabled }) => {
  const [draft, setDraft] = useState(String(value));
  const editing = useRef(false);
  useEffect(() => { if (!editing.current) setDraft(String(value)); }, [value]);
  const commit = () => {
    editing.current = false;
    const parsed = Number(draft);
    if (draft.trim() !== '' && Number.isFinite(parsed)) onCommit(parsed);
    else setDraft(String(value));
  };
  return <input disabled={disabled} type="number" min={min} step={step} value={draft} onFocus={() => { editing.current = true; }} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(String(value)); event.currentTarget.blur(); } }} />;
};

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const visualManagerRef = useRef<MonsterVisualManager | null>(null);
  const [configs, setConfigs] = useState<MonsterDisplayConfigLibrary>({});
  const [monsterStripes, setMonsterStripes] = useState<MonsterStripePresetLibrary>({});
  const [stripes, setStripes] = useState<StripePresetLibrary>({});
  const [battlefields, setBattlefields] = useState<Record<string, Battlefield>>({});
  const [placements, setPlacements] = useState<Record<string, MonsterPlacement[]>>({});
  const [rulesByBattlefield, setRulesByBattlefield] = useState<Record<string, BattlefieldStripeRuleConfig>>({});
  const [activeId, setActiveId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [message, setMessage] = useState('正在加载配置...');

  const sourceBattlefield = battlefields[activeId];
  const battlefield = useMemo(() => sourceBattlefield ? { ...sourceBattlefield, monsters: placements[activeId] || sourceBattlefield.monsters } : null, [sourceBattlefield, placements, activeId]);
  const activeRules = rulesByBattlefield[activeId] || (activeId ? normalizeDistanceStripeRuleConfig(activeId) : null);
  const selected = battlefield?.monsters.find(monster => monster.id === selectedId);

  useEffect(() => {
    Promise.all([fetchJson(MONSTER_CONFIG_URL), fetchJson(MONSTER_STRIPE_PRESET_URL), fetchJson(STRIPE_PRESET_URL), fetchJson(FORMATION_CONFIG_URL), loadRules()]).then(([rawConfigs, rawMonsterStripes, rawStripes, rawBattlefields, savedRules]) => {
      const library = normalizeMonsterConfigLibrary(rawConfigs);
      const normalizedBattlefields = Object.fromEntries(Object.entries(rawBattlefields && typeof rawBattlefields === 'object' ? rawBattlefields : {}).map(([key, value]) => [key, normalizeBattlefield(value as Partial<Battlefield>, key)]));
      setConfigs(library);
      setMonsterStripes(normalizeMonsterStripePresetLibrary(rawMonsterStripes));
      setStripes(normalizeStripePresetLibrary(rawStripes));
      setBattlefields(normalizedBattlefields);
      setRulesByBattlefield(() => {
        let draft: Record<string, BattlefieldStripeRuleConfig> = {};
        try { draft = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { draft = {}; }
        const next: Record<string, BattlefieldStripeRuleConfig> = {};
        Object.keys(normalizedBattlefields).forEach(id => { next[id] = normalizeDistanceStripeRuleConfig(id, draft[id] || savedRules[id]); });
        return next;
      });
      setPlacements(Object.fromEntries(Object.entries(normalizedBattlefields).map(([id, field]) => [id, field.monsters.map(monster => ({ ...monster, monsterStripePresetKey: monster.monsterStripePresetKey || library[monster.monsterConfigKey]?.monsterStripePresetKey || '' }))])));
      setActiveId(Object.keys(normalizedBattlefields)[0] || '');
      setMessage(`已加载 ${Object.keys(normalizedBattlefields).length} 个现成战场配置。战场参数只读，怪物位置为本 Lab 的可编辑预览配置。`);
    }).catch(error => setMessage(`加载失败：${String(error)}`));
  }, []);

  useEffect(() => {
    if (battlefield && !battlefield.monsters.some(monster => monster.id === selectedId)) setSelectedId(battlefield.monsters[0]?.id || '');
  }, [battlefield, selectedId]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rulesByBattlefield)); } catch {}
  }, [rulesByBattlefield]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const context = createCameraLabScene(canvas);
    context.camera.target.set(0, -1, -8);
    context.camera.radius = 34;
    const camera = createCameraLabController(context.camera);
    const panel = createFloatingCameraControlPanel(stage, camera);
    visualManagerRef.current = new MonsterVisualManager(context.scene);
    const drag = { active: false, pointerId: -1, x: 0, y: 0 };
    const pointerDown = (event: PointerEvent) => { if (event.button !== 0) return; if (camera.state.lookControlMode === 'pointerLock') { canvas.requestPointerLock?.().catch?.(() => {}); return; } drag.active = true; drag.pointerId = event.pointerId; drag.x = event.clientX; drag.y = event.clientY; canvas.style.cursor = 'grabbing'; canvas.setPointerCapture(event.pointerId); };
    const pointerMove = (event: PointerEvent) => { if (!drag.active || event.pointerId !== drag.pointerId) return; camera.handlePointerDelta(event.clientX - drag.x, event.clientY - drag.y); drag.x = event.clientX; drag.y = event.clientY; panel.syncFromController(); };
    const pointerEnd = (event: PointerEvent) => { if (!drag.active || event.pointerId !== drag.pointerId) return; drag.active = false; drag.pointerId = -1; canvas.style.cursor = 'grab'; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); };
    const lockedMove = (event: MouseEvent) => { if (document.pointerLockElement === canvas) camera.handlePointerDelta(event.movementX || 0, event.movementY || 0); };
    const lockChange = () => { canvas.style.cursor = document.pointerLockElement === canvas ? 'none' : 'grab'; };
    const keyDown = (event: KeyboardEvent) => { if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement || !['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(event.code)) return; camera.keys.add(event.code); event.preventDefault(); };
    const keyUp = (event: KeyboardEvent) => camera.keys.delete(event.code);
    const wheel = (event: WheelEvent) => { if (camera.state.mode !== 'orbit') return; event.preventDefault(); camera.handleWheel(event.deltaY); panel.syncFromController(); };
    const resize = () => context.engine.resize();
    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerEnd);
    canvas.addEventListener('pointercancel', pointerEnd);
    canvas.addEventListener('wheel', wheel, { passive: false });
    document.addEventListener('mousemove', lockedMove);
    document.addEventListener('pointerlockchange', lockChange);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('resize', resize);
    context.engine.runRenderLoop(() => { const dt = context.engine.getDeltaTime() / 1000; camera.update(dt); panel.updateStatus(); visualManagerRef.current?.update(dt); context.scene.render(); });
    return () => {
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerEnd);
      canvas.removeEventListener('pointercancel', pointerEnd);
      canvas.removeEventListener('wheel', wheel);
      document.removeEventListener('mousemove', lockedMove);
      document.removeEventListener('pointerlockchange', lockChange);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('resize', resize);
      visualManagerRef.current?.dispose();
      visualManagerRef.current = null;
      panel.dispose();
      context.dispose();
    };
  }, []);

  useEffect(() => {
    if (!battlefield || !activeRules) return;
    visualManagerRef.current?.sync(battlefield, { configs, monsterStripes, stripes }, selectedId, activeRules);
  }, [battlefield, configs, monsterStripes, stripes, selectedId, activeRules]);

  const patchPlacements = (next: MonsterPlacement[]) => activeId && setPlacements(all => ({ ...all, [activeId]: next }));
  const patchMonster = (patch: Partial<MonsterPlacement>) => selected && battlefield && patchPlacements(battlefield.monsters.map(monster => monster.id === selected.id ? { ...monster, ...patch } : monster));
  const patchRules = (patch: Partial<BattlefieldStripeRuleConfig>) => activeRules && setRulesByBattlefield(all => ({ ...all, [activeId]: { ...activeRules, ...patch } }));
  const patchRule = (id: string, patch: Partial<StripeRule>) => activeRules && patchRules({ rules: activeRules.rules.map(rule => rule.id === id ? { ...rule, ...patch } : rule).sort((a, b) => a.startRow - b.startRow) });
  const addMonster = () => {
    const key = Object.keys(configs)[0];
    if (!battlefield || !key) return;
    const monster: MonsterPlacement = { id: uid('monster'), monsterConfigKey: key, monsterStripePresetKey: configs[key]?.monsterStripePresetKey || '', chaos: { value: 0, threshold: 100, duration: 0 }, position: { row: 0, column: 0, size: 1, isOccupyingFullRowCentered: false } };
    patchPlacements([...battlefield.monsters, monster]);
    setSelectedId(monster.id);
  };
  const addRule = () => {
    if (!activeRules) return;
    const firstStripeKey = Object.keys(monsterStripes)[0] || '';
    patchRules({ rules: [...activeRules.rules, { id: uid('rule'), startRow: Math.max(1, ...activeRules.rules.map(rule => rule.startRow + 1)), monsterStripePresetKey: firstStripeKey }].sort((a, b) => a.startRow - b.startRow) });
  };
  const resetPlacements = () => sourceBattlefield && setPlacements(all => ({ ...all, [sourceBattlefield.id]: sourceBattlefield.monsters.map(monster => ({ ...monster })) }));
  const save = async () => {
    try {
      const payload = Object.fromEntries(Object.entries(rulesByBattlefield).map(([id, config]) => [id, normalizeDistanceStripeRuleConfig(id, config)]));
      const response = await requestDevServer(RULE_API_PATH, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok || result.success === false) throw new Error(result.errors?.[0] || result.message || `HTTP ${response.status}`);
      localStorage.removeItem(STORAGE_KEY);
      setMessage(`已保存 ${Object.keys(payload).length} 个战场条纹距离规则到 config/monsterBattlefieldStripeRules.json。`);
    } catch (error) {
      setMessage(`保存失败：${String(error)}`);
    }
  };

  return <div style={{ height: '100vh', padding: 14, display: 'grid', gridTemplateColumns: '430px minmax(0,1fr)', gap: 14 }}>
    <aside style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><h2 style={{ margin: '0 0 5px' }}>战场条纹距离规则 Lab</h2><div style={{ color: '#8291a8', fontSize: 12 }}>使用现成战场配置；怪物位置可在本 Lab 里调整预览；怪物显示条纹由行数规则自动赋予。</div></div>
      <section style={section}>
        <label>现成战场配置（只读）</label>
        <select value={activeId} onChange={event => setActiveId(event.target.value)}>{Object.values(battlefields).map(item => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select>
        {battlefield && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, marginTop: 8, color: '#aab7ca', fontSize: 12 }}>
          <div>宽度：{battlefield.width} 格</div><div>格宽：{battlefield.cellSize}</div><div>行距：{battlefield.rowSpacing}</div>
        </div>}
      </section>
      <section style={section}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><strong>距离条纹规则</strong><button onClick={addRule}>添加规则</button></div>
        <label>规则名称</label>
        <input value={activeRules?.name || ''} onChange={event => patchRules({ name: event.target.value })} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>{activeRules?.rules.map(rule => <div key={rule.id} style={{ border: '1px solid #2d3a50', borderRadius: 8, padding: 9, background: '#111925' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(0,1fr) 58px', gap: 7, alignItems: 'end' }}>
            <div><label>从第几行</label><CommitNumberInput min={1} step={1} value={rule.startRow} onCommit={value => patchRule(rule.id, { startRow: positiveInt(value) })} /></div>
            <div><label>使用怪物条纹预设</label><select value={rule.monsterStripePresetKey} onChange={event => patchRule(rule.id, { monsterStripePresetKey: event.target.value })}>{Object.entries(monsterStripes).map(([key, preset]) => <option key={key} value={key}>{preset.name || key} · {key}</option>)}</select></div>
            <button onClick={() => patchRules({ rules: activeRules.rules.filter(item => item.id !== rule.id) })}>删除</button>
          </div>
        </div>)}</div>
      </section>
      <section style={section}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><strong>怪物位置预览</strong><button onClick={addMonster}>添加怪物</button></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 8 }}><button onClick={resetPlacements}>还原为战场默认怪物</button><button onClick={() => patchPlacements([])}>清空预览怪物</button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 9 }}>{battlefield?.monsters.map((item, index) => {
          const effective = resolveDistanceStripePresetKey(activeRules?.rules || [], item.position.row, item.monsterStripePresetKey || configs[item.monsterConfigKey]?.monsterStripePresetKey || '');
          return <button key={item.id} onClick={() => setSelectedId(item.id)} style={{ textAlign: 'left', borderColor: item.id === selectedId ? '#65a8ff' : '#3a4961', background: item.id === selectedId ? '#183b61' : '#202b3d' }}>{index + 1}. {configs[item.monsterConfigKey]?.name || item.monsterConfigKey} · 第 {item.position.row + 1} 行 · {effective}</button>;
        })}</div>
      </section>
      {selected && <section style={section}>
        <label>怪物视觉配置</label>
        <select value={selected.monsterConfigKey} onChange={event => { const key = event.target.value; patchMonster({ monsterConfigKey: key, monsterStripePresetKey: configs[key]?.monsterStripePresetKey || '' }); }}>{Object.entries(configs).map(([key, config]) => <option key={key} value={key}>{config.name || key} · {key}</option>)}</select>
        <label>战场默认条纹（只读，规则会覆盖它）</label>
        <input value={selected.monsterStripePresetKey || configs[selected.monsterConfigKey]?.monsterStripePresetKey || ''} disabled />
        <label>规则实际赋予条纹</label>
        <input value={resolveDistanceStripePresetKey(activeRules?.rules || [], selected.position.row, selected.monsterStripePresetKey || configs[selected.monsterConfigKey]?.monsterStripePresetKey || '')} disabled />
        <label><input type="checkbox" style={{width:'auto',marginRight:7}} checked={selected.position.isOccupyingFullRowCentered} onChange={event => patchMonster({ position: { ...selected.position, isOccupyingFullRowCentered: event.target.checked } })}/>占领该行全部格子并居中</label>
        <label>所在行（从 1 开始）</label>
        <CommitNumberInput min={1} step={1} value={selected.position.row + 1} onCommit={value => patchMonster({ position: { ...selected.position, row: indexInt(value - 1) } })} />
        {!selected.position.isOccupyingFullRowCentered && <><label>占用格数</label><CommitNumberInput min={1} step={1} value={selected.position.size} onCommit={value => patchMonster({ position: { ...selected.position, size: positiveInt(value) } })} /><label>所在列（从 1 开始）</label><CommitNumberInput min={1} step={1} value={selected.position.column + 1} onCommit={value => patchMonster({ position: { ...selected.position, column: indexInt(value - 1) } })} /></>}
        <button style={{ width: '100%', marginTop: 10 }} onClick={() => battlefield && patchPlacements(battlefield.monsters.filter(monster => monster.id !== selected.id))}>删除此怪物</button>
      </section>}
      <section style={section}><button style={{ width: '100%' }} onClick={() => void save()}>保存条纹距离规则</button><div style={{ marginTop: 8, color: '#9dacbf', fontSize: 12, lineHeight: 1.5 }}>{message}</div></section>
    </aside>
    <main ref={stageRef} style={{ minWidth: 0, position: 'relative', border: '1px solid #273348', borderRadius: 8, overflow: 'hidden', background: '#080d14' }}><canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} /><div style={{ position: 'absolute', left: 12, bottom: 10, color: '#c1cede', fontSize: 12, pointerEvents: 'none' }}>条纹由“从第 N 行开始”的规则自动决定 · 战场配置只读</div></main>
  </div>;
};

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
