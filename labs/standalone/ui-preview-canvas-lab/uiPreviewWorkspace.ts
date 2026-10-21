export const uiPreviewWorkspaceKey = 'ui-preview-canvas-lab:workspace:v1';
export type UiPreviewWorkspace = {
  left: number; right: number;
  leftOpen: boolean; rightOpen: boolean;
  referenceFrameVisible: boolean;
  sections: Record<string, boolean>;
};
export const defaultUiPreviewWorkspace = (width: number): UiPreviewWorkspace => ({
  left: 280, right: 340, leftOpen: width >= 1050, rightOpen: width >= 1050, referenceFrameVisible: true, sections: {},
});
export function normalizeUiPreviewWorkspace(raw: unknown, width: number): UiPreviewWorkspace {
  const result = defaultUiPreviewWorkspace(width);
  if (!raw || typeof raw !== 'object') return result;
  const value = raw as Partial<UiPreviewWorkspace>;
  for (const side of ['left', 'right'] as const) {
    const size = value[side];
    if (typeof size === 'number' && Number.isFinite(size)) result[side] = Math.max(220, Math.min(side === 'left' ? 480 : 560, size));
  }
  for (const side of ['leftOpen', 'rightOpen'] as const) if (typeof value[side] === 'boolean') result[side] = value[side];
  if (typeof value.referenceFrameVisible === 'boolean') result.referenceFrameVisible = value.referenceFrameVisible;
  if (value.sections && typeof value.sections === 'object') result.sections = Object.fromEntries(Object.entries(value.sections).filter(([key, open]) => key.length < 100 && typeof open === 'boolean'));
  return result;
}
export function readUiPreviewWorkspace(storage: Pick<Storage, 'getItem'>, width: number): UiPreviewWorkspace {
  try { return normalizeUiPreviewWorkspace(JSON.parse(storage.getItem(uiPreviewWorkspaceKey) ?? 'null'), width); }
  catch { return defaultUiPreviewWorkspace(width); }
}
