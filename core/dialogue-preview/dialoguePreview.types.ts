import type { UiDocument, UiDocumentLibrary } from '../ui-document';

export type DialoguePreviewPreset = UiDocument;
export type DialoguePreviewPresetLibrary = UiDocumentLibrary;
export type DialoguePreviewComponentKind = 'dialogue-box' | 'portrait' | 'nameplate' | 'icon' | 'text';
export type DialoguePreviewIcon = 'continue' | 'auto' | 'voice' | 'skip' | 'log';
export type DialoguePreviewPresetCatalog = { version: 1; presets: Record<string, { presetKey: string; name: string; file: string }> };
