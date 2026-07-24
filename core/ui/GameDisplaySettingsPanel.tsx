import { useEffect, useMemo, useState } from 'react';
import {
  invokeNative,
  isElectronRuntime,
  type ApplyDisplaySettingsPayload,
  type ApplyDisplaySettingsResult,
  type DisplayResolution,
  type DisplaySettingsSnapshot
} from '@/runtime/nativeBridge';
import { OscilloscopeMaskPanel, type OscilloscopePanelConfig } from './OscilloscopeMaskPanel';

const FALLBACK_RESOLUTIONS: DisplayResolution[] = [
  { width: 1024, height: 576 },
  { width: 1152, height: 648 },
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 }
];

const PANEL_MASK_CONFIG: Partial<OscilloscopePanelConfig> = {
  shapeType: 'rectangle',
  shapeRotationDeg: 0,
  colorTheme: '#f5f5f5',
  wavePreset: 'ecg_sharp',
  pointerWavePreset: 'inherit',
  pointerWaveIntensityMultiplier: 1,
  pointerWaveDurationMultiplier: 1,
  pointerWaveTravelMultiplier: 1,
  pointerWaveSpreadMultiplier: 1,
  pointerWaveJitterMultiplier: 1,
  lineWidth: 3,
  enableLineGlow: false,
  clearFrameEachTick: true,
  clearFillAlpha: 1,
  showPlacementPreview: true,
  showImpactMarkers: false,
  autoInjectOnPointerDown: true,
  maxActiveWaves: 24,
  shapeSizeRatio: 0.5,
  shapeWidthScale: 1,
  shapeHeightScale: 1,
  rectangleWidthRatio: 1.4,
  rectangleHeightRatio: 2.8,
  polygonSides: 6,
  starPoints: 5,
  starInnerRatio: 0.45,
  interactionRadius: 140
};

const toResolutionLabel = (value: DisplayResolution): string => `${value.width}*${value.height}`;

type GameDisplaySettingsPanelProps = {
  open: boolean;
  onClose: () => void;
};

export const GameDisplaySettingsPanel = ({ open, onClose }: GameDisplaySettingsPanelProps) => {
  const [resolutions, setResolutions] = useState<DisplayResolution[]>(FALLBACK_RESOLUTIONS);
  const [selectedResolution, setSelectedResolution] = useState(toResolutionLabel(FALLBACK_RESOLUTIONS[2]));
  const [fullscreen, setFullscreen] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const resolutionOptions = useMemo(() => {
    const knownLabels = new Set<string>();
    const result: DisplayResolution[] = [];
    for (const item of resolutions) {
      const label = toResolutionLabel(item);
      if (knownLabels.has(label)) continue;
      knownLabels.add(label);
      result.push(item);
    }
    return result;
  }, [resolutions]);

  useEffect(() => {
    if (!open) return;

    const init = async () => {
      if (!isElectronRuntime()) {
        setStatusText('当前为网页模式，仅支持演示，不会修改桌面窗口。');
        return;
      }
      try {
        const snapshot = await invokeNative<DisplaySettingsSnapshot, 'window:get-display-settings'>(
          'window:get-display-settings'
        );
        const nextResolutions = snapshot.resolutions.length > 0 ? snapshot.resolutions : FALLBACK_RESOLUTIONS;
        setResolutions(nextResolutions);
        const currentLabel = `${snapshot.width}*${snapshot.height}`;
        const hasCurrent = nextResolutions.some((item) => toResolutionLabel(item) === currentLabel);
        if (!hasCurrent) {
          setResolutions((prev) => [{ width: snapshot.width, height: snapshot.height }, ...prev]);
        }
        setSelectedResolution(currentLabel);
        setFullscreen(Boolean(snapshot.fullscreen));
        setStatusText('');
      } catch {
        setStatusText('读取当前窗口配置失败。');
      }
    };

    void init();
  }, [open]);

  if (!open) return null;

  const applySettings = async () => {
    const [wText, hText] = selectedResolution.split('*');
    const payload: ApplyDisplaySettingsPayload = {
      width: Math.max(640, Number(wText) || 1280),
      height: Math.max(360, Number(hText) || 720),
      fullscreen
    };

    if (!isElectronRuntime()) {
      setStatusText(`网页模式：预览设置 ${payload.width}*${payload.height}, 全屏=${payload.fullscreen}`);
      return;
    }

    setIsApplying(true);
    try {
      const result = await invokeNative<ApplyDisplaySettingsResult, 'window:apply-display-settings'>(
        'window:apply-display-settings',
        payload
      );
      if (result.ok) {
        setStatusText(
          `已应用：${result.width ?? payload.width}*${result.height ?? payload.height}，全屏=${
            result.fullscreen ?? payload.fullscreen ? '开' : '关'
          }`
        );
      } else {
        setStatusText(result.message || '应用设置失败。');
      }
    } catch {
      setStatusText('应用设置失败，请检查 Electron 主进程。');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.52)',
        zIndex: 9999,
        padding: 0
      }}
    >
      <div
        style={{
          width: '100vw',
          height: '100vh'
        }}
      >
        <OscilloscopeMaskPanel
          config={PANEL_MASK_CONFIG}
          background={{ mode: 'solid', solidColor: 'rgba(11, 15, 21, 0.94)' }}
          contentPointerEvents="auto"
          style={{ background: 'rgba(11, 15, 21, 0.94)' }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              color: '#e2e8f0'
            }}
          >
            <div style={{ width: 'min(460px, 100%)', padding: 16 }}>
              <h3 style={{ margin: '0 0 12px', color: '#f8fafc' }}>显示设置</h3>
              <label style={{ display: 'block', fontSize: 13 }}>
                分辨率
                <select
                  value={selectedResolution}
                  onChange={(event) => setSelectedResolution(event.target.value)}
                  style={{ width: '100%', marginTop: 6 }}
                >
                  {resolutionOptions.map((item) => {
                    const label = toResolutionLabel(item);
                    return (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={fullscreen}
                  onChange={(event) => setFullscreen(event.target.checked)}
                />
                全屏
              </label>

              <div style={{ marginTop: 14, minHeight: 18, fontSize: 12, color: '#cbd5e1' }}>{statusText}</div>

              <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => { void applySettings(); }} disabled={isApplying}>
                  {isApplying ? '应用中...' : '应用设置'}
                </button>
                <button type="button" onClick={onClose}>关闭</button>
              </div>
            </div>
          </div>
        </OscilloscopeMaskPanel>
      </div>
    </div>
  );
};
