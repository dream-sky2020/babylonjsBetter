import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArcRotateCamera, Color3, Color4, Engine, HemisphericLight, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import { SpecialStatusBadge } from '@/core/ui';
import {
  createAtlasSpritePlane,
  createNumberSprite,
  getPublicResourceImagePaths,
  loadNumberSpritePresets,
  type NumberSprite,
  type NumberSpritePreset,
  type NumberSpritePresetMap
} from '@/core/sprite';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{6})$/;
const TEXT_COLOR_PRESETS = ['#e2e8f0', '#ffffff', '#f8fafc', '#fde68a', '#fca5a5', '#93c5fd'];

type DragMode = 'move' | 'resize';
type PreviewMode = 'ui2d' | 'babylon3d';
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
  const [previewMode, setPreviewMode] = useState<PreviewMode>('ui2d');
  const [numberPresets, setNumberPresets] = useState<NumberSpritePresetMap>({});
  const [numberPresetKey, setNumberPresetKey] = useState('number_default');
  const [billboard3d, setBillboard3d] = useState(true);
  const [debug3d, setDebug3d] = useState(false);
  const [statusHeight3d, setStatusHeight3d] = useState(2.4);
  const [statusScale3d, setStatusScale3d] = useState(1);
  const [numberScale3d, setNumberScale3d] = useState(1);
  const [cornerInset3d, setCornerInset3d] = useState(0);
  const [positionX3d, setPositionX3d] = useState(0);
  const [positionY3d, setPositionY3d] = useState(2.25);
  const [positionZ3d, setPositionZ3d] = useState(0);
  const [numberOffsets3d, setNumberOffsets3d] = useState<Array<[number, number, number]>>([
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ]);

  const updateNumberOffset3d = (index: number, axis: 0 | 1 | 2, value: number) => {
    setNumberOffsets3d((current) => current.map((offset, offsetIndex) => {
      if (offsetIndex !== index) return offset;
      const next: [number, number, number] = [...offset];
      next[axis] = value;
      return next;
    }));
  };

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

  const resourceImageOptions = useMemo(() => getPublicResourceImagePaths(true), []);

  useEffect(() => {
    let cancelled = false;
    void loadNumberSpritePresets(true).then((loaded) => {
      if (cancelled) return;
      setNumberPresets(loaded);
      const keys = Object.keys(loaded);
      setNumberPresetKey((current) => loaded[current] ? current : (keys[0] ?? ''));
    }).catch((error) => {
      console.error('数字精灵配置加载失败', error);
    });
    return () => { cancelled = true; };
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

  const badgePreview = (
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
  );

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
          预览场景
          <select
            aria-label="预览场景"
            value={previewMode}
            onChange={(event) => setPreviewMode(event.target.value as PreviewMode)}
            style={{ width: '100%', marginTop: 4 }}
          >
            <option value="ui2d">UI 2D</option>
            <option value="babylon3d">Babylon3d</option>
          </select>
        </label>

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

        {previewMode === 'babylon3d' ? <div style={{ display: 'grid', gap: 10 }}><label>
          3D 数字精灵配置
          <select
            value={numberPresetKey}
            onChange={(event) => setNumberPresetKey(event.target.value)}
            style={{ width: '100%', marginTop: 4 }}
          >
            {Object.entries(numberPresets).map(([key, item]) => (
              <option key={key} value={key}>{key} · {item.name}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
          <input
            type="checkbox"
            checked={billboard3d}
            onChange={(event) => setBillboard3d(event.target.checked)}
          />
          3D 始终朝向相机
        </label>
        <button type="button" onClick={() => setDebug3d((current) => !current)}>
          {debug3d ? '关闭精灵 Debug 边界' : '开启精灵 Debug 边界'}
        </button>
        </div> : null}

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

        {previewMode === 'ui2d' ? <><label>
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
        </> : <div style={{ display: 'grid', gap: 10 }}>
          <label>
            状态图高度
            <input type="number" min={0.1} step="0.1" value={statusHeight3d} onChange={(event) => setStatusHeight3d(Number(event.target.value))} style={{ width: '100%', marginTop: 4 }} />
          </label>
          <label>
            状态精灵缩放
            <input type="number" min={0.1} step="0.1" value={statusScale3d} onChange={(event) => setStatusScale3d(Number(event.target.value))} style={{ width: '100%', marginTop: 4 }} />
          </label>
          <label>
            数字精灵缩放
            <input type="number" min={0.1} step="0.1" value={numberScale3d} onChange={(event) => setNumberScale3d(Number(event.target.value))} style={{ width: '100%', marginTop: 4 }} />
          </label>
          <label>
            数字整体内边距
            <input type="number" step="0.1" value={cornerInset3d} onChange={(event) => setCornerInset3d(Number(event.target.value))} style={{ width: '100%', marginTop: 4 }} />
          </label>
          <label>
            状态图位置 X
            <input type="number" step="0.1" value={positionX3d} onChange={(event) => setPositionX3d(Number(event.target.value))} style={{ width: '100%', marginTop: 4 }} />
          </label>
          <label>
            状态图位置 Y
            <input type="number" step="0.1" value={positionY3d} onChange={(event) => setPositionY3d(Number(event.target.value))} style={{ width: '100%', marginTop: 4 }} />
          </label>
          <label>
            状态图位置 Z
            <input type="number" step="0.1" value={positionZ3d} onChange={(event) => setPositionZ3d(Number(event.target.value))} style={{ width: '100%', marginTop: 4 }} />
          </label>
          {(['左上数字', '右上数字', '左下数字', '右下数字'] as const).map((label, index) => (
            <fieldset key={label} style={{ margin: 0, padding: 8, border: '1px solid rgba(148, 163, 184, 0.35)', borderRadius: 6 }}>
              <legend style={{ padding: '0 4px', fontSize: 12 }}>{label}偏移</legend>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {(['X', 'Y', 'Z'] as const).map((axisLabel, axis) => (
                  <label key={axisLabel} style={{ fontSize: 11 }}>
                    {axisLabel}
                    <input type="number" step="0.1" value={numberOffsets3d[index]?.[axis] ?? 0} onChange={(event) => updateNumberOffset3d(index, axis as 0 | 1 | 2, Number(event.target.value))} style={{ width: '100%', marginTop: 3 }} />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <button type="button" onClick={() => {
            setStatusHeight3d(2.4);
            setStatusScale3d(1);
            setNumberScale3d(1);
            setCornerInset3d(0);
            setPositionX3d(0);
            setPositionY3d(2.25);
            setPositionZ3d(0);
            setNumberOffsets3d([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
          }}>
            重置 3D 参数
          </button>
        </div>}
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
            left: previewMode === 'babylon3d' ? 0 : '50%',
            top: previewMode === 'babylon3d' ? 0 : '50%',
            transform: previewMode === 'babylon3d' ? 'none' : `translate(calc(-50% + ${frameOffsetX}px), calc(-50% + ${frameOffsetY}px))`,
            width: previewMode === 'babylon3d' ? '100%' : frameWidth,
            height: previewMode === 'babylon3d' ? '100%' : frameHeight,
            border: previewMode === 'babylon3d' ? 'none' : '1px solid rgba(148, 163, 184, 0.45)',
            borderRadius: previewMode === 'babylon3d' ? 0 : 12,
            background: '#111827',
            display: 'grid',
            gridTemplateRows: previewMode === 'babylon3d' ? '1fr' : '34px 1fr'
          }}
        >
          <div
            onPointerDown={(event) => beginDrag(event, 'move')}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{
              display: previewMode === 'babylon3d' ? 'none' : 'flex',
              cursor: 'grab',
              borderBottom: '1px solid rgba(148, 163, 184, 0.35)',
              color: '#e2e8f0',
              fontSize: 12,
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 10px',
              userSelect: 'none'
            }}
          >
            <span>Special Status Frame</span>
            <span>{Math.round(frameWidth)} x {Math.round(frameHeight)}</span>
          </div>

          <div style={{ display: 'grid', placeItems: 'center', overflow: 'hidden', padding: previewMode === 'babylon3d' ? 0 : 16 }}>
            {previewMode === 'babylon3d' ? (
              <Babylon3dStatusPreview
                iconSrc={iconSrc}
                values={[topLeftValue, topRightValue, bottomLeftValue, bottomRightValue]}
                visible={[showTopLeftValue, showTopRightValue, showBottomLeftValue, showBottomRightValue]}
                statusHeight={statusHeight3d}
                statusScale={statusScale3d}
                numberScale={numberScale3d}
                cornerInset={cornerInset3d}
                position={[positionX3d, positionY3d, positionZ3d]}
                numberOffsets={numberOffsets3d}
                debug={debug3d}
                numberPreset={numberPresets[numberPresetKey]}
                billboard={billboard3d}
              />
            ) : badgePreview}
          </div>

          <div
            onPointerDown={(event) => beginDrag(event, 'resize')}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{
              display: previewMode === 'babylon3d' ? 'none' : 'block',
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

type Babylon3dStatusPreviewProps = {
  iconSrc: string;
  values: Array<number | string>;
  visible: boolean[];
  statusHeight: number;
  statusScale: number;
  numberScale: number;
  cornerInset: number;
  position: [number, number, number];
  numberOffsets: Array<[number, number, number]>;
  debug: boolean;
  numberPreset?: NumberSpritePreset;
  billboard: boolean;
};

const createPlaneDebugOverlay = (mesh: Mesh, scene: Scene, color: Color3): Mesh[] => {
  const border = MeshBuilder.CreateLines(`${mesh.name}_debug_border`, {
    points: [
      new Vector3(-0.5, 0.5, -0.02),
      new Vector3(0.5, 0.5, -0.02),
      new Vector3(0.5, -0.5, -0.02),
      new Vector3(-0.5, -0.5, -0.02),
      new Vector3(-0.5, 0.5, -0.02)
    ]
  }, scene);
  const centerLines = MeshBuilder.CreateLineSystem(`${mesh.name}_debug_center_lines`, {
    lines: [
      [new Vector3(-0.5, 0, -0.02), new Vector3(0.5, 0, -0.02)],
      [new Vector3(0, -0.5, -0.02), new Vector3(0, 0.5, -0.02)]
    ]
  }, scene);
  for (const debugMesh of [border, centerLines]) {
    debugMesh.color = color;
    debugMesh.parent = mesh;
    debugMesh.isPickable = false;
    debugMesh.renderingGroupId = 3;
  }
  return [border, centerLines];
};

const Babylon3dStatusPreview: React.FC<Babylon3dStatusPreviewProps> = ({ iconSrc, values, visible, statusHeight, statusScale, numberScale, cornerInset, position, numberOffsets, numberPreset, billboard, debug }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine(canvas, true, { stencil: true });
    const scene = new Scene(engine);
    sceneRef.current = scene;
    scene.clearColor = new Color4(0.035, 0.055, 0.09, 1);
    const camera = new ArcRotateCamera('special_status_3d_camera', -Math.PI / 2, 1.18, 9, new Vector3(0, 1, 0), scene);
    camera.attachControl(canvas, true);
    camera.wheelPrecision = 35;
    const light = new HemisphericLight('special_status_3d_light', new Vector3(0.4, 1, 0.2), scene);
    light.intensity = 1.35;
    const ground = MeshBuilder.CreateGround('special_status_3d_ground', { width: 18, height: 18 }, scene);
    const groundMaterial = new StandardMaterial('special_status_3d_ground_material', scene);
    groundMaterial.diffuseColor = new Color3(0.06, 0.1, 0.16);
    ground.material = groundMaterial;
    engine.runRenderLoop(() => scene.render());
    const resize = () => engine.resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      scene.dispose();
      engine.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const icon = createAtlasSpritePlane(
      scene,
      encodeURI(iconSrc || '/resources/favicon.svg'),
      statusHeight * statusScale
    );
    icon.mesh.name = 'special_status_core_sprite';
    icon.mesh.position = new Vector3(position[0], position[1], position[2]);
    icon.mesh.billboardMode = billboard ? Mesh.BILLBOARDMODE_Y : 0;
    icon.mesh.renderingGroupId = 1;
    if (icon.mesh.material) icon.mesh.material.disableDepthWrite = true;
    icon.mesh.showBoundingBox = debug;
    icon.mesh.isPickable = false;
    const debugMeshes = debug ? createPlaneDebugOverlay(icon.mesh, scene, new Color3(0.2, 0.85, 1)) : [];
    return () => {
      for (const debugMesh of debugMeshes) debugMesh.dispose();
      icon.dispose();
    };
  }, [iconSrc, statusHeight, statusScale, position[0], position[1], position[2], billboard, debug]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !numberPreset) return;
    let cancelled = false;
    const created: NumberSprite[] = [];
    const iconHeight = statusHeight * statusScale;
    const offset = Math.max(0.02, iconHeight * 0.5 - cornerInset);
    const positions = [
      new Vector3(position[0] - offset, position[1] + offset, position[2] - 0.04),
      new Vector3(position[0] + offset, position[1] + offset, position[2] - 0.04),
      new Vector3(position[0] - offset, position[1] - offset, position[2] - 0.04),
      new Vector3(position[0] + offset, position[1] - offset, position[2] - 0.04)
    ];
    const runtimePreset: NumberSpritePreset = {
      ...numberPreset,
      height: numberPreset.height * numberScale,
      billboard: false
    };

    void Promise.all(values.map(async (value, index) => {
      if (!visible[index]) return;
      const numberSprite = await createNumberSprite(scene, String(value), runtimePreset);
      if (cancelled) {
        numberSprite.dispose();
        return;
      }
      const basePosition = positions[index] ?? Vector3.Zero();
      const digitOffset = numberOffsets[index] ?? [0, 0, 0];
      numberSprite.root.position.copyFrom(basePosition).addInPlaceFromFloats(digitOffset[0], digitOffset[1], digitOffset[2]);
      numberSprite.root.billboardMode = billboard ? Mesh.BILLBOARDMODE_Y : 0;
      numberSprite.setDebugVisible(debug);
      for (const digitMesh of numberSprite.root.getChildMeshes()) {
        digitMesh.renderingGroupId = 2;
        if (digitMesh.material) digitMesh.material.disableDepthWrite = true;
      }
      created.push(numberSprite);
    })).catch((error) => {
      console.error('Special Status 3D 数字精灵创建失败', error);
    });

    return () => {
      cancelled = true;
      for (const numberSprite of created) numberSprite.dispose();
    };
  }, [numberPreset, values[0], values[1], values[2], values[3], visible[0], visible[1], visible[2], visible[3], statusHeight, statusScale, numberScale, cornerInset, position[0], position[1], position[2], numberOffsets, billboard, debug]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', outline: 'none' }} />
      <div style={{ position: 'absolute', left: 8, bottom: 6, color: '#94a3b8', fontSize: 10, pointerEvents: 'none' }}>
        Babylon3d 场景 · 左键旋转 · 滚轮缩放
      </div>
    </div>
  );
};
