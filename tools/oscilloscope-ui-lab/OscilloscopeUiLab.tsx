import React, { useMemo, useRef, useState } from 'react';
import {
  OscilloscopeMaskPanel,
  type OscilloscopeMaskPanelHandle,
  type OscilloscopeShapeType,
  type OscilloscopeWavePresetId,
  type OscilloscopeBackgroundMode
} from '@/core/ui';

const THEME_OPTIONS = [
  '#00ff41',
  '#38bdf8',
  '#ff0055',
  '#fbbf24',
  '#f5f5f5',
  '#dbeafe'
];

const SHAPE_OPTIONS: OscilloscopeShapeType[] = ['square', 'rectangle', 'circle', 'polygon', 'star'];
const PRESET_OPTIONS: OscilloscopeWavePresetId[] = ['ecg_sharp', 'soft', 'shock'];
const POINTER_PRESET_OPTIONS: Array<OscilloscopeWavePresetId | 'inherit'> = ['inherit', ...PRESET_OPTIONS];
const BACKGROUND_MODE_OPTIONS: OscilloscopeBackgroundMode[] = ['scanline', 'grid', 'solid', 'image', 'none'];

export const OscilloscopeUiLab: React.FC = () => {
  const panelRef = useRef<OscilloscopeMaskPanelHandle | null>(null);
  const [shapeType, setShapeType] = useState<OscilloscopeShapeType>('square');
  const [shapeRotationDeg, setShapeRotationDeg] = useState(0);
  const [themeColor, setThemeColor] = useState('#00ff41');
  const [wavePreset, setWavePreset] = useState<OscilloscopeWavePresetId>('ecg_sharp');
  const [pointerWavePreset, setPointerWavePreset] = useState<OscilloscopeWavePresetId | 'inherit'>('inherit');
  const [pointerWaveIntensityMultiplier, setPointerWaveIntensityMultiplier] = useState(1);
  const [pointerWaveDurationMultiplier, setPointerWaveDurationMultiplier] = useState(1);
  const [pointerWaveTravelMultiplier, setPointerWaveTravelMultiplier] = useState(1);
  const [pointerWaveSpreadMultiplier, setPointerWaveSpreadMultiplier] = useState(1);
  const [pointerWaveJitterMultiplier, setPointerWaveJitterMultiplier] = useState(1);
  const [backgroundMode, setBackgroundMode] = useState<OscilloscopeBackgroundMode>('scanline');
  const [lineWidth, setLineWidth] = useState(2.2);
  const [enableLineGlow, setEnableLineGlow] = useState(true);
  const [clearFrameEachTick, setClearFrameEachTick] = useState(true);
  const [clearFillAlpha, setClearFillAlpha] = useState(0.25);
  const [showPlacementPreview, setShowPlacementPreview] = useState(true);
  const [showImpactMarkers, setShowImpactMarkers] = useState(true);
  const [autoInjectOnPointerDown, setAutoInjectOnPointerDown] = useState(true);
  const [maxActiveWaves, setMaxActiveWaves] = useState(24);
  const [edgePadding, setEdgePadding] = useState(18);
  const [shapeSizeRatio, setShapeSizeRatio] = useState(0.22);
  const [shapeWidthScale, setShapeWidthScale] = useState(1);
  const [shapeHeightScale, setShapeHeightScale] = useState(1);
  const [rectangleWidthRatio, setRectangleWidthRatio] = useState(1.4);
  const [rectangleHeightRatio, setRectangleHeightRatio] = useState(0.8);
  const [polygonSides, setPolygonSides] = useState(6);
  const [starPoints, setStarPoints] = useState(5);
  const [starInnerRatio, setStarInnerRatio] = useState(0.45);
  const [interactionRadius, setInteractionRadius] = useState(140);
  const [imageUrl, setImageUrl] = useState('');
  const [waveCount, setWaveCount] = useState(0);
  const [exportStatusText, setExportStatusText] = useState('');
  const [previewWidth, setPreviewWidth] = useState(480);
  const [previewHeight, setPreviewHeight] = useState(260);
  const isEdgeFitShape = shapeType === 'square' || shapeType === 'rectangle';
  const isRectangleShape = shapeType === 'rectangle';
  const isPolygonShape = shapeType === 'polygon';
  const isStarShape = shapeType === 'star';

  const panelConfig = useMemo(() => ({
    shapeType,
    shapeRotationDeg,
    colorTheme: themeColor,
    wavePreset,
    pointerWavePreset,
    pointerWaveIntensityMultiplier,
    pointerWaveDurationMultiplier,
    pointerWaveTravelMultiplier,
    pointerWaveSpreadMultiplier,
    pointerWaveJitterMultiplier,
    lineWidth,
    enableLineGlow,
    clearFrameEachTick,
    clearFillAlpha,
    showPlacementPreview,
    showImpactMarkers,
    autoInjectOnPointerDown,
    maxActiveWaves,
    edgePadding,
    shapeSizeRatio,
    shapeWidthScale,
    shapeHeightScale,
    rectangleWidthRatio,
    rectangleHeightRatio,
    polygonSides,
    starPoints,
    starInnerRatio,
    interactionRadius
  }), [
    shapeType,
    shapeRotationDeg,
    themeColor,
    wavePreset,
    pointerWavePreset,
    pointerWaveIntensityMultiplier,
    pointerWaveDurationMultiplier,
    pointerWaveTravelMultiplier,
    pointerWaveSpreadMultiplier,
    pointerWaveJitterMultiplier,
    lineWidth,
    enableLineGlow,
    clearFrameEachTick,
    clearFillAlpha,
    showPlacementPreview,
    showImpactMarkers,
    autoInjectOnPointerDown,
    maxActiveWaves,
    edgePadding,
    shapeSizeRatio,
    shapeWidthScale,
    shapeHeightScale,
    rectangleWidthRatio,
    rectangleHeightRatio,
    polygonSides,
    starPoints,
    starInnerRatio,
    interactionRadius
  ]);

  const exportPreviewText = useMemo(() => JSON.stringify({
    config: panelConfig,
    background: {
      mode: backgroundMode,
      imageUrl
    }
  }, null, 2), [panelConfig, backgroundMode, imageUrl]);

  const triggerRandomWave = () => {
    panelRef.current?.triggerWaveAtRatio(Math.random());
  };

  const triggerBurst = () => {
    for (let i = 0; i < 5; i++) {
      const ratio = i / 5 + Math.random() * 0.05;
      panelRef.current?.triggerWaveAtRatio(ratio, {
        intensity: 30 + Math.random() * 35
      });
    }
  };

  const applyBackground = () => {
    panelRef.current?.setBackground({
      mode: backgroundMode,
      imageUrl
    });
  };

  const copyTextByLegacyExecCommand = (text: string): boolean => {
    if (typeof document === 'undefined') {
      return false;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const exportCurrentConfigToClipboard = async () => {
    const json = exportPreviewText;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(json);
        setExportStatusText('配置已复制到剪贴板');
        return;
      }
    } catch {
      // noop: fallback below
    }

    const copiedByLegacyApi = copyTextByLegacyExecCommand(json);
    setExportStatusText(
      copiedByLegacyApi
        ? '配置已复制到剪贴板（兼容模式）'
        : '复制失败，请手动复制下面文本'
    );
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#020604',
        color: '#bbf7d0',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        display: 'grid',
        gridTemplateColumns: 'minmax(300px, 360px) 1fr',
        overflow: 'hidden'
      }}
    >
      <aside
        style={{
          borderRight: '1px solid rgba(74, 222, 128, 0.25)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          background: 'rgba(8, 18, 13, 0.9)',
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      >
        <h3 style={{ margin: 0, color: '#4ade80' }}>Oscilloscope UI Lab</h3>
        <div style={{ fontSize: 12, opacity: 0.9 }}>
          组件接口联调：创建、参数设置、波纹触发、背景切换、承载 React 内容。
        </div>
        <div style={{ fontSize: 12, opacity: 0.9 }}>
          `square/rectangle` 会沿容器边缘采样，非全屏尺寸也可直接作为 UI 边框层使用。
        </div>

        <label>
          形状
          <select
            value={shapeType}
            onChange={(event) => {
              const next = event.target.value as OscilloscopeShapeType;
              setShapeType(next);
              panelRef.current?.setShapeType(next);
            }}
            style={{ width: '100%', marginTop: 4 }}
          >
            {SHAPE_OPTIONS.map((shape) => (
              <option key={shape} value={shape}>{shape}</option>
            ))}
          </select>
        </label>

        <label>
          旋转角度 {shapeRotationDeg}°
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={shapeRotationDeg}
            onChange={(event) => {
              const next = Number(event.target.value);
              setShapeRotationDeg(next);
              panelRef.current?.setConfig({ shapeRotationDeg: next });
            }}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          波纹预设
          <select
            value={wavePreset}
            onChange={(event) => {
              const next = event.target.value as OscilloscopeWavePresetId;
              setWavePreset(next);
              panelRef.current?.setConfig({ wavePreset: next });
            }}
            style={{ width: '100%', marginTop: 4 }}
          >
            {PRESET_OPTIONS.map((preset) => (
              <option key={preset} value={preset}>{preset}</option>
            ))}
          </select>
        </label>

        <label>
          点击注入波预设
          <select
            value={pointerWavePreset}
            onChange={(event) => {
              const next = event.target.value as OscilloscopeWavePresetId | 'inherit';
              setPointerWavePreset(next);
              panelRef.current?.setConfig({ pointerWavePreset: next });
            }}
            style={{ width: '100%', marginTop: 4 }}
          >
            {POINTER_PRESET_OPTIONS.map((preset) => (
              <option key={preset} value={preset}>{preset}</option>
            ))}
          </select>
        </label>

        <label>
          主题色
          <select
            value={themeColor}
            onChange={(event) => {
              const next = event.target.value;
              setThemeColor(next);
              panelRef.current?.setThemeColor(next);
            }}
            style={{ width: '100%', marginTop: 4 }}
          >
            {THEME_OPTIONS.map((color) => (
              <option key={color} value={color}>{color}</option>
            ))}
          </select>
        </label>

        <label>
          线宽 {lineWidth.toFixed(1)}
          <input
            type="range"
            min={1}
            max={6}
            step={0.1}
            value={lineWidth}
            onChange={(event) => {
              const next = Number(event.target.value);
              setLineWidth(next);
              panelRef.current?.setConfig({ lineWidth: next });
            }}
            style={{ width: '100%' }}
          />
        </label>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={enableLineGlow}
            onChange={(event) => {
              const next = event.target.checked;
              setEnableLineGlow(next);
              panelRef.current?.setConfig({ enableLineGlow: next });
            }}
          />
          启用线条发光
        </label>

        <label>
          残影清除强度 {clearFillAlpha.toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={clearFillAlpha}
            onChange={(event) => {
              const next = Number(event.target.value);
              setClearFillAlpha(next);
              panelRef.current?.setConfig({ clearFillAlpha: next });
            }}
            style={{ width: '100%' }}
          />
        </label>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={clearFrameEachTick}
            onChange={(event) => {
              const next = event.target.checked;
              setClearFrameEachTick(next);
              panelRef.current?.setConfig({ clearFrameEachTick: next });
            }}
          />
          每帧清除残影（关闭后保留拖尾）
        </label>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={showPlacementPreview}
            onChange={(event) => {
              const next = event.target.checked;
              setShowPlacementPreview(next);
              panelRef.current?.setConfig({ showPlacementPreview: next });
            }}
          />
          显示可放置线段高亮
        </label>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={showImpactMarkers}
            onChange={(event) => {
              const next = event.target.checked;
              setShowImpactMarkers(next);
              panelRef.current?.setConfig({ showImpactMarkers: next });
            }}
          />
          显示落点动画
        </label>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={autoInjectOnPointerDown}
            onChange={(event) => {
              const next = event.target.checked;
              setAutoInjectOnPointerDown(next);
              panelRef.current?.setConfig({ autoInjectOnPointerDown: next });
            }}
          />
          启用鼠标点击注入波
        </label>

        <label>
          并存波上限 {maxActiveWaves}
          <input
            type="range"
            min={1}
            max={64}
            step={1}
            value={maxActiveWaves}
            onChange={(event) => {
              const next = Number(event.target.value);
              setMaxActiveWaves(next);
              panelRef.current?.setConfig({ maxActiveWaves: next });
            }}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          预览宽度 {previewWidth}px
          <input
            type="range"
            min={100}
            max={900}
            step={2}
            value={previewWidth}
            onChange={(event) => setPreviewWidth(Number(event.target.value))}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          预览高度 {previewHeight}px
          <input
            type="range"
            min={50}
            max={500}
            step={2}
            value={previewHeight}
            onChange={(event) => setPreviewHeight(Number(event.target.value))}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          边缘留白（震动缓冲） {edgePadding}px
          <input
            type="range"
            min={0}
            max={80}
            step={1}
            value={edgePadding}
            onChange={(event) => {
              const next = Number(event.target.value);
              setEdgePadding(next);
              panelRef.current?.setConfig({ edgePadding: next });
            }}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          点击波强度倍率 {pointerWaveIntensityMultiplier.toFixed(2)}
          <input
            type="range"
            min={0}
            max={3}
            step={0.01}
            value={pointerWaveIntensityMultiplier}
            onChange={(event) => {
              const next = Number(event.target.value);
              setPointerWaveIntensityMultiplier(next);
              panelRef.current?.setConfig({ pointerWaveIntensityMultiplier: next });
            }}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          点击波持续倍率 {pointerWaveDurationMultiplier.toFixed(2)}
          <input
            type="range"
            min={0.1}
            max={3}
            step={0.01}
            value={pointerWaveDurationMultiplier}
            onChange={(event) => {
              const next = Number(event.target.value);
              setPointerWaveDurationMultiplier(next);
              panelRef.current?.setConfig({ pointerWaveDurationMultiplier: next });
            }}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          点击波速度倍率 {pointerWaveTravelMultiplier.toFixed(2)}
          <input
            type="range"
            min={0.1}
            max={3}
            step={0.01}
            value={pointerWaveTravelMultiplier}
            onChange={(event) => {
              const next = Number(event.target.value);
              setPointerWaveTravelMultiplier(next);
              panelRef.current?.setConfig({ pointerWaveTravelMultiplier: next });
            }}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          点击波扩散倍率 {pointerWaveSpreadMultiplier.toFixed(2)}
          <input
            type="range"
            min={0.1}
            max={3}
            step={0.01}
            value={pointerWaveSpreadMultiplier}
            onChange={(event) => {
              const next = Number(event.target.value);
              setPointerWaveSpreadMultiplier(next);
              panelRef.current?.setConfig({ pointerWaveSpreadMultiplier: next });
            }}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          点击波抖动倍率 {pointerWaveJitterMultiplier.toFixed(2)}
          <input
            type="range"
            min={0}
            max={3}
            step={0.01}
            value={pointerWaveJitterMultiplier}
            onChange={(event) => {
              const next = Number(event.target.value);
              setPointerWaveJitterMultiplier(next);
              panelRef.current?.setConfig({ pointerWaveJitterMultiplier: next });
            }}
            style={{ width: '100%' }}
          />
        </label>

        {!isEdgeFitShape ? (
          <>
            <label>
              形状尺寸 {shapeSizeRatio.toFixed(2)}
              <input
                type="range"
                min={0.12}
                max={0.36}
                step={0.01}
                value={shapeSizeRatio}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setShapeSizeRatio(next);
                  panelRef.current?.setConfig({ shapeSizeRatio: next });
                }}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              水平缩放 {shapeWidthScale.toFixed(2)}
              <input
                type="range"
                min={0.4}
                max={2}
                step={0.01}
                value={shapeWidthScale}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setShapeWidthScale(next);
                  panelRef.current?.setConfig({ shapeWidthScale: next });
                }}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              垂直缩放 {shapeHeightScale.toFixed(2)}
              <input
                type="range"
                min={0.4}
                max={2}
                step={0.01}
                value={shapeHeightScale}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setShapeHeightScale(next);
                  panelRef.current?.setConfig({ shapeHeightScale: next });
                }}
                style={{ width: '100%' }}
              />
            </label>
          </>
        ) : null}

        {isRectangleShape && !isEdgeFitShape ? (
          <>
            <label>
              矩形宽比 {rectangleWidthRatio.toFixed(2)}
              <input
                type="range"
                min={0.5}
                max={2.6}
                step={0.01}
                value={rectangleWidthRatio}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setRectangleWidthRatio(next);
                  panelRef.current?.setConfig({ rectangleWidthRatio: next });
                }}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              矩形高比 {rectangleHeightRatio.toFixed(2)}
              <input
                type="range"
                min={0.3}
                max={2.2}
                step={0.01}
                value={rectangleHeightRatio}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setRectangleHeightRatio(next);
                  panelRef.current?.setConfig({ rectangleHeightRatio: next });
                }}
                style={{ width: '100%' }}
              />
            </label>
          </>
        ) : null}

        {isPolygonShape ? (
          <label>
            多边形边数 {polygonSides}
            <input
              type="range"
              min={3}
              max={12}
              step={1}
              value={polygonSides}
              onChange={(event) => {
                const next = Number(event.target.value);
                setPolygonSides(next);
                panelRef.current?.setConfig({ polygonSides: next });
              }}
              style={{ width: '100%' }}
            />
          </label>
        ) : null}

        {isStarShape ? (
          <>
            <label>
              星形尖角数 {starPoints}
              <input
                type="range"
                min={3}
                max={12}
                step={1}
                value={starPoints}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setStarPoints(next);
                  panelRef.current?.setConfig({ starPoints: next });
                }}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              星形内径比 {starInnerRatio.toFixed(2)}
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.01}
                value={starInnerRatio}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setStarInnerRatio(next);
                  panelRef.current?.setConfig({ starInnerRatio: next });
                }}
                style={{ width: '100%' }}
              />
            </label>
          </>
        ) : null}

        <label>
          点击捕捉半径 {interactionRadius}
          <input
            type="range"
            min={30}
            max={240}
            step={2}
            value={interactionRadius}
            onChange={(event) => {
              const next = Number(event.target.value);
              setInteractionRadius(next);
              panelRef.current?.setConfig({ interactionRadius: next });
            }}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          背景模式
          <select
            value={backgroundMode}
            onChange={(event) => {
              const next = event.target.value as OscilloscopeBackgroundMode;
              setBackgroundMode(next);
              panelRef.current?.setBackground({ mode: next });
            }}
            style={{ width: '100%', marginTop: 4 }}
          >
            {BACKGROUND_MODE_OPTIONS.map((mode) => (
              <option key={mode} value={mode}>{mode}</option>
            ))}
          </select>
        </label>

        <label>
          图像背景 URL
          <input
            type="text"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="/resources/xxx.png"
            style={{ width: '100%', marginTop: 4 }}
          />
        </label>

        <button onClick={applyBackground}>应用背景设置</button>
        <button onClick={exportCurrentConfigToClipboard}>复制当前导出配置到剪贴板</button>
        <button onClick={triggerRandomWave}>随机触发波纹</button>
        <button onClick={triggerBurst}>连发波纹 x5</button>
        <button
          onClick={() => {
            panelRef.current?.clearWaves();
            setWaveCount(0);
          }}
        >
          清空波纹
        </button>

        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
          已触发波纹次数: {waveCount}
        </div>
        <div
          style={{
            marginTop: 8,
            border: '1px solid rgba(74, 222, 128, 0.25)',
            background: 'rgba(3, 10, 7, 0.6)',
            borderRadius: 8,
            padding: 8
          }}
        >
          <div style={{ fontSize: 12, color: '#86efac', marginBottom: 6 }}>配置导出面板</div>
          <div style={{ fontSize: 12, minHeight: 18, marginBottom: 6, opacity: 0.95 }}>
            {exportStatusText || '下面实时预览导出内容，点击按钮即可复制'}
          </div>
          <textarea
            readOnly
            value={exportPreviewText}
            placeholder="导出结果会显示在这里"
            style={{
              width: '100%',
              minHeight: 120,
              resize: 'vertical',
              borderRadius: 6,
              border: '1px solid rgba(148, 163, 184, 0.35)',
              background: 'rgba(2, 6, 4, 0.85)',
              color: '#e2e8f0',
              padding: 8,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: 12,
              lineHeight: 1.45
            }}
          />
        </div>
      </aside>

      <main
        style={{
          padding: 24,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            width: previewWidth,
            height: previewHeight,
            maxWidth: '100%',
            maxHeight: '100%',
            minWidth: 100,
            minHeight: 50,
            border: '1px solid rgba(74, 222, 128, 0.25)',
            borderRadius: 10,
            overflow: 'hidden',
            background: '#010302',
            resize: 'both'
          }}
        >
          <OscilloscopeMaskPanel
            ref={panelRef}
            config={panelConfig}
            background={{ mode: backgroundMode, imageUrl }}
            contentPointerEvents="none"
            onPlacement={() => setWaveCount((value) => value + 1)}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div
                style={{
                  padding: '14px 18px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  background: 'rgba(0, 0, 0, 0.38)',
                  backdropFilter: 'blur(2px)',
                  color: '#f0fdf4'
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700 }}>MASKED REACT UI</div>
                <div style={{ fontSize: 12, opacity: 0.88, marginTop: 6 }}>
                  这里是 React 内容层，会被动态扭动轮廓裁切
                </div>
              </div>
            </div>
          </OscilloscopeMaskPanel>
        </div>
      </main>
    </div>
  );
};
