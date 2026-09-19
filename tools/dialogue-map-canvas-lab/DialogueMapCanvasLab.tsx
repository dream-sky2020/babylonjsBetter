import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cloneDialogueMapPreset,
  createDialogueMapPreset,
  loadDialogueMapPresetLibrary,
  saveDialogueMapPresetLibrary,
  validateDialogueMapPreset,
  type DialogueChoice,
  type DialogueMapNode,
  type DialogueMapPreset,
  type DialogueMapPresetLibrary,
  type DialogueNodeKind,
} from '@/core/dialogue-map';
import './dialogue-map-canvas-lab.css';

const NODE_WIDTH = 248;
const NODE_HEIGHT = 142;
const KIND_LABEL: Record<DialogueNodeKind, string> = { dialogue: '对话', choice: '选择', end: '结束' };
const KIND_COLOR: Record<DialogueNodeKind, string> = { dialogue: '#3b82f6', choice: '#a855f7', end: '#ef6461' };

const makeId = (prefix: string, existing: ReadonlySet<string>): string => {
  let index = 1;
  let id = prefix;
  while (existing.has(id)) id = `${prefix}_${index++}`;
  return id;
};

const shortText = (value: string, length: number): string => value.length > length ? `${value.slice(0, length - 1)}…` : value;

type DialogueCanvasProps = {
  preset: DialogueMapPreset;
  selectedNodeId: string;
  resetViewToken: number;
  onSelectNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, position: { x: number; y: number }) => void;
};

const DialogueCanvas: React.FC<DialogueCanvasProps> = ({ preset, selectedNodeId, resetViewToken, onSelectNode, onMoveNode }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [view, setView] = useState({ x: 48, y: 48, scale: 1 });
  const gesture = useRef<{
    mode: 'node' | 'pan'; nodeId?: string; startX: number; startY: number;
    originX: number; originY: number; nodeX?: number; nodeY?: number;
  } | undefined>(undefined);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => setSize({ width: Math.max(1, host.clientWidth), height: Math.max(1, host.clientHeight) });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const nodes = Object.values(preset.nodes);
    if (!nodes.length) return;
    const minX = Math.min(...nodes.map((node) => node.position.x));
    const minY = Math.min(...nodes.map((node) => node.position.y));
    const maxX = Math.max(...nodes.map((node) => node.position.x + NODE_WIDTH));
    const maxY = Math.max(...nodes.map((node) => node.position.y + NODE_HEIGHT));
    const scale = Math.min(1.25, Math.max(0.35, Math.min((size.width - 100) / Math.max(1, maxX - minX), (size.height - 100) / Math.max(1, maxY - minY))));
    // Canvas 视口重置是这个 Effect 对预设/容器尺寸变化的同步结果。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView({ x: (size.width - (maxX - minX) * scale) / 2 - minX * scale, y: (size.height - (maxY - minY) * scale) / 2 - minY * scale, scale });
    // 只在切换预设、显式适配或容器尺寸变化时重置；拖动节点不能触发自动适配。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset.presetKey, resetViewToken, size.width, size.height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * ratio);
    canvas.height = Math.round(size.height * ratio);
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, size.width, size.height);

    const gridSize = 24 * view.scale;
    if (gridSize >= 8) {
      ctx.strokeStyle = 'rgba(148, 163, 184, .08)';
      ctx.lineWidth = 1;
      const offsetX = ((view.x % gridSize) + gridSize) % gridSize;
      const offsetY = ((view.y % gridSize) + gridSize) % gridSize;
      ctx.beginPath();
      for (let x = offsetX; x < size.width; x += gridSize) { ctx.moveTo(x, 0); ctx.lineTo(x, size.height); }
      for (let y = offsetY; y < size.height; y += gridSize) { ctx.moveTo(0, y); ctx.lineTo(size.width, y); }
      ctx.stroke();
    }

    const sx = (x: number) => view.x + x * view.scale;
    const sy = (y: number) => view.y + y * view.scale;
    Object.values(preset.nodes).forEach((node) => {
      node.choices.forEach((choice, index) => {
        if (!choice.targetNodeId) return;
        const target = preset.nodes[choice.targetNodeId];
        if (!target) return;
        const x1 = sx(node.position.x + NODE_WIDTH);
        const y1 = sy(node.position.y + 68 + index * 18);
        const x2 = sx(target.position.x);
        const y2 = sy(target.position.y + 48);
        const bend = Math.max(45, Math.abs(x2 - x1) * 0.45);
        ctx.strokeStyle = selectedNodeId === node.id ? '#7dd3fc' : 'rgba(148, 163, 184, .55)';
        ctx.lineWidth = selectedNodeId === node.id ? 2.2 : 1.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(x1 + bend, y1, x2 - bend, y2, x2, y2);
        ctx.stroke();
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - Math.cos(angle - .45) * 9, y2 - Math.sin(angle - .45) * 9);
        ctx.lineTo(x2 - Math.cos(angle + .45) * 9, y2 - Math.sin(angle + .45) * 9);
        ctx.closePath();
        ctx.fill();
      });
    });

    Object.values(preset.nodes).forEach((node) => {
      const x = sx(node.position.x);
      const y = sy(node.position.y);
      const width = NODE_WIDTH * view.scale;
      const height = NODE_HEIGHT * view.scale;
      const selected = node.id === selectedNodeId;
      ctx.save();
      ctx.shadowColor = selected ? 'rgba(56, 189, 248, .42)' : 'rgba(0, 0, 0, .35)';
      ctx.shadowBlur = selected ? 18 : 10;
      ctx.fillStyle = '#151d31';
      ctx.strokeStyle = selected ? '#38bdf8' : '#344158';
      ctx.lineWidth = selected ? 2.5 : 1;
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, 10 * view.scale);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = KIND_COLOR[node.kind];
      ctx.beginPath();
      ctx.roundRect(x, y, width, 7 * view.scale, [10 * view.scale, 10 * view.scale, 0, 0]);
      ctx.fill();
      const font = Math.max(9, 13 * view.scale);
      ctx.font = `600 ${font}px "Segoe UI", "Microsoft YaHei", sans-serif`;
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(shortText(node.title || node.id, 25), x + 14 * view.scale, y + 31 * view.scale);
      ctx.font = `${Math.max(8, 11 * view.scale)}px "Segoe UI", "Microsoft YaHei", sans-serif`;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`${KIND_LABEL[node.kind]} · ${node.speaker || '无说话者'}`, x + 14 * view.scale, y + 51 * view.scale);
      ctx.fillStyle = '#d7deea';
      ctx.fillText(shortText(node.text || '（空内容）', 31), x + 14 * view.scale, y + 76 * view.scale);
      ctx.fillStyle = '#64748b';
      ctx.fillText(`${node.choices.length} 个出口  ·  ${node.id}`, x + 14 * view.scale, y + 121 * view.scale);
      if (preset.startNodeId === node.id) {
        ctx.fillStyle = '#22c55e';
        ctx.font = `700 ${Math.max(8, 10 * view.scale)}px "Segoe UI", sans-serif`;
        ctx.fillText('START', x + width - 49 * view.scale, y + 30 * view.scale);
      }
      ctx.restore();
    });
  }, [preset, selectedNodeId, size, view]);

  const eventPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const hitNode = (point: { x: number; y: number }): DialogueMapNode | undefined => Object.values(preset.nodes).reverse().find((node) => {
    const x = view.x + node.position.x * view.scale;
    const y = view.y + node.position.y * view.scale;
    return point.x >= x && point.x <= x + NODE_WIDTH * view.scale && point.y >= y && point.y <= y + NODE_HEIGHT * view.scale;
  });

  return <div className="dialogue-canvas" ref={hostRef}>
    <canvas
      ref={canvasRef}
      onPointerDown={(event) => {
        const point = eventPoint(event);
        const node = hitNode(point);
        event.currentTarget.setPointerCapture(event.pointerId);
        if (node) {
          onSelectNode(node.id);
          gesture.current = { mode: 'node', nodeId: node.id, startX: point.x, startY: point.y, originX: view.x, originY: view.y, nodeX: node.position.x, nodeY: node.position.y };
        } else {
          gesture.current = { mode: 'pan', startX: point.x, startY: point.y, originX: view.x, originY: view.y };
        }
      }}
      onPointerMove={(event) => {
        const active = gesture.current;
        if (!active) return;
        const point = eventPoint(event);
        if (active.mode === 'pan') setView((current) => ({ ...current, x: active.originX + point.x - active.startX, y: active.originY + point.y - active.startY }));
        else if (active.nodeId) onMoveNode(active.nodeId, { x: Math.round((active.nodeX ?? 0) + (point.x - active.startX) / view.scale), y: Math.round((active.nodeY ?? 0) + (point.y - active.startY) / view.scale) });
      }}
      onPointerUp={() => { gesture.current = undefined; }}
      onPointerCancel={() => { gesture.current = undefined; }}
      onWheel={(event) => {
        event.preventDefault();
        const point = { x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY };
        setView((current) => {
          const scale = Math.min(2.2, Math.max(.35, current.scale * (event.deltaY > 0 ? .9 : 1.1)));
          const worldX = (point.x - current.x) / current.scale;
          const worldY = (point.y - current.y) / current.scale;
          return { x: point.x - worldX * scale, y: point.y - worldY * scale, scale };
        });
      }}
    />
    <div className="dialogue-canvas__hint">拖动节点调整布局 · 拖动空白处平移 · 滚轮缩放</div>
    <div className="dialogue-canvas__zoom">{Math.round(view.scale * 100)}%</div>
  </div>;
};

export const DialogueMapCanvasLab: React.FC = () => {
  const [library, setLibrary] = useState<DialogueMapPresetLibrary>({});
  const [activeKey, setActiveKey] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [savedFingerprint, setSavedFingerprint] = useState('');
  const [message, setMessage] = useState('正在连接预设服务…');
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState('dialogue_map');
  const [newName, setNewName] = useState('新对话预设');
  const [resetViewToken, setResetViewToken] = useState(0);
  const preset = library[activeKey];
  const selectedNode = preset?.nodes[selectedNodeId];
  const fingerprint = useMemo(() => JSON.stringify(library), [library]);
  const dirty = Boolean(savedFingerprint && fingerprint !== savedFingerprint);
  const issues = useMemo(() => preset ? validateDialogueMapPreset(preset) : [], [preset]);

  const load = useCallback(async () => {
    try {
      setIsError(false);
      setMessage('正在加载对话预设…');
      const next = await loadDialogueMapPresetLibrary();
      const firstKey = Object.keys(next)[0] ?? '';
      setLibrary(next);
      setSavedFingerprint(JSON.stringify(next));
      setActiveKey((current) => next[current] ? current : firstKey);
      setSelectedNodeId((current) => next[firstKey]?.nodes[current] ? current : next[firstKey]?.startNodeId ?? '');
      setMessage(`已载入 ${Object.keys(next).length} 个对话预设。`);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    // 首次挂载连接数据源；后续重载由用户显式触发。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const updatePreset = useCallback((updater: (current: DialogueMapPreset) => DialogueMapPreset) => {
    setLibrary((current) => current[activeKey] ? { ...current, [activeKey]: updater(cloneDialogueMapPreset(current[activeKey])) } : current);
  }, [activeKey]);

  const updateNode = (nodeId: string, updater: (node: DialogueMapNode) => DialogueMapNode) => updatePreset((current) => ({
    ...current, nodes: { ...current.nodes, [nodeId]: updater({ ...current.nodes[nodeId], position: { ...current.nodes[nodeId].position }, choices: current.nodes[nodeId].choices.map((choice) => ({ ...choice })) }) },
  }));

  const createPreset = () => {
    const key = newKey.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(key) || library[key]) {
      setIsError(true); setMessage(library[key] ? '这个预设 Key 已存在。' : '预设 Key 只能包含字母、数字、下划线和连字符。'); return;
    }
    const next = createDialogueMapPreset(key, newName.trim() || key);
    setLibrary((current) => ({ ...current, [key]: next }));
    setActiveKey(key); setSelectedNodeId(next.startNodeId); setResetViewToken((value) => value + 1);
    setMessage(`已创建“${next.name}”，保存后写入配置目录。`); setIsError(false);
  };

  const addNode = (kind: DialogueNodeKind = 'dialogue') => {
    if (!preset) return;
    const id = makeId(kind === 'choice' ? 'choice' : kind === 'end' ? 'end' : 'dialogue', new Set(Object.keys(preset.nodes)));
    const node: DialogueMapNode = {
      id, kind, title: kind === 'end' ? '结束' : kind === 'choice' ? '新选择' : '新对话', speaker: '', text: '',
      position: { x: 100 + Object.keys(preset.nodes).length * 60, y: 100 + Object.keys(preset.nodes).length * 40 }, choices: [],
    };
    updatePreset((current) => ({ ...current, nodes: { ...current.nodes, [id]: node } }));
    setSelectedNodeId(id);
  };

  const deleteNode = () => {
    if (!preset || !selectedNode || Object.keys(preset.nodes).length <= 1) return;
    const remaining = Object.keys(preset.nodes).filter((id) => id !== selectedNode.id);
    const nextSelected = remaining[0];
    updatePreset((current) => {
      const nodes = Object.fromEntries(Object.entries(current.nodes).filter(([id]) => id !== selectedNode.id).map(([id, node]) => [id, {
        ...node, choices: node.choices.map((choice) => choice.targetNodeId === selectedNode.id ? { ...choice, targetNodeId: undefined } : choice),
      }]));
      return { ...current, startNodeId: current.startNodeId === selectedNode.id ? nextSelected : current.startNodeId, nodes };
    });
    setSelectedNodeId(nextSelected);
  };

  const addChoice = () => {
    if (!selectedNode) return;
    const id = makeId('option', new Set(selectedNode.choices.map((choice) => choice.id)));
    updateNode(selectedNode.id, (node) => ({ ...node, choices: [...node.choices, { id, text: node.kind === 'dialogue' ? '继续' : '新选项' }] }));
  };

  const updateChoice = (index: number, patch: Partial<DialogueChoice>) => {
    if (!selectedNode) return;
    updateNode(selectedNode.id, (node) => ({ ...node, choices: node.choices.map((choice, choiceIndex) => choiceIndex === index ? { ...choice, ...patch } : choice) }));
  };

  const save = async () => {
    const allIssues = Object.values(library).flatMap(validateDialogueMapPreset).filter((issue) => issue.code !== 'unreachable-node');
    if (allIssues.length) { setIsError(true); setMessage(`保存前请修复：${allIssues[0].message}`); return; }
    setSaving(true);
    try {
      await saveDialogueMapPresetLibrary(library);
      setSavedFingerprint(JSON.stringify(library)); setIsError(false); setMessage(`已保存 ${Object.keys(library).length} 个对话预设。`);
    } catch (error) { setIsError(true); setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setSaving(false); }
  };

  if (!preset) return <main className="dialogue-empty"><h1>Dialogue Map Canvas Lab</h1><p className={isError ? 'is-error' : ''}>{message}</p><button type="button" onClick={() => void load()}>重新加载</button></main>;

  return <div className="dialogue-lab">
    <header className="dialogue-lab__header">
      <div><span className="eyebrow">DIALOGUE DATA WORKBENCH</span><h1>Dialogue Map Canvas Lab</h1></div>
      <div className={`server-status${isError ? ' is-error' : ''}`}><i />{message}</div>
    </header>
    <aside className="dialogue-lab__sidebar">
      <section className="panel-card">
        <div className="panel-card__heading"><div><span>预设库</span><strong>{Object.keys(library).length}</strong></div><button type="button" onClick={() => void load()}>重新加载</button></div>
        <label className="field"><span>当前预设</span><select value={activeKey} onChange={(event) => { const key = event.target.value; setActiveKey(key); setSelectedNodeId(library[key].startNodeId); setResetViewToken((value) => value + 1); }}>{Object.values(library).map((item) => <option key={item.presetKey} value={item.presetKey}>{item.name}</option>)}</select></label>
        <label className="field"><span>显示名称</span><input value={preset.name} onChange={(event) => updatePreset((current) => ({ ...current, name: event.target.value }))} /></label>
        <div className="create-preset">
          <strong>新建预设</strong>
          <input aria-label="新预设 Key" value={newKey} onChange={(event) => setNewKey(event.target.value)} placeholder="preset_key" />
          <input aria-label="新预设名称" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="显示名称" />
          <button type="button" onClick={createPreset}>＋ 创建</button>
        </div>
      </section>
      <section className="panel-card node-list-card">
        <div className="panel-card__heading"><div><span>节点</span><strong>{Object.keys(preset.nodes).length}</strong></div></div>
        <div className="node-create-row"><button type="button" onClick={() => addNode('dialogue')}>＋ 对话</button><button type="button" onClick={() => addNode('choice')}>＋ 选择</button><button type="button" onClick={() => addNode('end')}>＋ 结束</button></div>
        <div className="node-list">{Object.values(preset.nodes).map((node) => <button type="button" key={node.id} className={node.id === selectedNodeId ? 'is-active' : ''} onClick={() => setSelectedNodeId(node.id)}><i style={{ background: KIND_COLOR[node.kind] }} /><span><strong>{node.title || node.id}</strong><small>{node.speaker || KIND_LABEL[node.kind]} · {node.id}</small></span>{preset.startNodeId === node.id ? <em>起点</em> : null}</button>)}</div>
      </section>
    </aside>
    <main className="dialogue-lab__stage">
      <div className="stage-toolbar">
        <div><strong>{preset.name}</strong><span>{preset.presetKey}</span>{dirty ? <em>● 未保存</em> : <em className="is-saved">✓ 已保存</em>}</div>
        <div className="stage-toolbar__actions"><span className={issues.length ? 'has-issues' : ''}>{issues.length ? `${issues.length} 项提示` : '✓ 校验通过'}</span><button type="button" onClick={() => setResetViewToken((value) => value + 1)}>适配全部</button><button type="button" className="save-button" disabled={saving} onClick={() => void save()}>{saving ? '保存中…' : '保存全部'}</button></div>
      </div>
      <DialogueCanvas preset={preset} selectedNodeId={selectedNodeId} resetViewToken={resetViewToken} onSelectNode={setSelectedNodeId} onMoveNode={(id, position) => updateNode(id, (node) => ({ ...node, position }))} />
      <div className="stage-status"><span>{Object.keys(preset.nodes).length} 个节点</span><span>{Object.values(preset.nodes).reduce((count, node) => count + node.choices.length, 0)} 条连接</span><span>{issues[0]?.message ?? '所有引用有效'}</span></div>
    </main>
    <aside className="dialogue-lab__inspector">
      <div className="inspector-title"><div><span>INSPECTOR</span><strong>{selectedNode?.title ?? '未选择节点'}</strong></div>{selectedNode ? <button type="button" className="danger-button" disabled={Object.keys(preset.nodes).length <= 1} onClick={deleteNode}>删除节点</button> : null}</div>
      {selectedNode ? <div className="inspector-scroll">
        <section className="panel-card">
          <div className="kind-row">{(['dialogue', 'choice', 'end'] as const).map((kind) => <button type="button" key={kind} className={selectedNode.kind === kind ? 'is-active' : ''} onClick={() => updateNode(selectedNode.id, (node) => ({ ...node, kind, choices: kind === 'end' ? [] : node.choices }))}>{KIND_LABEL[kind]}</button>)}</div>
          <label className="field"><span>节点 ID</span><input value={selectedNode.id} disabled /></label>
          <label className="field"><span>标题</span><input value={selectedNode.title} onChange={(event) => updateNode(selectedNode.id, (node) => ({ ...node, title: event.target.value }))} /></label>
          <label className="field"><span>说话者</span><input value={selectedNode.speaker} onChange={(event) => updateNode(selectedNode.id, (node) => ({ ...node, speaker: event.target.value }))} /></label>
          <label className="field"><span>对话内容</span><textarea rows={5} value={selectedNode.text} onChange={(event) => updateNode(selectedNode.id, (node) => ({ ...node, text: event.target.value }))} /></label>
          <label className="field"><span>标签（逗号分隔）</span><input value={(selectedNode.tags ?? []).join(', ')} onChange={(event) => updateNode(selectedNode.id, (node) => ({ ...node, tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) }))} /></label>
          <button type="button" className="start-button" disabled={preset.startNodeId === selectedNode.id} onClick={() => updatePreset((current) => ({ ...current, startNodeId: selectedNode.id }))}>{preset.startNodeId === selectedNode.id ? '✓ 当前起始节点' : '设为起始节点'}</button>
        </section>
        <section className="panel-card">
          <div className="panel-card__heading"><div><span>出口与选择</span><strong>{selectedNode.choices.length}</strong></div>{selectedNode.kind !== 'end' ? <button type="button" onClick={addChoice}>＋ 出口</button> : null}</div>
          {selectedNode.choices.map((choice, index) => <div className="choice-editor" key={`${choice.id}-${index}`}>
            <div><strong>出口 {index + 1}</strong><button type="button" aria-label="删除出口" onClick={() => updateNode(selectedNode.id, (node) => ({ ...node, choices: node.choices.filter((_, choiceIndex) => choiceIndex !== index) }))}>×</button></div>
            <label className="field"><span>ID</span><input value={choice.id} onChange={(event) => updateChoice(index, { id: event.target.value })} /></label>
            <label className="field"><span>显示文本</span><input value={choice.text} onChange={(event) => updateChoice(index, { text: event.target.value })} /></label>
            <label className="field"><span>目标节点</span><select value={choice.targetNodeId ?? ''} onChange={(event) => updateChoice(index, { targetNodeId: event.target.value || undefined })}><option value="">不连接</option>{Object.values(preset.nodes).filter((node) => node.id !== selectedNode.id).map((node) => <option key={node.id} value={node.id}>{node.title || node.id} · {node.id}</option>)}</select></label>
            <label className="field"><span>条件（可选）</span><input value={choice.condition ?? ''} onChange={(event) => updateChoice(index, { condition: event.target.value || undefined })} placeholder="例如 flags.helped_guard" /></label>
            <label className="field"><span>事件（可选）</span><input value={choice.event ?? ''} onChange={(event) => updateChoice(index, { event: event.target.value || undefined })} placeholder="例如 quest:start" /></label>
          </div>)}
          {!selectedNode.choices.length ? <p className="empty-note">这个节点还没有出口。</p> : null}
        </section>
        {issues.filter((issue) => issue.nodeId === selectedNode.id).length ? <section className="panel-card issue-card"><strong>节点提示</strong>{issues.filter((issue) => issue.nodeId === selectedNode.id).map((issue) => <p key={`${issue.code}-${issue.choiceId ?? ''}`}>{issue.message}</p>)}</section> : null}
      </div> : null}
    </aside>
  </div>;
};
