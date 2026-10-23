import { createContext, useContext, useState, type ReactNode, type KeyboardEvent } from 'react';
import { Chart } from './Chart.tsx';
import { axisPosition, axisX, DEFAULT_DRAFT, evaluate, format, formatGap, formula, milestoneX, MODELS, resolveDraft, updateDraft, type Draft, type Model } from './functions.ts';

import { Navigation } from '../../kit/draggable/Navigation.tsx';
import type { PanelId } from './layouts.ts';
type Session = { panels: Record<PanelId, ReactNode>; navigation: ReactNode; footer: ReactNode };
const SessionContext = createContext<Session | null>(null);
const FrameContext = createContext(true);
function Window({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  const framed = useContext(FrameContext);
  return framed ? <section className={`lf-window ${className}`}><h2>{title}</h2><div className="lf-body">{children}</div></section> : <>{children}</>;
}
export function CalculatorProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>({ ...DEFAULT_DRAFT });
  const [message, setMessage] = useState('拖动曲线上的圆点或 X 滑块，观察 Y 与极限的差距。');
  const patch = (next: Partial<Draft>) => setDraft(current => updateDraft(current, next));
  let error = '', resolved: ReturnType<typeof resolveDraft> | undefined;
  try { resolved = resolveDraft(draft); } catch (e) { error = e instanceof Error ? e.message : String(e); }
  const rounded = !!resolved && (resolved.result.roundedToLimit || Number(format(resolved.result.value, 12)) === resolved.parameters.limit);
  const field = (key: 'limit' | 'start' | 'halfX' | 'power' | 'pointX' | 'pointY' | 'x' | 'maxX', label: string, min?: number) => <label className="lf-field">{label}<input type="number" step={key === 'x' && draft.integerX ? 1 : 'any'} min={min} value={draft[key]} onChange={event => patch({ [key]: event.target.value })} /></label>;
  const setX = (x: number) => patch({ x: Number(x.toPrecision(12)).toString() });
  const sliderKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!draft.integerX || !resolved) return;
    let next: number;
    switch (event.key) {
      case 'ArrowRight': case 'ArrowUp': next = resolved.x + 1; break;
      case 'ArrowLeft': case 'ArrowDown': next = resolved.x - 1; break;
      case 'PageUp': next = resolved.x + 10; break;
      case 'PageDown': next = resolved.x - 10; break;
      case 'Home': next = 0; break;
      case 'End': next = Math.floor(resolved.maxX); break;
      default: return;
    }
    event.preventDefault(); setX(Math.max(0, Math.min(1e12, next)));
  };
  const presets = [
    { name: '属性收益上限', values: { ...DEFAULT_DRAFT } },
    { name: '减免上限 80%', values: { ...DEFAULT_DRAFT, model: 'rational' as const, limit: '.8', halfX: '100', x: '100', maxX: '1000' } },
    { name: '指数衰减到 0', values: { ...DEFAULT_DRAFT, model: 'exponential' as const, limit: '0', start: '100', halfX: '30', x: '30', maxX: '300' } },
    { name: 'S 型成长', values: { ...DEFAULT_DRAFT, model: 'hill' as const, power: '3', halfX: '50', x: '50', maxX: '200' } },
  ];
  const copy = async (code: boolean) => {
    if (!resolved) return;
    try { await navigator.clipboard.writeText(code ? `const f = (x) => ${formula(resolved.parameters, true)};` : formula(resolved.parameters)); setMessage(code ? '已复制 JavaScript 函数。适用范围 X ≥ 0。' : '已复制当前公式。'); }
    catch { setMessage('无法访问剪贴板，请选中下方公式手动复制。'); }
  };
  const exportCsv = () => {
    if (!resolved) return;
    const { parameters, maxX } = resolved;
    const rows = [['X', 'Y（浮点近似）', '与极限绝对差', '绝对差的自然对数', '趋近进度']];
    const seen = new Set<number>();
    for (let i = 0; i <= 200; i++) { const sample = axisX(i / 200, maxX, parameters.halfX, draft.logX), x = draft.integerX ? Math.round(sample) : sample; if (seen.has(x)) continue; seen.add(x); const result = evaluate(parameters, Math.min(1e12, x)); rows.push([String(x), String(result.value), formatGap(result.logGap), String(result.logGap), String(result.progress)]); }
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `limit-function-${draft.model}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(`已导出当前图表范围内的 ${rows.length - 1} 个${draft.integerX ? '整数 X ' : ''}采样点。`);
  };
  const panels: Session['panels'] = {
    parameters: (<Window title="01 / 选择函数与目标极限"><div className="lf-models">{(Object.keys(MODELS) as Model[]).map(model => <button key={model} aria-pressed={draft.model === model} onClick={() => patch({ model })}><b>{MODELS[model].name}</b><small>{model === 'rational' ? 'X / (X + H)' : model === 'exponential' ? '1 − 2^(−X/H)' : model === 'arctangent' ? '(2/π) atan(X/H)' : 'Xⁿ / (Xⁿ + Hⁿ)'}</small></button>)}</div><p className="lf-muted">{MODELS[draft.model].description}</p>
      {field('limit', '目标极限 L')}{field('start', 'X = 0 时的 Y₀')}
      <label className="lf-toggle"><input type="checkbox" checked={draft.fit} onChange={event => patch({ fit: event.target.checked })} />由参考点反推参数</label>
      {draft.fit ? <div className="lf-inset">{field('pointX', '参考点 X', 0)}{field('pointY', '参考点 Y')}<p className="lf-muted">填写希望曲线经过的一个点；Y 必须位于 Y₀ 与 L 之间。</p></div> : <>{field('halfX', '半程 X（H）', 1e-12)}<p className="lf-muted">X = H 时，Y 刚好走完起点到极限距离的一半。H 越小，越早接近极限。</p></>}
      {draft.model === 'hill' && <>{field('power', '幂指数 n', .1)}<p className="lf-muted">0.1 ≤ n ≤ 8；n = 1 时等同分式饱和。</p></>}
      {resolved && <div className="lf-derived">当前 H = <b>{format(resolved.parameters.halfX, 10)}</b>{draft.fit && <small>由参考点计算</small>}</div>}
    </Window>),
    presets: (<Window title="02 / 常用数据示例"><div className="lf-presets">{presets.map(preset => <button key={preset.name} onClick={() => { setDraft(current => updateDraft(current, { ...preset.values, integerX: current.integerX })); setMessage(`已载入：${preset.name}。`); }}>{preset.name}</button>)}</div></Window>),
    explanation: (<Window title="这个极限是什么意思？"><p>当 X 不断增大，F(X) 越来越接近 L。这些模型在有限 X 下始终与 L 保留差距。</p><p className="lf-muted">极限并不总是“不能达到的值”。本页特意选择四类不会在有限 X 取到 L 的函数，条件是 H &gt; 0、L ≠ Y₀、X ≥ 0。L &lt; Y₀ 时会从上方下降趋近。</p></Window>),
    formula: (resolved ? <Window title="03 / 已生成的 F(X)" className="lf-formula-window"><div className="lf-formula" data-testid="generated-formula">{formula(resolved.parameters)}</div><div className="lf-formula-meta"><span>lim F(X) = {format(resolved.parameters.limit)} <small>（X → +∞）</small></span><span>F(0) = {format(resolved.parameters.start)}</span><span>F(H) = {format((resolved.parameters.start + resolved.parameters.limit) / 2)}</span></div></Window> : <p className="lf-muted" role="alert">{error}</p>),
    curve: (resolved ? <Window title="04 / 曲线与 X 调节" className="lf-chart-window"><div className="lf-chart-tools"><span><i className="lf-key-curve" />F(X)</span><span><i className="lf-key-limit" />目标极限</span><label className="lf-toggle"><input type="checkbox" checked={draft.logX} onChange={event => patch({ logX: event.target.checked })} />对数 X 轴</label><label className="lf-toggle"><input type="checkbox" checked={draft.integerX} onChange={event => patch({ integerX: event.target.checked })} />X 仅允许整数</label>{field('maxX', '图表右边界 X', 1e-12)}</div><Chart parameters={resolved.parameters} x={resolved.x} maxX={resolved.maxX} logX={draft.logX} onSelect={setX} />
      <div className="lf-x-controls">{field('x', '当前 X', 0)}<input aria-label="调节 X" onKeyDown={sliderKey} type="range" min={0} max={1000} step={1} value={Math.round(axisPosition(resolved.x, resolved.maxX, resolved.parameters.halfX, draft.logX) * 1000)} onChange={event => setX(Math.min(1e12, axisX(Number(event.target.value) / 1000, resolved.maxX, resolved.parameters.halfX, draft.logX)))} /><button onClick={() => setX(Math.min(1e12, Math.max(resolved.parameters.halfX, resolved.x * 2)))}>X × 2</button><button onClick={() => setX(resolved.parameters.halfX)}>{draft.integerX && !Number.isInteger(resolved.parameters.halfX) ? 'X ≈ H' : 'X = H'}</button><button onClick={() => setX(0)}>X = 0</button></div>
      <p className="lf-muted">可拖动圆点沿曲线移动，也可点击或按住曲线区域拖动取 X；Y 始终按公式计算。{draft.integerX && ' 整数模式已开启：当前 X 四舍五入为整数。'}当前 X 超过设定边界时自动扩展图表；最大 X 为 10¹²。</p>{rounded && <p className="lf-precision" role="status">当前 Y 的差距小于显示精度或浮点精度，屏幕可能显示为 L；这不代表数学上已经达到极限。上方差距通过对数计算保留。</p>}
      </Window> : <div className="lf-empty"><p role="alert">{error}</p><p>修正参数后会恢复计算。</p>{field('x', '当前 X', 0)}{field('maxX', '图表右边界 X', 1e-12)}</div>),
    milestones: (resolved ? <Window title="05 / 到底要多大的 X？"><table><thead><tr><th>趋近进度</th><th>需要的 X{draft.integerX ? '（向上取整）' : ''}</th><th>对应 Y</th><th>操作</th></tr></thead><tbody>{[.5, .9, .95, .99, .999].map(progress => { const x = milestoneX(resolved.parameters, progress, draft.integerX); return <tr key={progress}><td>{progress * 100}%</td><td>{format(x, 8)}</td><td>{x <= 1e12 ? format(evaluate(resolved.parameters, x).value, 8) : '超出计算范围'}</td><td><button disabled={x > 1e12} title={x > 1e12 ? '超出本计算台的 X 范围' : '应用这个 X'} onClick={() => setX(x)}>查看</button></td></tr>; })}<tr><td>100%</td><td>需要 X → +∞</td><td>{format(resolved.parameters.limit)}</td><td>有限 X 不可达</td></tr></tbody></table></Window> : <p className="lf-muted" role="alert">{error}</p>),
    details: (resolved ? <Window title="06 / 当前计算说明"><dl><dt>函数模板</dt><dd>{MODELS[draft.model].template}</dd><dt>方向</dt><dd>{resolved.parameters.limit > resolved.parameters.start ? '从下方单调增加，趋近上限' : '从上方单调下降，趋近下限'}</dd><dt>定义域</dt><dd>X ≥ 0；H &gt; 0</dd><dt>当前阶段的剩余比例</dt><dd>{resolved.result.progress * 100 > 99.9999 ? '接近 0%，但不是数学意义上的 0' : `${format((1 - resolved.result.progress) * 100, 8)}%`}</dd></dl></Window> : <p className="lf-muted" role="alert">{error}</p>),
    metrics: (resolved ? <div className="lf-metrics"><section><small>当前输入 X</small><strong data-testid="current-x">{format(resolved.x, 10)}</strong></section><section className="lf-value"><small>计算结果 Y = F(X)</small><strong data-testid="current-y">{rounded ? '≈ ' : ''}{format(resolved.result.value, 12)}</strong></section><section><small>与极限差距 |L − Y|</small><strong data-testid="current-gap">{formatGap(resolved.result.logGap)}</strong></section><section><small>起点 → 极限的进度</small><strong>{resolved.result.progress * 100 > 99.9999 ? '≈ 100' : format(resolved.result.progress * 100, 7)}<em>%</em></strong></section></div> : <p className="lf-error" role="alert">{error}</p>),
  };
  const navigation = <><header className="lf-title"><b>ƒ Limit Function Lab · 极限函数计算台</b><span>数据计算 / 函数生成 / 曲线观察</span></header>
    <Navigation title="极限函数计算" className="lf-toolbar"><button onClick={() => { setDraft({ ...DEFAULT_DRAFT }); setMessage('已恢复默认参数。'); }}>恢复默认</button><button disabled={!resolved} onClick={() => void copy(false)}>复制公式</button><button disabled={!resolved} onClick={() => void copy(true)}>复制 JS 函数</button><button disabled={!resolved} onClick={exportCsv}>导出 CSV</button><small>X ≥ 0 · 有界单调函数</small></Navigation></>;
  const footer = <footer className="lf-footer" role="status">{message}<span>本地计算 · 不上传数据 · 刷新恢复默认参数</span></footer>;
  return <SessionContext.Provider value={{ panels, navigation, footer }}>{children}</SessionContext.Provider>;
}
export function useCalculator() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('缺少极限函数计算会话。');
  return session;
}
export function CalculatorNavigation() { return useCalculator().navigation; }
export function CalculatorFooter() { return useCalculator().footer; }
export function CalculatorPanel({ id, framed = true, editing = false }: { id: PanelId; framed?: boolean; editing?: boolean }) {
  const { panels } = useCalculator();
  const content = <FrameContext.Provider value={framed}>{panels[id]}</FrameContext.Provider>;
  return editing ? <fieldset disabled className="lf-editing">{content}</fieldset> : content;
}
