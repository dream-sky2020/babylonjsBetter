export const MODELS = {
  rational: { name: '分式饱和', template: 'Y₀ + (L − Y₀) · X / (X + H)', description: '前期增长快，后期逐渐放缓；适合属性收益、完成度和软上限。' },
  exponential: { name: '指数趋近', template: 'L − (L − Y₀) · 2^(−X/H)', description: 'X 每增加 H，与极限的差距就减半。' },
  arctangent: { name: '反正切趋近', template: 'Y₀ + (L − Y₀) · (2/π) · atan(X/H)', description: '平滑地从起点出发，逐渐接近极限。' },
  hill: { name: '幂次饱和（Hill）', template: 'Y₀ + (L − Y₀) · Xⁿ / (Xⁿ + Hⁿ)', description: '指数 n 控制曲线形状；n > 1 时先慢后快再趋于平缓。' },
} as const;
export type Model = keyof typeof MODELS;
export type Parameters = { model: Model; limit: number; start: number; halfX: number; power: number };
export type Draft = { model: Model; limit: string; start: string; halfX: string; power: string; fit: boolean; pointX: string; pointY: string; x: string; maxX: string; logX: boolean; integerX: boolean };
export const DEFAULT_DRAFT: Draft = { model: 'rational', limit: '100', start: '0', halfX: '50', power: '2', fit: false, pointX: '100', pointY: '80', x: '50', maxX: '250', logX: false, integerX: false };

export function updateDraft(current: Draft, patch: Partial<Draft>): Draft {
  const next = { ...current, ...patch };
  const x = Number(next.x);
  if (next.integerX && next.x.trim() && Number.isFinite(x) && x >= 0 && x <= 1e12) next.x = String(Math.round(x));
  return next;
}
const LN2 = Math.LN2;
const softplus = (x: number) => x > 0 ? x + Math.log1p(Math.exp(-x)) : Math.log1p(Math.exp(x));

export function validate(p: Parameters) {
  if (!Object.hasOwn(MODELS, p.model)) throw new Error('请选择支持的函数类型。');
  if (!Number.isFinite(p.limit) || !Number.isFinite(p.start) || Math.abs(p.limit) > 1e12 || Math.abs(p.start) > 1e12) throw new Error('极限与起始值需为有限数，绝对值不超过 10¹²。');
  if (p.limit === p.start) throw new Error('极限值需与起始值不同；相同会变成常数函数。');
  if (!Number.isFinite(p.halfX) || p.halfX < 1e-12 || p.halfX > 1e12) throw new Error('半程 X（H）需在 10⁻¹²～10¹² 之间。');
  if (!Number.isFinite(p.power) || p.power < .1 || p.power > 8) throw new Error('幂指数 n 需在 0.1～8 之间。');
}

export function evaluate(p: Parameters, x: number) {
  validate(p);
  if (!Number.isFinite(x) || x < 0 || x > 1e12) throw new Error('X 需在 0～10¹² 之间。');
  let logFraction = 0;
  if (x > 0) {
    if (p.model === 'exponential') logFraction = -LN2 * x / p.halfX;
    else if (p.model === 'arctangent') logFraction = x <= p.halfX ? Math.log1p(-(2 / Math.PI) * Math.atan(x / p.halfX)) : Math.log(2 / Math.PI) + Math.log(Math.atan(p.halfX / x));
    else if (p.model === 'hill') logFraction = -softplus(p.power * Math.log(x / p.halfX));
    else logFraction = -Math.log1p(x / p.halfX);
  }
  const fraction = Math.exp(logFraction);
  const progress = -Math.expm1(logFraction);
  const delta = p.limit - p.start;
  const value = x === 0 ? p.start : progress < .5 ? p.start + delta * progress : p.limit - delta * fraction;
  const logGap = Math.log(Math.abs(delta)) + logFraction;
  return { value, progress, gap: Math.exp(logGap), logGap, roundedToLimit: value === p.limit };
}

export function xAtProgress(p: Parameters, progress: number): number {
  validate(p);
  if (!Number.isFinite(progress) || progress < 0 || progress >= 1) throw new Error('目标进度需大于等于 0 且小于 100%。');
  if (progress === 0) return 0;
  if (p.model === 'exponential') return -p.halfX * Math.log1p(-progress) / LN2;
  if (p.model === 'arctangent') return p.halfX * Math.tan(Math.PI * progress / 2);
  const ratio = Math.exp((Math.log(progress) - Math.log1p(-progress)) / (p.model === 'hill' ? p.power : 1));
  return p.halfX * ratio;
}

export function fitHalfX(p: Parameters, x: number, y: number): number {
  validate(p);
  if (!Number.isFinite(x) || x <= 0 || x > 1e12 || !Number.isFinite(y)) throw new Error('参考点 X 需大于 0 且不超过 10¹²，Y 需为有限数。');
  const progress = (y - p.start) / (p.limit - p.start);
  if (!(progress > 0 && progress < 1)) throw new Error('参考点 Y 必须严格位于起始值与极限值之间。');
  const halfX = x / xAtProgress({ ...p, halfX: 1 }, progress);
  validate({ ...p, halfX }); return halfX;
}

export function milestoneX(p: Parameters, progress: number, integerX: boolean): number {
  const x = xAtProgress(p, progress);
  if (!integerX) return x;
  const nearest = Math.round(x);
  return Math.abs(x - nearest) <= Number.EPSILON * Math.max(1, Math.abs(x)) * 8 ? nearest : Math.ceil(x);
}

export function resolveDraft(draft: Draft) {
  const number = (value: string, label: string) => { if (!value.trim() || !Number.isFinite(Number(value))) throw new Error(`${label}请输入有效数字。`); return Number(value); };
  let parameters: Parameters = { model: draft.model, start: number(draft.start, '起始值'), limit: number(draft.limit, '极限值'), halfX: draft.fit ? 1 : number(draft.halfX, '半程 X'), power: draft.model === 'hill' ? number(draft.power, '幂指数') : 1 };
  validate(parameters);
  if (draft.fit) parameters = { ...parameters, halfX: fitHalfX(parameters, number(draft.pointX, '参考点 X'), number(draft.pointY, '参考点 Y')) };
  const rawX = number(draft.x, '当前 X'), maxX = number(draft.maxX, '图表范围');
  if (rawX < 0 || rawX > 1e12) throw new Error('X 需在 0～10¹² 之间。');
  const x = draft.integerX ? Math.round(rawX) : rawX;
  if (maxX <= 0 || maxX > 1e12) throw new Error('图表右边界需大于 0 且不超过 10¹²。');
  const result = evaluate(parameters, x);
  return { parameters, x, maxX: Math.max(x, maxX), result };
}

export function format(value: number, digits = 6): string {
  if (!Number.isFinite(value)) return '超出数值范围';
  if (value === 0) return '0';
  if (Math.abs(value) >= 1e7 || Math.abs(value) < 1e-5) return value.toExponential(4);
  return Number(value.toPrecision(digits)).toString();
}
export function formatGap(logGap: number): string {
  if (logGap < -700) return `约 10^(${format(logGap / Math.LN10, 8)})`;
  return format(Math.exp(logGap), 10);
}
export function formula(p: Parameters, code = false): string {
  const repr = (value: number) => code ? String(value) : format(value, 12);
  const l = repr(p.limit), s = repr(p.start), delta = repr(p.limit - p.start), h = repr(p.halfX), n = repr(p.power);
  if (code) {
    if (p.model === 'exponential') return `(${l}) - (${delta}) * Math.exp(-Math.LN2 * x / (${h}))`;
    if (p.model === 'arctangent') return `(${s}) + (${delta}) * (2 / Math.PI) * Math.atan(x / (${h}))`;
    if (p.model === 'hill') return `(${s}) + (${delta}) * (x === 0 ? 0 : 1 / (1 + Math.exp((${n}) * (Math.log(${h}) - Math.log(x)))))`;
    return `(${s}) + (${delta}) * x / (x + (${h}))`;
  }
  if (p.model === 'exponential') return `F(X) = (${l}) − (${delta}) × 2^(−X / ${h})`;
  if (p.model === 'arctangent') return `F(X) = (${s}) + (${delta}) × (2/π) × atan(X / ${h})`;
  if (p.model === 'hill') return `F(X) = (${s}) + (${delta}) × X^${n} / (X^${n} + ${h}^${n})`;
  return `F(X) = (${s}) + (${delta}) × X / (X + ${h})`;
}
export function axisX(t: number, maxX: number, halfX: number, logarithmic: boolean) {
  return Math.max(0, Math.min(maxX, logarithmic ? halfX * Math.expm1(t * Math.log1p(maxX / halfX)) : t * maxX));
}
export function axisPosition(x: number, maxX: number, halfX: number, logarithmic: boolean) {
  return logarithmic ? Math.log1p(x / halfX) / Math.log1p(maxX / halfX) : x / maxX;
}
