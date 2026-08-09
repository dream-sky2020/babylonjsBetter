import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getResolvedDevServerPort, requestDevServer } from '@/core/network/devServerPortResolver.ts';
import { DEFAULT_SCANNED_ATLAS_OPTIONS, getPublicResourceImagePaths, joinPublicPath, normalizePublicPath, type TexturePackerAtlas } from '@/core/sprite';
import {
  ConfigurableAvatar,
  createDefaultAvatarContainer,
  type AvatarContainerConfig,
  type AvatarContainerShape,
  type AvatarExpressionConfig
} from '@/core/ui';

const API_PATH = '/api/avatar-configs';
const panel: React.CSSProperties = { border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#111827' };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 8px', color: '#e2e8f0', background: '#0f172a', border: '1px solid #475569', borderRadius: 6 };

type AtlasSelection = { jsonPath: string; frameName: string };
type Expression = AvatarExpressionConfig & { atlas?: AtlasSelection };
type AvatarConfig = { id: string; name: string; container: AvatarContainerConfig; expressions: Expression[] };
type AvatarConfigMap = Record<string, AvatarConfig>;

const defaultContainer = createDefaultAvatarContainer;
const makeExpression = (imagePath = ''): Expression => ({ id: 'default', name: '默认', imagePath, offsetX: 0, offsetY: 0, scale: 1 });
const makeConfig = (imagePath = ''): AvatarConfigMap => ({ character_default: { id: 'character_default', name: '当前人物', container: defaultContainer(), expressions: [makeExpression(imagePath)] } });
const normalizeConfigs = (value: AvatarConfigMap): AvatarConfigMap => Object.fromEntries(Object.entries(value).map(([key, item]) => [key, { ...item, container: { ...defaultContainer(), ...item.container } }]));
const uniqueId = (base: string, used: string[]): string => {
  const root = base.trim().replace(/\s+/g, '_') || 'item';
  if (!used.includes(root)) return root;
  let index = 2;
  while (used.includes(`${root}_${index}`)) index += 1;
  return `${root}_${index}`;
};

export const AvatarVisualLab: React.FC = () => {
  const images = useMemo(() => getPublicResourceImagePaths(false).map((path) => path.replace(/^\/+/, '')), []);
  const atlases = useMemo(() => DEFAULT_SCANNED_ATLAS_OPTIONS, []);
  const [configs, setConfigs] = useState<AvatarConfigMap>(() => makeConfig(images[0] ?? ''));
  const [activeCharacterId, setActiveCharacterId] = useState('character_default');
  const [activeExpressionId, setActiveExpressionId] = useState('default');
  const [mode, setMode] = useState<'single' | 'atlas'>('single');
  const [atlasPath, setAtlasPath] = useState(atlases[0] ?? '');
  const [atlas, setAtlas] = useState<TexturePackerAtlas | null>(null);
  const [frameNames, setFrameNames] = useState<string[]>([]);
  const [message, setMessage] = useState('正在连接配置服务…');
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  const character = configs[activeCharacterId];
  const expression = character?.expressions.find((item) => item.id === activeExpressionId) ?? character?.expressions[0];

  const loadAtlas = useCallback(async (path: string, preferredFrame?: string) => {
    if (!path) return;
    try {
      const response = await fetch(encodeURI(`/${normalizePublicPath(path)}`));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as TexturePackerAtlas;
      const names = Object.keys(data.frames ?? {}).sort((a, b) => a.localeCompare(b, 'zh-CN'));
      if (!names.length) throw new Error('图集中没有可用帧');
      setAtlasPath(normalizePublicPath(path)); setAtlas(data); setFrameNames(names);
      const frameName = preferredFrame && data.frames[preferredFrame] ? preferredFrame : names[0];
      const imagePath = joinPublicPath(path, data.meta.image);
      setConfigs((current) => {
        const currentCharacter = current[activeCharacterId];
        if (!currentCharacter) return current;
        return { ...current, [activeCharacterId]: { ...currentCharacter, expressions: currentCharacter.expressions.map((item) => item.id === activeExpressionId ? { ...item, imagePath, atlas: { jsonPath: normalizePublicPath(path), frameName } } : item) } };
      });
      setMessage(`已加载图集：${path}`);
    } catch (error) { setMessage(`图集加载失败：${String(error)}`); }
  }, [activeCharacterId, activeExpressionId]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await requestDevServer(`${API_PATH}?t=${Date.now()}`, { method: 'GET' });
        const payload = await response.json();
        if (!response.ok || payload.success === false) throw new Error(payload.message || `HTTP ${response.status}`);
        const loaded = normalizeConfigs(payload.data && Object.keys(payload.data).length ? payload.data as AvatarConfigMap : makeConfig(images[0] ?? ''));
        const first = Object.keys(loaded)[0];
        setConfigs(loaded); setActiveCharacterId(first); setActiveExpressionId(loaded[first].expressions[0]?.id ?? '');
        setMessage(`已读取 ${Object.keys(loaded).length} 个人物配置（端口 ${getResolvedDevServerPort() ?? '-'}）`);
      } catch (error) { setMessage(`配置服务未连接，当前可继续编辑：${String(error)}`); }
    })();
  }, [images]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      if (expression?.atlas) { setMode('atlas'); void loadAtlas(expression.atlas.jsonPath, expression.atlas.frameName); }
      else setMode('single');
    });
  // Switching the selection is the only trigger; loadAtlas also updates the selected expression.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCharacterId, activeExpressionId]);

  const patchCharacter = (patch: Partial<AvatarConfig>) => {
    if (!character) return;
    setConfigs((current) => ({ ...current, [activeCharacterId]: { ...character, ...patch, id: activeCharacterId } }));
  };
  const patchExpression = (patch: Partial<Expression>) => {
    if (!character || !expression) return;
    patchCharacter({ expressions: character.expressions.map((item) => item.id === expression.id ? { ...item, ...patch, id: expression.id } : item) });
  };
  const patchContainer = (patch: Partial<AvatarContainerConfig>) => {
    if (!character) return;
    patchCharacter({ container: { ...defaultContainer(), ...character.container, ...patch } });
  };
  const renameCharacterId = (nextId: string) => {
    const id = nextId.trim(); if (!character || !id || (id !== activeCharacterId && configs[id])) return;
    setConfigs((current) => { const next = { ...current }; delete next[activeCharacterId]; next[id] = { ...character, id }; return next; }); setActiveCharacterId(id);
  };
  const renameExpressionId = (nextId: string) => {
    const id = nextId.trim(); if (!character || !expression || !id || character.expressions.some((item) => item.id === id && item !== expression)) return;
    patchCharacter({ expressions: character.expressions.map((item) => item === expression ? { ...item, id } : item) }); setActiveExpressionId(id);
  };
  const save = async () => {
    try {
      const response = await requestDevServer(API_PATH, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(configs) });
      const payload = await response.json(); if (!response.ok || payload.success === false) throw new Error((payload.errors ?? [payload.message]).join('；'));
      setMessage(`保存成功：config/avatarConfigs.json（${payload.count} 个人物）`);
    } catch (error) { setMessage(`保存失败：${String(error)}`); }
  };

  const atlasFrame = expression?.atlas && atlas ? atlas.frames[expression.atlas.frameName] : undefined;
  const container = { ...defaultContainer(), ...character?.container };
  const containerRadius = container.shape === 'circle' || container.shape === 'ellipse'
    ? '50%'
    : container.shape === 'square' ? 0 : container.borderRadius;
  const resolvedAtlasFrame = atlasFrame && atlas ? { frame: atlasFrame.frame, atlasSize: atlas.meta.size } : undefined;

  return <div style={{ width: '100vw', height: '100vh', display: 'grid', gridTemplateColumns: '390px 1fr', overflow: 'hidden', background: '#020617', color: '#e2e8f0', fontFamily: 'Segoe UI, PingFang SC, Microsoft YaHei, sans-serif' }}>
    <aside style={{ padding: 14, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, borderRight: '1px solid #334155' }}>
      <h2 style={{ margin: 0 }}>头像配置编辑器</h2><div style={{ fontSize: 12, color: '#94a3b8' }}>{message}</div>
      <section style={panel}><strong>人物</strong>
        <select style={{ ...input, marginTop: 8 }} value={activeCharacterId} onChange={(e) => { const id = e.target.value; setActiveCharacterId(id); setActiveExpressionId(configs[id].expressions[0]?.id ?? ''); }}>{Object.values(configs).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select>
        <label>人物 ID<input style={input} value={activeCharacterId} onChange={(e) => renameCharacterId(e.target.value)} /></label>
        <label>人物名称<input style={input} value={character?.name ?? ''} onChange={(e) => patchCharacter({ name: e.target.value })} /></label>
        <button onClick={() => { const id = uniqueId('character', Object.keys(configs)); setConfigs((c) => ({ ...c, [id]: { id, name: '新人物', container: defaultContainer(), expressions: [makeExpression(images[0] ?? '')] } })); setActiveCharacterId(id); setActiveExpressionId('default'); }}>新增人物</button>
        <button disabled={Object.keys(configs).length <= 1} onClick={() => { const next = { ...configs }; delete next[activeCharacterId]; const id = Object.keys(next)[0]; setConfigs(next); setActiveCharacterId(id); setActiveExpressionId(next[id].expressions[0]?.id ?? ''); }}>删除人物</button>
      </section>
      <section style={panel}><strong>表情</strong>
        <select style={{ ...input, marginTop: 8 }} value={expression?.id ?? ''} onChange={(e) => setActiveExpressionId(e.target.value)}>{character?.expressions.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select>
        <label>表情 ID<input style={input} value={expression?.id ?? ''} onChange={(e) => renameExpressionId(e.target.value)} /></label>
        <label>表情名称<input style={input} value={expression?.name ?? ''} onChange={(e) => patchExpression({ name: e.target.value })} /></label>
        <button onClick={() => { if (!character) return; const id = uniqueId('expression', character.expressions.map((item) => item.id)); patchCharacter({ expressions: [...character.expressions, { ...makeExpression(images[0] ?? ''), id, name: '新表情' }] }); setActiveExpressionId(id); }}>新增表情</button>
        <button disabled={!character || character.expressions.length <= 1} onClick={() => { if (!character || !expression) return; const next = character.expressions.filter((item) => item.id !== expression.id); patchCharacter({ expressions: next }); setActiveExpressionId(next[0]?.id ?? ''); }}>删除表情</button>
      </section>
      <section style={panel}><strong>图片来源</strong><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}><button onClick={() => { setMode('single'); patchExpression({ atlas: undefined }); }}>单图</button><button onClick={() => { setMode('atlas'); if (atlasPath) void loadAtlas(atlasPath); }}>图集帧</button></div>
        {mode === 'single' ? <><label>扫描 public 下图片<select style={input} value={expression?.imagePath ?? ''} onChange={(e) => patchExpression({ imagePath: e.target.value, atlas: undefined })}><option value="">无图片</option>{images.map((path) => <option key={path} value={path}>{path}</option>)}</select></label><label>图片路径<input style={input} value={expression?.imagePath ?? ''} onChange={(e) => patchExpression({ imagePath: normalizePublicPath(e.target.value), atlas: undefined })} /></label></> : <><label>扫描 public 下图集<select style={input} value={atlasPath} onChange={(e) => void loadAtlas(e.target.value)}>{atlases.map((path) => <option key={path} value={path}>{path}</option>)}</select></label><label>图集帧<select style={input} value={expression?.atlas?.frameName ?? ''} onChange={(e) => patchExpression({ atlas: { jsonPath: atlasPath, frameName: e.target.value } })}>{frameNames.map((name) => <option key={name}>{name}</option>)}</select></label></>}
      </section>
      <section style={panel}><strong>图标位置</strong>{(['offsetX', 'offsetY'] as const).map((field) => <label key={field}>{field}：{expression?.[field] ?? 0}px<input type="range" min={-500} max={500} value={expression?.[field] ?? 0} onChange={(e) => patchExpression({ [field]: Number(e.target.value) })} style={{ width: '100%' }} /></label>)}<label>缩放：{expression?.scale ?? 1}<input type="range" min={0.1} max={5} step={0.01} value={expression?.scale ?? 1} onChange={(e) => patchExpression({ scale: Number(e.target.value) })} style={{ width: '100%' }} /></label><button onClick={() => patchExpression({ offsetX: 0, offsetY: 0, scale: 1 })}>重置位置</button></section>
      <section style={panel}><strong>容器尺寸与形状</strong>
        <label>形状<select style={input} value={container.shape} onChange={(e) => patchContainer({ shape: e.target.value as AvatarContainerShape })}><option value="square">方形 / 矩形</option><option value="rounded">圆角矩形</option><option value="circle">圆形</option><option value="ellipse">椭圆</option></select></label>
        {(['width', 'height'] as const).map((field) => <label key={field}>{field === 'width' ? '宽度' : '高度'}：{container[field]}px<div style={{ display: 'grid', gridTemplateColumns: '1fr 76px', gap: 8 }}><input type="range" min={48} max={800} value={container[field]} onChange={(e) => patchContainer({ [field]: Number(e.target.value) })} /><input style={input} type="number" min={48} max={1600} value={container[field]} onChange={(e) => patchContainer({ [field]: Math.max(48, Number(e.target.value) || 48) })} /></div></label>)}
        {container.shape === 'rounded' ? <label>圆角：{container.borderRadius}px<input type="range" min={0} max={Math.min(container.width, container.height) / 2} value={container.borderRadius} onChange={(e) => patchContainer({ borderRadius: Number(e.target.value) })} style={{ width: '100%' }} /></label> : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 8 }}><button onClick={() => patchContainer({ width: 128, height: 128 })}>128²</button><button onClick={() => patchContainer({ width: 256, height: 256 })}>256²</button><button onClick={() => patchContainer({ width: 320, height: 180 })}>16:9</button></div>
      </section>
      <button onClick={() => void save()} style={{ padding: 10, background: '#16a34a', color: 'white', border: 0, borderRadius: 8 }}>保存头像配置</button>
    </aside>
    <main style={{ minWidth: 0, minHeight: 0, padding: 28, overflow: 'auto', display: 'grid', placeItems: 'center', backgroundImage: 'linear-gradient(45deg,#0f172a 25%,transparent 25%),linear-gradient(-45deg,#0f172a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#0f172a 75%),linear-gradient(-45deg,transparent 75%,#0f172a 75%)', backgroundSize: '32px 32px', backgroundPosition: '0 0,0 16px,16px -16px,-16px 0' }}>
      <div><div style={{ marginBottom: 8, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>{container.width} × {container.height}px · {container.shape}</div><div onPointerDown={(e) => { if (!expression) return; e.currentTarget.setPointerCapture(e.pointerId); dragRef.current = { x: e.clientX, y: e.clientY, offsetX: expression.offsetX, offsetY: expression.offsetY }; }} onPointerMove={(e) => { const drag = dragRef.current; if (drag) patchExpression({ offsetX: drag.offsetX + e.clientX - drag.x, offsetY: drag.offsetY + e.clientY - drag.y }); }} onPointerUp={() => { dragRef.current = null; }} style={{ width: container.width, height: container.height, position: 'relative', overflow: 'hidden', borderRadius: containerRadius, border: '2px solid #4ade80', background: '#172033', cursor: 'move', boxShadow: '0 0 50px rgba(74,222,128,.18)' }}><ConfigurableAvatar expression={expression} atlasFrame={resolvedAtlasFrame} fallbackText={character?.name.slice(0, 2) || '?'}><div style={{ position: 'absolute', left: 12, bottom: 10, padding: '4px 8px', background: 'rgba(2,6,23,.72)', borderRadius: 6, pointerEvents: 'none' }}>{character?.name} / {expression?.name}</div></ConfigurableAvatar></div></div>
    </main>
  </div>;
};
