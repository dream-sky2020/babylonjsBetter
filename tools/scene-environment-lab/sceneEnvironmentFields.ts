import type { SceneEnvironmentPreset } from '../../core/scene/sceneEnvironment.types.ts';

export type EnvironmentField = { path: string; label: string; type: 'text' | 'number' | 'vector' | 'boolean' | 'select' | 'color' | 'json'; options?: readonly string[]; optional?: boolean; min?: number; integer?: boolean };
const field = (path: string, label: string, type: EnvironmentField['type'], optional = false, options?: readonly string[]): EnvironmentField => ({ path, label, type, optional, options });
const shadowFlags = [field('shadow.cast', '投射阴影', 'boolean', true), field('shadow.receive', '接收阴影', 'boolean', true)];
export function environmentTarget(preset: SceneEnvironmentPreset, id: string | null): Record<string, unknown> {
  if (!id || id === 'scene') return preset as unknown as Record<string, unknown>;
  const split = id.indexOf(':'); const kind = id.slice(0, split); const key = id.slice(split + 1);
  const list = kind === 'transform' ? preset.transformNodes ?? [] : kind === 'object' ? preset.objects : kind === 'model' ? preset.models : preset.lights;
  const target = list.find(item => item.id === key);
  if (!target) throw new Error(`找不到声明：${id}`);
  return target as unknown as Record<string, unknown>;
}
/** Explicit declaration schema. Never enumerate Babylon nodes or runtime properties. */
export function environmentFields(preset: SceneEnvironmentPreset, id: string | null, shadowKeys: readonly string[]): EnvironmentField[] {
  const target = environmentTarget(preset, id);
  const common = [field('name', '名称', 'text')];
  if (!id || id === 'scene') return [...common, field('clearColor', '背景颜色', 'color')];
  if (id.startsWith('transform:')) return [...common, field('role', '用途', 'select', true, ['empty', 'rig', 'socket']), field('position', '位置', 'vector'), field('rotation', '旋转（弧度）', 'vector', true), field('scaling', '缩放', 'vector', true)];
  if (id.startsWith('object:')) {
    const geometry = target.geometry as { primitive: string };
    const sizes = geometry.primitive === 'ground' ? ['width', 'height'] : geometry.primitive === 'box' ? ['width', 'height', 'depth'] : ['height', 'diameterTop', 'diameterBottom', 'tessellation'];
    return [...common, field('position', '位置', 'vector'), field('rotation', '旋转（弧度）', 'vector', true), field('scaling', '缩放', 'vector', true), field('color', '颜色', 'color'),
      ...sizes.map(path => ({ ...field(`geometry.${path}`, ({ width: '宽度', height: '高度 / 地面深度', depth: '深度', diameterTop: '顶部直径', diameterBottom: '底部直径', tessellation: '圆周细分' })[path] ?? path, 'number', path === 'tessellation'), min: path === 'diameterTop' ? 0 : path === 'tessellation' ? 3 : Number.MIN_VALUE, integer: path === 'tessellation' })), ...shadowFlags];
  }
  if (id.startsWith('model:')) return [...common, field('modelPath', '模型路径（GLB / GLTF）', 'text'), field('position', '位置', 'vector'), field('rotation', '旋转（弧度）', 'vector', true), field('scaling', '缩放', 'vector', true), field('transparencyPolicy', '透明策略', 'select', true, ['source', 'depth-safe-cutout']), field('animation.name', '动画名称', 'text', true), field('animation.autoplay', '自动播放', 'boolean', true), field('animation.loop', '循环动画', 'boolean', true), ...shadowFlags];
  const light = target.light as { primitive: string };
  const fields = [...common, { ...field('intensity', '强度', 'number'), min: 0 }, field('color', '颜色', 'color')];
  if (light.primitive !== 'point') fields.push(field('light.direction', '方向', 'vector'));
  if (light.primitive === 'hemispheric') return [...fields, field('light.groundColor', '地面颜色', 'color')];
  fields.push(field('light.position', '位置', 'vector', light.primitive === 'directional'));
  if (light.primitive === 'point') fields.push({ ...field('light.range', '照明范围', 'number', true), min: Number.MIN_VALUE });
  fields.push(field('shadow.qualityPresetKey', '阴影预设（清空关闭阴影）', 'select', true, shadowKeys), field('shadow.qualityTier', '阴影档位', 'select', true, ['low', 'medium', 'high', 'ultra']), field('shadow.overrides', '阴影局部覆盖（JSON）', 'json', true));
  return fields;
}
export function fieldValue(target: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, target);
}
export function formatField(value: unknown, type: EnvironmentField['type']) {
  return value === undefined ? '' : type === 'vector' || type === 'json' ? JSON.stringify(value) : String(value);
}
function assign(target: Record<string, unknown>, path: string[], value: unknown) {
  const [key, ...tail] = path;
  if (!tail.length) { if (value === undefined) delete target[key]; else target[key] = value; return; }
  const child = (target[key] ?? {}) as Record<string, unknown>;
  assign(child, tail, value);
  if (Object.keys(child).length) target[key] = child; else delete target[key];
}
export function applyEnvironmentFields(preset: SceneEnvironmentPreset, id: string | null, fields: EnvironmentField[], values: Record<string, string>): SceneEnvironmentPreset {
  const next = structuredClone(preset); const target = environmentTarget(next, id);
  for (const f of fields) {
    const text = values[f.path]?.trim() ?? '';
    let value: unknown = text;
    if (!text) { if (!f.optional) throw new Error(`${f.label}不能为空`); value = undefined; }
    else if (f.type === 'number') {
      value = Number(text);
      if (!Number.isFinite(value) || (f.min !== undefined && Number(value) < f.min) || (f.integer && !Number.isInteger(value))) throw new Error(`${f.label}不是合法数值`);
    } else if (f.type === 'boolean') { if (!['true', 'false'].includes(text)) throw new Error(`${f.label}必须是布尔值`); value = text === 'true'; }
    else if (f.type === 'select') { if (!f.options?.includes(text)) throw new Error(`${f.label}选项无效`); }
    else if (f.type === 'color') {
      const alpha = f.path === 'clearColor';
      if (!(alpha ? /^#[0-9a-f]{6}([0-9a-f]{2})?$/i : /^#[0-9a-f]{6}$/i).test(text)) throw new Error(`${f.label}使用 ${alpha ? '#RRGGBB 或 #RRGGBBAA' : '#RRGGBB'}`);
    }
    else if (f.type === 'vector' || f.type === 'json') {
      try { value = JSON.parse(text); } catch { throw new Error(f.type === 'vector' ? `${f.label}的 X、Y、Z 都必须填写有限数字` : `${f.label}不是合法 JSON`); }
      if (f.type === 'vector' && (!Array.isArray(value) || value.length !== 3 || value.some(v => typeof v !== 'number' || !Number.isFinite(v)))) throw new Error(`${f.label}必须包含三个有限数字`);
    }
    assign(target, f.path.split('.'), value);
  }
  if (id?.startsWith('light:') && !values['shadow.qualityPresetKey']) delete target.shadow;
  return next;
}
