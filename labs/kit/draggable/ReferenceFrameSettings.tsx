import { useState } from 'react';
import { referenceFramePresets, type ReferenceFrame } from './settings.ts';

export function ReferenceFrameSettings({ value, change }: { value: ReferenceFrame; change: (value: ReferenceFrame) => void }) {
  const preset = referenceFramePresets.find(size => size.width === value.width && size.height === value.height);
  return <fieldset className="wb-reference-settings"><legend>游戏画面参考框</legend>
    <label><input type="checkbox" checked={value.visible} onChange={event => change({ ...value, visible: event.target.checked })} />显示绿色参考框</label>
    <label>显示层级<select aria-label="参考框显示层级" value={value.layer ?? 'back'} onChange={event => change({ ...value, layer: event.target.value as ReferenceFrame['layer'] })}>
      <option value="front">最前面 · 检查边界</option><option value="back">最后面 · 作为背景</option>
    </select></label>
    <label>常用规格<select aria-label="参考框常用规格" value={preset ? `${preset.width}x${preset.height}` : 'custom'} onChange={event => { const size = referenceFramePresets.find(size => `${size.width}x${size.height}` === event.target.value); if (size) change({ ...value, ...size }); }}>
      <option value="custom" disabled>自定义尺寸</option>{referenceFramePresets.map(size => <option key={size.width} value={`${size.width}x${size.height}`}>{size.width} × {size.height}</option>)}
    </select></label>
    <FrameSize key={`width-${value.width}`} label="参考宽度" value={value.width} change={width => change({ ...value, width })} />
    <FrameSize key={`height-${value.height}`} label="参考高度" value={value.height} change={height => change({ ...value, height })} />
    <p>从工作区左上角起，1 像素对应 1 个页面像素，随浏览器缩放；超出屏幕可滚动查看。前景模式让边框显示在面板之上，鼠标仍可穿透；背景模式显示在面板下方。仅供布局参考，不限制面板位置和大小。</p>
  </fieldset>;
}
function FrameSize({ label, value, change }: { label: string; value: number; change: (size: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  return <label>{label}<input aria-label={label} type="number" required min={1} max={16384} step={1} value={draft}
    onChange={event => setDraft(event.target.value)}
    onBlur={event => { const size = event.currentTarget.valueAsNumber; if (event.currentTarget.validity.valid && Number.isSafeInteger(size)) { if (size !== value) change(size); } else setDraft(String(value)); }}
    onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } if (event.key === 'Escape') { event.currentTarget.value = String(value); setDraft(String(value)); event.currentTarget.blur(); } }} /> px</label>;
}
