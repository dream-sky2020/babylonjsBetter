export type VisualDeformationConfig = {
  mode: 'automatic' | 'manual';
  referencePitchDeg: number;
  strength: number;
  heightScale: number;
  shear: number;
};
export type DeformationView = { pitchDeg: number; yawDeg: number; projection: 'perspective' | 'orthographic' };
export type DeformationCoefficients = Readonly<{ x: number; y: number; z: number }>;
export const IDENTITY_DEFORMATION: DeformationCoefficients = Object.freeze({ x: 0, y: 1, z: 0 });
export const DEFAULT_VISUAL_DEFORMATION: Readonly<VisualDeformationConfig> = Object.freeze({
  mode: 'automatic', referencePitchDeg: 0, strength: 1, heightScale: 1, shear: 0,
});
export function parseVisualDeformation(value: unknown): VisualDeformationConfig {
  if (!value || typeof value !== 'object') throw new Error('变形配置必须为对象');
  const v = value as Record<string, unknown>;
  const number = (key: string, min: number, max: number): number => {
    const n = v[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) throw new Error(`${key} 必须为 ${min}–${max} 的数值`);
    return n;
  };
  if (v.mode !== 'automatic' && v.mode !== 'manual') throw new Error('未知变形模式');
  return { mode: v.mode, referencePitchDeg: number('referencePitchDeg', 0, 89.99), strength: number('strength', 0, 1),
    heightScale: number('heightScale', .25, 4), shear: number('shear', -4, 4) };
}
/** World-space affine height shear. Ground layout is deliberately absent from this calculation. */
export function resolveDeformation(config: VisualDeformationConfig, view: DeformationView | null): DeformationCoefficients {
  const c = parseVisualDeformation(config);
  if (!view || c.strength === 0 || (c.mode === 'automatic' && view.projection !== 'orthographic')) return IDENTITY_DEFORMATION;
  if (![view.pitchDeg, view.yawDeg].every(Number.isFinite) || view.pitchDeg < 15 || view.pitchDeg > 89.99) throw new Error('俯视角必须在 15–89.99°');
  const pitch = view.pitchDeg * Math.PI / 180;
  const yaw = view.yawDeg * Math.PI / 180;
  // Screen-up projection of height h is h*cos(pitch) - horizontalTowardCamera*sin(pitch).
  const shear = c.mode === 'manual' ? c.shear
    : (c.heightScale * Math.cos(pitch) - Math.cos(c.referencePitchDeg * Math.PI / 180)) / Math.sin(pitch);
  return Object.freeze({ x: Math.sin(yaw) * shear * c.strength, y: 1 + (c.heightScale - 1) * c.strength,
    z: Math.cos(yaw) * shear * c.strength });
}
export const isIdentityDeformation = (c: DeformationCoefficients) => c.x === 0 && c.y === 1 && c.z === 0;
export function deformPosition(p: readonly number[], anchor: readonly number[], c: DeformationCoefficients): [number, number, number] {
  const height = p[1] - anchor[1];
  return [p[0] + height * c.x, anchor[1] + height * c.y, p[2] + height * c.z];
}

export type DeformationTargetInfo = Readonly<{
  id: string; label: string; groupId: string; tags: readonly string[]; kind: 'model' | 'sprite' | 'geometry' | 'particle';
  persistent: boolean; supported: boolean; reason?: string;
}>;
export type DeformationRule = { selector: 'group' | 'tag' | 'kind' | 'id'; value: string; strength: number };
export type DeformationSettings = { enabled: boolean; selection: 'all' | 'rules'; config: VisualDeformationConfig; rules: DeformationRule[] };
export const DEFAULT_DEFORMATION_SETTINGS: DeformationSettings = { enabled: false, selection: 'all', config: { ...DEFAULT_VISUAL_DEFORMATION }, rules: [] };
export function parseDeformationSettings(value: unknown, version = 1): DeformationSettings {
  if (version !== 1 || !value || typeof value !== 'object') throw new Error('变形设置版本或格式无效');
  const v = value as Record<string, unknown>;
  if (typeof v.enabled !== 'boolean' || (v.selection !== 'all' && v.selection !== 'rules') || !Array.isArray(v.rules)) throw new Error('变形设置格式无效');
  const rules = v.rules.map((raw: unknown): DeformationRule => {
    if (!raw || typeof raw !== 'object') throw new Error('分组规则无效');
    const r = raw as Record<string, unknown>;
    if (!['group', 'tag', 'kind', 'id'].includes(String(r.selector)) || typeof r.value !== 'string' || !r.value.trim()
      || typeof r.strength !== 'number' || !Number.isFinite(r.strength) || r.strength < 0 || r.strength > 1) throw new Error('规则必须包含选择类型、名称和 0–1 强度');
    return { selector: r.selector as DeformationRule['selector'], value: r.value, strength: r.strength };
  });
  return { enabled: v.enabled, selection: v.selection, config: parseVisualDeformation(v.config), rules };
}
/** ID > tag > group > kind > default. Last rule of equal specificity wins, never multiply rules. */
export function resolveTargetStrength(target: DeformationTargetInfo, settings: DeformationSettings): number {
  if (!settings.enabled || !target.supported) return 0;
  let strength = settings.selection === 'all' ? settings.config.strength : 0;
  let priority = 0;
  const order = { kind: 1, group: 2, tag: 3, id: 4 };
  for (const rule of settings.rules) {
    const matches = rule.selector === 'id' ? target.id === rule.value : rule.selector === 'tag' ? target.tags.includes(rule.value)
      : rule.selector === 'group' ? target.groupId === rule.value : target.kind === rule.value;
    if (matches && order[rule.selector] >= priority) { priority = order[rule.selector]; strength = rule.strength; }
  }
  return strength;
}
