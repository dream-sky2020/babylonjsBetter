import { cloneUiDocument, encodeUiDocumentLibrary, parseUiDocument, parseUiDocumentLibrary, type UiNode } from '../ui-document';
import { createDialoguePreviewDefinitionRegistry } from './dialoguePreview.definitions';
import type { DialoguePreviewPreset, DialoguePreviewPresetLibrary } from './dialoguePreview.types';

const registry = createDialoguePreviewDefinitionRegistry();
const node = (id: string, name: string, type: string, x: number, y: number, width: number, height: number, zIndex: number, props: Record<string, unknown>, opacity = 1): UiNode => ({
  id, name, type, definitionVersion: registry.require(type).version, parentId: null, childIds: [],
  layout: { mode: 'absolute', x, y, width, height, zIndex }, visible: true, locked: false, opacity,
  props: { ...registry.require(type).createDefaultProps(), ...props },
});

export const createDialoguePreviewPreset = (presetKey = 'default_dialogue_ui', name = '默认对话界面'): DialoguePreviewPreset => {
  const nodes = [
    node('portrait-left', '左侧头像', 'portrait', 84, 236, 390, 560, 1, { content: '林', fill: '#243a55', accent: '#68d5c3' }),
    node('portrait-right', '右侧头像', 'portrait', 1126, 236, 390, 560, 1, { content: '岚', fill: '#3b2947', accent: '#ef8fa9' }, .58),
    node('dialogue-box', '主对话框', 'dialogue-box', 170, 612, 1260, 226, 10, { content: '月光正好。沿着这条路走，我们会在钟声响起前抵达城门。' }),
    node('speaker-name', '姓名牌', 'nameplate', 228, 570, 226, 68, 11, { content: '林', fill: '#1f3550', stroke: '#68d5c3', accent: '#68d5c3', cornerRadius: 16, fontSize: 30 }),
    node('continue-icon', '继续图标', 'icon', 1352, 766, 42, 42, 12, { icon: 'continue', fill: '#15243a', stroke: '#f5c96a' }),
    node('auto-icon', '自动播放图标', 'icon', 1264, 638, 94, 36, 12, { icon: 'auto', content: 'AUTO', fill: '#23364a', stroke: '#68d5c3', accent: '#68d5c3', fontSize: 15 }),
    node('voice-icon', '语音图标', 'icon', 246, 690, 42, 42, 12, { icon: 'voice', fill: '#1d2c42', stroke: '#7dd3fc', accent: '#7dd3fc' }),
  ];
  return { schemaVersion: 2, presetKey, name, canvas: { width: 1600, height: 900, backgroundTop: '#101a35', backgroundBottom: '#24162e', gridSize: 20 }, rootIds: nodes.map((item) => item.id), nodes: Object.fromEntries(nodes.map((item) => [item.id, item])) };
};

export const parseDialoguePreviewPreset = (value: unknown, expectedKey?: string): DialoguePreviewPreset => parseUiDocument(value, expectedKey);
export const parseDialoguePreviewPresetLibrary = (value: unknown): DialoguePreviewPresetLibrary => parseUiDocumentLibrary(value);
export const cloneDialoguePreviewPreset = (preset: DialoguePreviewPreset): DialoguePreviewPreset => cloneUiDocument(preset);
export const encodeDialoguePreviewPresetLibrary = (library: DialoguePreviewPresetLibrary): DialoguePreviewPresetLibrary => encodeUiDocumentLibrary(library);
