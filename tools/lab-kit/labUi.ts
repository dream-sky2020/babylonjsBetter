export type LabPanel = {
  root: HTMLDivElement;
  content: HTMLDivElement;
};

export type LabPanelOptions = {
  defaultCollapsed?: boolean;
};

type LabUiPreferences = {
  version: 1;
  panels: Record<string, { collapsed: boolean }>;
  switches: Record<string, boolean>;
};

export type LabSwitchOptions = {
  /** 仅用于显示类 UI 偏好；key 在当前 Lab 页面内必须稳定且唯一。 */
  preference?: Readonly<{ ui: LabUi; key: string }>;
};

export type LabBooleanPreference = Readonly<{
  value: boolean;
  set(value: boolean): void;
}>;

type PanelEntry = LabPanel & {
  id: string;
  title: string;
  collapseButton: HTMLButtonElement;
  defaultCollapsed: boolean;
};

const createDefaultPreferences = (): LabUiPreferences => ({ version: 1, panels: {}, switches: {} });

export class LabUi {
  private readonly panels = new Map<string, PanelEntry>();
  private readonly boundBooleanPreferenceKeys = new Set<string>();
  private readonly storageKey: string;
  private preferences: LabUiPreferences;

  constructor(
    readonly sidebar: HTMLElement,
    readonly status: HTMLDivElement,
  ) {
    const path = typeof location === 'undefined' ? 'unknown' : location.pathname;
    this.storageKey = `babylonjsBetter:lab-ui:${path}`;
    this.preferences = this.readPreferences();
    this.sidebar.append(this.createLayoutToolbar());
  }

  addPanel(id: string, title: string, options: LabPanelOptions = {}): LabPanel {
    if (this.panels.has(id)) {
      throw new Error(`Lab 面板 ID 重复：“${id}”。`);
    }
    const root = document.createElement('section');
    root.className = 'lab-card';
    root.dataset.labPanel = id;
    const header = document.createElement('div');
    header.className = 'lab-card-header';
    const heading = document.createElement('h2');
    heading.textContent = title;
    const collapseButton = document.createElement('button');
    collapseButton.type = 'button';
    collapseButton.className = 'lab-card-collapse';
    collapseButton.setAttribute('aria-label', `收起“${title}”面板`);
    collapseButton.setAttribute('aria-expanded', 'true');
    collapseButton.title = '收起';
    const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevron.setAttribute('viewBox', '0 0 16 16');
    chevron.setAttribute('aria-hidden', 'true');
    const chevronPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    chevronPath.setAttribute('d', 'm5 3 5 5-5 5');
    chevron.append(chevronPath);
    collapseButton.append(chevron);
    const content = document.createElement('div');
    content.className = 'lab-panel-content';
    const contentId = `lab-panel-content-${id}`;
    content.id = contentId;
    collapseButton.setAttribute('aria-controls', contentId);
    const entry: PanelEntry = {
      id,
      title,
      root,
      content,
      collapseButton,
      defaultCollapsed: options.defaultCollapsed === true,
    };
    header.addEventListener('click', () => this.setPanelCollapsed(entry, !root.classList.contains('is-collapsed'), true));
    header.append(heading, collapseButton);
    root.append(header, content);
    this.panels.set(id, entry);
    const saved = this.preferences.panels[id];
    this.setPanelCollapsed(entry, saved?.collapsed ?? entry.defaultCollapsed, false);
    this.sidebar.append(root);
    return { root, content };
  }

  setStatus(message: string, error = false): void {
    this.status.textContent = message;
    this.status.dataset.error = String(error);
  }

  createBooleanPreference(key: string, defaultValue: boolean): LabBooleanPreference {
    const normalizedKey = key.trim();
    if (!normalizedKey) throw new Error('Lab Boolean 偏好 Key 不能为空。');
    if (this.boundBooleanPreferenceKeys.has(normalizedKey)) {
      throw new Error(`Lab Boolean 偏好 Key 重复：“${normalizedKey}”。`);
    }
    this.boundBooleanPreferenceKeys.add(normalizedKey);
    const value = this.preferences.switches[normalizedKey] ?? defaultValue;
    return Object.freeze({
      value,
      set: (nextValue: boolean) => {
        this.preferences.switches[normalizedKey] = nextValue;
        this.writePreferences();
      },
    });
  }

  bindSwitchPreference(key: string, input: HTMLInputElement, defaultValue: boolean): void {
    const preference = this.createBooleanPreference(key, defaultValue);
    input.checked = preference.value;
    input.addEventListener('change', () => {
      preference.set(input.checked);
    });
  }

  private setPanelCollapsed(entry: PanelEntry, collapsed: boolean, persist: boolean): void {
    entry.root.classList.toggle('is-collapsed', collapsed);
    entry.content.hidden = collapsed;
    entry.collapseButton.title = collapsed ? '展开' : '收起';
    entry.collapseButton.setAttribute('aria-expanded', String(!collapsed));
    entry.collapseButton.setAttribute('aria-label', `${collapsed ? '展开' : '收起'}“${entry.title}”面板`);
    if (!persist) return;
    this.preferences.panels[entry.id] = { collapsed };
    this.writePreferences();
  }

  private setAllCollapsed(collapsed: boolean): void {
    this.panels.forEach((entry) => {
      this.setPanelCollapsed(entry, collapsed, false);
      this.preferences.panels[entry.id] = { collapsed };
    });
    this.writePreferences();
  }

  private resetLayout(): void {
    this.preferences.panels = {};
    this.writePreferences();
    this.panels.forEach((entry) => this.setPanelCollapsed(entry, entry.defaultCollapsed, false));
  }

  private createLayoutToolbar(): HTMLDivElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'lab-panel-layout-actions';
    const createButton = (label: string, action: () => void): HTMLButtonElement => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', action);
      return button;
    };
    toolbar.append(
      createButton('全部展开', () => this.setAllCollapsed(false)),
      createButton('全部折叠', () => this.setAllCollapsed(true)),
      createButton('重置布局', () => this.resetLayout()),
    );
    return toolbar;
  }

  private readPreferences(): LabUiPreferences {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return createDefaultPreferences();
      const parsed = JSON.parse(raw) as Partial<LabUiPreferences>;
      if (parsed.version !== 1 || !parsed.panels || typeof parsed.panels !== 'object' || Array.isArray(parsed.panels)) {
        return createDefaultPreferences();
      }
      const panels: LabUiPreferences['panels'] = {};
      const switches: LabUiPreferences['switches'] = {};
      Object.entries(parsed.panels).forEach(([id, value]) => {
        if (value && typeof value === 'object' && 'collapsed' in value && typeof value.collapsed === 'boolean') {
          panels[id] = { collapsed: value.collapsed };
        }
      });
      if (parsed.switches && typeof parsed.switches === 'object' && !Array.isArray(parsed.switches)) {
        Object.entries(parsed.switches).forEach(([key, value]) => {
          if (typeof value === 'boolean') switches[key] = value;
        });
      }
      return { version: 1, panels, switches };
    } catch {
      return createDefaultPreferences();
    }
  }

  private writePreferences(): void {
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.preferences)); } catch { /* 浏览器可能禁止或耗尽本地存储。 */ }
  }
}

export const createLabField = (labelText: string, control: HTMLElement): HTMLLabelElement => {
  const label = document.createElement('label');
  label.className = 'lab-field';
  const text = document.createElement('span');
  text.textContent = labelText;
  label.append(text, control);
  return label;
};

export const createLabSwitch = (
  labelText: string,
  checked = false,
  options: LabSwitchOptions = {},
): { row: HTMLLabelElement; input: HTMLInputElement } => {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  if (options.preference) {
    options.preference.ui.bindSwitchPreference(options.preference.key, input, checked);
  }
  const row = createLabField(labelText, input);
  row.classList.add('lab-switch');
  return { row, input };
};

export const createLabJson = (initialText = '尚未加载'): HTMLPreElement => {
  const element = document.createElement('pre');
  element.className = 'lab-json';
  element.textContent = initialText;
  return element;
};

export const createLabStatus = (initialText: string): HTMLDivElement => {
  const element = document.createElement('div');
  element.className = 'lab-inline-status';
  element.textContent = initialText;
  return element;
};
