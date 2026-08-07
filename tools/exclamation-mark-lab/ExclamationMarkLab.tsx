import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3
} from '@babylonjs/core';
import {
  createAtlasSpritePlane,
  createDefaultExclamationMarkPreset,
  createDefaultExclamationBasePreset,
  createExclamationMarkProgressMaterial,
  applyExclamationMarkProgressPreset,
  getPublicResourceImagePaths,
  normalizeExclamationMarkPresets,
  normalizeExclamationBasePresets,
  type ExclamationBasePreset,
  type ExclamationBasePresetMap,
  type ExclamationMarkPreset,
  type ExclamationMarkPresetMap
} from '@/core/sprite';
import { getResolvedDevServerPort, requestDevServer } from '@/core/network/devServerPortResolver.ts';
import { ExclamationProgressControls } from '@/tools/shared/ExclamationProgressControls.tsx';

const API_PATH = '/api/exclamation-mark-presets';
const BASE_API_PATH = '/api/exclamation-base-presets';
const sectionStyle: React.CSSProperties = { padding: 12, border: '1px solid #273348', borderRadius: 10, background: '#151d29' };
const numericInputStyle: React.CSSProperties = { width: '100%' };

const uniqueKey = (base: string, presets: Record<string, unknown>): string => {
  const normalized = base.trim().replace(/\s+/g, '_') || 'exclamation_mark';
  if (!presets[normalized]) return normalized;
  let suffix = 2;
  while (presets[`${normalized}_${suffix}`]) suffix += 1;
  return `${normalized}_${suffix}`;
};

export const ExclamationMarkLab: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const spriteRef = useRef<ReturnType<typeof createAtlasSpritePlane> | null>(null);
  const progressMaterialRef = useRef<ReturnType<typeof createExclamationMarkProgressMaterial> | null>(null);
  const baseSpriteRef = useRef<ReturnType<typeof createAtlasSpritePlane> | null>(null);
  const baseMaterialRef = useRef<ReturnType<typeof createExclamationMarkProgressMaterial> | null>(null);
  const desiredHeightRef = useRef(2.4);
  const [presets, setPresets] = useState<ExclamationMarkPresetMap>({});
  const [activeKey, setActiveKey] = useState('');
  const [basePresets, setBasePresets] = useState<ExclamationBasePresetMap>({});
  const [activeBaseKey, setActiveBaseKey] = useState('');
  const [message, setMessage] = useState('正在连接配置服务…');
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [debugVisible, setDebugVisible] = useState(false);
  const imageOptions = useMemo(() => getPublicResourceImagePaths(true).map((path) => path.replace(/^\/+/, '')), []);
  const markPreset = presets[activeKey];
  const basePreset = basePresets[activeBaseKey];
  const preset = markPreset ? { ...markPreset, base: basePreset ?? markPreset.base } : undefined;

  const patchBasePreset = useCallback((patch: Partial<ExclamationBasePreset>) => {
    if (!basePreset) return;
    setBasePresets((current) => ({ ...current, [activeBaseKey]: { ...basePreset, ...patch, presetKey: activeBaseKey } }));
  }, [activeBaseKey, basePreset]);

  const replacePreset = useCallback((next: ExclamationMarkPreset) => {
    setPresets((current) => ({ ...current, [activeKey]: { ...next, presetKey: activeKey } }));
  }, [activeKey]);

  const patchPreset = useCallback((patch: Partial<ExclamationMarkPreset>) => {
    if (!preset) return;
    replacePreset({ ...preset, ...patch });
  }, [preset, replacePreset]);

  const loadFromServer = useCallback(async () => {
    try {
      const response = await requestDevServer(`${API_PATH}?t=${Date.now()}`, { method: 'GET' });
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.message || `HTTP ${response.status}`);
      let loaded = normalizeExclamationMarkPresets(payload.data);
      if (Object.keys(loaded).length === 0) {
        const key = 'exclamation_default';
        loaded = { [key]: createDefaultExclamationMarkPreset(key, imageOptions[0] ?? '') };
      }
      const keys = Object.keys(loaded).sort((a, b) => a.localeCompare(b, 'zh-CN'));
      setPresets(loaded);
      setActiveKey((current) => loaded[current] ? current : keys[0]);
      setServerPort(getResolvedDevServerPort());
      setMessage(`已读取 ${keys.length} 个感叹号预设。`);
    } catch (error) {
      const key = 'exclamation_default';
      setPresets((current) => Object.keys(current).length ? current : { [key]: createDefaultExclamationMarkPreset(key, imageOptions[0] ?? '') });
      setActiveKey((current) => current || key);
      setServerPort(null);
      setMessage(`读取失败：${String(error)}`);
    }
  }, [imageOptions]);

  useEffect(() => { void loadFromServer(); }, [loadFromServer]);
  useEffect(() => {
    void (async () => {
      try {
        const response = await requestDevServer(`${BASE_API_PATH}?t=${Date.now()}`, { method: 'GET' });
        const payload = await response.json();
        let loaded = normalizeExclamationBasePresets(payload.data);
        if (!Object.keys(loaded).length) {
          const key = 'interrupt_base_default';
          loaded = { [key]: createDefaultExclamationBasePreset(key, imageOptions[0] ?? '') };
        }
        setBasePresets(loaded);
        setActiveBaseKey(Object.keys(loaded)[0]);
      } catch { /* Python service message is already shown by the main loader. */ }
    })();
  }, [imageOptions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine(canvas, true, { stencil: true });
    const scene = new Scene(engine);
    sceneRef.current = scene;
    scene.clearColor = new Color4(0.025, 0.04, 0.065, 1);
    const camera = new ArcRotateCamera('exclamation_mark_camera', -Math.PI / 2, 1.18, 9, new Vector3(0, 1.5, 0), scene);
    camera.attachControl(canvas, true);
    camera.wheelPrecision = 35;
    new HemisphericLight('exclamation_mark_light', new Vector3(0.4, 1, 0.2), scene).intensity = 1.25;
    const ground = MeshBuilder.CreateGround('exclamation_mark_ground', { width: 18, height: 18 }, scene);
    const material = new StandardMaterial('exclamation_mark_ground_material', scene);
    material.diffuseColor = new Color3(0.055, 0.09, 0.14);
    ground.material = material;
    engine.runRenderLoop(() => scene.render());
    const resize = () => engine.resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      scene.dispose();
      engine.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !preset?.imagePath) return;
    const sprite = createAtlasSpritePlane(scene, encodeURI(`/${preset.imagePath.replace(/^\/+/, '')}`), 1);
    const progressMaterial = createExclamationMarkProgressMaterial(scene, sprite.texture, preset);
    sprite.mesh.material = progressMaterial.material;
    sprite.mesh.isPickable = false;
    sprite.mesh.renderingGroupId = 1;
    sprite.mesh.alphaIndex = 1;
    spriteRef.current = sprite;
    progressMaterialRef.current = progressMaterial;
    const applyCurrentSize = () => {
      const textureSize = sprite.texture.getSize();
      const aspect = textureSize.width > 0 && textureSize.height > 0 ? textureSize.width / textureSize.height : 1;
      sprite.mesh.scaling.x = (preset.sizeMode === 'fixed' ? preset.width * preset.scale : desiredHeightRef.current * aspect) * preset.scaleX;
      sprite.mesh.scaling.y = desiredHeightRef.current * preset.scaleY;
    };
    sprite.texture.onLoadObservable.add(applyCurrentSize);
    applyCurrentSize();
    return () => {
      if (spriteRef.current === sprite) spriteRef.current = null;
      if (progressMaterialRef.current === progressMaterial) progressMaterialRef.current = null;
      progressMaterial.dispose();
      sprite.dispose();
    };
  }, [preset?.imagePath]);

  useEffect(() => {
    const scene = sceneRef.current;
    const base = preset?.base;
    if (!scene || !preset || !base?.enabled || !base.imagePath) return;
    const sprite = createAtlasSpritePlane(scene, encodeURI(`/${base.imagePath.replace(/^\/+/, '')}`), 1);
    const basePreset = { ...preset, presetKey: `${preset.presetKey}_base`, imagePath: base.imagePath, progress: base.progress };
    const material = createExclamationMarkProgressMaterial(scene, sprite.texture, basePreset);
    sprite.mesh.material = material.material;
    sprite.mesh.name = `exclamation_mark_base_${preset.presetKey}`;
    sprite.mesh.position.copyFromFloats(
      preset.position[0] + base.offset[0], preset.position[1] + base.offset[1], preset.position[2] + base.offset[2]
    );
    sprite.mesh.billboardMode = preset.faceCamera ? Mesh.BILLBOARDMODE_Y : 0;
    sprite.mesh.isPickable = false;
    sprite.mesh.renderingGroupId = 1;
    sprite.mesh.alphaIndex = 0;
    const applySize = () => {
      const size = sprite.texture.getSize();
      const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 1;
      const height = base.height * base.scale;
      sprite.mesh.scaling.x = (base.sizeMode === 'fixed' ? base.width * base.scale : height * aspect) * base.scaleX;
      sprite.mesh.scaling.y = height * base.scaleY;
    };
    sprite.texture.onLoadObservable.add(applySize);
    applySize();
    baseSpriteRef.current = sprite;
    baseMaterialRef.current = material;
    return () => {
      if (baseSpriteRef.current === sprite) baseSpriteRef.current = null;
      if (baseMaterialRef.current === material) baseMaterialRef.current = null;
      material.dispose(); sprite.dispose();
    };
  }, [preset?.base?.enabled, preset?.base?.imagePath]);

  useEffect(() => {
    if (!preset?.base || !baseSpriteRef.current || !baseMaterialRef.current) return;
    const base = preset.base;
    const sprite = baseSpriteRef.current;
    const size = sprite.texture.getSize();
    const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 1;
    const height = base.height * base.scale;
    sprite.mesh.scaling.x = (base.sizeMode === 'fixed' ? base.width * base.scale : height * aspect) * base.scaleX;
    sprite.mesh.scaling.y = height * base.scaleY;
    sprite.mesh.position.copyFromFloats(preset.position[0] + base.offset[0], preset.position[1] + base.offset[1], preset.position[2] + base.offset[2]);
    sprite.mesh.billboardMode = preset.faceCamera ? Mesh.BILLBOARDMODE_Y : 0;
    sprite.mesh.showBoundingBox = debugVisible;
    applyExclamationMarkProgressPreset(baseMaterialRef.current, { ...preset, progress: base.progress });
  }, [preset, debugVisible]);

  useEffect(() => {
    if (!preset) return;
    desiredHeightRef.current = preset.height * preset.scale;
    const sprite = spriteRef.current;
    if (!sprite) return;
    const textureSize = sprite.texture.getSize();
    const aspect = textureSize.width > 0 && textureSize.height > 0 ? textureSize.width / textureSize.height : 1;
    sprite.mesh.scaling.x = (preset.sizeMode === 'fixed' ? preset.width * preset.scale : desiredHeightRef.current * aspect) * preset.scaleX;
    sprite.mesh.scaling.y = desiredHeightRef.current * preset.scaleY;
  }, [preset?.height, preset?.width, preset?.scale, preset?.scaleX, preset?.scaleY, preset?.sizeMode]);

  useEffect(() => {
    if (!preset) return;
    const sprite = spriteRef.current;
    if (!sprite) return;
    sprite.mesh.name = `exclamation_mark_${preset.presetKey}`;
    sprite.mesh.position.copyFromFloats(preset.position[0], preset.position[1], preset.position[2]);
    sprite.mesh.billboardMode = preset.faceCamera ? Mesh.BILLBOARDMODE_Y : 0;
    sprite.mesh.showBoundingBox = debugVisible;
  }, [preset?.presetKey, preset?.position[0], preset?.position[1], preset?.position[2], preset?.faceCamera, debugVisible]);

  useEffect(() => {
    if (!preset || !progressMaterialRef.current) return;
    applyExclamationMarkProgressPreset(progressMaterialRef.current, preset);
  }, [preset]);

  const save = async () => {
    try {
      const normalized = normalizeExclamationMarkPresets(presets);
      const markPayload = Object.fromEntries(Object.entries(normalized).map(([key, item]) => { const { base: _base, ...mark } = item; return [key, mark]; }));
      const response = await requestDevServer(API_PATH, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(markPayload)
      });
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.errors?.[0] || payload.message || `HTTP ${response.status}`);
      const baseResponse = await requestDevServer(BASE_API_PATH, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(normalizeExclamationBasePresets(basePresets)) });
      const basePayload = await baseResponse.json();
      if (!baseResponse.ok || basePayload.success === false) throw new Error(basePayload.message || `HTTP ${baseResponse.status}`);
      setPresets(normalized);
      setServerPort(getResolvedDevServerPort());
      setMessage(`已保存 ${Object.keys(normalized).length} 个预设到 config/exclamationMarkPresets.json。`);
    } catch (error) {
      setMessage(`保存失败：${String(error)}`);
    }
  };

  const newPreset = () => {
    const requested = window.prompt('新预设 Key', 'exclamation_mark')?.trim();
    if (!requested) return;
    const key = uniqueKey(requested, presets);
    setPresets((current) => ({ ...current, [key]: createDefaultExclamationMarkPreset(key, imageOptions[0] ?? '') }));
    setActiveKey(key);
  };

  const duplicatePreset = () => {
    if (!preset) return;
    const key = uniqueKey(`${activeKey}_copy`, presets);
    setPresets((current) => ({ ...current, [key]: { ...preset, presetKey: key, name: `${preset.name} 副本`, position: [...preset.position] } }));
    setActiveKey(key);
  };

  const renamePreset = () => {
    if (!preset) return;
    const requested = window.prompt('新的预设 Key', activeKey)?.trim();
    if (!requested || requested === activeKey) return;
    if (presets[requested]) { setMessage(`重命名失败：${requested} 已存在。`); return; }
    setPresets((current) => {
      const next = { ...current };
      delete next[activeKey];
      next[requested] = { ...preset, presetKey: requested };
      return next;
    });
    setActiveKey(requested);
  };

  const deletePreset = () => {
    if (!preset || Object.keys(presets).length <= 1 || !window.confirm(`删除预设 ${activeKey}？`)) return;
    setPresets((current) => {
      const next = { ...current };
      delete next[activeKey];
      setActiveKey(Object.keys(next).sort((a, b) => a.localeCompare(b, 'zh-CN'))[0] ?? '');
      return next;
    });
  };

  const newBasePreset = () => {
    const requested = window.prompt('新底座配置 Key', 'exclamation_base')?.trim();
    if (!requested) return;
    const key = uniqueKey(requested, basePresets);
    setBasePresets((current) => ({ ...current, [key]: createDefaultExclamationBasePreset(key, imageOptions[0] ?? '') }));
    setActiveBaseKey(key);
  };

  const duplicateBasePreset = () => {
    if (!basePreset) return;
    const key = uniqueKey(`${activeBaseKey}_copy`, basePresets);
    setBasePresets((current) => ({ ...current, [key]: { ...basePreset, presetKey: key, name: `${basePreset.name} 副本`, offset: [...basePreset.offset], progress: { ...basePreset.progress } } }));
    setActiveBaseKey(key);
  };

  const renameBasePreset = () => {
    if (!basePreset) return;
    const requested = window.prompt('新的底座配置 Key', activeBaseKey)?.trim();
    if (!requested || requested === activeBaseKey) return;
    if (basePresets[requested]) { setMessage(`重命名失败：${requested} 已存在。`); return; }
    setBasePresets((current) => {
      const next = { ...current };
      delete next[activeBaseKey];
      next[requested] = { ...basePreset, presetKey: requested };
      return next;
    });
    setActiveBaseKey(requested);
  };

  const deleteBasePreset = () => {
    if (!basePreset || Object.keys(basePresets).length <= 1 || !window.confirm(`删除底座配置 ${activeBaseKey}？`)) return;
    setBasePresets((current) => {
      const next = { ...current };
      delete next[activeBaseKey];
      setActiveBaseKey(Object.keys(next).sort((a, b) => a.localeCompare(b, 'zh-CN'))[0] ?? '');
      return next;
    });
  };

  const updatePosition = (axis: 0 | 1 | 2, value: number) => {
    if (!preset) return;
    const position: [number, number, number] = [...preset.position];
    position[axis] = value;
    patchPreset({ position });
  };

  return <div style={{ height: '100vh', padding: 14, display: 'grid', gridTemplateColumns: '430px minmax(0, 1fr)', gap: 14 }}>
    <aside style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><h2 style={{ margin: '0 0 5px' }}>Exclamation Mark 配置 Lab</h2><div style={{ color: '#8291a8', fontSize: 12 }}>感叹号与底座的图片、尺寸、缩放和 Shader 参数只能在这里编辑并保存。</div></div>
      <section style={sectionStyle}>
        <label>预设</label>
        <select value={activeKey} onChange={(event) => setActiveKey(event.target.value)}>
          {Object.entries(presets).sort(([a], [b]) => a.localeCompare(b, 'zh-CN')).map(([key, item]) => <option key={key} value={key}>{key} · {item.name}</option>)}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7, marginTop: 8 }}>
          <button onClick={newPreset}>新建</button><button disabled={!preset} onClick={duplicatePreset}>复制</button>
          <button disabled={!preset} onClick={renamePreset}>重命名 Key</button><button disabled={!preset || Object.keys(presets).length <= 1} onClick={deletePreset}>删除</button>
          <button onClick={() => void loadFromServer()}>重新加载</button><button onClick={() => void save()}>保存全部</button>
        </div>
      </section>
      {preset ? <section style={sectionStyle}>
        <label>显示名称</label><input value={preset.name} onChange={(event) => patchPreset({ name: event.target.value })} />
        <label>感叹号图片（自动扫描 public/resources）</label>
        <select value={preset.imagePath} onChange={(event) => patchPreset({ imagePath: event.target.value })}>
          {!imageOptions.includes(preset.imagePath) ? <option value={preset.imagePath}>{preset.imagePath || '-- 请选择图片 --'}</option> : null}
          {imageOptions.map((path) => <option key={path} value={path}>{path}</option>)}
        </select>
        <label>图片路径（保存到配置）</label><input value={preset.imagePath} onChange={(event) => patchPreset({ imagePath: event.target.value.replace(/^\/+/, '') })} />
        <ExclamationProgressControls value={preset.progress} onChange={(progress) => patchPreset({ progress })} />
        <details open style={{ marginTop: 12, padding: 10, border: '1px solid #5a4930', borderRadius: 8, background: '#1b1710' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>行动打断伤害底座</summary>
          <label>底座配置（独立配置库）</label><select value={activeBaseKey} onChange={(event) => setActiveBaseKey(event.target.value)}>{Object.entries(basePresets).map(([key, item]) => <option key={key} value={key}>{key} · {item.name}</option>)}</select>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7, marginTop: 8 }}>
            <button onClick={newBasePreset}>新建底座</button><button disabled={!basePreset} onClick={duplicateBasePreset}>复制底座</button>
            <button disabled={!basePreset} onClick={renameBasePreset}>重命名底座 Key</button><button disabled={!basePreset || Object.keys(basePresets).length <= 1} onClick={deleteBasePreset}>删除底座</button>
          </div>
          <label>底座显示名称</label><input value={preset.base.name} onChange={(event) => patchBasePreset({ name: event.target.value })} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input style={{ width: 'auto' }} type="checkbox" checked={preset.base.enabled} onChange={(event) => patchBasePreset({ enabled: event.target.checked })} />启用底座</label>
          <label>底座图片</label><select value={preset.base.imagePath} onChange={(event) => patchBasePreset({ imagePath: event.target.value })}>{!imageOptions.includes(preset.base.imagePath) ? <option value={preset.base.imagePath}>{preset.base.imagePath || '-- 请选择图片 --'}</option> : null}{imageOptions.map((path) => <option key={path} value={path}>{path}</option>)}</select>
          <label>尺寸模式</label><select value={preset.base.sizeMode} onChange={(event) => patchBasePreset({ sizeMode: event.target.value as 'fixed' | 'preserve-aspect' })}><option value="fixed">固定宽高</option><option value="preserve-aspect">保持图片比例</option></select>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}><div><label>宽度</label><input type="number" min="0.01" step="0.1" value={preset.base.width} disabled={preset.base.sizeMode !== 'fixed'} onChange={(e) => patchBasePreset({ width: Number(e.target.value) })} /></div><div><label>高度</label><input type="number" min="0.01" step="0.1" value={preset.base.height} onChange={(e) => patchBasePreset({ height: Number(e.target.value) })} /></div><div><label>整体缩放</label><input type="number" min="0.01" step="0.05" value={preset.base.scale} onChange={(e) => patchBasePreset({ scale: Number(e.target.value) })} /></div><div><label>X 缩放</label><input type="number" min="0.01" step="0.05" value={preset.base.scaleX} onChange={(e) => patchBasePreset({ scaleX: Number(e.target.value) })} /></div><div><label>Y 缩放</label><input type="number" min="0.01" step="0.05" value={preset.base.scaleY} onChange={(e) => patchBasePreset({ scaleY: Number(e.target.value) })} /></div></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>{(['X', 'Y', 'Z'] as const).map((axis, index) => <div key={axis}><label>偏移 {axis}</label><input type="number" step="0.05" value={preset.base.offset[index]} onChange={(e) => { const offset: [number, number, number] = [...preset.base.offset]; offset[index] = Number(e.target.value); patchBasePreset({ offset }); }} /></div>)}</div>
          <ExclamationProgressControls title="底座进度 Shader" value={preset.base.progress} onChange={(progress) => patchBasePreset({ progress })} />
        </details>
        <label>图片尺寸模式</label>
        <select value={preset.sizeMode} onChange={(event) => patchPreset({ sizeMode: event.target.value as ExclamationMarkPreset['sizeMode'] })}>
          <option value="fixed">固定宽高（切换图片不改变平面尺寸）</option>
          <option value="preserve-aspect">保持图片原始比例</option>
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><label>基础宽度</label><input style={numericInputStyle} type="number" min="0.01" step="0.1" value={preset.width} disabled={preset.sizeMode !== 'fixed'} onChange={(event) => patchPreset({ width: Number(event.target.value) })} /></div>
          <div><label>基础高度</label><input style={numericInputStyle} type="number" min="0.01" step="0.1" value={preset.height} onChange={(event) => patchPreset({ height: Number(event.target.value) })} /></div>
          <div><label>整体缩放</label><input style={numericInputStyle} type="number" min="0.01" step="0.1" value={preset.scale} onChange={(event) => patchPreset({ scale: Number(event.target.value) })} /></div>
          <div><label>X 缩放</label><input style={numericInputStyle} type="number" min="0.01" step="0.05" value={preset.scaleX} onChange={(event) => patchPreset({ scaleX: Number(event.target.value) })} /></div>
          <div><label>Y 缩放</label><input style={numericInputStyle} type="number" min="0.01" step="0.05" value={preset.scaleY} onChange={(event) => patchPreset({ scaleY: Number(event.target.value) })} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {(['X', 'Y', 'Z'] as const).map((axis, index) => <div key={axis}><label>位置 {axis}</label><input type="number" step="0.1" value={preset.position[index]} onChange={(event) => updatePosition(index as 0 | 1 | 2, Number(event.target.value))} /></div>)}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input style={{ width: 'auto' }} type="checkbox" checked={preset.faceCamera} onChange={(event) => patchPreset({ faceCamera: event.target.checked })} />绕 Y 轴朝向相机（始终垂直地面）</label>
        <button style={{ width: '100%', marginTop: 8 }} onClick={() => setDebugVisible((value) => !value)}>{debugVisible ? '关闭 Sprite Debug' : '开启 Sprite Debug'}</button>
      </section> : null}
      <section style={sectionStyle}><div style={{ color: serverPort ? '#8bd8a4' : '#e8ad83', fontSize: 12 }}>Python 服务：{serverPort ? `已连接 ${serverPort}` : '未连接'}</div><div style={{ marginTop: 7, color: '#9dacbf', fontSize: 12, lineHeight: 1.5 }}>{message}</div></section>
    </aside>
    <main style={{ minWidth: 0, position: 'relative', border: '1px solid #273348', borderRadius: 12, overflow: 'hidden', background: '#080d14' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      <div style={{ position: 'absolute', left: 10, bottom: 8, color: '#8291a8', fontSize: 11, pointerEvents: 'none' }}>左键旋转 · 滚轮缩放 · Sprite 始终保持垂直</div>
    </main>
  </div>;
};
