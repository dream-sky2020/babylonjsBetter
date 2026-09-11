import { useEffect, useMemo, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react';
import { openCommandMenuFromElement, type CommandMenuEntry } from '@/core/ui/menu';
import {
  createCoreSignalNodeRegistry, evaluateSignalGraph,
  type SignalGraphDocument, type SignalGraphEvaluation, type SignalGraphNode,
  type SignalGraphOutput, type SignalPortDefinition, type SignalValue,
} from '@/core/animation/signal';
import type { NumericContributionMix } from '@/core/animation/contribution';
import type { AnimationObjectRecord, AnimationWorkspace, PreviewSignalBinding } from './animationWorkspace.ts';
import { createPreviewContributionMix, previewTargetKey } from './previewContributionMixer.ts';
import type { TransformRecordMode } from './transformRecording.ts';
import { DopeSheet } from './DopeSheet.tsx';
import { EventTrack } from './EventTrack.tsx';
import { CurveEditor } from './CurveEditor.tsx';

type WorkspaceTab = 'graph' | 'dopesheet' | 'events' | 'curves' | 'parameters' | 'output';
type PendingPort = Readonly<{ nodeId: string; portId: string; valueTypeId: string }>;
type Props = Readonly<{
  graph: SignalGraphDocument;
  bindings: readonly PreviewSignalBinding[];
  objects: readonly AnimationObjectRecord[];
  selectedObjectId: string | null;
  transport: AnimationWorkspace['transport'];
  events: AnimationWorkspace['events'];
  time: number;
  recordMode: TransformRecordMode;
  onTimeChange: Dispatch<SetStateAction<number>>;
  onRecordModeChange(mode: TransformRecordMode): void;
  onBeginEdit(): void;
  onEndEdit(): void;
  onGraphChange(graph: SignalGraphDocument): void;
  onBindingsChange(bindings: readonly PreviewSignalBinding[]): void;
  onTransportChange(transport: AnimationWorkspace['transport']): void;
  onEventsChange(events: AnimationWorkspace['events']): void;
  onEvaluate(evaluation: SignalGraphEvaluation, contributionMix: NumericContributionMix): void;
}>;

const registry = createCoreSignalNodeRegistry();
const makeId = (prefix: string) => globalThis.crypto?.randomUUID?.() ?? `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const NODE_WIDTH = 176;
const PORT_TOP = 50;
const PORT_STEP = 25;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finite = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const formatValue = (value: SignalValue) => typeof value === 'number' ? value.toFixed(4) : typeof value === 'boolean' ? String(value) : value && typeof value === 'object' ? `${value.x.toFixed(2)}, ${value.y.toFixed(2)}, ${value.z.toFixed(2)}` : 'null';

const MiniIcon = ({ name }: { name: 'add' | 'play' | 'pause' | 'stop' | 'delete' | 'output' }) => <svg viewBox="0 0 20 20" aria-hidden="true">
  {name === 'add' && <path d="M10 3v14M3 10h14" />}
  {name === 'play' && <path d="m6 3 10 7-10 7z" />}
  {name === 'pause' && <path d="M6 4v12m8-12v12" />}
  {name === 'stop' && <path d="M5 5h10v10H5z" />}
  {name === 'delete' && <path d="M4 6h12M8 6V3h4v3m3 0-1 11H6L5 6m4 3v5m2-5v5" />}
  {name === 'output' && <path d="M3 10h11m-4-4 4 4-4 4m4-8h3v8h-3" />}
</svg>;

const inputDefault = (node: SignalGraphNode, port: SignalPortDefinition) => {
  const raw = node.config.inputDefaults;
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? finite((raw as Record<string, unknown>)[port.id], finite(port.defaultValue)) : finite(port.defaultValue);
};

export function SignalWorkspace({ graph, bindings, objects, selectedObjectId, transport, events, time, recordMode, onTimeChange, onRecordModeChange, onBeginEdit, onEndEdit, onGraphChange, onBindingsChange, onTransportChange, onEventsChange, onEvaluate }: Props) {
  const [tab, setTab] = useState<WorkspaceTab>('graph');
  const [selectedNodeId, setSelectedNodeId] = useState(graph.nodes[0]?.id ?? null);
  const [pendingPort, setPendingPort] = useState<PendingPort | null>(null);
  const [playing, setPlaying] = useState(false);
  const { duration, loop, playbackSpeed } = transport;
  const lastFrameRef = useRef<number | null>(null);
  const onEvaluateRef = useRef(onEvaluate);
  const graphChangeRef = useRef(onGraphChange);
  const endEditRef = useRef(onEndEdit);
  const dragRef = useRef<{ id: string; startX: number; startY: number; nodeX: number; nodeY: number } | null>(null);
  useEffect(() => { onEvaluateRef.current = onEvaluate; }, [onEvaluate]);
  useEffect(() => { graphChangeRef.current = onGraphChange; }, [onGraphChange]);
  useEffect(() => { endEditRef.current = onEndEdit; }, [onEndEdit]);

  const evaluation = useMemo(() => evaluateSignalGraph(graph, registry, time), [graph, time]);
  const contributionMix = useMemo(() => createPreviewContributionMix(evaluation, bindings, objects), [evaluation, bindings, objects]);
  useEffect(() => { onEvaluateRef.current(evaluation, contributionMix); }, [evaluation, contributionMix]);
  useEffect(() => {
    if (!playing) { lastFrameRef.current = null; return; }
    let frame = 0;
    const tick = (now: number) => {
      const previous = lastFrameRef.current ?? now; lastFrameRef.current = now;
      onTimeChange(current => {
        const next = current + Math.min(0.1, (now - previous) / 1000) * playbackSpeed;
        if (next <= duration) return next;
        if (loop) return duration > 0 ? next % duration : 0;
        setPlaying(false); return duration;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration, loop, playbackSpeed, onTimeChange]);
  useEffect(() => { if (time > duration) onTimeChange(duration); }, [time, duration, onTimeChange]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current; if (!drag) return;
      const x = Math.max(8, drag.nodeX + event.clientX - drag.startX);
      const y = Math.max(8, drag.nodeY + event.clientY - drag.startY);
      graphChangeRef.current({ ...graph, nodes: graph.nodes.map(node => node.id === drag.id ? { ...node, position: { x, y } } : node) });
    };
    const end = () => { if (dragRef.current) endEditRef.current(); dragRef.current = null; };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); };
  }, [graph]);

  const activeNodeId = selectedNodeId && graph.nodes.some(node => node.id === selectedNodeId) ? selectedNodeId : graph.nodes[0]?.id ?? null;

  const updateNode = (id: string, patch: Partial<SignalGraphNode>) => onGraphChange({ ...graph, nodes: graph.nodes.map(node => node.id === id ? { ...node, ...patch } : node) });
  const addNode = (typeId: string, destination: WorkspaceTab = 'graph') => {
    const definition = registry.get(typeId); if (!definition) return;
    const node: SignalGraphNode = { id: makeId('node'), typeId, version: definition.version, label: definition.label, position: { x: 54 + graph.nodes.length * 24, y: 42 + graph.nodes.length * 18 }, config: definition.createConfig() };
    onGraphChange({ ...graph, nodes: [...graph.nodes, node] }); setSelectedNodeId(node.id); setTab(destination);
  };
  const addNodeMenu = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const categories = new Map<string, CommandMenuEntry[]>();
    registry.list().forEach(definition => {
      const entries = categories.get(definition.category) ?? [];
      entries.push({ id: definition.typeId, label: definition.label, action: () => addNode(definition.typeId) }); categories.set(definition.category, entries);
    });
    openCommandMenuFromElement(event.currentTarget, [...categories].map(([category, children]) => ({ id: category, label: category, children })), { ariaLabel: '添加 Signal Node' });
  };
  const deleteNode = (id: string) => {
    const removedOutputIds = new Set(graph.outputs.filter(output => output.source.nodeId === id).map(output => output.id));
    onGraphChange({ ...graph, nodes: graph.nodes.filter(node => node.id !== id), connections: graph.connections.filter(connection => connection.source.nodeId !== id && connection.target.nodeId !== id), outputs: graph.outputs.filter(output => output.source.nodeId !== id) });
    if (removedOutputIds.size) onBindingsChange(bindings.filter(binding => !removedOutputIds.has(binding.outputId) && !removedOutputIds.has(String(binding.config.modulationOutputId ?? ''))));
    setPendingPort(current => current?.nodeId === id ? null : current);
  };
  const connectInput = (node: SignalGraphNode, port: SignalPortDefinition) => {
    if (!pendingPort || pendingPort.nodeId === node.id || pendingPort.valueTypeId !== port.valueTypeId) return;
    const connection = { id: makeId('connection'), source: { nodeId: pendingPort.nodeId, portId: pendingPort.portId }, target: { nodeId: node.id, portId: port.id } };
    onGraphChange({ ...graph, connections: [...graph.connections.filter(item => !(item.target.nodeId === node.id && item.target.portId === port.id)), connection] }); setPendingPort(null);
  };
  const exposeOutput = (node: SignalGraphNode, port: SignalPortDefinition) => {
    if (graph.outputs.some(output => output.source.nodeId === node.id && output.source.portId === port.id)) return;
    const output: SignalGraphOutput = { id: makeId('output'), name: `${node.label} · ${port.label}`, valueTypeId: port.valueTypeId, source: { nodeId: node.id, portId: port.id } };
    onGraphChange({ ...graph, outputs: [...graph.outputs, output] });
  };
  const removeOutput = (outputId: string) => {
    onGraphChange({ ...graph, outputs: graph.outputs.filter(output => output.id !== outputId) });
    onBindingsChange(bindings.filter(binding => binding.outputId !== outputId && binding.config.modulationOutputId !== outputId));
  };
  const removeConnectionAtInput = (nodeId: string, portId: string) => onGraphChange({ ...graph, connections: graph.connections.filter(item => !(item.target.nodeId === nodeId && item.target.portId === portId)) });
  const setNodeInputDefault = (node: SignalGraphNode, portId: string, value: number) => updateNode(node.id, { config: { ...node.config, inputDefaults: { ...(node.config.inputDefaults as Record<string, unknown> ?? {}), [portId]: value } } });

  const addParameter = () => onGraphChange({ ...graph, parameters: [...graph.parameters, { id: makeId('parameter'), name: `Parameter ${graph.parameters.length + 1}`, valueTypeId: 'core.number', value: 1 }] });
  const updateParameter = (id: string, patch: Record<string, unknown>) => onGraphChange({ ...graph, parameters: graph.parameters.map(parameter => parameter.id === id ? { ...parameter, ...patch } : parameter) });
  const deleteParameter = (id: string) => onGraphChange({ ...graph, parameters: graph.parameters.filter(parameter => parameter.id !== id) });

  const addBinding = () => {
    const output = graph.outputs.find(item => item.valueTypeId === 'core.number'); const object = objects.find(item => item.id === selectedObjectId) ?? objects.find(item => item.id !== 'workspace-root');
    if (!output || !object) return;
    onBindingsChange([...bindings, { id: makeId('binding'), outputId: output.id, objectId: object.id, adapterTypeId: 'babylon.transform-component.number', config: { path: 'position.y', operation: 'additive', scale: 1, offset: 0, weight: 1, priority: 0, enabled: true, solo: false, modulationOutputId: '' } }]); setTab('output');
  };
  const updateBinding = (id: string, patch: Partial<PreviewSignalBinding>) => onBindingsChange(bindings.map(binding => binding.id === id ? { ...binding, ...patch } : binding));
  const updateBindingConfig = (binding: PreviewSignalBinding, patch: Record<string, unknown>) => updateBinding(binding.id, { config: { ...binding.config, ...patch } });

  const selectedNode = graph.nodes.find(node => node.id === activeNodeId);
  const selectedDefinition = selectedNode ? registry.get(selectedNode.typeId) : undefined;
  return <section className="awb-signal-dock">
    <header>
      <div className="awb-signal-title"><b>SIGNAL WORKSPACE</b><span>{graph.nodes.length} nodes · {graph.connections.length} links · {graph.outputs.length} outputs</span></div>
      <div className="awb-transport">
        <div className="awb-record-modes" aria-label="关键帧录制模式"><button className={recordMode === 'off' ? 'active' : ''} onClick={() => onRecordModeChange('off')} title="编辑基础值，不自动创建关键帧">EDIT</button><button className={recordMode === 'auto' ? 'active auto' : ''} onClick={() => onRecordModeChange('auto')} title="仅对已有动画属性自动成键">AUTO</button><button className={recordMode === 'record' ? 'active record' : ''} onClick={() => onRecordModeChange('record')} title="属性变化时自动创建轨道和关键帧"><i />REC</button></div>
        <button className={playing ? 'active' : ''} onClick={() => setPlaying(value => !value)} title={playing ? '暂停' : '播放'}><MiniIcon name={playing ? 'pause' : 'play'} /></button>
        <button onClick={() => { setPlaying(false); onTimeChange(0); }} title="停止并回到开始"><MiniIcon name="stop" /></button>
        <label><span>TIME</span><input type="number" min="0" max={duration} step="0.001" value={Number(time.toFixed(3))} onChange={event => onTimeChange(clamp(Number(event.target.value), 0, duration))} /></label>
        <input className="awb-time-scrubber" aria-label="当前时间" type="range" min="0" max={duration} step="0.001" value={time} onChange={event => onTimeChange(Number(event.target.value))} />
        <label><span>END</span><input type="number" min="0.05" step="0.1" value={duration} onChange={event => onTransportChange({ ...transport, duration: Math.max(0.05, Number(event.target.value) || 2) })} /></label>
        <label><span>SPEED</span><input type="number" min="0.01" step="0.1" value={playbackSpeed} onChange={event => onTransportChange({ ...transport, playbackSpeed: Math.max(.01, Number(event.target.value) || 1) })} /></label>
        <label className="awb-loop"><input type="checkbox" checked={loop} onChange={event => onTransportChange({ ...transport, loop: event.target.checked })} /> LOOP</label>
      </div>
      <nav>{([['graph', 'Graph'], ['dopesheet', 'Dope Sheet'], ['events', 'Events'], ['curves', 'Curves'], ['parameters', 'Parameters'], ['output', 'Live Output']] as const).map(item => <button key={item[0]} className={tab === item[0] ? 'active' : ''} onClick={() => setTab(item[0])}>{item[1]}</button>)}</nav>
    </header>

    {tab === 'graph' && <div className="awb-graph-layout">
      <div className="awb-graph-toolbar"><button onClick={addNodeMenu}><MiniIcon name="add" />添加节点</button><span>{pendingPort ? '请选择兼容的输入端口' : '从输出端口点击并连接到输入端口'}</span>{pendingPort && <button onClick={() => setPendingPort(null)}>取消连接</button>}</div>
      <div className="awb-graph-scroll" onPointerDown={() => setPendingPort(null)}>
        <div className="awb-graph-canvas">
          <svg className="awb-graph-links" viewBox="0 0 1600 900" preserveAspectRatio="none">
            {graph.connections.map(connection => {
              const source = graph.nodes.find(node => node.id === connection.source.nodeId); const target = graph.nodes.find(node => node.id === connection.target.nodeId);
              const sourceDefinition = source ? registry.get(source.typeId) : undefined; const targetDefinition = target ? registry.get(target.typeId) : undefined;
              if (!source || !target || !sourceDefinition || !targetDefinition) return null;
              const sourceIndex = sourceDefinition.outputs.findIndex(port => port.id === connection.source.portId); const targetIndex = targetDefinition.inputs.findIndex(port => port.id === connection.target.portId);
              const x1 = source.position.x + NODE_WIDTH; const y1 = source.position.y + PORT_TOP + sourceIndex * PORT_STEP; const x2 = target.position.x; const y2 = target.position.y + PORT_TOP + targetIndex * PORT_STEP;
              return <path key={connection.id} d={`M${x1} ${y1} C${x1 + 70} ${y1},${x2 - 70} ${y2},${x2} ${y2}`} />;
            })}
          </svg>
          {graph.nodes.map(node => {
            const definition = registry.get(node.typeId); if (!definition) return null;
            return <article key={node.id} className={`awb-signal-node ${activeNodeId === node.id ? 'selected' : ''}`} style={{ left: node.position.x, top: node.position.y }} onPointerDown={event => event.stopPropagation()} onClick={() => setSelectedNodeId(node.id)}>
              <header onPointerDown={event => { if (event.button !== 0) return; onBeginEdit(); dragRef.current = { id: node.id, startX: event.clientX, startY: event.clientY, nodeX: node.position.x, nodeY: node.position.y }; setSelectedNodeId(node.id); }}><i /> <input value={node.label} aria-label="节点名称" onPointerDown={event => event.stopPropagation()} onChange={event => updateNode(node.id, { label: event.target.value })} /><small>{definition.category}</small></header>
              <div className="awb-node-ports">
                <div>{definition.inputs.map(port => {
                  const connected = graph.connections.some(item => item.target.nodeId === node.id && item.target.portId === port.id);
                  return <div className="awb-node-port input" key={port.id}><button className={connected ? 'connected' : ''} title={connected ? '点击断开' : '连接输入'} onClick={() => connected ? removeConnectionAtInput(node.id, port.id) : connectInput(node, port)} /><span>{port.label}</span>{!connected && port.valueTypeId === 'core.number' && <input type="number" step="0.1" value={inputDefault(node, port)} onChange={event => setNodeInputDefault(node, port.id, Number(event.target.value))} />}</div>;
                })}</div>
                <div>{definition.outputs.map(port => <div className="awb-node-port output" key={port.id}><span>{port.label}</span><button className={pendingPort?.nodeId === node.id && pendingPort.portId === port.id ? 'pending' : ''} title="开始连接" onClick={() => setPendingPort({ nodeId: node.id, portId: port.id, valueTypeId: port.valueTypeId })} /></div>)}</div>
              </div>
              {node.typeId === 'core.number' && <label className="awb-node-config">Value<input type="number" step="0.1" value={finite(node.config.value, 1)} onChange={event => updateNode(node.id, { config: { ...node.config, value: Number(event.target.value) } })} /></label>}
              {node.typeId === 'core.parameter' && <label className="awb-node-config">Parameter<select value={String(node.config.parameterId ?? '')} onChange={event => updateNode(node.id, { config: { ...node.config, parameterId: event.target.value } })}><option value="">未选择</option>{graph.parameters.map(parameter => <option key={parameter.id} value={parameter.id}>{parameter.name}</option>)}</select></label>}
            </article>;
          })}
        </div>
      </div>
      <aside className="awb-node-inspector">{selectedNode && selectedDefinition ? <><header><strong>{selectedNode.label}</strong><small>{selectedNode.typeId}</small></header><div className="awb-node-actions"><button onClick={() => deleteNode(selectedNode.id)}><MiniIcon name="delete" />删除节点</button></div><h4>公开输出</h4>{selectedDefinition.outputs.map(port => { const exposed = graph.outputs.find(output => output.source.nodeId === selectedNode.id && output.source.portId === port.id); return <div className="awb-expose-row" key={port.id}><span>{port.label}</span>{exposed ? <button onClick={() => removeOutput(exposed.id)}>取消公开</button> : <button onClick={() => exposeOutput(selectedNode, port)}><MiniIcon name="output" />公开</button>}</div>; })}{selectedNode.typeId === 'core.curve.number' && <button className="awb-primary-row" onClick={() => setTab('curves')}>在 Curves 中编辑</button>}</> : <div className="awb-empty">选择节点查看设置</div>}</aside>
    </div>}

    {tab === 'dopesheet' && <DopeSheet key={selectedObjectId ?? 'none'} graph={graph} bindings={bindings} objects={objects} selectedObjectId={selectedObjectId} time={time} duration={duration} onTimeChange={onTimeChange} onGraphChange={onGraphChange} onBeginEdit={onBeginEdit} onEndEdit={onEndEdit} />}

    {tab === 'events' && <EventTrack events={events} time={time} duration={duration} playing={playing} onTimeChange={onTimeChange} onEventsChange={onEventsChange} onBeginEdit={onBeginEdit} onEndEdit={onEndEdit} />}

    {tab === 'curves' && <CurveEditor graph={graph} bindings={bindings} objects={objects} selectedObjectId={selectedObjectId} selectedNodeId={activeNodeId} time={time} duration={duration} onTimeChange={onTimeChange} onSelectedNodeIdChange={setSelectedNodeId} onGraphChange={onGraphChange} onCreateCurve={() => addNode('core.curve.number', 'curves')} onBeginEdit={onBeginEdit} onEndEdit={onEndEdit} />}

    {tab === 'parameters' && <div className="awb-parameter-page"><header><div><strong>GRAPH PARAMETERS</strong><span>Parameter 节点按永久 ID 引用这些运行时输入。</span></div><button onClick={addParameter}><MiniIcon name="add" />添加参数</button></header><div className="awb-table-head"><span>Name</span><span>Type</span><span>Value</span><span /></div>{graph.parameters.map(parameter => <div className="awb-table-row" key={parameter.id}><input value={parameter.name} onChange={event => updateParameter(parameter.id, { name: event.target.value })} /><code>{parameter.valueTypeId}</code><input type="number" step="0.1" value={finite(parameter.value)} onChange={event => updateParameter(parameter.id, { value: Number(event.target.value) })} /><button onClick={() => deleteParameter(parameter.id)}><MiniIcon name="delete" /></button></div>)}</div>}

    {tab === 'output' && <div className="awb-output-page"><section><header><div><strong>LIVE OUTPUTS</strong><span>公开信号保持独立，不预先烘焙为固定动作。</span></div></header>{graph.outputs.map(output => <div className="awb-output-row" key={output.id}><i /><input value={output.name} onChange={event => onGraphChange({ ...graph, outputs: graph.outputs.map(item => item.id === output.id ? { ...item, name: event.target.value } : item) })} /><code>{output.valueTypeId}</code><b>{formatValue(evaluation.outputs.get(output.id) ?? null)}</b><button onClick={() => removeOutput(output.id)}><MiniIcon name="delete" /></button></div>)}{!graph.outputs.length && <div className="awb-empty">先在 Graph 中公开一个节点输出</div>}<header className="awb-mix-result-title"><div><strong>MIXED TARGETS</strong><span>每个目标每帧只接收一个最终值。</span></div></header>{[...contributionMix.values].map(([target, value]) => <div className="awb-mix-result" key={target}><span>{target.replace(':', ' · ')}</span><b>{value.toFixed(4)}</b><small>{contributionMix.groups.get(target)?.filter(item => item.effectiveWeight > 0).length ?? 0} active</small></div>)}</section><section><header><div><strong>CONTRIBUTION MIXER</strong><span>Add / Set / Multiply、权重、优先级、Solo 与信号调制。</span></div><button onClick={addBinding} disabled={!graph.outputs.length}><MiniIcon name="add" />添加贡献</button></header>{bindings.map(binding => { const path = String(binding.config.path ?? 'position.y'); const targetKey = previewTargetKey(binding.objectId, path); const applied = contributionMix.groups.get(targetKey)?.find(item => item.id === binding.id); return <article className={`awb-contribution-card ${binding.config.enabled === false ? 'muted' : ''} ${binding.config.solo === true ? 'solo' : ''}`} key={binding.id}><div className="awb-contribution-main"><button className={`awb-toggle ${binding.config.enabled === false ? 'active' : ''}`} title="启用/静音" onClick={() => updateBindingConfig(binding, { enabled: binding.config.enabled === false })}>M</button><button className={`awb-toggle ${binding.config.solo === true ? 'active' : ''}`} title="仅播放同目标上的 Solo 贡献" onClick={() => updateBindingConfig(binding, { solo: binding.config.solo !== true })}>S</button><select value={binding.outputId} onChange={event => updateBinding(binding.id, { outputId: event.target.value })}>{graph.outputs.map(output => <option key={output.id} value={output.id}>{output.name}</option>)}</select><span>→</span><select value={binding.objectId} onChange={event => updateBinding(binding.id, { objectId: event.target.value })}>{objects.map(object => <option key={object.id} value={object.id}>{object.name}</option>)}</select><select value={path} onChange={event => updateBindingConfig(binding, { path: event.target.value })}>{['position.x','position.y','position.z','rotation.x','rotation.y','rotation.z','scaling.x','scaling.y','scaling.z'].map(item => <option key={item}>{item}</option>)}</select><button className="awb-contribution-delete" onClick={() => onBindingsChange(bindings.filter(item => item.id !== binding.id))}><MiniIcon name="delete" /></button></div><div className="awb-contribution-controls"><label>BLEND<select value={String(binding.config.operation ?? 'additive')} onChange={event => updateBindingConfig(binding, { operation: event.target.value })}><option value="additive">Add</option><option value="override">Set</option><option value="multiply">Multiply</option></select></label><label>WEIGHT<input type="number" min="0" max="1" step="0.05" value={finite(binding.config.weight, 1)} onChange={event => updateBindingConfig(binding, { weight: Number(event.target.value) })} /></label><label>PRIORITY<input type="number" step="1" value={finite(binding.config.priority)} onChange={event => updateBindingConfig(binding, { priority: Number(event.target.value) })} /></label><label>SCALE<input type="number" step="0.1" value={finite(binding.config.scale, 1)} onChange={event => updateBindingConfig(binding, { scale: Number(event.target.value) })} /></label><label>MODULATE<select value={String(binding.config.modulationOutputId ?? '')} onChange={event => updateBindingConfig(binding, { modulationOutputId: event.target.value })}><option value="">None</option>{graph.outputs.filter(output => output.valueTypeId === 'core.number').map(output => <option key={output.id} value={output.id}>{output.name}</option>)}</select></label><output className={applied?.suppressed ? 'suppressed' : ''}>{applied?.suppressed ? 'SOLO 抑制' : `W ${applied?.effectiveWeight.toFixed(2) ?? '0.00'} · ${applied?.valueAfter.toFixed(3) ?? '—'}`}</output></div></article>; })}{!bindings.length && <div className="awb-empty">添加贡献后，多个信号可以共同驱动同一个对象属性</div>}</section></div>}
  </section>;
}
