import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef
} from 'react';

/* eslint-disable react-hooks/exhaustive-deps */

export type OscilloscopeShapeType = 'square' | 'rectangle' | 'circle' | 'polygon' | 'star';
export type OscilloscopeWavePresetId = 'ecg_sharp' | 'soft' | 'shock';
export type OscilloscopeBackgroundMode = 'scanline' | 'grid' | 'solid' | 'image' | 'none';

type PointData = {
  baseX: number;
  baseY: number;
  nx: number;
  ny: number;
};

type WaveConfig = {
  intensity: number;
  durationFrames: number;
  decayPerFrame: number;
  travelPerFrame: number;
  spread: number;
  jitterFreq: number;
  jitterAmp: number;
  maxRadiusRatio: number;
  shapeFn: (x: number) => number;
};

type WaveRuntime = {
  centerIndex: number;
  radius: number;
  age: number;
  intensity: number;
  durationFrames: number;
  decayPerFrame: number;
  travelPerFrame: number;
  spread: number;
  jitterFreq: number;
  jitterAmp: number;
  maxRadius: number;
  shapeFn: (x: number) => number;
};

type MarkerRuntime = {
  index: number;
  ttl: number;
};

type HoverPlacement = {
  x: number;
  y: number;
  index: number;
  distance: number;
  inside: boolean;
};

export type OscilloscopeBackgroundConfig = {
  mode: OscilloscopeBackgroundMode;
  solidColor: string;
  gradientFrom: string;
  gradientTo: string;
  scanLineAlpha: number;
  gridSpacing: number;
  imageUrl: string;
  overlayAlpha: number;
};

export type OscilloscopePanelConfig = {
  pointCount: number;
  shapeType: OscilloscopeShapeType;
  shapeRotationDeg: number;
  colorTheme: string;
  lineWidth: number;
  enableLineGlow: boolean;
  clearFrameEachTick: boolean;
  clearFillAlpha: number;
  previewSpan: number;
  interactionRadius: number;
  shapeSizeRatio: number;
  shapeWidthScale: number;
  shapeHeightScale: number;
  rectangleWidthRatio: number;
  rectangleHeightRatio: number;
  polygonSides: number;
  starPoints: number;
  starInnerRatio: number;
  showPlacementPreview: boolean;
  showImpactMarkers: boolean;
  autoInjectOnPointerDown: boolean;
  pointerWavePreset: OscilloscopeWavePresetId | 'inherit';
  pointerWaveIntensityMultiplier: number;
  pointerWaveDurationMultiplier: number;
  pointerWaveTravelMultiplier: number;
  pointerWaveSpreadMultiplier: number;
  pointerWaveJitterMultiplier: number;
  maxActiveWaves: number;
  wavePreset: OscilloscopeWavePresetId;
};

export type TriggerWaveOverrides = Partial<WaveConfig>;

export type OscilloscopeMaskPanelHandle = {
  triggerWaveByIndex: (index: number, overrides?: TriggerWaveOverrides) => void;
  triggerWaveAtRatio: (ratio: number, overrides?: TriggerWaveOverrides) => void;
  triggerWaveAtPoint: (x: number, y: number, overrides?: TriggerWaveOverrides) => void;
  setConfig: (nextConfig: Partial<OscilloscopePanelConfig>) => void;
  setBackground: (nextBackground: Partial<OscilloscopeBackgroundConfig>) => void;
  setShapeType: (shapeType: OscilloscopeShapeType) => void;
  setThemeColor: (color: string) => void;
  clearWaves: () => void;
};

export type OscilloscopeMaskPanelProps = {
  className?: string;
  style?: React.CSSProperties;
  config?: Partial<OscilloscopePanelConfig>;
  background?: Partial<OscilloscopeBackgroundConfig>;
  onPlacement?: (index: number) => void;
  children?: React.ReactNode;
  contentPointerEvents?: React.CSSProperties['pointerEvents'];
};

const DEFAULT_CONFIG: OscilloscopePanelConfig = {
  pointCount: 400,
  shapeType: 'square',
  shapeRotationDeg: 0,
  colorTheme: '#00ff41',
  lineWidth: 2.2,
  enableLineGlow: true,
  clearFrameEachTick: true,
  clearFillAlpha: 0.25,
  previewSpan: 8,
  interactionRadius: 140,
  shapeSizeRatio: 0.22,
  shapeWidthScale: 1,
  shapeHeightScale: 1,
  rectangleWidthRatio: 1.4,
  rectangleHeightRatio: 0.8,
  polygonSides: 6,
  starPoints: 5,
  starInnerRatio: 0.45,
  showPlacementPreview: true,
  showImpactMarkers: true,
  autoInjectOnPointerDown: true,
  pointerWavePreset: 'inherit',
  pointerWaveIntensityMultiplier: 1,
  pointerWaveDurationMultiplier: 1,
  pointerWaveTravelMultiplier: 1,
  pointerWaveSpreadMultiplier: 1,
  pointerWaveJitterMultiplier: 1,
  maxActiveWaves: 24,
  wavePreset: 'ecg_sharp'
};

const DEFAULT_BACKGROUND: OscilloscopeBackgroundConfig = {
  mode: 'scanline',
  solidColor: '#08120d',
  gradientFrom: 'rgba(10, 32, 20, 0.9)',
  gradientTo: 'rgba(2, 10, 7, 0.98)',
  scanLineAlpha: 0.14,
  gridSpacing: 24,
  imageUrl: '',
  overlayAlpha: 0.3
};

const WAVE_PRESETS: Record<OscilloscopeWavePresetId, WaveConfig> = {
  ecg_sharp: {
    intensity: 38,
    durationFrames: 90,
    decayPerFrame: 0.967,
    travelPerFrame: 2.6,
    spread: 7.2,
    jitterFreq: 0.42,
    jitterAmp: 0.06,
    maxRadiusRatio: 0.18,
    shapeFn: (x) => {
      const p = 0.05 * Math.exp(-Math.pow((x + 0.82) / 0.17, 2));
      const q = -0.42 * Math.exp(-Math.pow((x + 0.11) / 0.048, 2));
      const r = 1.62 * Math.exp(-Math.pow(x / 0.024, 2));
      const s = -0.66 * Math.exp(-Math.pow((x - 0.09) / 0.052, 2));
      const t = 0.1 * Math.exp(-Math.pow((x - 0.58) / 0.24, 2));
      return p + q + r + s + t;
    }
  },
  soft: {
    intensity: 26,
    durationFrames: 110,
    decayPerFrame: 0.975,
    travelPerFrame: 1.8,
    spread: 10.8,
    jitterFreq: 0.22,
    jitterAmp: 0.03,
    maxRadiusRatio: 0.22,
    shapeFn: (x) => {
      const p = 0.1 * Math.exp(-Math.pow((x + 0.95) / 0.34, 2));
      const q = -0.18 * Math.exp(-Math.pow((x + 0.18) / 0.12, 2));
      const r = 0.86 * Math.exp(-Math.pow(x / 0.09, 2));
      const s = -0.25 * Math.exp(-Math.pow((x - 0.16) / 0.12, 2));
      const t = 0.18 * Math.exp(-Math.pow((x - 0.78) / 0.34, 2));
      return p + q + r + s + t;
    }
  },
  shock: {
    intensity: 52,
    durationFrames: 58,
    decayPerFrame: 0.948,
    travelPerFrame: 3.5,
    spread: 5.8,
    jitterFreq: 0.78,
    jitterAmp: 0.1,
    maxRadiusRatio: 0.14,
    shapeFn: (x) => {
      const pre = -0.32 * Math.exp(-Math.pow((x + 0.2) / 0.06, 2));
      const spike = 2 * Math.exp(-Math.pow(x / 0.018, 2));
      const post = -0.72 * Math.exp(-Math.pow((x - 0.07) / 0.045, 2));
      const tail = 0.06 * Math.exp(-Math.pow((x - 0.42) / 0.16, 2));
      return pre + spike + post + tail;
    }
  }
};

export const OscilloscopeMaskPanel = forwardRef<OscilloscopeMaskPanelHandle, OscilloscopeMaskPanelProps>(
  function OscilloscopeMaskPanel(
    {
      className,
      style,
      config,
      background,
      onPlacement,
      children,
      contentPointerEvents = 'none'
    },
    ref
  ) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const rafIdRef = useRef<number | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const frameTickRef = useRef(0);
    const backgroundImageRef = useRef<HTMLImageElement | null>(null);
    const pointsRef = useRef<PointData[]>([]);
    const wavesRef = useRef<WaveRuntime[]>([]);
    const markersRef = useRef<MarkerRuntime[]>([]);
    const cfgRef = useRef<OscilloscopePanelConfig>({ ...DEFAULT_CONFIG, ...(config ?? {}) });
    const bgRef = useRef<OscilloscopeBackgroundConfig>({ ...DEFAULT_BACKGROUND, ...(background ?? {}) });
    const stateRef = useRef({
      width: 0,
      height: 0,
      centerX: 0,
      centerY: 0,
      offsets: new Float32Array(cfgRef.current.pointCount),
      hover: {
        x: -1000,
        y: -1000,
        index: -1,
        distance: Infinity,
        inside: false
      } as HoverPlacement
    });

    const hasChildren = useMemo(() => Boolean(children), [children]);

    const loadBackgroundImage = (url: string) => {
      if (!url) {
        backgroundImageRef.current = null;
        return;
      }
      const image = new Image();
      image.src = url;
      image.onload = () => {
        backgroundImageRef.current = image;
      };
      image.onerror = () => {
        backgroundImageRef.current = null;
      };
    };

    const generateShape = () => {
      const cfg = cfgRef.current;
      const nextPoints: PointData[] = [];
      const { width, height } = stateRef.current;
      const N = cfg.pointCount;
      const size = Math.min(width, height) * cfg.shapeSizeRatio;
      const rotationRad = (cfg.shapeRotationDeg * Math.PI) / 180;
      const cosR = Math.cos(rotationRad);
      const sinR = Math.sin(rotationRad);
      const shapeWidthScale = Math.max(0.1, cfg.shapeWidthScale);
      const shapeHeightScale = Math.max(0.1, cfg.shapeHeightScale);
      const rectangleWidthRatio = Math.max(0.2, cfg.rectangleWidthRatio);
      const rectangleHeightRatio = Math.max(0.2, cfg.rectangleHeightRatio);
      const polygonSides = Math.max(3, Math.floor(cfg.polygonSides));
      const starPoints = Math.max(3, Math.floor(cfg.starPoints));
      const starInnerRatio = Math.min(0.95, Math.max(0.05, cfg.starInnerRatio));

      for (let i = 0; i < N; i++) {
        const t = (i / N) * Math.PI * 2;
        let bx: number;
        let by: number;
        let nx: number;
        let ny: number;

        if (cfg.shapeType === 'circle') {
          bx = Math.cos(t) * size * shapeWidthScale;
          by = Math.sin(t) * size * shapeHeightScale;
          const len = Math.hypot(bx, by) || 1;
          nx = bx / len;
          ny = by / len;
        } else if (cfg.shapeType === 'square' || cfg.shapeType === 'rectangle') {
          const shapeRatioX = cfg.shapeType === 'rectangle' ? rectangleWidthRatio : 1;
          const shapeRatioY = cfg.shapeType === 'rectangle' ? rectangleHeightRatio : 1;
          const w = size * shapeWidthScale * shapeRatioX;
          const h = size * shapeHeightScale * shapeRatioY;
          const p = i / N;
          if (p < 0.25) {
            const sub = p / 0.25;
            bx = -w + sub * 2 * w;
            by = -h;
            nx = 0;
            ny = -1;
          } else if (p < 0.5) {
            const sub = (p - 0.25) / 0.25;
            bx = w;
            by = -h + sub * 2 * h;
            nx = 1;
            ny = 0;
          } else if (p < 0.75) {
            const sub = (p - 0.5) / 0.25;
            bx = w - sub * 2 * w;
            by = h;
            nx = 0;
            ny = 1;
          } else {
            const sub = (p - 0.75) / 0.25;
            bx = -w;
            by = h - sub * 2 * h;
            nx = -1;
            ny = 0;
          }
        } else if (cfg.shapeType === 'polygon') {
          const angleStep = (Math.PI * 2) / polygonSides;
          const sideIndex = Math.floor(t / angleStep);
          const a1 = sideIndex * angleStep;
          const a2 = (sideIndex + 1) * angleStep;
          const ratio = (t - a1) / angleStep;
          const x1 = Math.cos(a1) * size * shapeWidthScale;
          const y1 = Math.sin(a1) * size * shapeHeightScale;
          const x2 = Math.cos(a2) * size * shapeWidthScale;
          const y2 = Math.sin(a2) * size * shapeHeightScale;
          bx = x1 + (x2 - x1) * ratio;
          by = y1 + (y2 - y1) * ratio;
          const len = Math.hypot(bx, by) || 1;
          nx = bx / len;
          ny = by / len;
        } else {
          const rOuterX = size * shapeWidthScale;
          const rOuterY = size * shapeHeightScale;
          const rInnerX = rOuterX * starInnerRatio;
          const rInnerY = rOuterY * starInnerRatio;
          const pts = starPoints * 2;
          const step = (Math.PI * 2) / pts;
          const sideIndex = Math.floor(t / step);
          const a1 = sideIndex * step;
          const a2 = (sideIndex + 1) * step;
          const r1x = sideIndex % 2 === 0 ? rOuterX : rInnerX;
          const r1y = sideIndex % 2 === 0 ? rOuterY : rInnerY;
          const r2x = sideIndex % 2 === 0 ? rInnerX : rOuterX;
          const r2y = sideIndex % 2 === 0 ? rInnerY : rOuterY;
          const ratio = (t - a1) / step;
          bx = r1x * Math.cos(a1) + (r2x * Math.cos(a2) - r1x * Math.cos(a1)) * ratio;
          by = r1y * Math.sin(a1) + (r2y * Math.sin(a2) - r1y * Math.sin(a1)) * ratio;
          const len = Math.hypot(bx, by) || 1;
          nx = bx / len;
          ny = by / len;
        }

        nextPoints.push({ baseX: bx, baseY: by, nx, ny });
      }
      for (let i = 0; i < nextPoints.length; i++) {
        const pt = nextPoints[i];
        const rotatedX = pt.baseX * cosR - pt.baseY * sinR;
        const rotatedY = pt.baseX * sinR + pt.baseY * cosR;
        const rotatedNx = pt.nx * cosR - pt.ny * sinR;
        const rotatedNy = pt.nx * sinR + pt.ny * cosR;
        pt.baseX = rotatedX;
        pt.baseY = rotatedY;
        pt.nx = rotatedNx;
        pt.ny = rotatedNy;
      }

      pointsRef.current = nextPoints;
      wavesRef.current = [];
      markersRef.current = [];
      stateRef.current.offsets = new Float32Array(N);
      stateRef.current.hover.index = -1;
      stateRef.current.hover.distance = Infinity;
    };

    const resizeCanvas = () => {
      const root = rootRef.current;
      const canvas = canvasRef.current;
      if (!root || !canvas) return;
      const rect = root.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      if (canvas.width !== width) {
        canvas.width = width;
      }
      if (canvas.height !== height) {
        canvas.height = height;
      }
      stateRef.current.width = width;
      stateRef.current.height = height;
      stateRef.current.centerX = width / 2;
      stateRef.current.centerY = height / 2;
      generateShape();
    };

    const findClosestPointIndex = (x: number, y: number) => {
      const points = pointsRef.current;
      const offsets = stateRef.current.offsets;
      const { centerX, centerY } = stateRef.current;
      let closestIdx = -1;
      let minDist = Infinity;
      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        const offset = offsets[i] || 0;
        const worldX = centerX + pt.baseX + pt.nx * offset;
        const worldY = centerY + pt.baseY + pt.ny * offset;
        const dist = Math.hypot(worldX - x, worldY - y);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      }
      return { index: closestIdx, distance: minDist };
    };

    const createWaveAt = (centerIndex: number, overrides: TriggerWaveOverrides = {}) => {
      const cfg = cfgRef.current;
      const basePreset = WAVE_PRESETS[cfg.wavePreset];
      const merged = { ...basePreset, ...overrides };
      const N = cfg.pointCount;
      wavesRef.current.push({
        centerIndex,
        radius: 0,
        age: 0,
        intensity: merged.intensity,
        durationFrames: merged.durationFrames,
        decayPerFrame: merged.decayPerFrame,
        travelPerFrame: merged.travelPerFrame,
        spread: merged.spread,
        jitterFreq: merged.jitterFreq,
        jitterAmp: merged.jitterAmp,
        maxRadius: N * merged.maxRadiusRatio,
        shapeFn: merged.shapeFn
      });
      const maxActiveWaves = Math.max(1, Math.floor(cfg.maxActiveWaves));
      if (wavesRef.current.length > maxActiveWaves) {
        wavesRef.current.splice(0, wavesRef.current.length - maxActiveWaves);
      }
      if (cfg.showImpactMarkers) {
        markersRef.current.push({ index: centerIndex, ttl: 24 });
      }
      onPlacement?.(centerIndex);
    };

    const createPointerWaveOverrides = (): TriggerWaveOverrides => {
      const cfg = cfgRef.current;
      const basePreset =
        cfg.pointerWavePreset === 'inherit'
          ? WAVE_PRESETS[cfg.wavePreset]
          : WAVE_PRESETS[cfg.pointerWavePreset];

      return {
        shapeFn: basePreset.shapeFn,
        intensity: basePreset.intensity * Math.max(0, cfg.pointerWaveIntensityMultiplier),
        durationFrames: Math.max(
          1,
          Math.round(basePreset.durationFrames * Math.max(0.05, cfg.pointerWaveDurationMultiplier))
        ),
        travelPerFrame: basePreset.travelPerFrame * Math.max(0.05, cfg.pointerWaveTravelMultiplier),
        spread: basePreset.spread * Math.max(0.05, cfg.pointerWaveSpreadMultiplier),
        jitterFreq: basePreset.jitterFreq,
        jitterAmp: basePreset.jitterAmp * Math.max(0, cfg.pointerWaveJitterMultiplier),
        decayPerFrame: basePreset.decayPerFrame,
        maxRadiusRatio: basePreset.maxRadiusRatio
      };
    };

    const updateWavesAndOffsets = () => {
      const waves = wavesRef.current;
      const cfg = cfgRef.current;
      const N = cfg.pointCount;
      for (let w = waves.length - 1; w >= 0; w--) {
        const wave = waves[w];
        wave.age += 1;
        wave.radius += wave.travelPerFrame;
        wave.intensity *= wave.decayPerFrame;
        if (
          wave.age > wave.durationFrames ||
          wave.intensity < 0.25 ||
          wave.radius > wave.maxRadius
        ) {
          waves.splice(w, 1);
        }
      }

      const offsets = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        let totalOffset = 0;
        for (let w = 0; w < waves.length; w++) {
          const wave = waves[w];
          let dist = Math.abs(i - wave.centerIndex);
          if (dist > N / 2) dist = N - dist;
          const x = (dist - wave.radius) / wave.spread;
          if (x > -1.25 && x < 1.15) {
            const localFalloff = Math.exp(-Math.pow(x / 0.72, 2));
            const life = 1 - wave.age / wave.durationFrames;
            const baseShape = wave.shapeFn(x) * localFalloff * life;
            const jitter = Math.sin(wave.age * wave.jitterFreq + dist * 0.35) * wave.jitterAmp;
            totalOffset += wave.intensity * (baseShape + jitter * 0.1 * life);
          }
        }
        offsets[i] = totalOffset;
      }
      stateRef.current.offsets = offsets;
    };

    const traceCurrentShapePath = (ctx: CanvasRenderingContext2D) => {
      const points = pointsRef.current;
      const offsets = stateRef.current.offsets;
      const { centerX, centerY } = stateRef.current;
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        const offset = offsets[i] || 0;
        const x = centerX + pt.baseX + pt.nx * offset;
        const y = centerY + pt.baseY + pt.ny * offset;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    const drawMaskedBackground = (ctx: CanvasRenderingContext2D) => {
      const bg = bgRef.current;
      const { width, height, centerX, centerY } = stateRef.current;
      const t = frameTickRef.current * 0.02;
      ctx.save();
      traceCurrentShapePath(ctx);
      ctx.clip();

      if (bg.mode === 'none') {
        ctx.clearRect(0, 0, width, height);
      } else if (bg.mode === 'solid') {
        ctx.fillStyle = bg.solidColor;
        ctx.fillRect(0, 0, width, height);
      } else if (bg.mode === 'image' && backgroundImageRef.current) {
        const img = backgroundImageRef.current;
        const scale = Math.max(width / img.width, height / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const drawX = (width - drawW) * 0.5;
        const drawY = (height - drawH) * 0.5;
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        if (bg.overlayAlpha > 0) {
          ctx.fillStyle = `rgba(2,10,7,${bg.overlayAlpha})`;
          ctx.fillRect(0, 0, width, height);
        }
      } else {
        const panelGlow = ctx.createRadialGradient(
          centerX,
          centerY,
          Math.min(width, height) * 0.08,
          centerX,
          centerY,
          Math.min(width, height) * 0.5
        );
        panelGlow.addColorStop(0, bg.gradientFrom);
        panelGlow.addColorStop(1, bg.gradientTo);
        ctx.fillStyle = panelGlow;
        ctx.fillRect(0, 0, width, height);
      }

      if (bg.mode === 'scanline') {
        ctx.strokeStyle = cfgRef.current.colorTheme;
        ctx.lineWidth = 1;
        ctx.globalAlpha = bg.scanLineAlpha;
        const scanGap = 14;
        for (let y = -scanGap; y < height + scanGap; y += scanGap) {
          const waveX = Math.sin(t + y * 0.03) * 12;
          ctx.beginPath();
          ctx.moveTo(-20 + waveX, y + ((frameTickRef.current % scanGap) * 0.75));
          ctx.lineTo(width + 20 + waveX, y + ((frameTickRef.current % scanGap) * 0.75));
          ctx.stroke();
        }
      }

      if (bg.mode === 'grid') {
        const step = Math.max(8, bg.gridSpacing);
        ctx.strokeStyle = cfgRef.current.colorTheme;
        ctx.globalAlpha = 0.12;
        ctx.lineWidth = 1;
        for (let x = 0; x <= width; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y <= height; y += step) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      }

      ctx.restore();
    };

    const drawPlacementPreview = (ctx: CanvasRenderingContext2D) => {
      const cfg = cfgRef.current;
      const hover = stateRef.current.hover;
      if (!cfg.showPlacementPreview) return;
      if (hover.index === -1 || hover.distance >= cfg.interactionRadius) return;
      const points = pointsRef.current;
      const offsets = stateRef.current.offsets;
      const { centerX, centerY } = stateRef.current;
      const span = cfg.previewSpan;
      const color = cfg.colorTheme;
      const highlightColor = color === '#f5f5f5' || color === '#dbeafe' ? '#ffffff' : '#e5e7eb';
      ctx.save();
      ctx.strokeStyle = highlightColor;
      ctx.lineWidth = 3.4;
      ctx.shadowBlur = 14;
      ctx.shadowColor = highlightColor;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      for (let step = -span; step <= span; step++) {
        const idx = (hover.index + step + points.length) % points.length;
        const pt = points[idx];
        const offset = offsets[idx] || 0;
        const x = centerX + pt.baseX + pt.nx * offset;
        const y = centerY + pt.baseY + pt.ny * offset;
        if (step === -span) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    };

    const drawImpactMarkers = (ctx: CanvasRenderingContext2D) => {
      if (!cfgRef.current.showImpactMarkers) return;
      const markers = markersRef.current;
      const points = pointsRef.current;
      const offsets = stateRef.current.offsets;
      const { centerX, centerY } = stateRef.current;
      const color = cfgRef.current.colorTheme;
      for (let m = markers.length - 1; m >= 0; m--) {
        const marker = markers[m];
        marker.ttl -= 1;
        if (marker.ttl <= 0) {
          markers.splice(m, 1);
          continue;
        }
        const pt = points[marker.index];
        if (!pt) continue;
        const alpha = marker.ttl / 24;
        const offset = offsets[marker.index] || 0;
        const x = centerX + pt.baseX + pt.nx * offset;
        const y = centerY + pt.baseY + pt.ny * offset;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(x, y, 3 + (1 - alpha) * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    const updateClipPath = () => {
      if (!hasChildren) return;
      const content = contentRef.current;
      const points = pointsRef.current;
      const { offsets, width, height, centerX, centerY } = stateRef.current;
      if (!content || points.length === 0 || width <= 0 || height <= 0) return;
      const sampleCount = 72;
      const step = Math.max(1, Math.floor(points.length / sampleCount));
      const coords: string[] = [];
      for (let i = 0; i < points.length; i += step) {
        const pt = points[i];
        const offset = offsets[i] || 0;
        const x = centerX + pt.baseX + pt.nx * offset;
        const y = centerY + pt.baseY + pt.ny * offset;
        const xp = (x / width) * 100;
        const yp = (y / height) * 100;
        coords.push(`${xp.toFixed(2)}% ${yp.toFixed(2)}%`);
      }
      if (coords.length > 2) {
        content.style.clipPath = `polygon(${coords.join(',')})`;
      }
    };

    const drawFrame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { width, height } = stateRef.current;
      if (width <= 0 || height <= 0) return;

      frameTickRef.current += 1;
      updateWavesAndOffsets();

      const hover = stateRef.current.hover;
      if (hover.inside) {
        const target = findClosestPointIndex(hover.x, hover.y);
        hover.index = target.index;
        hover.distance = target.distance;
      }

      if (cfgRef.current.clearFrameEachTick) {
        const alpha = Math.min(1, Math.max(0, cfgRef.current.clearFillAlpha));
        ctx.fillStyle = `rgba(2, 6, 4, ${alpha})`;
        ctx.fillRect(0, 0, width, height);
      }
      drawMaskedBackground(ctx);
      ctx.strokeStyle = cfgRef.current.colorTheme;
      ctx.lineWidth = cfgRef.current.lineWidth;
      if (cfgRef.current.enableLineGlow) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = cfgRef.current.colorTheme;
      } else {
        ctx.shadowBlur = 0;
      }
      traceCurrentShapePath(ctx);
      ctx.stroke();
      drawPlacementPreview(ctx);
      drawImpactMarkers(ctx);
      updateClipPath();
    };

    const loop = () => {
      drawFrame();
      rafIdRef.current = requestAnimationFrame(loop);
    };

    const getCanvasPos = (event: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: -9999, y: -9999 };
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onPointerMove = (event: PointerEvent) => {
      const pos = getCanvasPos(event);
      const hover = stateRef.current.hover;
      hover.x = pos.x;
      hover.y = pos.y;
      hover.inside = true;
      const target = findClosestPointIndex(pos.x, pos.y);
      hover.index = target.index;
      hover.distance = target.distance;
    };

    const onPointerDown = (event: PointerEvent) => {
      const cfg = cfgRef.current;
      const pos = getCanvasPos(event);
      if (!cfg.autoInjectOnPointerDown) return;
      const target = findClosestPointIndex(pos.x, pos.y);
      if (target.index !== -1 && target.distance < cfg.interactionRadius) {
        createWaveAt(target.index, createPointerWaveOverrides());
      }
    };

    const onPointerLeave = () => {
      const hover = stateRef.current.hover;
      hover.inside = false;
      hover.index = -1;
      hover.distance = Infinity;
    };

    useImperativeHandle(ref, () => ({
      triggerWaveByIndex: (index, overrides) => {
        const N = cfgRef.current.pointCount;
        if (!Number.isFinite(index) || N <= 0) return;
        const wrapped = ((Math.round(index) % N) + N) % N;
        createWaveAt(wrapped, overrides);
      },
      triggerWaveAtRatio: (ratio, overrides) => {
        const N = cfgRef.current.pointCount;
        const normalized = ((ratio % 1) + 1) % 1;
        const index = Math.floor(normalized * N);
        createWaveAt(index, overrides);
      },
      triggerWaveAtPoint: (x, y, overrides) => {
        const target = findClosestPointIndex(x, y);
        if (target.index !== -1) {
          createWaveAt(target.index, overrides);
        }
      },
      setConfig: (nextConfig) => {
        cfgRef.current = { ...cfgRef.current, ...nextConfig };
        if (
          typeof nextConfig.pointCount === 'number' ||
          typeof nextConfig.shapeType === 'string' ||
          typeof nextConfig.shapeRotationDeg === 'number' ||
          typeof nextConfig.shapeSizeRatio === 'number' ||
          typeof nextConfig.shapeWidthScale === 'number' ||
          typeof nextConfig.shapeHeightScale === 'number' ||
          typeof nextConfig.rectangleWidthRatio === 'number' ||
          typeof nextConfig.rectangleHeightRatio === 'number' ||
          typeof nextConfig.polygonSides === 'number' ||
          typeof nextConfig.starPoints === 'number' ||
          typeof nextConfig.starInnerRatio === 'number'
        ) {
          resizeCanvas();
        }
        if (typeof nextConfig.showImpactMarkers === 'boolean' && !nextConfig.showImpactMarkers) {
          markersRef.current = [];
        }
      },
      setBackground: (nextBackground) => {
        const prevUrl = bgRef.current.imageUrl;
        bgRef.current = { ...bgRef.current, ...nextBackground };
        if (bgRef.current.imageUrl !== prevUrl) {
          loadBackgroundImage(bgRef.current.imageUrl);
        }
      },
      setShapeType: (shapeType) => {
        cfgRef.current = { ...cfgRef.current, shapeType };
        resizeCanvas();
      },
      setThemeColor: (color) => {
        cfgRef.current = { ...cfgRef.current, colorTheme: color };
      },
      clearWaves: () => {
        wavesRef.current = [];
        markersRef.current = [];
        stateRef.current.offsets = new Float32Array(cfgRef.current.pointCount);
      }
    }), [onPlacement]);

    useEffect(() => {
      cfgRef.current = { ...cfgRef.current, ...(config ?? {}) };
      resizeCanvas();
    }, [config]);

    useEffect(() => {
      const prevUrl = bgRef.current.imageUrl;
      bgRef.current = { ...bgRef.current, ...(background ?? {}) };
      if (bgRef.current.imageUrl !== prevUrl) {
        loadBackgroundImage(bgRef.current.imageUrl);
      }
    }, [background]);

    useEffect(() => {
      loadBackgroundImage(bgRef.current.imageUrl);
      resizeCanvas();
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointerleave', onPointerLeave);

      resizeObserverRef.current = new ResizeObserver(() => {
        resizeCanvas();
      });
      if (rootRef.current) {
        resizeObserverRef.current.observe(rootRef.current);
      }

      rafIdRef.current = requestAnimationFrame(loop);
      return () => {
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointerleave', onPointerLeave);
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
        }
        resizeObserverRef.current?.disconnect();
        resizeObserverRef.current = null;
      };
    }, []);

    return (
      <div
        ref={rootRef}
        className={className}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          ...style
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: 'block',
            cursor: 'crosshair'
          }}
        />
        <div
          ref={contentRef}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: contentPointerEvents,
            willChange: 'clip-path'
          }}
        >
          {children}
        </div>
      </div>
    );
  }
);
