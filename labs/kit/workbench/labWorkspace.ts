export type LabWorkspace = { leftWidth: number; rightWidth: number; objectsOpen: boolean; controlsOpen: boolean; tab: 'modules' | 'diagnostics' };
export const DEFAULT_LAB_WORKSPACE: LabWorkspace = { leftWidth: 250, rightWidth: 350, objectsOpen: true, controlsOpen: true, tab: 'modules' };
export function normalizeLabWorkspace(value: Partial<LabWorkspace> | null): LabWorkspace {
  const width = (v: unknown, fallback: number, min: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(720, v)) : fallback;
  return { leftWidth: width(value?.leftWidth, 250, 180), rightWidth: width(value?.rightWidth, 350, 260),
    objectsOpen: typeof value?.objectsOpen === 'boolean' ? value.objectsOpen : true,
    controlsOpen: typeof value?.controlsOpen === 'boolean' ? value.controlsOpen : true,
    tab: value?.tab === 'diagnostics' ? 'diagnostics' : 'modules' };
}
