import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadConfigFromUrl } from '@/core/config';
import { Vector3 } from '@babylonjs/core';
import { createCameraLabController } from '@/core/camera/cameraLabController.ts';
import { createCameraLabScene } from '@/core/scene/createCameraLabScene.ts';
import { createFloatingCameraControlPanel } from '@/core/ui/FloatingCameraControlPanel.ts';
import { MONSTER_CONFIG_URL, MONSTER_STRIPE_PRESET_URL, STRIPE_PRESET_URL, createDefaultMonsterSpecialStatusEntry, createDefaultMonsterSpecialStatusPositions, MonsterVisualManager, normalizeMonsterConfigLibrary, normalizeMonsterSpecialStatusPositions, normalizeMonsterStripePresetLibrary, normalizeStripePresetLibrary, type MonsterDisplayConfigLibrary, type MonsterSpecialStatusPositionConfig, type MonsterSpecialStatusRowAnchorMode, type MonsterStripePresetLibrary, type StripePresetLibrary } from '@/core/monster';
import { loadNumberSpritePresets, type NumberSpritePresetMap } from '@/core/sprite';
import { SPECIAL_STATUS_VISUAL_PRESET_CONFIG_URL, normalizeSpecialStatusVisualPresets, type SpecialStatus3dValues, type SpecialStatus3dVisibility, type SpecialStatusVisualPresetMap } from '@/core/special-status';
import { getResolvedDevServerPort, requestDevServer } from '@/core/network/devServerPortResolver.ts';
type Vec3 = [
    number,
    number,
    number
];
type StatusItem = {
    id: string;
    presetKey: string;
    statusId: string;
    values: SpecialStatus3dValues;
    visible: SpecialStatus3dVisibility;
};
const section: React.CSSProperties = { padding: 10, border: '1px solid #273348', borderRadius: 9, background: '#151d29' };
const fetchJson = (url: string) => loadConfigFromUrl(url);
const vec = (value: Vec3): Vec3 => [...value];
const POSITION_API_PATH = '/api/monster-special-status-positions';
const PREVIEW_MONSTER_ID = 'monster-special-status-position-preview';
const PREVIEW_BATTLEFIELD_ID = 'monster-special-status-position-preview-field';
export const MonsterSpecialStatusPositionLab: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null), stageRef = useRef<HTMLElement>(null);
    const visualManagerRef = useRef<MonsterVisualManager | null>(null);
    const [monsters, setMonsters] = useState<MonsterDisplayConfigLibrary>({}), [monsterStripes, setMonsterStripes] = useState<MonsterStripePresetLibrary>({}), [stripes, setStripes] = useState<StripePresetLibrary>({});
    const [visuals, setVisuals] = useState<SpecialStatusVisualPresetMap>({}), [numbers, setNumbers] = useState<NumberSpritePresetMap>({});
    const [monsterKey, setMonsterKey] = useState(''), [stripeKey, setStripeKey] = useState(''), [monsterOffset, setMonsterOffset] = useState<Vec3>([0, 0, 0]);
    const [statusSpacing, setStatusSpacing] = useState<Vec3>([3, 0, 0]);
    const [statusGroupOffset, setStatusGroupOffset] = useState<Vec3>([0, 0, 0]);
    const [statusGroupScale, setStatusGroupScale] = useState(1);
    const [statusWrapCount, setStatusWrapCount] = useState(4);
    const [statusRowAnchorMode, setStatusRowAnchorMode] = useState<MonsterSpecialStatusRowAnchorMode>('center');
    const [faceCamera, setFaceCamera] = useState(false);
    const [spriteDebugVisible, setSpriteDebugVisible] = useState(false);
    const [spriteFacingAxis, setSpriteFacingAxis] = useState<'+Z' | '-Z'>('+Z');
    const [savedConfig, setSavedConfig] = useState<MonsterSpecialStatusPositionConfig>(createDefaultMonsterSpecialStatusPositions);
    const savedConfigRef = useRef(savedConfig), previousMonsterKeyRef = useRef('');
    const [serverPort, setServerPort] = useState<number | null>(null);
    const [items, setItems] = useState<StatusItem[]>([]), [selectedId, setSelectedId] = useState(''), [message, setMessage] = useState('正在加载配置…');
    const selected = items.find((item) => item.id === selectedId) ?? null;
    const statusDefinitions = useMemo(() => Object.values(visuals).flatMap(preset => Object.values(preset.statuses).map(status => ({ ...status, presetKey: preset.presetKey }))), [visuals]);
    useEffect(() => {
        void (async () => {
            try {
                const [a, b, c, d, e] = await Promise.all([fetchJson(MONSTER_CONFIG_URL), fetchJson(MONSTER_STRIPE_PRESET_URL), fetchJson(STRIPE_PRESET_URL), fetchJson(SPECIAL_STATUS_VISUAL_PRESET_CONFIG_URL), loadNumberSpritePresets(true)]);
                const ml = normalizeMonsterConfigLibrary(a), ms = normalizeMonsterStripePresetLibrary(b), vl = normalizeSpecialStatusVisualPresets(d);
                const mk = Object.keys(ml)[0] ?? '', vk = Object.keys(vl)[0] ?? '';
                setMonsters(ml);
                setMonsterStripes(ms);
                setStripes(normalizeStripePresetLibrary(c));
                setVisuals(vl);
                setNumbers(e);
                setMonsterKey(mk);
                const preferred = ml[mk]?.monsterStripePresetKey;
                setStripeKey(ms[preferred] ? preferred : Object.keys(ms)[0] ?? '');
                if (vk) {
                    const firstDefinition = Object.values(vl[vk]?.statuses ?? {})[0];
                    const first: StatusItem = { id: 'status_1', presetKey: vk, statusId: firstDefinition?.id ?? '', values: [89, 42, 17, 64], visible: [true, true, true, true] };
                    setItems([first]);
                    setSelectedId(first.id);
                }
                setMessage(`已加载 ${Object.keys(ml).length} 个怪物、${Object.keys(vl).length} 个特殊状态视觉预设。`);
            }
            catch (error) {
                setMessage(`加载失败：${String(error)}`);
            }
        })();
    }, []);
    useEffect(() => {
        void (async () => {
            try {
                let loaded: MonsterSpecialStatusPositionConfig;
                try {
                    const response = await requestDevServer(`${POSITION_API_PATH}?t=${Date.now()}`, { method: 'GET' });
                    const payload = await response.json();
                    if (!response.ok || payload.success === false)
                        throw new Error(payload.message || `HTTP ${response.status}`);
                    loaded = normalizeMonsterSpecialStatusPositions(payload.data);
                    setServerPort(getResolvedDevServerPort());
                }
                catch {
                    loaded = normalizeMonsterSpecialStatusPositions(await fetchJson('/config/monsterSpecialStatusPositions.json'));
                    setServerPort(null);
                }
                savedConfigRef.current = loaded;
                setSavedConfig(loaded);
                setSpriteFacingAxis(loaded.global.spriteFacingAxis);
                setStatusGroupScale(loaded.global.statusGroupScale);
                setStatusSpacing(vec(loaded.global.statusSpacing));
                const key = previousMonsterKeyRef.current || monsterKey;
                if (key) {
                    const entry = loaded.monsters[key] ?? createDefaultMonsterSpecialStatusEntry(key);
                    setStatusWrapCount(entry.statusWrapCount);
                    setStatusGroupOffset(vec(entry.statusGroupOffset));
                    setStatusRowAnchorMode(entry.statusRowAnchorMode);
                }
            }
            catch (error) {
                setMessage(`加载特殊状态位置配置失败：${String(error)}`);
            }
        })();
    }, []);
    useEffect(() => {
        const presetKey = savedConfig.global.visualPresetKey;
        const preset = visuals[presetKey];
        if (!preset)
            return;
        const firstStatusId = Object.keys(preset.statuses)[0] ?? '';
        setItems(current => current.map(item => ({
            ...item,
            presetKey,
            statusId: preset.statuses[item.statusId] ? item.statusId : firstStatusId
        })));
    }, [visuals, savedConfig.global.visualPresetKey]);
    useEffect(() => {
        if (!monsterKey)
            return;
        const previousKey = previousMonsterKeyRef.current;
        if (previousKey && previousKey !== monsterKey) {
            const next = { ...savedConfigRef.current, monsters: { ...savedConfigRef.current.monsters,
                    [previousKey]: { monsterConfigKey: previousKey, statusWrapCount, statusGroupOffset: vec(statusGroupOffset), statusRowAnchorMode }
                } };
            savedConfigRef.current = next;
            setSavedConfig(next);
        }
        if (previousKey !== monsterKey) {
            const entry = savedConfigRef.current.monsters[monsterKey] ?? createDefaultMonsterSpecialStatusEntry(monsterKey);
            setStatusWrapCount(entry.statusWrapCount);
            setStatusGroupOffset(vec(entry.statusGroupOffset));
            setStatusRowAnchorMode(entry.statusRowAnchorMode);
            previousMonsterKeyRef.current = monsterKey;
        }
    }, [monsterKey]);
    useEffect(() => {
        const canvas = canvasRef.current, stage = stageRef.current;
        if (!canvas || !stage)
            return;
        const context = createCameraLabScene(canvas), camera = createCameraLabController(context.camera), cameraPanel = createFloatingCameraControlPanel(stage, camera);
        const visualManager = new MonsterVisualManager(context.scene);
        visualManager.setHelpersVisible(false);
        visualManagerRef.current = visualManager;
        const drag = { active: false, id: -1, x: 0, y: 0 };
        const down = (e: PointerEvent) => { if (e.button !== 0)
            return; if (camera.state.lookControlMode === 'pointerLock') {
            void canvas.requestPointerLock?.();
            return;
        } drag.active = true; drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY; canvas.style.cursor = 'grabbing'; canvas.setPointerCapture(e.pointerId); };
        const move = (e: PointerEvent) => { if (!drag.active || drag.id !== e.pointerId)
            return; camera.handlePointerDelta(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; cameraPanel.syncFromController(); };
        const up = (e: PointerEvent) => { if (!drag.active || drag.id !== e.pointerId)
            return; drag.active = false; canvas.style.cursor = 'grab'; if (canvas.hasPointerCapture(e.pointerId))
            canvas.releasePointerCapture(e.pointerId); };
        const docMove = (e: MouseEvent) => { if (document.pointerLockElement === canvas)
            camera.handlePointerDelta(e.movementX, e.movementY); }, lock = () => { canvas.style.cursor = document.pointerLockElement === canvas ? 'none' : 'grab'; };
        const kd = (e: KeyboardEvent) => { if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement)
            return; if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(e.code))
            return; camera.keys.add(e.code); e.preventDefault(); }, ku = (e: KeyboardEvent) => camera.keys.delete(e.code);
        const wheel = (e: WheelEvent) => { if (camera.state.mode !== 'orbit')
            return; e.preventDefault(); camera.handleWheel(e.deltaY); cameraPanel.syncFromController(); }, resize = () => context.engine.resize();
        canvas.style.cursor = 'grab';
        canvas.addEventListener('pointerdown', down);
        canvas.addEventListener('pointermove', move);
        canvas.addEventListener('pointerup', up);
        canvas.addEventListener('pointercancel', up);
        canvas.addEventListener('wheel', wheel, { passive: false });
        document.addEventListener('mousemove', docMove);
        document.addEventListener('pointerlockchange', lock);
        window.addEventListener('keydown', kd);
        window.addEventListener('keyup', ku);
        window.addEventListener('resize', resize);
        context.engine.runRenderLoop(() => { const dt = context.engine.getDeltaTime() / 1000; camera.update(dt); cameraPanel.updateStatus(); visualManager.update(dt); context.scene.render(); });
        return () => { canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('wheel', wheel); document.removeEventListener('mousemove', docMove); document.removeEventListener('pointerlockchange', lock); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('resize', resize); visualManager.dispose(); visualManagerRef.current = null; cameraPanel.dispose(); context.dispose(); };
    }, []);
    useEffect(() => { const manager = visualManagerRef.current, config = monsters[monsterKey]; if (!manager || !config)
        return; manager.sync({ id: PREVIEW_BATTLEFIELD_ID, name: 'Special Status Position Preview', width: 1, cellSize: 1, rowSpacing: 1, monsters: [{ id: PREVIEW_MONSTER_ID, typeId: monsterKey, monsterConfigKey: monsterKey, monsterStripePresetKey: stripeKey, position: { row: 0, column: 0, size: 1, isOccupyingFullRowCentered: true }, chaos: { value: 0, threshold: 100, duration: 0 } }] }, { configs: monsters, monsterStripes, stripes }, PREVIEW_MONSTER_ID); manager.setMonsterInstanceOffset(PREVIEW_MONSTER_ID, new Vector3(...monsterOffset)); }, [monsters, monsterStripes, stripes, monsterKey, stripeKey, monsterOffset]);
    useEffect(() => {
        const manager = visualManagerRef.current;
        if (!manager)
            return;
        void manager.syncMonsterSpecialStatuses(PREVIEW_MONSTER_ID, items, {
            visualPresets: visuals,
            numberPresets: numbers
        }, {
            spacing: statusSpacing,
            groupOffset: statusGroupOffset,
            groupScale: statusGroupScale,
            wrapCount: statusWrapCount,
            rowAnchorMode: statusRowAnchorMode,
            billboard: faceCamera,
            debugVisible: spriteDebugVisible,
            facingAxis: spriteFacingAxis
        }).catch(error => setMessage(`更新失败：${String(error)}`));
    }, [items, visuals, numbers, monsterKey, stripeKey, monsterOffset, statusSpacing, statusGroupOffset, statusGroupScale, statusWrapCount, statusRowAnchorMode, faceCamera, spriteDebugVisible, spriteFacingAxis, monsters]);
    const savePositionConfig = async () => {
        if (!monsterKey)
            return;
        const complete = normalizeMonsterSpecialStatusPositions({
            global: {
                spriteFacingAxis,
                statusGroupScale,
                statusSpacing: vec(statusSpacing),
                visualPresetKey: selected?.presetKey ?? savedConfig.global.visualPresetKey
            },
            monsters: {
                ...savedConfigRef.current.monsters,
                [monsterKey]: { monsterConfigKey: monsterKey, statusWrapCount, statusGroupOffset: vec(statusGroupOffset), statusRowAnchorMode }
            }
        });
        try {
            const response = await requestDevServer(POSITION_API_PATH, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(complete) });
            const payload = await response.json();
            if (!response.ok || payload.success === false)
                throw new Error(payload.errors?.[0] || payload.message || `HTTP ${response.status}`);
            savedConfigRef.current = complete;
            setSavedConfig(complete);
            setServerPort(getResolvedDevServerPort());
            setMessage('已保存整体特殊状态配置和全部怪物独有的位置配置。');
        }
        catch (error) {
            setMessage(`保存特殊状态位置配置失败：${String(error)}`);
        }
    };
    const update = (fn: (item: StatusItem) => StatusItem) => setItems(current => { const selectedItem = current.find(item => item.id === selectedId); if (!selectedItem)
        return current; const next = fn(selectedItem); return current.map(item => item.id === selectedId ? next : item); });
    const add = () => { const definition = statusDefinitions[0]; if (!definition)
        return; const id = `status_${Date.now().toString(36)}`, item: StatusItem = { id, presetKey: definition.presetKey, statusId: definition.id, values: [0, 0, 0, 0], visible: [true, true, true, true] }; setItems(current => [...current, item]); setSelectedId(id); };
    const copySelected = () => { if (!selected)
        return; const id = `status_${Date.now().toString(36)}`, copy: StatusItem = { ...selected, id, values: [...selected.values] as SpecialStatus3dValues, visible: [...selected.visible] as SpecialStatus3dVisibility }; setItems(current => [...current, copy]); setSelectedId(id); };
    const remove = () => { if (!selected)
        return; const remaining = items.filter(item => item.id !== selected.id); setItems(remaining); setSelectedId(remaining[0]?.id ?? ''); };
    const axis = (source: Vec3, index: number, value: number) => { const next = vec(source); next[index] = value; return next; }, labels = ['左上', '右上', '左下', '右下'];
    return <div style={{ height: '100vh', padding: 12, display: 'grid', gridTemplateColumns: '440px minmax(0,1fr)', gap: 12 }}>
        <aside style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div><h2 style={{ margin: 0 }}>怪物 × 多特殊状态位置 Lab</h2><small style={{ color: '#8291a8' }}>整体配置、怪物独有配置与临时测试参数已分区。</small></div>

            <section style={section}>
                <h3 style={{ margin: '0 0 9px' }}>场景怪物（仅测试）</h3>
                <label>怪物显示配置</label>
                <select value={monsterKey} onChange={e => { const key = e.target.value; setMonsterKey(key); const preferred = monsters[key]?.monsterStripePresetKey; if (monsterStripes[preferred]) setStripeKey(preferred); }}>{Object.entries(monsters).map(([key, item]) => <option key={key} value={key}>{key} · {item.name}</option>)}</select>
                <label>怪物条纹配置</label>
                <select value={stripeKey} onChange={e => setStripeKey(e.target.value)}>{Object.entries(monsterStripes).map(([key, item]) => <option key={key} value={key}>{key} · {item.name}</option>)}</select>
                <label>怪物位置偏移 XYZ（不保存）</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>{['X', 'Y', 'Z'].map((a, i) => <input key={a} aria-label={`怪物${a}`} type="number" step="0.1" value={monsterOffset[i]} onChange={e => setMonsterOffset(axis(monsterOffset, i, Number(e.target.value)))}/>)}</div>
            </section>

            <section style={{ ...section, borderColor: '#3c628f', background: '#162235' }}>
                <h3 style={{ margin: '0 0 4px' }}>整体特殊状态配置</h3>
                <small style={{ color: '#8fa9ca' }}>对所有怪物、所有特殊状态统一生效</small>
                <label>特殊状态精灵面向轴</label>
                <select value={spriteFacingAxis} onChange={e => setSpriteFacingAxis(e.target.value === '-Z' ? '-Z' : '+Z')}><option value="+Z">+Z（朝向正 Z）</option><option value="-Z">-Z（朝向负 Z）</option></select>
                <label>特殊状态整体缩放</label>
                <input type="number" min="0.01" step="0.1" value={statusGroupScale} onChange={e => setStatusGroupScale(Number(e.target.value))}/>
                <label>特殊状态排列间距 XYZ</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>{['X', 'Y', 'Z'].map((a, i) => <input key={a} aria-label={`状态间距${a}`} type="number" step="0.1" value={statusSpacing[i]} onChange={e => setStatusSpacing(axis(statusSpacing, i, Number(e.target.value)))}/>)}</div>
                <label>视觉预设（整体）</label>
                <select value={selected?.presetKey ?? savedConfig.global.visualPresetKey} onChange={e => { const presetKey = e.target.value, firstStatusId = Object.keys(visuals[presetKey]?.statuses ?? {})[0] ?? ''; setItems(current => current.map(item => ({ ...item, presetKey, statusId: visuals[presetKey]?.statuses[item.statusId] ? item.statusId : firstStatusId }))); }}>{Object.entries(visuals).map(([key, item]) => <option key={key} value={key}>{key} · {item.name}</option>)}</select>
                <label style={{ display: 'flex', gap: 7, alignItems: 'center' }}><input style={{ width: 'auto' }} type="checkbox" checked={faceCamera} onChange={e => setFaceCamera(e.target.checked)}/>面向摄像机（仅测试，不保存）</label>
                <label style={{ display: 'flex', gap: 7, alignItems: 'center' }}><input aria-label="core sprite debug" style={{ width: 'auto' }} type="checkbox" checked={spriteDebugVisible} onChange={e => setSpriteDebugVisible(e.target.checked)}/>Core Sprite Debug（仅测试，不保存）</label>
            </section>

            <section style={{ ...section, borderColor: '#785d38', background: '#211d18' }}>
                <h3 style={{ margin: '0 0 4px' }}>当前怪物独有配置</h3>
                <small style={{ color: '#c2a77f' }}>{monsterKey || '未选择怪物'}</small>
                <label>每行特殊状态数量（超过后换行）</label>
                <input type="number" min="1" step="1" value={statusWrapCount} onChange={e => setStatusWrapCount(Math.max(1, Math.floor(Number(e.target.value) || 1)))}/>
                <label>换行锚定方式</label>
                <select value={statusRowAnchorMode} onChange={e => setStatusRowAnchorMode(e.target.value as MonsterSpecialStatusRowAnchorMode)}><option value="center">整体居中（现有）</option><option value="first-row-up">固定第一行，向上扩展</option><option value="first-row-down">固定第一行，向下扩展</option></select>
                <label>整体特殊状态相对怪物附加偏移 XYZ</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>{['X', 'Y', 'Z'].map((a, i) => <input key={a} aria-label={`状态整体偏移${a}`} type="number" step="0.1" value={statusGroupOffset[i]} onChange={e => setStatusGroupOffset(axis(statusGroupOffset, i, Number(e.target.value)))}/>)}</div>
            </section>

            <section style={section}>
                <h3 style={{ margin: '0 0 9px' }}>单个特殊状态测试参数（不保存）</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 6 }}><select value={selectedId} onChange={e => setSelectedId(e.target.value)}>{items.map((item, i) => <option key={item.id} value={item.id}>特殊状态 {i + 1}</option>)}</select><button onClick={add}>添加</button><button onClick={copySelected}>复制</button><button onClick={remove}>删除</button></div>
                {selected ? <><label>特殊状态视觉配置</label><select value={`${selected.presetKey}:${selected.statusId}`} onChange={e => { const [presetKey, statusId] = e.target.value.split(':'); update(item => ({ ...item, presetKey, statusId })); }}>{statusDefinitions.map(status => <option key={`${status.presetKey}:${status.id}`} value={`${status.presetKey}:${status.id}`}>{status.id} · {status.name}</option>)}</select><small style={{ color: '#8190a6' }}>{visuals[selected.presetKey]?.statuses[selected.statusId]?.imagePath || '未配置图片'}</small>{labels.map((label, i) => <div key={label} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 62px', gap: 6, alignItems: 'end' }}><label>{label}</label><input type="number" value={selected.values[i]} onChange={e => update(item => { const values = [...item.values] as SpecialStatus3dValues; values[i] = Number(e.target.value); return { ...item, values }; })}/><label style={{ display: 'flex', alignItems: 'center', gap: 4 }}><input style={{ width: 'auto' }} type="checkbox" checked={selected.visible[i]} onChange={e => update(item => { const visible = [...item.visible] as SpecialStatus3dVisibility; visible[i] = e.target.checked; return { ...item, visible }; })}/>显示</label></div>)}</> : <div>请添加特殊状态</div>}
            </section>

            <section style={section}>
                <button style={{ width: '100%' }} onClick={() => void savePositionConfig()}>保存整体与全部怪物配置</button>
                <div style={{ marginTop: 8, color: serverPort ? '#8bd8a4' : '#e8ad83', fontSize: 12 }}>Python 服务：{serverPort ? `已连接 ${serverPort}` : '未连接'}</div>
                <small style={{ display: 'block', marginTop: 6, color: '#9dacbf' }}>{message}</small>
            </section>
        </aside>
        <main ref={stageRef} style={{ minWidth: 0, position: 'relative', border: '1px solid #273348', borderRadius: 12, overflow: 'hidden' }}><canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}/><div style={{ position: 'absolute', left: 8, bottom: 6, color: '#718198', fontSize: 10, pointerEvents: 'none' }}>共享道路场景 · 左键旋转 · 滚轮缩放 · WASD/QE</div></main>
    </div>;
};
