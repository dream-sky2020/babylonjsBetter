import { validateDockTree as validate, type DockNode as GenericDockNode } from '../../../core/ui/editor-kit/dockLayout.ts';
export { dockLeaves, dockRects, moveDockPanel, removeDockPanel, setDockRatio } from '../../../core/ui/editor-kit/dockLayout.ts';
export type { DockRect } from '../../../core/ui/editor-kit/dockLayout.ts';
export type PanelId = 'objects' | 'materials' | 'textures';
export type DockNode = GenericDockNode<PanelId>;
export const panels: PanelId[] = ['objects', 'materials', 'textures'];
export const defaultDockTree: DockNode = { id: 'main', axis: 'x', ratio: .55, first: 'objects', second: { id: 'resources', axis: 'y', ratio: .5, first: 'materials', second: 'textures' } };
export function validateDockTree(value: unknown): DockNode { return validate(value, panels, defaultDockTree); }
