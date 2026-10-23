import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { axisPosition, axisX, evaluate, format, type Parameters } from './functions.ts';
type Props = { parameters: Parameters; x: number; maxX: number; logX: boolean; onSelect: (x: number) => void };
export function Chart({ parameters: p, x, maxX, logX, onSelect }: Props) {
  const gesture = useRef<{ id: number; maxX: number; halfX: number; logX: boolean; offset: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const w = 960, h = 430, left = 76, right = 32, top = 36, bottom = 54;
  const pw = w - left - right, ph = h - top - bottom;
  const span = Math.abs(p.limit - p.start), low = Math.min(p.start, p.limit) - span * .12, high = Math.max(p.start, p.limit) + span * .14;
  const px = (value: number) => left + pw * axisPosition(value, maxX, p.halfX, logX);
  const py = (value: number) => top + ph * ((high - value) / (high - low));
  const samples = Array.from({ length: 501 }, (_, i) => { const sx = axisX(i / 500, maxX, p.halfX, logX); return `${left + pw * i / 500},${py(evaluate(p, sx).value)}`; });
  const result = evaluate(p, x);
  const point = { x: px(x), y: py(result.value) };
  const limitY = py(p.limit);
  const coordinateX = (event: ReactPointerEvent<SVGSVGElement>) => {
    const matrix = event.currentTarget.getScreenCTM();
    if (matrix) return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()).x;
    const rect = event.currentTarget.getBoundingClientRect();
    return (event.clientX - rect.left) / rect.width * w;
  };
  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    const t = Math.max(0, Math.min(1, (coordinateX(event) - current.offset - left) / pw));
    onSelect(axisX(t, current.maxX, current.halfX, current.logX));
  };
  const finish = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (gesture.current?.id !== event.pointerId) return;
    gesture.current = null; setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <svg className="lf-chart" data-dragging={dragging} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="函数曲线；可拖动圆点调节 X，虚线为极限" onPointerDown={event => {
    if (event.button !== 0 || gesture.current) return;
    event.preventDefault();
    const onHandle = event.target instanceof Element && event.target.classList.contains('lf-point-handle');
    gesture.current = { id: event.pointerId, maxX, halfX: p.halfX, logX, offset: onHandle ? coordinateX(event) - point.x : 0 };
    event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); move(event);
  }} onPointerMove={move} onPointerUp={event => { move(event); finish(event); }} onPointerCancel={finish} onLostPointerCapture={finish}><title>F(X) 极限趋近曲线</title><desc>横轴 X 大于等于零，纵轴 F(X)。点击或拖动曲线区域选择 X，也可以拖动圆点沿曲线移动。橙色虚线表示极限，蓝色实线表示函数。</desc>
    <rect width={w} height={h} fill="#fcfdfb" />
    {Array.from({ length: 6 }, (_, i) => { const t = i / 5, xx = left + pw * t, yy = top + ph * t; return <g key={i}><line x1={xx} x2={xx} y1={top} y2={h - bottom} className="lf-gridline" /><line x1={left} x2={w - right} y1={yy} y2={yy} className="lf-gridline" /><text x={xx} y={h - bottom + 23} textAnchor="middle">{format(axisX(t, maxX, p.halfX, logX), 4)}</text><text x={left - 10} y={yy + 4} textAnchor="end">{format(high - (high - low) * t, 4)}</text></g>; })}
    <line x1={left} x2={w - right} y1={limitY} y2={limitY} className="lf-limit-line" /><text x={w - right - 6} y={limitY - 9} textAnchor="end" className="lf-limit-label">极限 L = {format(p.limit)}</text>
    <line x1={left} x2={w - right} y1={h - bottom} y2={h - bottom} className="lf-axis" /><line x1={left} x2={left} y1={top} y2={h - bottom} className="lf-axis" />
    <polyline points={samples.join(' ')} className="lf-curve" />
    <line x1={point.x} x2={point.x} y1={h - bottom} y2={point.y} className="lf-crosshair" /><line x1={left} x2={point.x} y1={point.y} y2={point.y} className="lf-crosshair" />
    <line x1={point.x} x2={point.x} y1={point.y} y2={limitY} className="lf-gap-line" />
    <circle className="lf-point-handle" cx={point.x} cy={point.y} r={17} fill="transparent"><title>拖动圆点调节 X，Y 随曲线自动更新</title></circle>
    <circle cx={point.x} cy={point.y} r={6} fill="#fff" stroke="#1763ae" strokeWidth={3} pointerEvents="none" />
    <text x={point.x > w / 2 ? point.x - 12 : point.x + 12} y={Math.min(h - bottom - 10, point.y + 23)} textAnchor={point.x > w / 2 ? 'end' : 'start'} className="lf-point-label">({format(x)}, {result.roundedToLimit ? '≈ ' : ''}{format(result.value)})</text>
    <text x={left} y={20} className="lf-axis-name">Y = F(X)</text><text x={w - right} y={h - 8} textAnchor="end" className="lf-axis-name">X {logX ? '· 对数刻度 log(1 + X/H)' : '· 线性刻度'}</text>
  </svg>;
}
