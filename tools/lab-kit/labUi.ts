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
};

type PanelEntry = LabPanel & {
  id: string;
  title: string;
  collapseButton: HTMLButtonElement;
  defaultCollapsed: boolean;
};

const createDefaultPreferences = (): LabUiPreferences => ({ version: 1, panels: {} });

export class LabUi {
  private readonly panels = new Map<string, PanelEntry>();
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
    collapseButton.textContent = '−';
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
    collapseButton.addEventListener('click', () => this.setPanelCollapsed(entry, !root.classList.contains('is-collapsed'), true));
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

  private setPanelCollapsed(entry: PanelEntry, collapsed: boolean, persist: boolean): void {
    entry.root.classList.toggle('is-collapsed', collapsed);
    entry.content.hidden = collapsed;
    entry.collapseButton.textContent = collapsed ? '+' : '−';
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
    this.preferences = createDefaultPreferences();
    try { localStorage.removeItem(this.storageKey); } catch { /* 浏览器可能禁止本地存储。 */ }
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
      Object.entries(parsed.panels).forEach(([id, value]) => {
        if (value && typeof value === 'object' && 'collapsed' in value && typeof value.collapsed === 'boolean') {
          panels[id] = { collapsed: value.collapsed };
        }
      });
      return { version: 1, panels };
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
): { row: HTMLLabelElement; input: HTMLInputElement } => {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
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
