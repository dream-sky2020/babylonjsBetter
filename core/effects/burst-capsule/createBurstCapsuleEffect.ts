import type {
  BurstCapsuleColorPair,
  BurstCapsuleControls,
  BurstCapsuleEffect,
  BurstCapsulePresetInput,
  CreateBurstCapsuleEffectOptions,
  PlayBurstCapsuleOptions
} from './burstCapsule.types';

type Capsule = {
  x: number;
  y: number;
  angle: number;
  speed: number;
  baseSpeed: number;
  friction: number;
  length: number;
  thickness: number;
  life: number;
  decay: number;
  outlineWidth: number;
  decayVisualMode: BurstCapsuleControls['decayVisualMode'];
  shrinkPower: number;
  mainColor: string;
  strokeColor: string;
};

export const DEFAULT_BURST_CAPSULE_CONTROLS: BurstCapsuleControls = {
  spawnCount: 36,
  spawnJitter: 0.1,
  speedMin: 15,
  speedMax: 40,
  friction: 0.92,
  decayMin: 0.03,
  decayMax: 0.06,
  lengthMin: 60,
  lengthMax: 140,
  thicknessMin: 4,
  thicknessMax: 7,
  outlineWidth: 3,
  trailAlpha: 1,
  decayVisualMode: 'fade',
  shrinkPower: 1.6,
  colorMode: 'random',
  singleMainColor: '#00f0ff',
  singleStrokeColor: '#ffffff'
};

export const DEFAULT_BURST_CAPSULE_COLOR_PAIRS: readonly BurstCapsuleColorPair[] = [
  { main: '#00f0ff', stroke: '#ffffff' },
  { main: '#ff0055', stroke: '#111111' },
  { main: '#ffea00', stroke: '#111111' },
  { main: '#00ff66', stroke: '#ffffff' },
  { main: '#ffffff', stroke: '#ff0055' }
];

const finite = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const randomRange = (min: number, max: number) =>
  min + Math.random() * (max - min);

const getControlInput = (
  input: BurstCapsulePresetInput | undefined
): Partial<BurstCapsuleControls> => {
  if (!input || typeof input !== 'object') return {};
  if ('controls' in input) return input.controls ?? {};
  return input;
};

export const normalizeBurstCapsuleControls = (
  input?: BurstCapsulePresetInput,
  fallback: BurstCapsuleControls = DEFAULT_BURST_CAPSULE_CONTROLS
): BurstCapsuleControls => {
  const source = getControlInput(input);
  const speedMin = Math.max(0, finite(source.speedMin, fallback.speedMin));
  const decayMin = Math.max(0.0001, finite(source.decayMin, fallback.decayMin));
  const lengthMin = Math.max(0, finite(source.lengthMin, fallback.lengthMin));
  const thicknessMin = Math.max(0.1, finite(source.thicknessMin, fallback.thicknessMin));

  return {
    spawnCount: Math.max(1, Math.round(finite(source.spawnCount, fallback.spawnCount))),
    spawnJitter: Math.max(0, finite(source.spawnJitter, fallback.spawnJitter)),
    speedMin,
    speedMax: Math.max(speedMin, finite(source.speedMax, fallback.speedMax)),
    friction: clamp(finite(source.friction, fallback.friction), 0, 1),
    decayMin,
    decayMax: Math.max(decayMin, finite(source.decayMax, fallback.decayMax)),
    lengthMin,
    lengthMax: Math.max(lengthMin, finite(source.lengthMax, fallback.lengthMax)),
    thicknessMin,
    thicknessMax: Math.max(
      thicknessMin,
      finite(source.thicknessMax, fallback.thicknessMax)
    ),
    outlineWidth: Math.max(0, finite(source.outlineWidth, fallback.outlineWidth)),
    trailAlpha: clamp(finite(source.trailAlpha, fallback.trailAlpha), 0, 1),
    decayVisualMode: source.decayVisualMode === 'shrink' ? 'shrink' : 'fade',
    shrinkPower: Math.max(0.01, finite(source.shrinkPower, fallback.shrinkPower)),
    colorMode: source.colorMode === 'single' ? 'single' : 'random',
    singleMainColor:
      typeof source.singleMainColor === 'string'
        ? source.singleMainColor
        : fallback.singleMainColor,
    singleStrokeColor:
      typeof source.singleStrokeColor === 'string'
        ? source.singleStrokeColor
        : fallback.singleStrokeColor
  };
};

export const createBurstCapsuleEffect = (
  canvas: HTMLCanvasElement,
  options: CreateBurstCapsuleEffectOptions = {}
): BurstCapsuleEffect => {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Burst capsule effect requires a 2D canvas context.');

  const defaultControls = normalizeBurstCapsuleControls(options.preset);
  const defaultColorPairs =
    options.colorPairs?.length ? options.colorPairs : DEFAULT_BURST_CAPSULE_COLOR_PAIRS;
  const capsules: Capsule[] = [];

  let width = 0;
  let height = 0;
  let animationFrameId = 0;
  let lastFrameMs = 0;
  let activeTrailAlpha = 1;
  let emptyTrailFrameCount = 0;
  let disposed = false;

  const resize = () => {
    if (disposed) return;
    const rect = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, rect.width);
    const nextHeight = Math.max(1, rect.height);
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const bufferWidth = Math.round(nextWidth * pixelRatio);
    const bufferHeight = Math.round(nextHeight * pixelRatio);

    width = nextWidth;
    height = nextHeight;
    if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
      canvas.width = bufferWidth;
      canvas.height = bufferHeight;
    }
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };

  const clearCanvas = () => {
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
  };

  const fadePreviousFrame = () => {
    if (activeTrailAlpha >= 1) {
      clearCanvas();
      return;
    }
    // 在透明覆盖层上擦除旧像素，而不是铺黑色，避免遮挡 Babylon 场景。
    context.save();
    context.globalCompositeOperation = 'destination-out';
    context.globalAlpha = activeTrailAlpha;
    context.fillRect(0, 0, width, height);
    context.restore();
  };

  const drawCapsule = (capsule: Capsule) => {
    if (capsule.life <= 0) return;
    const life = Math.max(0, capsule.life);
    const speedRatio = capsule.speed / Math.max(0.0001, capsule.baseSpeed);
    const baseLength = capsule.length * (speedRatio + 0.45);
    const shrinkRatio = Math.pow(life, capsule.shrinkPower);
    const length =
      capsule.decayVisualMode === 'shrink' ? baseLength * shrinkRatio : baseLength;
    const alpha = capsule.decayVisualMode === 'shrink' ? 1 : life;

    context.save();
    context.translate(capsule.x, capsule.y);
    context.rotate(capsule.angle);
    context.globalAlpha = alpha;
    context.lineCap = 'round';

    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(length, 0);
    context.strokeStyle = capsule.strokeColor;
    context.lineWidth = capsule.thickness + capsule.outlineWidth;
    context.stroke();

    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(length, 0);
    context.strokeStyle = capsule.mainColor;
    context.lineWidth = capsule.thickness;
    context.stroke();
    context.restore();
  };

  const tick = (nowMs: number) => {
    if (disposed) return;
    if (lastFrameMs <= 0) lastFrameMs = nowMs;
    const frameScale = Math.max(0, Math.min(3, (nowMs - lastFrameMs) / (1000 / 60)));
    lastFrameMs = nowMs;

    fadePreviousFrame();
    for (let index = capsules.length - 1; index >= 0; index -= 1) {
      const capsule = capsules[index];
      capsule.x += Math.cos(capsule.angle) * capsule.speed * frameScale;
      capsule.y += Math.sin(capsule.angle) * capsule.speed * frameScale;
      capsule.speed *= Math.pow(capsule.friction, frameScale);
      capsule.life -= capsule.decay * frameScale;
      drawCapsule(capsule);
      if (capsule.life <= 0) capsules.splice(index, 1);
    }

    emptyTrailFrameCount = capsules.length > 0 ? 0 : emptyTrailFrameCount + 1;
    const shouldFinishTrail = activeTrailAlpha < 1 && emptyTrailFrameCount <= 60;
    if (capsules.length > 0 || shouldFinishTrail) {
      animationFrameId = window.requestAnimationFrame(tick);
    } else {
      animationFrameId = 0;
      lastFrameMs = 0;
      clearCanvas();
    }
  };

  const ensureAnimationLoop = () => {
    if (animationFrameId || disposed) return;
    lastFrameMs = 0;
    animationFrameId = window.requestAnimationFrame(tick);
  };

  const play = ({
    x,
    y,
    preset,
    colorPairs
  }: PlayBurstCapsuleOptions) => {
    if (disposed || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const controls = normalizeBurstCapsuleControls(preset, defaultControls);
    const pairs = colorPairs?.length ? colorPairs : defaultColorPairs;
    activeTrailAlpha = controls.trailAlpha;
    emptyTrailFrameCount = 0;

    for (let index = 0; index < controls.spawnCount; index += 1) {
      const baseAngle = (Math.PI * 2 / controls.spawnCount) * index;
      const angle =
        baseAngle + randomRange(-controls.spawnJitter * 0.5, controls.spawnJitter * 0.5);
      const pair =
        controls.colorMode === 'single'
          ? { main: controls.singleMainColor, stroke: controls.singleStrokeColor }
          : pairs[Math.floor(Math.random() * pairs.length)];
      const speed = randomRange(controls.speedMin, controls.speedMax);

      capsules.push({
        x,
        y,
        angle,
        speed,
        baseSpeed: controls.speedMax,
        friction: controls.friction,
        length: randomRange(controls.lengthMin, controls.lengthMax),
        thickness: randomRange(controls.thicknessMin, controls.thicknessMax),
        life: 1,
        decay: randomRange(controls.decayMin, controls.decayMax),
        outlineWidth: controls.outlineWidth,
        decayVisualMode: controls.decayVisualMode,
        shrinkPower: controls.shrinkPower,
        mainColor: pair.main,
        strokeColor: pair.stroke
      });
    }
    ensureAnimationLoop();
  };

  const clear = () => {
    capsules.length = 0;
    activeTrailAlpha = 1;
    emptyTrailFrameCount = 0;
    lastFrameMs = 0;
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = 0;
    }
    clearCanvas();
  };

  const resizeObserver =
    options.autoResize === false || typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(resize);
  resizeObserver?.observe(canvas);
  resize();

  return {
    play,
    clear,
    resize,
    dispose: () => {
      if (disposed) return;
      clear();
      resizeObserver?.disconnect();
      disposed = true;
    }
  };
};
