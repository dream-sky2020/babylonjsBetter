import { openCommandMenuAtPoint, openCommandMenuFromElement, type CommandMenuEntry, type CommandMenuHandle } from '@/core/ui/menu';
import { LabSettingsStore, type SettingDefinition, type SettingValue, type RememberedSetting } from './LabSettingsStore';

export class LabPanelSettings {
  private defaults: SettingValue[];
  private initialized = false;
  private readonly cleanup: (() => void)[] = [];
  private readonly trigger = document.createElement('button');
  private readonly popup = document.createElement('div');
  private readonly checks: HTMLInputElement[] = [];
  private undoRecords: (RememberedSetting | undefined)[] | null = null;
  private readonly undoButton = document.createElement('button');
  private readonly count = document.createElement('small');
  private disposed = false;
  private menuHandle?: CommandMenuHandle;
  private releaseInput?: () => void;
  private lockInput: () => () => void;
  private panelId: string;
  private definitions: readonly SettingDefinition[];
  private store: LabSettingsStore;
  private apply: () => void;
  constructor(panelId: string, root: HTMLElement, definitions: readonly SettingDefinition[],
    store: LabSettingsStore, apply: () => void, legacy: Record<string, boolean> = {}, lockInput: () => () => void = () => () => {}) {
    this.panelId = panelId; this.definitions = definitions; this.store = store; this.apply = apply;
    this.lockInput = lockInput;
    if (new Set(definitions.map(item => item.key)).size !== definitions.length
      || definitions.some(item => !item.key.trim())) throw new Error(`面板 ${panelId} 的设置标识重复或为空`);
    this.defaults = definitions.map(item => structuredClone(item.read()));
    this.trigger.type = 'button'; this.trigger.className = 'lab-settings-trigger'; this.trigger.textContent = '⋯';
    this.trigger.title = '记住设置'; this.trigger.setAttribute('aria-label', '记住设置');
    this.trigger.setAttribute('aria-haspopup', 'menu');
    const header = root.querySelector<HTMLElement>('.lab-card-header')!;
    header.append(this.count, this.trigger);
    this.popup.className = 'lab-settings-popup'; this.popup.popover = 'auto';
    this.popup.setAttribute('role', 'dialog'); this.popup.setAttribute('aria-label', '管理需要记住的设置');
    const heading = document.createElement('div'); heading.className = 'lab-settings-heading';
    const title = document.createElement('strong'); title.textContent = '刷新后记住哪些设置';
    const close = document.createElement('button'); close.type = 'button'; close.textContent = '关闭';
    close.addEventListener('click', () => this.popup.hidePopover()); heading.append(title, close);
    const help = document.createElement('p'); help.textContent = '仅保存在本机当前页面，不写入地图或预设。关闭记住不会改变当前值。';
    const toolbar = document.createElement('div'); toolbar.className = 'lab-settings-actions';
    for (const [label, action] of [
      ['全部记住', () => this.setAll(true)], ['全部不记住', () => this.setAll(false)],
      ['恢复推荐规则', () => this.setAll(null)],
    ] as const) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
      button.addEventListener('click', action); toolbar.append(button);
    }
    this.undoButton.type = 'button'; this.undoButton.textContent = '撤销保存规则修改';
    this.undoButton.addEventListener('click', () => this.undo()); toolbar.append(this.undoButton);
    const search = document.createElement('input'); search.type = 'search'; search.placeholder = '搜索设置…';
    search.className = 'lab-settings-search'; search.setAttribute('aria-label', '搜索设置');
    search.addEventListener('input', () => {
      const query = search.value.trim().toLocaleLowerCase();
      [...list.children].forEach((row, index) => { (row as HTMLElement).hidden = !definitions[index].label.toLocaleLowerCase().includes(query); });
    });
    this.popup.append(heading, help, toolbar, search);
    const list = document.createElement('div'); list.className = 'lab-settings-list';
    definitions.forEach((item, index) => {
      if (item.legacyKey && this.store.get(this.id(item)) === undefined && typeof legacy[item.legacyKey] === 'boolean') {
        this.store.put(this.id(item), { remember: true, value: legacy[item.legacyKey] });
        this.store.flush();
      }
      const row = document.createElement('label'), check = document.createElement('input'), text = document.createElement('span');
      check.type = 'checkbox'; check.dataset.rememberSetting = item.key; text.textContent = item.label;
      check.addEventListener('change', () => this.setRemember(index, check.checked));
      row.append(check, text); list.append(row); this.checks.push(check);
      const onEdit = () => {
        if (this.remembered(index)) { this.capture(index); this.store.flush(); }
        this.refresh();
      };
      const rows = new Set<HTMLElement>();
      for (const element of item.elements) {
        element.dataset.labSetting = item.key;
        element.addEventListener('input', onEdit); element.addEventListener('change', onEdit);
        rows.add(element.closest<HTMLElement>('label') ?? element);
        this.cleanup.push(() => { element.removeEventListener('input', onEdit); element.removeEventListener('change', onEdit); delete element.dataset.labSetting; delete element.dataset.settingRemembered; });
      }
      for (const element of rows) {
        const context = (event: MouseEvent) => {
          const target = event.target as HTMLElement;
          // Preserve native text editing, selection and clipboard menus inside controls.
          if (target.closest('input, select, textarea')) return;
          event.preventDefault(); event.stopPropagation();
          this.menuHandle = openCommandMenuAtPoint(event.clientX, event.clientY, this.itemMenu(index), item.label);
        };
        element.addEventListener('contextmenu', context); this.cleanup.push(() => element.removeEventListener('contextmenu', context));
      }
    });
    this.popup.append(list); root.append(this.popup);
    this.trigger.addEventListener('click', event => {
      event.stopPropagation(); this.menuHandle = openCommandMenuFromElement(this.trigger, this.menu(), { align: 'end', ariaLabel: '记住设置' });
    });
    const onHeaderContext = (event: MouseEvent) => {
      event.preventDefault(); event.stopPropagation();
      this.menuHandle = openCommandMenuAtPoint(event.clientX, event.clientY, this.menu(), '记住设置');
    };
    header.addEventListener('contextmenu', onHeaderContext);
    this.cleanup.push(() => header.removeEventListener('contextmenu', onHeaderContext));
    this.popup.addEventListener('toggle', () => {
      if (!this.popup.matches(':popover-open')) {
        this.releaseInput?.(); this.releaseInput = undefined;
        this.trigger.focus({ preventScroll: true });
      }
    });
    this.refresh();
  }
  private id(item: SettingDefinition): string { return `${this.panelId}/${item.key}`; }
  private remembered(index: number): boolean { return this.store.get(this.id(this.definitions[index]))?.remember ?? !!this.definitions[index].defaultRemember; }
  private capture(index: number): void {
    const item = this.definitions[index], value = item.read();
    if (this.remembered(index) && item.valid(value)) this.store.put(this.id(item), { remember: true, value });
  }
  captureValue(key: string): void {
    const index = this.definitions.findIndex(item => item.key === key);
    if (index < 0 || !this.remembered(index)) return;
    this.capture(index); this.store.flush(); this.refresh();
  }
  private snapshotUndo(): void { this.undoRecords = this.definitions.map(item => this.store.get(this.id(item))); }
  private changeRule(index: number, remember: boolean): void {
    const id = this.id(this.definitions[index]), previous = this.store.get(id);
    this.store.put(id, { remember, ...(remember && previous?.value !== undefined ? { value: previous.value } : {}) });
    if (remember) this.capture(index);
  }
  setRemember(index: number, remember: boolean): void {
    this.snapshotUndo(); this.changeRule(index, remember); this.store.flush(); this.refresh();
  }
  setAll(remember: boolean | null): void {
    this.snapshotUndo();
    this.definitions.forEach((item, index) => this.changeRule(index, remember ?? !!item.defaultRemember));
    this.store.flush(); this.refresh();
  }
  undo(): void {
    if (!this.undoRecords) return;
    this.undoRecords.forEach((record, index) => {
      const id = this.id(this.definitions[index]);
      if (record) this.store.put(id, record); else this.store.remove(id);
    });
    this.undoRecords = null; this.store.flush(); this.refresh();
  }
  restore(): void {
    if (!this.initialized) {
      this.defaults = this.definitions.map(item => structuredClone(item.read()));
      this.initialized = true;
    }
    let changed = false;
    this.definitions.forEach((item, index) => {
      const record = this.store.get(this.id(item));
      if (!this.remembered(index) || record?.value === undefined) return;
      if (!item.valid(record.value)) { this.store.put(this.id(item), { remember: true }); return; }
      item.write(structuredClone(record.value)); changed = true;
    });
    if (changed) this.apply();
    this.refresh();
  }
  private reset(index: number): void {
    this.definitions[index].write(structuredClone(this.defaults[index])); this.apply();
    this.definitions.forEach((_, i) => this.capture(i)); this.store.flush(); this.refresh();
  }
  private itemMenu(index: number): CommandMenuEntry[] {
    return [
      { id: 'remember-setting', label: '记住此设置', checked: this.remembered(index), action: () => this.setRemember(index, true) },
      { id: 'forget-setting', label: '不记住此设置', checked: !this.remembered(index), action: () => this.setRemember(index, false) },
      { type: 'separator' }, { id: 'reset-setting', label: '恢复此项默认值', icon: 'reset', action: () => this.reset(index) },
    ];
  }
  private menu(): CommandMenuEntry[] {
    return [
      { id: 'manage-settings', label: '管理需要记住的设置…', action: () => this.open() },
      { id: 'remember-all', label: '全部记住', action: () => this.setAll(true) },
      { id: 'forget-all', label: '全部不记住', action: () => this.setAll(false) },
      { id: 'recommended-settings', label: '恢复推荐保存规则', action: () => this.setAll(null) },
      { type: 'separator' }, { id: 'undo-settings', label: '撤销保存规则修改', disabled: !this.undoRecords, action: () => this.undo() },
    ];
  }
  open(): void {
    this.refresh(); this.popup.showPopover();
    this.releaseInput ??= this.lockInput();
    const rect = this.trigger.getBoundingClientRect(), bounds = this.popup.getBoundingClientRect();
    this.popup.style.left = `${Math.max(8, Math.min(rect.right - bounds.width, window.innerWidth - bounds.width - 8))}px`;
    this.popup.style.top = `${Math.max(8, Math.min(rect.bottom + 5, window.innerHeight - bounds.height - 8))}px`;
    this.checks[0]?.focus({ preventScroll: true });
  }
  private refresh(): void {
    this.checks.forEach((check, index) => { check.checked = this.remembered(index); });
    this.count.className = 'lab-settings-count';
    const rememberedCount = this.checks.filter(check => check.checked).length;
    this.count.textContent = `记住 ${rememberedCount}/${this.definitions.length}`;
    this.undoButton.disabled = !this.undoRecords;
    this.definitions.forEach((item, index) => item.elements.forEach(element => {
      element.dataset.settingRemembered = String(this.remembered(index));
    }));
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    this.menuHandle?.close();
    this.releaseInput?.(); this.releaseInput = undefined;
    this.cleanup.forEach(cleanup => cleanup()); this.trigger.remove(); this.popup.remove(); this.count.remove();
  }
}
