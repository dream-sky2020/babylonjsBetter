import React, { useMemo, useRef, useState } from 'react';
import { SpecialStatusBadge } from '@/core/ui';

const RESOURCE_IMAGE_MODULES = import.meta.glob('/public/resources/**/*.{png,jpg,jpeg,webp,gif,avif,svg}', {
  eager: true,
  query: '?url',
  import: 'default'
});

const decodePublicPath = (input: string): string => String(input || '').replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '');
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{6})$/;
const TEXT_COLOR_PRESETS = ['#e2e8f0', '#ffffff', '#f8fafc', '#fde68a', '#fca5a5', '#93c5fd'];

type DragMode = 'move' | 'resize';
type DragState = {
  mode: DragMode;
  startX: number;
  startY: number;
  startOffsetX: number;
  startOffsetY: number;
  startWidth: number;
  startHeight: number;
};

export const SpecialStatusVisualLab: React.FC = () => {
  const dragStateRef = useRef<DragState | null>(null);

  const [topLeftValue, setTopLeftValue] = useState(89);
  const [topRightValue, setTopRightValue] = useState(42);
  const [bottomLeftValue, setBottomLeftValue] = useState(17);
  const [bottomRightValue, setBottomRightValue] = useState(64);
  const [showTopLeftValue, setShowTopLeftValue] = useState(true);
  const [showTopRightValue, setShowTopRightValue] = useState(true);
  const [showBottomLeftValue, setShowBottomLeftValue] = useState(true);
  const [showBottomRightValue, setShowBottomRightValue] = useState(true);
  const [iconSrc, setIconSrc] = useState('');

  const [badgeSize, setBadgeSize] = useState(96);
  const [iconScale, setIconScale] = useState(1);
  const [valueFontSize, setValueFontSize] = useState(18);
  const [cornerInset, setCornerInset] = useState(0);
  const [textColor, setTextColor] = useState('#e2e8f0');
  const [textColorInput, setTextColorInput] = useState('#e2e8f0');

  const [frameOffsetX, setFrameOffsetX] = useState(0);
  const [frameOffsetY, setFrameOffsetY] = useState(0);
  const [frameWidth, setFrameWidth] = useState(420);
  const [frameHeight, setFrameHeight] = useState(300);

  const resourceImageOptions = useMemo(() => {
    return Object.values(RESOURCE_IMAGE_MODULES)
      .map((assetUrl) => decodePublicPath(assetUrl as string))
      .map((path) => path.replace(/^public\/+/, ''))
      .filter((path) => path.startsWith('resources/'))
      .map((path) => `/${path}`)
      .sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, []);

  const beginDrag = (event: React.PointerEvent, mode: DragMode) => {
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: frameOffsetX,
      startOffsetY: frameOffsetY,
      startWidth: frameWidth,
      startHeight: frameHeight
    };
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const state = dragStateRef.current;
    if (!state) return;

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;

    if (state.mode === 'move') {
      setFrameOffsetX(clamp(state.startOffsetX + deltaX, -1200, 1200));
      setFrameOffsetY(clamp(state.startOffsetY + deltaY, -900, 900));
      return;
    }

    setFrameWidth(clamp(state.startWidth + deltaX, 220, 1080));
    setFrameHeight(clamp(state.startHeight + deltaY, 180, 820));
  };

  const endDrag = (event: React.PointerEvent) => {
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    dragStateRef.current = null;
  };

  const applyTextColor = (nextColor: string) => {
    setTextColor(nextColor);
    setTextColorInput(nextColor);
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#0b1015',
        color: '#e2e8f0',
        fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        display: 'grid',
        gridTemplateColumns: '360px minmax(0, 1fr)',
        overflow: 'hidden'
      }}
    >
      <aside
        style={{
          borderRight: '1px solid rgba(148, 163, 184, 0.24)',
          background: '#111827',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          overflowY: 'auto'
        }}
      >
        <h3 style={{ margin: 0, color: '#e2e8f0' }}>Special Status Visual Lab</h3>
        <div style={{ fontSize: 12, color: '#cbd5e1' }}>
          纯视觉实验页：组件只根据参数显示样式，不包含业务逻辑。
        </div>

        <label>
          图标资源（自动扫描 public/resources）
          <select
            value={resourceImageOptions.includes(iconSrc) ? iconSrc : ''}
            onChange={(event) => setIconSrc(event.target.value)}
            style={{ width: '100%', marginTop: 4 }}
          >
            <option value="">不使用图标（占位）</option>
            {resourceImageOptions.map((url) => (
              <option key={url} value={url}>{url}</option>
            ))}
          </select>
        </label>

        <label>
          图标 URL（可手填覆盖）
          <input
            value={iconSrc}
            placeholder="/resources/xxx.png"
            onChange={(event) => setIconSrc(event.target.value)}
            style={{ width: '100%', marginTop: 4 }}
          />
        </label>

        <label>
          左上数值
          <input
            type="number"
            value={topLeftValue}
            onChange={(event) => setTopLeftValue(Number(event.target.value))}
            style={{ width: '100%', marginTop: 4 }}
          />
        </label>
        <label>
          右上数值
          <input
            type="number"
            value={topRightValue}
            onChange={(event) => setTopRightValue(Number(event.target.value))}
            style={{ width: '100%', marginTop: 4 }}
          />
        </label>
        <label>
          左下数值
          <input
            type="number"
            value={bottomLeftValue}
            onChange={(event) => setBottomLeftValue(Number(event.target.value))}
            style={{ width: '100%', marginTop: 4 }}
          />
        </label>
        <label>
          右下数值
          <input
            type="number"
            value={bottomRightValue}
            onChange={(event) => setBottomRightValue(Number(event.target.value))}
            style={{ width: '100%', marginTop: 4 }}
          />
        </label>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12, color: '#cbd5e1' }}>数值显示开关</div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
            <input
              type="checkbox"
              checked={showTopLeftValue}
              onChange={(event) => setShowTopLeftValue(event.target.checked)}
            />
            显示左上
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
            <input
              type="checkbox"
              checked={showTopRightValue}
              onChange={(event) => setShowTopRightValue(event.target.checked)}
            />
            显示右上
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
            <input
              type="checkbox"
              checked={showBottomLeftValue}
              onChange={(event) => setShowBottomLeftValue(event.target.checked)}
            />
            显示左下
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
            <input
              type="checkbox"
              checked={showBottomRightValue}
              onChange={(event) => setShowBottomRightValue(event.target.checked)}
            />
            显示右下
          </label>
        </div>

        <label>
          组件尺寸（正方形） {badgeSize}px
          <input
            type="range"
            min={48}
            max={320}
            step={1}
            value={badgeSize}
            onChange={(event) => setBadgeSize(Number(event.target.value))}
            style={{ width: '100%' }}
          />
        </label>
        <label>
          图标缩放 {(iconScale * 100).toFixed(0)}%
          <input
            type="range"
            min={0.2}
            max={1.8}
            step={0.01}
            value={iconScale}
            onChange={(event) => setIconScale(Number(event.target.value))}
            style={{ width: '100%' }}
          />
        </label>
        <label>
          数字字号 {valueFontSize}px
          <input
            type="range"
            min={12}
            max={64}
            step={1}
            value={valueFontSize}
            onChange={(event) => setValueFontSize(Number(event.target.value))}
            style={{ width: '100%' }}
          />
        </label>
        <label>
          角标内边距 {cornerInset}px
          <input
            type="range"
            min={-24}
            max={24}
            step={1}
            value={cornerInset}
            onChange={(event) => setCornerInset(Number(event.target.value))}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          文本色
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <input
              type="color"
              value={HEX_COLOR_PATTERN.test(textColor) ? textColor : '#e2e8f0'}
              onChange={(event) => applyTextColor(event.target.value)}
              style={{ width: 56, height: 34, padding: 0, border: 'none', background: 'transparent' }}
            />
            <input
              value={textColorInput}
              onChange={(event) => setTextColorInput(event.target.value)}
              onBlur={() => {
                if (HEX_COLOR_PATTERN.test(textColorInput)) {
                  applyTextColor(textColorInput);
                  return;
                }
                setTextColorInput(textColor);
              }}
              placeholder="#e2e8f0"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {TEXT_COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => applyTextColor(color)}
                title={color}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  border: `1px solid ${textColor === color ? '#ffffff' : 'rgba(148, 163, 184, 0.6)'}`,
                  background: color,
                  cursor: 'pointer',
                  padding: 0
                }}
              />
            ))}
          </div>
        </label>

        <label>
          容器偏移 X {Math.round(frameOffsetX)}px
          <input
            type="range"
            min={-1200}
            max={1200}
            step={1}
            value={frameOffsetX}
            onChange={(event) => setFrameOffsetX(Number(event.target.value))}
            style={{ width: '100%' }}
          />
        </label>
        <label>
          容器偏移 Y {Math.round(frameOffsetY)}px
          <input
            type="range"
            min={-900}
            max={900}
            step={1}
            value={frameOffsetY}
            onChange={(event) => setFrameOffsetY(Number(event.target.value))}
            style={{ width: '100%' }}
          />
        </label>
        <label>
          容器宽 {Math.round(frameWidth)}px
          <input
            type="range"
            min={220}
            max={1080}
            step={1}
            value={frameWidth}
            onChange={(event) => setFrameWidth(Number(event.target.value))}
            style={{ width: '100%' }}
          />
        </label>
        <label>
          容器高 {Math.round(frameHeight)}px
          <input
            type="range"
            min={180}
            max={820}
            step={1}
            value={frameHeight}
            onChange={(event) => setFrameHeight(Number(event.target.value))}
            style={{ width: '100%' }}
          />
        </label>

        <button
          type="button"
          onClick={() => {
            setFrameOffsetX(0);
            setFrameOffsetY(0);
          }}
          style={{
            marginTop: 4,
            borderRadius: 8,
            border: '1px solid rgba(148, 163, 184, 0.45)',
            background: '#1f2937',
            color: '#e2e8f0',
            padding: '8px 10px',
            cursor: 'pointer'
          }}
        >
          回到中心
        </button>
      </aside>

      <main
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: '#0f172a',
          display: 'grid',
          placeItems: 'center'
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(calc(-50% + ${frameOffsetX}px), calc(-50% + ${frameOffsetY}px))`,
            width: frameWidth,
            height: frameHeight,
            border: '1px solid rgba(148, 163, 184, 0.45)',
            borderRadius: 12,
            background: '#111827',
            display: 'grid',
            gridTemplateRows: '34px 1fr'
          }}
        >
          <div
            onPointerDown={(event) => beginDrag(event, 'move')}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{
              cursor: 'grab',
              borderBottom: '1px solid rgba(148, 163, 184, 0.35)',
              color: '#e2e8f0',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 10px',
              userSelect: 'none'
            }}
          >
            <span>Special Status Frame</span>
            <span>{Math.round(frameWidth)} x {Math.round(frameHeight)}</span>
          </div>

          <div style={{ display: 'grid', placeItems: 'center', overflow: 'hidden', padding: 16 }}>
            <SpecialStatusBadge
              iconSrc={iconSrc || undefined}
              topLeftValue={topLeftValue}
              topRightValue={topRightValue}
              bottomLeftValue={bottomLeftValue}
              bottomRightValue={bottomRightValue}
              showTopLeftValue={showTopLeftValue}
              showTopRightValue={showTopRightValue}
              showBottomLeftValue={showBottomLeftValue}
              showBottomRightValue={showBottomRightValue}
              size={badgeSize}
              iconScale={iconScale}
              textColor={textColor}
              valueFontSize={valueFontSize}
              cornerInset={cornerInset}
            />
          </div>

          <div
            onPointerDown={(event) => beginDrag(event, 'resize')}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: 18,
              height: 18,
              cursor: 'nwse-resize',
              background: 'linear-gradient(135deg, transparent 0%, transparent 45%, rgba(148,163,184,0.8) 45%, rgba(148,163,184,0.8) 100%)'
            }}
          />
        </div>
      </main>
    </div>
  );
};
