export type PanelValue = string | number | boolean;
export type PanelOptions = Record<string, PanelValue>;
export type PanelSettings = Record<string, PanelOptions>;
export type PanelSettingField = { key: string; label: string } & (
  { type: 'select'; default: string | number; options: readonly { label: string; value: string | number }[] } |
  { type: 'boolean'; default: boolean } |
  { type: 'number'; default: number; min: number; max: number; step?: number }
);
export type PanelSettingsRegistry = Record<string, readonly PanelSettingField[]>;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function parsePanelSettings(value: unknown, ids: readonly string[], registry?: PanelSettingsRegistry): PanelSettings | undefined {
  if (value === undefined) return undefined;
  if (!record(value) || Object.keys(value).length > ids.length) throw new Error('面板设置无效。');
  const result: PanelSettings = {};
  for (const [id, options] of Object.entries(value)) {
    if (!ids.includes(id) || !record(options) || Object.keys(options).length > 32) throw new Error('面板设置包含未知面板或无效选项。');
    const parsed: PanelOptions = {};
    for (const [key, option] of Object.entries(options)) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key) || ['constructor','prototype','__proto__'].includes(key) || !['string','number','boolean'].includes(typeof option) || typeof option === 'number' && !Number.isFinite(option) || typeof option === 'string' && option.length > 1000) throw new Error('面板选项值无效。');
      if (registry) {
        const field = registry[id]?.find(value => value.key === key);
        if (!field || field.type === 'select' && !field.options.some(value => value.value === option) || field.type === 'boolean' && typeof option !== 'boolean' || field.type === 'number' && (typeof option !== 'number' || option < field.min || option > field.max || Math.abs((option - field.min) / (field.step ?? 1) - Math.round((option - field.min) / (field.step ?? 1))) > 1e-8)) throw new Error('面板选项超出允许范围。');
      }
      parsed[key] = option as PanelValue;
    }
    result[id] = parsed;
  }
  return result;
}
export function resolvedPanelSettings(values: PanelSettings | undefined, id: string, registry: PanelSettingsRegistry): PanelOptions { return { ...Object.fromEntries((registry[id] ?? []).map(field => [field.key, field.default])), ...values?.[id] }; }
export function updatePanelSetting<T extends { panelSettings?: PanelSettings }>(data: T, id: string, key: string, value: PanelValue, ids: readonly string[], registry: PanelSettingsRegistry): T {
  const panelSettings = parsePanelSettings({ ...data.panelSettings, [id]: { ...data.panelSettings?.[id], [key]: value } }, ids, registry)!;
  return { ...data, panelSettings };
}
export function resetPanelSettings<T extends { panelSettings?: PanelSettings }>(data: T, id: string): T {
  const panelSettings = { ...data.panelSettings }; delete panelSettings[id]; const next = { ...data };
  if (Object.keys(panelSettings).length) next.panelSettings = panelSettings; else delete next.panelSettings;
  return next;
}
