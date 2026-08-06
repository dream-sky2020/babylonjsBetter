import React from 'react';
import type { ProgressDirection, ProgressShape, SpriteProgressOptions, SpriteProgressRegionStyle } from '@/core/sprite/progress/spriteProgress.ts';

type Props = { value: SpriteProgressOptions; onChange: (value: SpriteProgressOptions) => void; title?: string };
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 };
const finite = (value: string, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const ExclamationProgressControls: React.FC<Props> = ({ value, onChange, title = '进度遮罩 Shader' }) => {
  const patch = (next: Partial<SpriteProgressOptions>) => onChange({ ...value, ...next });
  const patchVector = (field: 'centerOffsetPx' | 'axisScale', axis: 'x' | 'y', next: number) => patch({ [field]: { ...value[field], [axis]: next } });
  const renderStyle = (label: string, field: 'filled' | 'unfilled') => {
    const style: SpriteProgressRegionStyle = value[field] ?? {};
    const update = (next: Partial<SpriteProgressRegionStyle>) => patch({ [field]: { ...style, ...next } });
    return <div><strong>{label}</strong><label>来源</label><select value={style.source ?? 'texture'} onChange={(e) => update({ source: e.target.value as 'texture' | 'color' })}><option value="texture">原图纹理</option><option value="color">指定颜色</option></select>{style.source === 'color' ? <><label>颜色</label><input type="color" value={style.color ?? '#ffffff'} onChange={(e) => update({ color: e.target.value })} /></> : null}<label>透明度</label><input type="number" min="0" max="1" step="0.05" value={style.opacity ?? 1} onChange={(e) => update({ opacity: finite(e.target.value, 1) })} /></div>;
  };
  return <details open style={{ marginTop: 12, padding: 10, border: '1px solid #2d3b51', borderRadius: 8, background: '#101722' }}>
    <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{title}</summary>
    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input style={{ width: 'auto' }} type="checkbox" checked={value.enabled !== false} onChange={(e) => patch({ enabled: e.target.checked })} />启用进度遮罩</label>
    <label>进度：{Math.round((value.progress ?? 1) * 100)}%</label><input type="range" min="0" max="100" step="1" value={(value.progress ?? 1) * 100} onChange={(e) => patch({ progress: Number(e.target.value) / 100 })} />
    <div style={grid}><div><label>形状</label><select value={value.shape ?? 'linear'} onChange={(e) => patch({ shape: e.target.value as ProgressShape })}><option value="none">无</option><option value="linear">线性</option><option value="radial">圆形</option><option value="sector">扇形</option><option value="ring">环形</option><option value="diamond">菱形</option><option value="box">矩形扩散</option><option value="rect-perimeter">矩形周长</option></select></div><div><label>方向</label><select value={value.direction ?? 'forward'} onChange={(e) => patch({ direction: e.target.value as ProgressDirection })}><option value="forward">正向</option><option value="reverse">反向</option><option value="center-out">中心向外</option><option value="edges-in">两侧向内</option></select></div></div>
    <div style={grid}><div><label>线性角度（°）</label><input type="number" step="1" value={value.angleDeg ?? 0} onChange={(e) => patch({ angleDeg: finite(e.target.value, 0) })} /></div><div><label>柔化</label><input type="number" min="0" max="0.5" step="0.01" value={value.softness ?? 0} onChange={(e) => patch({ softness: finite(e.target.value, 0) })} /></div></div>
    <div style={grid}><div><label>起始角（°）</label><input type="number" step="1" value={value.startAngleDeg ?? 0} onChange={(e) => patch({ startAngleDeg: finite(e.target.value, 0) })} /></div><div><label>覆盖角（°）</label><input type="number" min="0.001" max="360" step="1" value={value.sweepAngleDeg ?? 360} onChange={(e) => patch({ sweepAngleDeg: finite(e.target.value, 360) })} /></div></div>
    <div style={grid}><div><label>内半径</label><input type="number" min="0" max="1" step="0.05" value={value.innerRadius ?? 0.65} onChange={(e) => patch({ innerRadius: finite(e.target.value, 0.65) })} /></div><div><label>外半径</label><input type="number" min="0" max="1" step="0.05" value={value.outerRadius ?? 1} onChange={(e) => patch({ outerRadius: finite(e.target.value, 1) })} /></div></div>
    <div style={grid}>{(['x', 'y'] as const).map((axis) => <div key={`offset-${axis}`}><label>中心偏移 {axis.toUpperCase()}（px）</label><input type="number" step="1" value={value.centerOffsetPx?.[axis] ?? 0} onChange={(e) => patchVector('centerOffsetPx', axis, finite(e.target.value, 0))} /></div>)}</div>
    <div style={grid}>{(['x', 'y'] as const).map((axis) => <div key={`scale-${axis}`}><label>轴缩放 {axis.toUpperCase()}</label><input type="number" min="0.001" step="0.05" value={value.axisScale?.[axis] ?? 1} onChange={(e) => patchVector('axisScale', axis, finite(e.target.value, 1))} /></div>)}</div>
    <div style={grid}>{renderStyle('已填充区域', 'filled')}{renderStyle('未填充区域', 'unfilled')}</div>
  </details>;
};
