export const referenceFramePresets = [
  { width: 1920, height: 1080 }, { width: 1600, height: 900 },
  { width: 1366, height: 768 }, { width: 1280, height: 720 },
  { width: 960, height: 540 }, { width: 854, height: 480 },
] as const;
export type ReferenceFrame = { layer: 'front' | 'back'; visible: boolean; width: number; height: number };
export function defaultReferenceFrame(): ReferenceFrame { return { visible: true, width: 1920, height: 1080, layer: 'back' }; }
export function parseReferenceFrame(value: unknown): ReferenceFrame {
  if (value === undefined) return defaultReferenceFrame();
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('游戏画面参考框设置无效。');
  const frame = value as ReferenceFrame;
  if (typeof frame.visible !== 'boolean' || ![frame.width, frame.height].every(size => Number.isSafeInteger(size) && size >= 1 && size <= 16384)) throw new Error('参考尺寸必须是 1 到 16384 的整数像素。');
  if (frame.layer !== undefined && !['front', 'back'].includes(frame.layer)) throw new Error('参考框显示层级无效。');
  return { visible: frame.visible, width: frame.width, height: frame.height, layer: frame.layer ?? 'back' };
}
export type GridSettings = { precision: number; threshold: number; autoCompact: boolean; collision: 'push' | 'block' | 'overlap'; preview: 'window' | 'outline'; referenceFrame?: ReferenceFrame };
export function defaultGridSettings(): GridSettings { return { precision: 2, threshold: 6, autoCompact: false, collision: 'push', preview: 'window', referenceFrame: defaultReferenceFrame() }; }
export function parseGridSettings(value: unknown): GridSettings {
  if (value === undefined) return defaultGridSettings();
  if (!value || typeof value !== 'object') throw new Error('布局设置无效。');
  const settings = value as GridSettings;
  if (![0.5, 1, 2, 4].includes(settings.precision) || !Number.isInteger(settings.threshold) || settings.threshold < 0 || settings.threshold > 24 || typeof settings.autoCompact !== 'boolean' || !['window', 'outline'].includes(settings.preview)) throw new Error('布局设置超出范围。');
  if (settings.collision !== undefined && !['push', 'block', 'overlap'].includes(settings.collision)) throw new Error('碰撞处理设置无效。');
  return { precision: settings.precision, threshold: settings.threshold, autoCompact: settings.collision === 'overlap' ? false : settings.autoCompact, collision: settings.collision ?? 'push', preview: settings.preview, referenceFrame: parseReferenceFrame(settings.referenceFrame) };
}
