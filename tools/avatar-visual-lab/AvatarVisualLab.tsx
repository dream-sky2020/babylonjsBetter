import React, { useMemo, useRef, useState } from 'react';
import { CharacterAvatarCard } from '@/core/ui';

const RESOURCE_IMAGE_MODULES = import.meta.glob('/public/resources/**/*.{png,jpg,jpeg,webp,gif,avif,svg}', {
  eager: true,
  query: '?url',
  import: 'default'
});

const decodePublicPath = (input: string): string => String(input || '').replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '');
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

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

export const AvatarVisualLab: React.FC = () => {
  const dragStateRef = useRef<DragState | null>(null);
  const [displayName, setDisplayName] = useState('晨曦执行者');
  const [imageUrl, setImageUrl] = useState('');
  const [cardSize, setCardSize] = useState(176);
  const [borderRadius, setBorderRadius] = useState(12);
  const [fontSize, setFontSize] = useState(40);
  const [borderColor, setBorderColor] = useState('rgba(134, 239, 172, 0.75)');
  const [textColor, setTextColor] = useState('#ecfdf5');
  const [background, setBackground] = useState('linear-gradient(145deg, rgba(52, 211, 153, 0.95) 0%, rgba(22, 101, 52, 0.9) 62%, rgba(4, 30, 18, 0.96) 100%)');

  const [frameOffsetX, setFrameOffsetX] = useState(0);
  const [frameOffsetY, setFrameOffsetY] = useState(0);
  const [frameWidth, setFrameWidth] = useState(360);
  const [frameHeight, setFrameHeight] = useState(320);

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

    setFrameWidth(clamp(state.startWidth + deltaX, 180, 960));
    setFrameHeight(clamp(state.startHeight + deltaY, 180, 820));
  };

  const endDrag = (event: React.PointerEvent) => {
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    dragStateRef.current = null;
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
        gridTemplateColumns: '340px minmax(0, 1fr)',
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
        <h3 style={{ margin: 0, color: '#e2e8f0' }}>Avatar Visual Lab</h3>
        <div style={{ fontSize: 12, color: '#cbd5e1' }}>
          默认自动居中。右侧容器可拖拽移动、右下角可缩放。
        </div>

        <label>
          名称文本
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            style={{ width: '100%', marginTop: 4 }}
          />
        </label>

        <label>
          头像资源（自动扫描 public/resources）
          <select
            value={resourceImageOptions.includes(imageUrl) ? imageUrl : ''}
            onChange={(event) => setImageUrl(event.target.value)}
            style={{ width: '100%', marginTop: 4 }}
          >
            <option value="">不使用图片（显示文字头像）</option>
            {resourceImageOptions.map((url) => (
              <option key={url} value={url}>{url}</option>
            ))}
          </select>
        </label>

        <label>
          图片 URL（可手填覆盖）
          <input
            value={imageUrl}
            placeholder="/resources/xxx.png"
            onChange={(event) => setImageUrl(event.target.value)}
            style={{ width: '100%', marginTop: 4 }}
          />
        </label>

        <label>
          头像尺寸 {cardSize}px
          <input
            type="range"
            min={64}
            max={320}
            step={1}
            value={cardSize}
            onChange={(event) => setCardSize(Number(event.target.value))}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          圆角 {borderRadius}px
          <input
            type="range"
            min={0}
            max={64}
            step={1}
            value={borderRadius}
            onChange={(event) => setBorderRadius(Number(event.target.value))}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          字体大小 {fontSize}px
          <input
            type="range"
            min={14}
            max={72}
            step={1}
            value={fontSize}
            onChange={(event) => setFontSize(Number(event.target.value))}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          边框色
          <input
            value={borderColor}
            onChange={(event) => setBorderColor(event.target.value)}
            style={{ width: '100%', marginTop: 4 }}
          />
        </label>

        <label>
          文本色
          <input
            value={textColor}
            onChange={(event) => setTextColor(event.target.value)}
            style={{ width: '100%', marginTop: 4 }}
          />
        </label>

        <label>
          背景（支持渐变）
          <textarea
            value={background}
            onChange={(event) => setBackground(event.target.value)}
            rows={3}
            style={{ width: '100%', marginTop: 4, resize: 'vertical' }}
          />
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
            min={180}
            max={960}
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
            <span>Avatar Frame</span>
            <span>{Math.round(frameWidth)} x {Math.round(frameHeight)}</span>
          </div>

          <div style={{ display: 'grid', placeItems: 'center', overflow: 'hidden', padding: 16 }}>
            <CharacterAvatarCard
              displayName={displayName}
              imageSrc={imageUrl || undefined}
              size={cardSize}
              borderRadius={borderRadius}
              borderColor={borderColor}
              glowColor="transparent"
              textColor={textColor}
              fontSize={fontSize}
              background={background}
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
