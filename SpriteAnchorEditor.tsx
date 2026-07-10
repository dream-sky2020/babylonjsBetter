import React, { useRef } from 'react';
import type { MockSprite } from './utils/mockSprite';
import { usePresetManagement } from './hooks/spriteAnchorEditor/usePresetManagement';
import { useAtlasManagement } from './hooks/spriteAnchorEditor/useAtlasManagement';
import { useSpritePreview } from './hooks/spriteAnchorEditor/useSpritePreview';
import { useBabylonScene } from './hooks/spriteAnchorEditor/useBabylonScene';
import { useClipboardActions } from './hooks/spriteAnchorEditor/useClipboardActions';
import {
  ANCHOR_MAX,
  ANCHOR_MIN,
  BOUNDS_MAX,
  BOUNDS_MIN,
  DEFAULT_ATLAS_JSON_PATH,
  INPUT_STEP
} from './utils/spriteAnchorEditorHelpers';

export const SpriteAnchorEditor: React.FC = () => {
  const initialImagePath = 'resources/优势.png';
  const spriteRef = useRef<MockSprite | null>(null);

  const {
    preset,
    presetRef,
    message,
    presetSourceLabel,
    presetKeys,
    setMessage,
    setPresetSourceLabel,
    setPreset,
    applyPresetBySelection,
    updatePresetByDrag,
    updatePresetField,
    importCurrentLocalPreset,
    saveCurrentPreset,
    clearCurrentPreset,
    exportJson
  } = usePresetManagement({ initialImagePath });

  const {
    imagePath,
    mode,
    atlasJsonPath,
    atlasImagePath,
    atlasData,
    frameNames,
    selectedFrameName,
    scannedAtlasOptions,
    resourceImageOptions,
    allPresetKeys,
    normalizedImagePath,
    activeImagePath,
    activeFrameName,
    activePresetKey,
    currentFrameRegion,
    setMode,
    setAtlasJsonPath,
    loadAtlas,
    handleSpriteResourceChange,
    handlePresetSelectionChange,
    handleAtlasFrameSelectChange
  } = useAtlasManagement({
    initialImagePath,
    presetKeys,
    applyPresetBySelection,
    setMessage
  });

  const { canvasRef, sceneRef, zoomLabel, resetView } = useBabylonScene({
    presetRef,
    spriteRef,
    updatePresetByDrag,
    setMessage
  });

  useSpritePreview({
    sceneRef,
    spriteRef,
    preset,
    presetRef,
    imagePath,
    activeImagePath,
    currentFrameRegion
  });

  const { copyCurrentPreset, pastePreset } = useClipboardActions({
    preset,
    setPreset,
    setPresetSourceLabel,
    setMessage
  });

  const renderDragNumberControl = (
    label: string,
    path: string,
    value: number,
    min: number,
    max: number,
    description?: string
  ) => (
    <div key={path} style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: '#141a23' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ color: '#9fb0c5', fontSize: 12 }}>{label}</span>
        <span style={{ color: '#cdd6e1', fontSize: 12 }}>{value.toFixed(4)}</span>
      </div>
      {description ? <div style={{ color: '#6f8098', fontSize: 11, marginBottom: 6 }}>{description}</div> : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 88px', gap: 8, alignItems: 'center' }}>
        <input
          type="range"
          min={min}
          max={max}
          step={INPUT_STEP}
          value={value}
          onChange={(event) => updatePresetField(path, event.target.value)}
        />
        <input
          type="number"
          step={INPUT_STEP}
          min={min}
          max={max}
          value={value}
          onChange={(event) => updatePresetField(path, event.target.value)}
        />
      </div>
    </div>
  );


  return (
    <div style={{ padding: 16, height: '100vh', boxSizing: 'border-box', display: 'grid', gridTemplateColumns: '420px 1fr', gap: 16 }}>
      <div style={{ background: '#1a1f29', borderRadius: 12, padding: 14, overflow: 'auto' }}>
        <h2 style={{ margin: 0, marginBottom: 10 }}>Sprite 锚点编辑器</h2>
        <p style={{ marginTop: 0, color: '#9fb0c5', fontSize: 13 }}>右侧画布支持拖拽平移、滚轮缩放、左下角小地图与回正视角。</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <button
            onClick={() => {
              handleSpriteResourceChange(imagePath);
            }}
            style={{ background: mode === 'single' ? '#2e3f5e' : undefined }}
          >
            单图模式
          </button>
          <button
            onClick={() => {
              setMode('atlas');
              if (!atlasData) void loadAtlas(atlasJsonPath || scannedAtlasOptions[0] || DEFAULT_ATLAS_JSON_PATH);
            }}
            style={{ background: mode === 'atlas' ? '#2e3f5e' : undefined }}
          >
            TexturePacker 图集模式
          </button>
        </div>

        {mode === 'single' ? (
          <>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>图片路径（基于 public）</label>
            <input
              value={imagePath}
              onChange={(e) => handleSpriteResourceChange(e.target.value)}
              placeholder="resources/优势.png"
              style={{ width: '100%', marginBottom: 8, padding: '8px 10px', borderRadius: 6, border: '1px solid #3a4253', background: '#11151d', color: '#e8edf2' }}
            />
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>资源图片列表（自动扫描 public）</label>
            <select
              value={normalizedImagePath}
              onChange={(e) => handleSpriteResourceChange(e.target.value)}
              style={{ width: '100%', marginBottom: 8, padding: '8px 10px', borderRadius: 6, border: '1px solid #3a4253', background: '#11151d', color: '#e8edf2' }}
            >
              {resourceImageOptions.map((key) => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>图集 JSON 路径（自动扫描 public）</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 86px', gap: 8, marginBottom: 8 }}>
              {scannedAtlasOptions.length > 0 ? (
                <select
                  value={atlasJsonPath}
                  onChange={(e) => {
                    const newPath = e.target.value;
                    if (!newPath || newPath === atlasJsonPath) return;
                    setAtlasJsonPath(newPath);
                    void loadAtlas(newPath);
                  }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #3a4253', background: '#11151d', color: '#e8edf2' }}
                >
                  <option value="" disabled>-- 请选择图集 --</option>
                  {scannedAtlasOptions.map((path) => (
                    <option key={path} value={path}>{path}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={atlasJsonPath}
                  onChange={(e) => setAtlasJsonPath(e.target.value)}
                  placeholder="未扫描到 JSON，请手动输入..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #3a4253', background: '#11151d', color: '#e8edf2' }}
                />
              )}
              <button onClick={() => loadAtlas(atlasJsonPath)}>加载图集</button>
            </div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>图集帧（同一纹理不同区域）</label>
            <select
              value={selectedFrameName}
              onChange={(e) => handleAtlasFrameSelectChange(e.target.value)}
              style={{ width: '100%', marginBottom: 8, padding: '8px 10px', borderRadius: 6, border: '1px solid #3a4253', background: '#11151d', color: '#e8edf2' }}
            >
              {frameNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <div style={{ fontSize: 12, color: '#9fb0c5', marginBottom: 8 }}>
              当前图集纹理：{atlasImagePath || '-'}
            </div>
          </>
        )}

        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>快速选择已有锚点配置</label>
        <select
          value={activePresetKey}
          onChange={(e) => { void handlePresetSelectionChange(e.target.value); }}
          style={{ width: '100%', marginBottom: 8, padding: '8px 10px', borderRadius: 6, border: '1px solid #3a4253', background: '#11151d', color: '#e8edf2' }}
        >
          {allPresetKeys.map((key) => (
            <option key={key} value={key}>{key}</option>
          ))}
        </select>
        <div style={{ fontSize: 12, color: '#6f8098', marginBottom: 10 }}>当前预设 Key：{activePresetKey}</div>

        <div style={{ fontSize: 12, color: '#9fb0c5', marginBottom: 10 }}>{presetSourceLabel}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <button onClick={() => importCurrentLocalPreset(activePresetKey, activeImagePath, imagePath, activeFrameName)}>导入本地配置</button>
          <button onClick={() => saveCurrentPreset(activePresetKey, activeImagePath, imagePath, activeFrameName)}>保存到本地</button>
          <button onClick={() => clearCurrentPreset(activePresetKey, activeImagePath, imagePath, activeFrameName, currentFrameRegion)}>清除本地覆盖</button>
          <button onClick={exportJson}>导出 JSON</button>
          <button onClick={copyCurrentPreset}>复制配置</button>
          <button onClick={pastePreset}>粘贴配置</button>
        </div>

        <div style={{ marginBottom: 12, fontSize: 12, color: '#9fb0c5' }}>{message}</div>

        <h3 style={{ margin: '10px 0 8px 0', fontSize: 15 }}>锚点精确数据（{ANCHOR_MIN}~{ANCHOR_MAX}）</h3>
        <div>
          {renderDragNumberControl('head.u（顶部锚点 X）', 'head.u', preset.anchors.head.u, ANCHOR_MIN, ANCHOR_MAX)}
          {renderDragNumberControl('head.v（顶部锚点 Y）', 'head.v', preset.anchors.head.v, ANCHOR_MIN, ANCHOR_MAX)}
          {renderDragNumberControl('foot.u（底部锚点 X）', 'foot.u', preset.anchors.foot.u, ANCHOR_MIN, ANCHOR_MAX)}
          {renderDragNumberControl('foot.v（底部锚点 Y）', 'foot.v', preset.anchors.foot.v, ANCHOR_MIN, ANCHOR_MAX)}
          {renderDragNumberControl('center.u（中心锚点 X）', 'center.u', preset.anchors.center.u, ANCHOR_MIN, ANCHOR_MAX)}
          {renderDragNumberControl('center.v（中心锚点 Y）', 'center.v', preset.anchors.center.v, ANCHOR_MIN, ANCHOR_MAX)}
          {renderDragNumberControl('bodyAxisX（身体中轴线）', 'bodyAxisX', preset.bodyAxisX, ANCHOR_MIN, ANCHOR_MAX)}
        </div>

        <h3 style={{ margin: '12px 0 8px 0', fontSize: 15 }}>特殊包围盒（{BOUNDS_MIN}~{BOUNDS_MAX}）</h3>
        <div>
          {renderDragNumberControl('bodyBounds.minU（左边界）', 'minU', preset.bodyBounds.minU, BOUNDS_MIN, BOUNDS_MAX)}
          {renderDragNumberControl('bodyBounds.maxU（右边界）', 'maxU', preset.bodyBounds.maxU, BOUNDS_MIN, BOUNDS_MAX)}
          {renderDragNumberControl('bodyBounds.minV（上边界）', 'minV', preset.bodyBounds.minV, BOUNDS_MIN, BOUNDS_MAX)}
          {renderDragNumberControl('bodyBounds.maxV（下边界）', 'maxV', preset.bodyBounds.maxV, BOUNDS_MIN, BOUNDS_MAX)}
        </div>
      </div>

      <div style={{ background: '#1a1f29', borderRadius: 12, padding: 12, position: 'relative', minHeight: 0 }}>
        <div style={{ marginBottom: 8, color: '#9fb0c5', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>使用 Babylon 实时渲染：红=head，蓝=center，绿=foot，黄框=bodyBounds（drawSpriteDebugHelper）</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#cdd6e1' }}>相机缩放：{zoomLabel}</span>
            <button onClick={resetView} style={{ marginLeft: 8 }}>视角回到原位</button>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: 'calc(100% - 38px)',
            minHeight: 520,
            background: '#0f1319',
            borderRadius: 8,
            display: 'block',
            cursor: 'grab'
          }}
        />
      </div>
    </div>
  );
};
