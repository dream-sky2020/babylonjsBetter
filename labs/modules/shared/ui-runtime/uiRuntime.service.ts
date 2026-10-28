import { createServiceToken } from '@/core/system-runtime/ServiceToken';

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
};
export type LabUiRuntimeService = { open(options: LabUiOverlayOptions): Promise<LabUiOverlay> };
export const LAB_UI_RUNTIME = createServiceToken<LabUiRuntimeService>('lab.ui-runtime');
