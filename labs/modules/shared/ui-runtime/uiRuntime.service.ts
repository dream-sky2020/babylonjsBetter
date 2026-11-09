import { createServiceToken } from '@/core/system-runtime/ServiceToken';
import type { UiDocument } from '@/core/ui-document/uiDocument.types';

export type LabUiOverlay = {
  update(context: Record<string, unknown>): void;
  show(): void;
  hide(): void;
  dispose(): void;
};
export type LabUiOverlayOptions = {
  id: string;
  presetKey: string;
  context?: Record<string, unknown>;
  onAction?(action: string): void | Promise<void>;
  /** Modal captures the viewport and pauses scene input; HUD passes empty space through. */
  inputMode?: 'passthrough' | 'modal';
  /** HUDs can anchor their design canvas and scale it down only when needed. */
  anchor?: 'top-left';
  validatePreset?(document: UiDocument): void;
};
export type LabUiRuntimeService = { open(options: LabUiOverlayOptions): Promise<LabUiOverlay> };
export const LAB_UI_RUNTIME = createServiceToken<LabUiRuntimeService>('lab.ui-runtime');
