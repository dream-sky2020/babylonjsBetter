export type DungeonOverheadViewConfig = {
  pitchDeg: number;
  yawDeg: number;
  projection: 'perspective' | 'orthographic';
  orthographicSize: number;
  proportion: 'original' | 'compensate' | 'manual';
  screenAspect: number;
  scaleX: number;
  scaleZ: number;
  restoreDisplayInFirstPerson: boolean;
};
export const DEFAULT_OVERHEAD_VIEW: Readonly<DungeonOverheadViewConfig> = Object.freeze({
  pitchDeg: 45, yawDeg: 0, projection: 'orthographic', orthographicSize: 35,
  proportion: 'compensate', screenAspect: 1, scaleX: 1, scaleZ: 1, restoreDisplayInFirstPerson: false,
});
export const parseOverheadView = (value: unknown): DungeonOverheadViewConfig => {
  if (!value || typeof value !== 'object') throw new Error('俯视配置必须为对象');
  const v = value as Record<string, unknown>;
  const number = (key: string, min: number, max: number): number => {
    const n = v[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) throw new Error(`${key} 必须在 ${min}..${max} 之间`);
    return n;
  };
  if (v.projection !== 'perspective' && v.projection !== 'orthographic') throw new Error('投影类型无效');
  if (!['original', 'compensate', 'manual'].includes(String(v.proportion))) throw new Error('格子比例策略无效');
  if (v.restoreDisplayInFirstPerson !== undefined && typeof v.restoreDisplayInFirstPerson !== 'boolean') throw new Error('restoreDisplayInFirstPerson 必须为布尔值');
  const config: DungeonOverheadViewConfig = {
    projection: v.projection, proportion: v.proportion as DungeonOverheadViewConfig['proportion'],
    pitchDeg: number('pitchDeg', 15, 89.99), yawDeg: number('yawDeg', -180, 180),
    orthographicSize: number('orthographicSize', .01, 10000), screenAspect: number('screenAspect', .1, 10),
    scaleX: number('scaleX', .1, 20), scaleZ: number('scaleZ', .1, 20),
    restoreDisplayInFirstPerson: v.restoreDisplayInFirstPerson ?? false,
  };
  if (config.proportion === 'compensate' && (config.projection !== 'orthographic' || Math.abs(config.yawDeg % 180) > 1e-6)) {
    throw new Error('自动补偿要求正交投影，水平朝向为 0° 或 ±180°；斜向观察请使用原比例或手动比例');
  }
  return config;
};
export type ResolvedDungeonView = Readonly<{
  config: Readonly<DungeonOverheadViewConfig>;
  origin: readonly [number, number, number];
  scaleX: number;
  scaleZ: number;
}>;
export const resolveOverheadView = (config: DungeonOverheadViewConfig,
  origin: readonly [number, number, number], tileSize: readonly [number, number, number]): ResolvedDungeonView => {
  const validated = parseOverheadView(config);
  if (![...origin, ...tileSize].every(Number.isFinite) || tileSize.some(n => n <= 0)) throw new Error('地图显示布局无效');
  return Object.freeze({ config: Object.freeze(validated), origin: Object.freeze([...origin]) as readonly [number, number, number],
    scaleX: config.proportion === 'manual' ? config.scaleX : 1,
    scaleZ: config.proportion === 'manual' ? config.scaleZ : config.proportion === 'compensate'
      ? tileSize[0] / tileSize[2] * config.screenAspect / Math.sin(config.pitchDeg * Math.PI / 180) : 1,
  });
};
export const mapDungeonDisplayPosition = (view: ResolvedDungeonView | null, p: readonly [number, number, number]): [number, number, number] => view
  ? [view.origin[0] + (p[0] - view.origin[0]) * view.scaleX, p[1], view.origin[2] + (p[2] - view.origin[2]) * view.scaleZ]
  : [...p];

export const selectDungeonDisplayView = (active: ResolvedDungeonView | null, configured: ResolvedDungeonView | null): ResolvedDungeonView | null =>
  active ?? (configured?.config.restoreDisplayInFirstPerson ? null : configured);

export type DungeonViewLease = { apply(view: ResolvedDungeonView | null): void; release(): void };
export type DungeonViewConsumer = { acquire(owner: string): DungeonViewLease };
/** Consumer owns the callback/resources; a coordinator only owns a revocable lease. */
export const createDungeonViewConsumer = (apply: (view: ResolvedDungeonView | null) => void) => {
  let current: symbol | null = null;
  let disposed = false;
  return {
    acquire(owner: string): DungeonViewLease {
      if (disposed || current) throw new Error(`显示接口不能由 ${owner} 重复接管`);
      const token = Symbol(owner); current = token;
      return {
        apply(view) { if (disposed || current !== token) throw new Error('显示控制句柄已释放'); apply(view); },
        release() { if (current !== token) return; current = null; if (!disposed) apply(null); },
      };
    },
    dispose() { if (disposed) return; disposed = true; current = null; apply(null); },
  };
};
// Structural node contract keeps all coordinate math in core, without Babylon ownership.
export const applyDungeonViewToNode = (node: { scaling: { set(x: number, y: number, z: number): unknown }; position: { set(x: number, y: number, z: number): unknown } }, view: ResolvedDungeonView | null): void => {
  node.scaling.set(view?.scaleX ?? 1, 1, view?.scaleZ ?? 1);
  node.position.set(view ? view.origin[0] * (1 - view.scaleX) : 0, 0, view ? view.origin[2] * (1 - view.scaleZ) : 0);
};
