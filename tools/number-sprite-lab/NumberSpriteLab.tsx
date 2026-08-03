import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3
} from '@babylonjs/core';
import {
  createNumberSprite,
  DEFAULT_SCANNED_ATLAS_OPTIONS,
  joinPublicPath,
  normalizePublicPath,
  normalizeNumberSpritePresets,
  RESOURCE_IMAGE_MODULES,
  type NumberSprite,
  type NumberSpriteGlyphSource,
  type NumberSpritePreset,
  type NumberSpritePresetMap,
  type TexturePackerAtlas
} from '@/core/sprite';

const CONFIG_URL = '/config/numberSpriteConfigs.json';
const API_PATH = '/api/number-sprite-configs';
const GLYPHS = [...'0123456789-+.'];
const DEFAULT_PRESET: NumberSpritePreset = {
  presetKey: 'number_default', name: '默认数字精灵', height: 1.5, spacing: 0.08,
  groupingEnabled: false, groupingExtraSpacing: 0.2,
  alignment: 'center', billboard: true, glyphs: {}
};

const inputStyle: React.CSSProperties = { width: '100%' };
const sectionStyle: React.CSSProperties = { padding: 12, border: '1px solid #273348', borderRadius: 10, background: '#151d29' };

const scanServer = async (): Promise<number | null> => {
  for (let port = 4550; port <= 4600; port += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(250) });
      if (response.ok) return port;
    } catch { /* continue */ }
  }
  return null;
};

const loadAtlas = async (path: string): Promise<TexturePackerAtlas> => {
  const response = await fetch(encodeURI(`/${normalizePublicPath(path)}?t=${Date.now()}`), { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<TexturePackerAtlas>;
};

export const NumberSpriteLab: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const previewRef = useRef<NumberSprite | null>(null);
  const debugVisibleRef = useRef(false);
  const [presets, setPresets] = useState<NumberSpritePresetMap>({ number_default: DEFAULT_PRESET });
  const [activeKey, setActiveKey] = useState('number_default');
  const [activeGlyph, setActiveGlyph] = useState('0');
  const [previewText, setPreviewText] = useState('0123456789');
  const [debugVisible, setDebugVisible] = useState(false);
  const [message, setMessage] = useState('正在读取配置…');
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [atlasFrames, setAtlasFrames] = useState<string[]>([]);
  const [atlasImagePath, setAtlasImagePath] = useState('');

  const preset = presets[activeKey] ?? DEFAULT_PRESET;
  const source = preset.glyphs[activeGlyph];
  const imageOptions = useMemo(() => Object.values(RESOURCE_IMAGE_MODULES)
    .map((url) => normalizePublicPath(url))
    .sort((a, b) => a.localeCompare(b, 'zh-CN')), []);
  const atlasOptions = useMemo(() => DEFAULT_SCANNED_ATLAS_OPTIONS, []);

  const updatePreset = useCallback((patch: Partial<NumberSpritePreset>) => {
    setPresets((previous) => ({ ...previous, [activeKey]: { ...previous[activeKey], ...patch } }));
  }, [activeKey]);

  const updateGlyph = useCallback((next: NumberSpriteGlyphSource | null) => {
    setPresets((previous) => {
      const current = previous[activeKey];
      const glyphs = { ...current.glyphs };
      if (next) glyphs[activeGlyph] = next;
      else delete glyphs[activeGlyph];
      return { ...previous, [activeKey]: { ...current, glyphs } };
    });
  }, [activeGlyph, activeKey]);

  const inspectAtlas = useCallback(async (path: string, preferredFrame?: string) => {
    if (!path) return;
    try {
      const atlas = await loadAtlas(path);
      const frames = Object.keys(atlas.frames).sort((a, b) => a.localeCompare(b, 'zh-CN'));
      setAtlasFrames(frames);
      setAtlasImagePath(joinPublicPath(path, atlas.meta.image));
      if (frames.length && (!preferredFrame || !atlas.frames[preferredFrame])) {
        updateGlyph({ type: 'atlas', atlasJsonPath: normalizePublicPath(path), frameName: frames[0] });
      }
    } catch (error) {
      setAtlasFrames([]);
      setAtlasImagePath('');
      setMessage(`图集加载失败：${String(error)}`);
    }
  }, [updateGlyph]);

  /* eslint-disable react-hooks/set-state-in-effect -- synchronize the selected glyph editor */
  useEffect(() => {
    const current = preset.glyphs[activeGlyph];
    if (current?.type === 'atlas') void inspectAtlas(current.atlasJsonPath, current.frameName);
    else { setAtlasFrames([]); setAtlasImagePath(''); }
  }, [activeGlyph, activeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`${CONFIG_URL}?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const loaded = normalizeNumberSpritePresets(await response.json());
        const keys = Object.keys(loaded);
        setPresets(keys.length ? loaded : { number_default: DEFAULT_PRESET });
        setActiveKey(keys[0] ?? 'number_default');
        setMessage(`已读取 ${keys.length} 个数字精灵配置。`);
      } catch (error) { setMessage(`读取配置失败：${String(error)}`); }
      setServerPort(await scanServer());
    })();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine(canvas, true);
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.025, 0.04, 0.065, 1);
    const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2, 8, Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 2;
    camera.upperRadiusLimit = 20;
    new HemisphericLight('light', new Vector3(0, 1, -1), scene).intensity = 0.8;
    const ground = MeshBuilder.CreateGround('ground', { width: 12, height: 8 }, scene);
    ground.position.y = -1.8;
    const material = new StandardMaterial('groundMaterial', scene);
    material.diffuseColor = new Color3(0.05, 0.09, 0.14);
    ground.material = material;
    sceneRef.current = scene;
    engine.runRenderLoop(() => scene.render());
    const resize = () => engine.resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      previewRef.current?.dispose();
      scene.dispose();
      engine.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      previewRef.current?.dispose();
      previewRef.current = null;
      void createNumberSprite(scene, previewText, preset).then((created) => {
        if (cancelled) { created.dispose(); return; }
        created.setDebugVisible(debugVisibleRef.current);
        previewRef.current = created;
      }).catch((error) => setMessage(`预览生成失败：${String(error)}`));
    }, 100);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [preset, previewText]);

  useEffect(() => {
    debugVisibleRef.current = debugVisible;
    previewRef.current?.setDebugVisible(debugVisible);
  }, [debugVisible]);

  const save = async () => {
    const port = serverPort ?? await scanServer();
    if (!port) { setMessage('未找到 python/server.py（端口 4550–4600）。'); return; }
    try {
      const normalizedPresets = normalizeNumberSpritePresets(presets);
      const response = await fetch(`http://127.0.0.1:${port}${API_PATH}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(normalizedPresets)
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.errors?.join('；') || payload.message || `HTTP ${response.status}`);
      setServerPort(port);
      setPresets(normalizedPresets);
      setMessage(`已保存到 config/numberSpriteConfigs.json（${Object.keys(presets).length} 个配置）。`);
    } catch (error) { setMessage(`保存失败：${String(error)}`); }
  };

  const autoMap = async () => {
    if (source?.type !== 'atlas') return;
    const atlas = await loadAtlas(source.atlasJsonPath);
    const names = Object.keys(atlas.frames);
    const glyphs = { ...preset.glyphs };
    for (const digit of '0123456789') {
      const match = names.find((name) => name === digit || name.replace(/\.[^.]+$/, '') === digit || new RegExp(`(?:^|[_-])${digit}(?:[_-]|\\.|$)`).test(name));
      if (match) glyphs[digit] = { type: 'atlas', atlasJsonPath: source.atlasJsonPath, frameName: match };
    }
    updatePreset({ glyphs });
    setMessage('已按帧名自动匹配 0–9；请检查未匹配或同名歧义的数字。');
  };

  return <div style={{ height: '100vh', padding: 14, display: 'grid', gridTemplateColumns: '430px minmax(0, 1fr)', gap: 14 }}>
    <aside style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><h2 style={{ margin: '0 0 5px' }}>数字精灵配置 Lab</h2><div style={{ color: '#8291a8', fontSize: 12 }}>数字 → 单图 / TexturePacker 帧，右侧由 Babylon 运行时真实生成。</div></div>
      <section style={sectionStyle}>
        <label>配置</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 7 }}>
          <select value={activeKey} onChange={(e) => setActiveKey(e.target.value)}>{Object.keys(presets).map((key) => <option key={key}>{key}</option>)}</select>
          <button onClick={() => {
            const key = window.prompt('新配置 Key', `number_${Object.keys(presets).length + 1}`)?.trim();
            if (!key || presets[key]) return;
            setPresets((old) => ({ ...old, [key]: { ...DEFAULT_PRESET, presetKey: key, name: key, glyphs: {} } })); setActiveKey(key);
          }}>新建</button>
          <button onClick={() => {
            if (Object.keys(presets).length <= 1 || !window.confirm(`删除 ${activeKey}？`)) return;
            setPresets((old) => { const next = { ...old }; delete next[activeKey]; setActiveKey(Object.keys(next)[0]); return next; });
          }}>删除</button>
        </div>
        <label>名称</label><input value={preset.name} onChange={(e) => updatePreset({ name: e.target.value })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><label>高度（世界单位）</label><input type="number" min="0.01" step="0.05" value={preset.height} onChange={(e) => updatePreset({ height: Number(e.target.value) })} /></div>
          <div><label>字符间距</label><input type="number" step="0.01" value={preset.spacing} onChange={(e) => updatePreset({ spacing: Number(e.target.value) })} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><label>对齐</label><select value={preset.alignment} onChange={(e) => updatePreset({ alignment: e.target.value as NumberSpritePreset['alignment'] })}><option value="left">左</option><option value="center">居中</option><option value="right">右</option></select></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 21 }}><input style={{ width: 'auto' }} type="checkbox" checked={preset.billboard} onChange={(e) => updatePreset({ billboard: e.target.checked })} />始终朝向相机</label>
        </div>
        <div style={{ marginTop: 10, padding: '9px 10px', border: '1px solid #2d3b51', borderRadius: 8, background: '#111823' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <input style={{ width: 'auto' }} type="checkbox" checked={preset.groupingEnabled} onChange={(e) => updatePreset({ groupingEnabled: e.target.checked })} />
            每 3 位增加额外间距
          </label>
          {preset.groupingEnabled ? <div>
            <label>三位分组额外间距（世界单位）</label>
            <input type="number" min="0" step="0.01" value={preset.groupingExtraSpacing} onChange={(e) => updatePreset({ groupingExtraSpacing: Math.max(0, Number(e.target.value)) })} />
            <div style={{ marginTop: 6, color: '#7f90a8', fontSize: 11 }}>从整数部分右侧分组，例如 1 | 234 | 567；小数部分不分组。</div>
          </div> : null}
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
          {GLYPHS.map((glyph) => <button key={glyph} onClick={() => setActiveGlyph(glyph)} style={{ background: glyph === activeGlyph ? '#476899' : preset.glyphs[glyph] ? '#244c3c' : '#202a3a' }}>{glyph}</button>)}
        </div>
        <label>“{activeGlyph}” 的资源类型</label>
        <select value={source?.type ?? 'none'} onChange={(e) => {
          if (e.target.value === 'none') updateGlyph(null);
          else if (e.target.value === 'single') updateGlyph({ type: 'single', imagePath: imageOptions[0] ?? 'resources/' });
          else {
            const atlasJsonPath = atlasOptions[0] ?? '';
            updateGlyph({ type: 'atlas', atlasJsonPath, frameName: '' });
            void inspectAtlas(atlasJsonPath);
          }
        }}><option value="none">未配置</option><option value="single">单图</option><option value="atlas">TexturePacker 图集帧</option></select>
        {source?.type === 'single' && <>
          <label>图片路径（public 下）</label><input list="number-sprite-images" value={source.imagePath} onChange={(e) => updateGlyph({ ...source, imagePath: normalizePublicPath(e.target.value) })} />
          <datalist id="number-sprite-images">{imageOptions.map((path) => <option key={path} value={path} />)}</datalist>
        </>}
        {source?.type === 'atlas' && <>
          <label>图集 JSON</label><select value={source.atlasJsonPath} onChange={(e) => { const atlasJsonPath = e.target.value; updateGlyph({ type: 'atlas', atlasJsonPath, frameName: '' }); void inspectAtlas(atlasJsonPath); }}>{atlasOptions.map((path) => <option key={path}>{path}</option>)}</select>
          <label>图集帧</label><select value={source.frameName} onChange={(e) => updateGlyph({ ...source, frameName: e.target.value })}>{atlasFrames.map((name) => <option key={name}>{name}</option>)}</select>
          <div style={{ marginTop: 7, color: '#8291a8', fontSize: 11 }}>纹理：{atlasImagePath || '-'}</div>
          <button style={{ marginTop: 9, width: '100%' }} onClick={() => void autoMap()}>按帧名自动匹配 0–9</button>
        </>}
      </section>
      <section style={sectionStyle}>
        <button style={{ width: '100%' }} onClick={() => void save()}>保存到项目配置</button>
        <div style={{ marginTop: 8, fontSize: 12, color: serverPort ? '#8bd8a4' : '#e8ad83' }}>Python 服务：{serverPort ? `已连接 ${serverPort}` : '未连接'}</div>
        <div style={{ marginTop: 6, color: '#9dacbf', fontSize: 12, lineHeight: 1.5 }}>{message}</div>
      </section>
    </aside>
    <main style={{ minWidth: 0, position: 'relative', border: '1px solid #273348', borderRadius: 12, overflow: 'hidden', background: '#080d14' }}>
      <div style={{ position: 'absolute', zIndex: 2, top: 12, left: 12, right: 12, padding: 10, borderRadius: 9, background: 'rgba(10,16,25,.88)', display: 'grid', gridTemplateColumns: 'auto minmax(140px, 420px) auto 1fr', alignItems: 'center', gap: 10 }}>
        <strong>Babylon 预览</strong>
        <input style={inputStyle} value={previewText} onChange={(e) => setPreviewText(e.target.value)} placeholder="输入数字，例如 -1284" />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, whiteSpace: 'nowrap' }}>
          <input style={{ width: 'auto' }} type="checkbox" checked={debugVisible} onChange={(e) => setDebugVisible(e.target.checked)} />
          Sprite Debug（包围盒 / 边框 / 中线）
        </label>
        <span style={{ color: '#8291a8', fontSize: 12 }}>拖拽旋转 · 滚轮缩放</span>
      </div>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </main>
  </div>;
};
