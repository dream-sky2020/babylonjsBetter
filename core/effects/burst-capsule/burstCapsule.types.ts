export type BurstCapsuleDecayVisualMode = 'fade' | 'shrink';
export type BurstCapsuleColorMode = 'random' | 'single';

export type BurstCapsuleColorPair = {
  main: string;
  stroke: string;
};

export type BurstCapsuleControls = {
  spawnCount: number;
  spawnJitter: number;
  speedMin: number;
  speedMax: number;
  friction: number;
  decayMin: number;
  decayMax: number;
  lengthMin: number;
  lengthMax: number;
  thicknessMin: number;
  thicknessMax: number;
  outlineWidth: number;
  trailAlpha: number;
  decayVisualMode: BurstCapsuleDecayVisualMode;
  shrinkPower: number;
  colorMode: BurstCapsuleColorMode;
  singleMainColor: string;
  singleStrokeColor: string;
};

export type BurstCapsulePreset = {
  presetKey?: string;
  name?: string;
  controls: BurstCapsuleControls;
};

export type BurstCapsulePresetInput =
  | Partial<BurstCapsuleControls>
  | {
      presetKey?: string;
      name?: string;
      controls?: Partial<BurstCapsuleControls>;
    };

export type PlayBurstCapsuleOptions = {
  /** 相对于特效 Canvas 左上角的 CSS 像素坐标。 */
  x: number;
  y: number;
  /** 只覆盖本次爆发的配置。 */
  preset?: BurstCapsulePresetInput;
  /** 只覆盖本次爆发使用的随机颜色池。 */
  colorPairs?: readonly BurstCapsuleColorPair[];
};

export type CreateBurstCapsuleEffectOptions = {
  preset?: BurstCapsulePresetInput;
  colorPairs?: readonly BurstCapsuleColorPair[];
  /** 默认自动跟随 Canvas 的 CSS 尺寸和 devicePixelRatio。 */
  autoResize?: boolean;
};

export type BurstCapsuleEffect = {
  play: (options: PlayBurstCapsuleOptions) => void;
  clear: () => void;
  resize: () => void;
  dispose: () => void;
};
