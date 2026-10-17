export type GridSettings = { precision: number; threshold: number; autoCompact: boolean; collision: 'push' | 'block' | 'overlap'; preview: 'window' | 'outline' };
export function defaultGridSettings(): GridSettings { return { precision: 2, threshold: 6, autoCompact: false, collision: 'push', preview: 'window' }; }
export function parseGridSettings(value: unknown): GridSettings {
  if (value === undefined) return defaultGridSettings();
  if (!value || typeof value !== 'object') throw new Error('布局设置无效。');
  const settings = value as GridSettings;
  if (![0.5, 1, 2, 4].includes(settings.precision) || !Number.isInteger(settings.threshold) || settings.threshold < 0 || settings.threshold > 24 || typeof settings.autoCompact !== 'boolean' || !['window', 'outline'].includes(settings.preview)) throw new Error('布局设置超出范围。');
  if (settings.collision !== undefined && !['push', 'block', 'overlap'].includes(settings.collision)) throw new Error('碰撞处理设置无效。');
  return { precision: settings.precision, threshold: settings.threshold, autoCompact: settings.collision === 'overlap' ? false : settings.autoCompact, collision: settings.collision ?? 'push', preview: settings.preview };
}
