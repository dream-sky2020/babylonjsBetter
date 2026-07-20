import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_ONION_SKIN_SETTINGS,
  DEFAULT_SCANNED_ATLAS_OPTIONS,
  moveKeyframeTime,
  removeKeyframesAt,
  resolvePartAtlas,
  toFixedNumber,
  upsertKeyframe,
  upsertPoseChannel,
  type CurveChannel,
  type OnionSkinSettings,
  type SpritePartPose
} from '@/core/sprite';
import { useBabylonScene } from '@/hooks/spriteAnimationEditor/useBabylonScene.ts';
import { useCompositePreview } from '@/hooks/spriteAnimationEditor/useCompositePreview.ts';
import { useLibraryManagement } from '@/hooks/spriteAnimationEditor/useLibraryManagement.ts';
import { KeyframeCurveEditor } from './KeyframeCurveEditor';

const panelStyle: React.CSSProperties = {
  background: '#171b24',
  border: '1px solid #2a3344',
  borderRadius: 10,
  padding: 12,
  overflow: 'auto'
};

const labelStyle: React.CSSProperties = {
  color: '#8fa0b5',
  fontSize: 12,
  marginBottom: 4
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#0f131a',
  color: '#e8edf2',
  border: '1px solid #334155',
  borderRadius: 6,
  padding: '6px 8px'
};

const buttonStyle: React.CSSProperties = {
  background: '#243044',
  color: '#e8edf2',
  border: '1px solid #3b4b63',
  borderRadius: 6,
  padding: '6px 10px',
  cursor: 'pointer'
};

export const SpriteAnimationEditor: React.FC = () => {
  const lib = useLibraryManagement();
  const { canvasRef, sceneRef, cameraRef, sceneEpoch, zoomLabel, resetView } = useBabylonScene({
    setMessage: lib.setMessage
  });
  const [curveChannel, setCurveChannel] = useState<CurveChannel>('x');
  const [onionSkin, setOnionSkin] = useState<OnionSkinSettings>(DEFAULT_ONION_SKIN_SETTINGS);
  const selectedKeyTimeRef = useRef(lib.selectedKeyTime);
  const updateClipRef = useRef(lib.updateClip);
  useEffect(() => {
    selectedKeyTimeRef.current = lib.selectedKeyTime;
    updateClipRef.current = lib.updateClip;
  }, [lib.selectedKeyTime, lib.updateClip]);

  const onPartDragged = useCallback((partId: string, pose: Pick<SpritePartPose, 'x' | 'y'>) => {
    updateClipRef.current((prev) =>
      upsertKeyframe(prev, selectedKeyTimeRef.current, partId, {
        x: pose.x,
        y: pose.y
      })
    );
  }, []);

  const preview = useCompositePreview({
    sceneRef,
    cameraRef,
    sceneEpoch,
    rig: lib.rig,
    clip: lib.clip,
    scrubTime: lib.selectedKeyTime,
    selectedPartId: lib.selectedPartId,
    onionSkin,
    setMessage: lib.setMessage,
    onPartPicked: lib.setSelectedPartId,
    onPartDragged
  });

  const patchOnionSkin = (patch: Partial<OnionSkinSettings>) => {
    setOnionSkin((prev) => ({ ...prev, ...patch }));
  };

  const selectedPart = useMemo(
    () => lib.rig?.parts.find((part) => part.partId === lib.selectedPartId) ?? null,
    [lib.rig, lib.selectedPartId]
  );

  const selectedKey = useMemo(
    () => lib.clip?.keys.find((key) => Math.abs(key.time - lib.selectedKeyTime) < 1e-4) ?? null,
    [lib.clip, lib.selectedKeyTime]
  );

  const selectedPose: SpritePartPose = selectedKey?.parts[lib.selectedPartId] ?? {};
  const partAtlas = lib.rig && selectedPart ? resolvePartAtlas(lib.rig, selectedPart) : null;

  const updatePoseField = (field: keyof SpritePartPose, raw: string | boolean) => {
    if (!lib.clip || !lib.selectedPartId) return;
    const nextPose: SpritePartPose = { ...selectedPose };
    if (typeof raw === 'boolean') {
      nextPose.visible = raw;
    } else if (field === 'frameName') {
      nextPose.frameName = raw;
    } else if (
      field === 'x' ||
      field === 'y' ||
      field === 'rotationDeg' ||
      field === 'scaleX' ||
      field === 'scaleY'
    ) {
      const num = Number(raw);
      if (Number.isNaN(num)) return;
      nextPose[field] = toFixedNumber(num);
    }
    lib.updateClip((prev) => upsertKeyframe(prev, lib.selectedKeyTime, lib.selectedPartId, nextPose));
  };

  const applyKeyTimeEdit = (raw: string) => {
    const next = Number(raw);
    if (Number.isNaN(next) || next < 0) return;
    const from = lib.selectedKeyTime;
    const to = toFixedNumber(next);
    lib.updateClip((prev) => moveKeyframeTime(prev, from, to));
    lib.setSelectedKeyTime(to);
    preview.seek(to);
  };

  const rigOptions = Object.values(lib.library.rigs);
  const clipOptions = Object.values(lib.library.clips).filter(
    (clip) => !lib.rig || clip.rigId === lib.rig.rigId
  );

  return (
    <div
      style={{
        height: '100vh',
        display: 'grid',
        gridTemplateRows: '48px 1fr 280px',
        gap: 8,
        padding: 8
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          ...panelStyle,
          padding: '8px 12px'
        }}
      >
        <div>
          <strong>Sprite 动画编辑器</strong>
          <span style={{ marginLeft: 12, color: '#8fa0b5', fontSize: 12 }}>
            多图集 · 拖拽部件 · 关键帧曲线 · {zoomLabel}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: lib.serverConnected ? '#7dcea0' : '#e07474' }}>
            {lib.serverConnected ? `API :${lib.serverPort ?? '?'}` : 'API 未连接'}
          </span>
          <button type="button" style={buttonStyle} onClick={() => void lib.retryServerConnection()}>
            重试连接
          </button>
          <button type="button" style={buttonStyle} onClick={resetView}>
            复位视角
          </button>
          <button type="button" style={buttonStyle} onClick={() => void preview.rebuildPreview()}>
            重建预览
          </button>
          <button
            type="button"
            style={{ ...buttonStyle, background: '#2f6fed', borderColor: '#2f6fed' }}
            onClick={() => void lib.saveLibrary()}
          >
            保存
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 320px', gap: 8, minHeight: 0 }}>
        <aside style={panelStyle}>
          <div style={labelStyle}>Rig 默认图集</div>
          <select
            style={{ ...inputStyle, marginBottom: 10 }}
            value={lib.rig?.atlasJsonPath ?? ''}
            onChange={(event) => void lib.loadAtlasIntoRig(event.target.value)}
          >
            <option value="" disabled>
              选择图集…
            </option>
            {DEFAULT_SCANNED_ATLAS_OPTIONS.map((path) => (
              <option key={path} value={path}>
                {path}
              </option>
            ))}
          </select>

          <div style={labelStyle}>Rig</div>
          <select
            style={{ ...inputStyle, marginBottom: 10 }}
            value={lib.rig?.rigId ?? ''}
            onChange={(event) => lib.selectRig(event.target.value)}
          >
            {rigOptions.map((rig) => (
              <option key={rig.rigId} value={rig.rigId}>
                {rig.name || rig.rigId}
              </option>
            ))}
          </select>

          {lib.rig ? (
            <>
              <div style={labelStyle}>名称</div>
              <input
                style={{ ...inputStyle, marginBottom: 10 }}
                value={lib.rig.name ?? ''}
                onChange={(event) =>
                  lib.updateRig((prev) => ({ ...prev, name: event.target.value }))
                }
              />
              <div style={labelStyle}>baseSize</div>
              <input
                type="number"
                step={0.1}
                style={{ ...inputStyle, marginBottom: 10 }}
                value={lib.rig.baseSize ?? 2.5}
                onChange={(event) =>
                  lib.updateRig((prev) => ({
                    ...prev,
                    baseSize: Number(event.target.value) || 2.5
                  }))
                }
              />
            </>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={labelStyle}>部件（点击高亮，画布可拖）</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" style={buttonStyle} onClick={lib.addPart}>
                +
              </button>
              <button type="button" style={buttonStyle} onClick={lib.removeSelectedPart}>
                -
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {lib.rig?.parts.map((part) => (
              <button
                key={part.partId}
                type="button"
                style={{
                  ...buttonStyle,
                  textAlign: 'left',
                  background: part.partId === lib.selectedPartId ? '#2f6fed' : '#243044',
                  borderColor: part.partId === lib.selectedPartId ? '#2f6fed' : '#3b4b63'
                }}
                onClick={() => lib.setSelectedPartId(part.partId)}
              >
                {part.label || part.partId}
                {part.atlasJsonPath ? ' · 独立图集' : ''}
              </button>
            ))}
          </div>

          {selectedPart ? (
            <>
              <div style={labelStyle}>显示名</div>
              <input
                style={{ ...inputStyle, marginBottom: 8 }}
                value={selectedPart.label ?? ''}
                onChange={(event) =>
                  lib.updateSelectedPart((prev) => ({ ...prev, label: event.target.value }))
                }
              />

              <div style={labelStyle}>部件图集（可覆盖 Rig 默认）</div>
              <select
                style={{ ...inputStyle, marginBottom: 6 }}
                value={selectedPart.atlasJsonPath ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) {
                    lib.clearSelectedPartAtlasOverride();
                    return;
                  }
                  void lib.loadAtlasIntoSelectedPart(value);
                }}
              >
                <option value="">使用 Rig 默认</option>
                {DEFAULT_SCANNED_ATLAS_OPTIONS.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
              </select>
              <div style={{ color: '#6f8098', fontSize: 11, marginBottom: 8 }}>
                当前：{partAtlas?.atlasJsonPath || '（无）'}
              </div>

              <div style={labelStyle}>默认帧</div>
              <select
                style={{ ...inputStyle, marginBottom: 8 }}
                value={selectedPart.defaultFrameName ?? ''}
                onChange={(event) =>
                  lib.updateSelectedPart((prev) => ({
                    ...prev,
                    defaultFrameName: event.target.value
                  }))
                }
              >
                <option value="">（无）</option>
                {lib.frameNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <div style={labelStyle}>zIndex</div>
              <input
                type="number"
                style={{ ...inputStyle, marginBottom: 8 }}
                value={selectedPart.zIndex ?? 0}
                onChange={(event) =>
                  lib.updateSelectedPart((prev) => ({
                    ...prev,
                    zIndex: Number(event.target.value) || 0
                  }))
                }
              />
            </>
          ) : null}
        </aside>

        <section style={{ ...panelStyle, padding: 0, overflow: 'hidden', position: 'relative' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          <div
            style={{
              position: 'absolute',
              left: 10,
              bottom: 10,
              fontSize: 11,
              color: '#9fb0c5',
              background: 'rgba(15,19,26,0.75)',
              padding: '4px 8px',
              borderRadius: 6
            }}
          >
            左键拖部件 · 右键/中键平移 · 滚轮缩放
          </div>
        </section>

        <aside style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={labelStyle}>动画片段</div>
            <button type="button" style={buttonStyle} onClick={lib.addClip}>
              新建
            </button>
          </div>
          <select
            style={{ ...inputStyle, marginBottom: 10 }}
            value={lib.clip?.clipId ?? ''}
            onChange={(event) => lib.selectClip(event.target.value)}
          >
            {clipOptions.map((clip) => (
              <option key={clip.clipId} value={clip.clipId}>
                {clip.name || clip.clipId}
              </option>
            ))}
          </select>

          {lib.clip ? (
            <>
              <div style={labelStyle}>名称</div>
              <input
                style={{ ...inputStyle, marginBottom: 8 }}
                value={lib.clip.name ?? ''}
                onChange={(event) =>
                  lib.updateClip((prev) => ({ ...prev, name: event.target.value }))
                }
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={labelStyle}>fps</div>
                  <input
                    type="number"
                    style={inputStyle}
                    value={lib.clip.fps}
                    onChange={(event) =>
                      lib.updateClip((prev) => ({
                        ...prev,
                        fps: Number(event.target.value) || 12
                      }))
                    }
                  />
                </div>
                <div>
                  <div style={labelStyle}>duration (秒)</div>
                  <input
                    type="number"
                    step={0.05}
                    style={inputStyle}
                    value={lib.clip.duration ?? preview.duration}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isNaN(value) || value < 0) return;
                      lib.updateClip((prev) => ({
                        ...prev,
                        duration: toFixedNumber(value)
                      }));
                    }}
                  />
                </div>
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0' }}>
                <input
                  type="checkbox"
                  checked={lib.clip.loop}
                  onChange={(event) =>
                    lib.updateClip((prev) => ({ ...prev, loop: event.target.checked }))
                  }
                />
                循环播放
              </label>

              <div style={labelStyle}>选中关键帧时间 (秒)</div>
              <input
                type="number"
                step={0.01}
                style={{ ...inputStyle, marginBottom: 8 }}
                value={lib.selectedKeyTime}
                onChange={(event) => applyKeyTimeEdit(event.target.value)}
              />

              <div style={labelStyle}>当前关键帧姿态 · {lib.selectedPartId || '未选部件'}</div>
              <div style={labelStyle}>frameName</div>
              <select
                style={{ ...inputStyle, marginBottom: 8 }}
                value={selectedPose.frameName ?? ''}
                onChange={(event) => updatePoseField('frameName', event.target.value)}
              >
                <option value="">（保持）</option>
                {lib.frameNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {(['x', 'y', 'rotationDeg', 'scaleX', 'scaleY'] as const).map((field) => (
                <div key={field} style={{ marginBottom: 8 }}>
                  <div style={labelStyle}>{field}</div>
                  <input
                    type="number"
                    step={0.01}
                    style={inputStyle}
                    value={selectedPose[field] ?? ''}
                    placeholder="（空=不改）"
                    onChange={(event) => updatePoseField(field, event.target.value)}
                  />
                </div>
              ))}
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedPose.visible !== false}
                  onChange={(event) => updatePoseField('visible', event.target.checked)}
                />
                可见
              </label>
            </>
          ) : null}
        </aside>
      </div>

      <footer style={{ ...panelStyle, display: 'grid', gridTemplateRows: 'auto auto auto 1fr', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" style={buttonStyle} onClick={preview.play}>
            播放
          </button>
          <button type="button" style={buttonStyle} onClick={preview.pause}>
            暂停
          </button>
          <button type="button" style={buttonStyle} onClick={preview.stop}>
            停止
          </button>
          <span style={{ fontSize: 12, color: '#9fb0c5' }}>
            {preview.currentTime.toFixed(3)}s / {preview.duration.toFixed(3)}s
            {preview.playing ? ' · playing' : ''}
            {lib.clip?.loop ? ' · loop' : ''}
          </span>
          <button
            type="button"
            style={buttonStyle}
            onClick={() => {
              if (!lib.clip) return;
              const time = toFixedNumber(preview.currentTime);
              lib.updateClip((prev) =>
                upsertKeyframe(prev, time, lib.selectedPartId, {
                  ...selectedPose,
                  frameName: selectedPose.frameName || selectedPart?.defaultFrameName,
                  x: selectedPose.x ?? 0,
                  y: selectedPose.y ?? 0
                })
              );
              lib.setSelectedKeyTime(time);
              lib.setMessage(`已在 ${time}s 写入关键帧`);
            }}
          >
            在当前时间打关键帧
          </button>
          <button
            type="button"
            style={buttonStyle}
            onClick={() => {
              if (!lib.clip) return;
              const times = lib.selectedKeyTimes;
              lib.updateClip((prev) => removeKeyframesAt(prev, times));
              lib.setSelectedKeyTime(0);
              preview.seek(0);
              lib.setMessage(`已删除 ${times.length} 个关键帧`);
            }}
          >
            删除选中关键帧
          </button>
          <span style={{ fontSize: 12, color: '#6f8098' }}>{lib.message}</span>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '8px 10px',
            borderRadius: 8,
            background: '#121722',
            border: '1px solid #2a3344'
          }}
        >
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
            <input
              type="checkbox"
              checked={onionSkin.enabled}
              onChange={(event) => patchOnionSkin({ enabled: event.target.checked })}
            />
            洋葱皮残影
          </label>
          <span style={{ fontSize: 11, color: '#e07474' }}>红=过去</span>
          <span style={{ fontSize: 11, color: '#5b9dff' }}>蓝=未来</span>
          <select
            style={{ ...inputStyle, width: 210 }}
            value={onionSkin.mode}
            disabled={!onionSkin.enabled}
            onChange={(event) =>
              patchOnionSkin({ mode: event.target.value as OnionSkinSettings['mode'] })
            }
          >
            <option value="time">模式一：固定时间步长</option>
            <option value="keyframe">模式二：仅关键帧</option>
          </select>
          {onionSkin.mode === 'time' ? (
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
              间隔(ms)
              <input
                type="number"
                min={1}
                step={1}
                disabled={!onionSkin.enabled}
                style={{ ...inputStyle, width: 72 }}
                value={Math.round(onionSkin.intervalSec * 1000)}
                onChange={(event) => {
                  const ms = Number(event.target.value);
                  if (!Number.isFinite(ms) || ms < 1) return;
                  patchOnionSkin({ intervalSec: ms / 1000 });
                }}
              />
            </label>
          ) : null}
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
            过去
            <input
              type="number"
              min={0}
              max={24}
              disabled={!onionSkin.enabled}
              style={{ ...inputStyle, width: 56 }}
              value={onionSkin.pastCount}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                patchOnionSkin({ pastCount: Math.max(0, Math.min(24, Math.floor(value))) });
              }}
            />
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
            未来
            <input
              type="number"
              min={0}
              max={24}
              disabled={!onionSkin.enabled}
              style={{ ...inputStyle, width: 56 }}
              value={onionSkin.futureCount}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isFinite(value)) return;
                patchOnionSkin({ futureCount: Math.max(0, Math.min(24, Math.floor(value))) });
              }}
            />
          </label>
          <span style={{ fontSize: 11, color: '#6f8098' }}>
            {onionSkin.mode === 'time'
              ? '按固定间隔采样运动轨迹；循环时未来可绕回开头'
              : '只吸附真实关键帧姿态；循环时过去/未来可跨时间轴两端'}
          </span>
        </div>

        <div>
          <input
            type="range"
            min={0}
            max={Math.max(preview.duration, 0.001)}
            step={0.01}
            value={Math.min(lib.selectedKeyTime, preview.duration || 0)}
            onChange={(event) => {
              const time = Number(event.target.value);
              lib.setSelectedKeyTime(time);
              preview.seek(time);
            }}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {lib.clip?.keys.map((key) => {
              const selected = lib.selectedKeyTimes.some((t) => Math.abs(t - key.time) < 1e-4);
              return (
                <button
                  key={key.time}
                  type="button"
                  style={{
                    ...buttonStyle,
                    background: selected ? '#2f6fed' : '#243044',
                    borderColor: selected ? '#2f6fed' : '#3b4b63'
                  }}
                  onClick={(event) => {
                    lib.selectKeyTime(key.time, event.ctrlKey || event.metaKey);
                    preview.seek(key.time);
                  }}
                >
                  {key.time.toFixed(2)}s
                </button>
              );
            })}
          </div>
        </div>

        <KeyframeCurveEditor
          clip={lib.clip}
          partId={lib.selectedPartId}
          channel={curveChannel}
          selectedKeyTimes={lib.selectedKeyTimes}
          duration={preview.duration}
          onChannelChange={setCurveChannel}
          onSelectKey={(time, multi) => {
            lib.selectKeyTime(time, multi);
            preview.seek(time);
          }}
          onChangePoint={(time, value) => {
            lib.updateClip((prev) =>
              upsertPoseChannel(prev, time, lib.selectedPartId, curveChannel, value)
            );
            if (!preview.playing) preview.seek(lib.selectedKeyTime);
          }}
          onMoveKeyTime={(from, to) => {
            lib.updateClip((prev) => moveKeyframeTime(prev, from, to));
            lib.setSelectedKeyTime(to);
            preview.seek(to);
          }}
        />
      </footer>
    </div>
  );
};
