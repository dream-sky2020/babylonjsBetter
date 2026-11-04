import { controlSetting, type SettingDefinition, type SettingValue } from '@/labs/kit/settings/LabSettingsStore';
import type { LabSharedData, LabSharedDataDefinition } from '@/labs/kit/shared-memory/LabMemory';
import { createLabField, createLabStatus, createLabSwitch, type LabContext } from '@/labs/kit';

/** Small control builders; each owning module supplies its controls and bindings. */
export function createMonsterPanel(context: LabContext, id: string, title: string) {
  const panel = context.ui.addPanel(id, title);
  const status = createLabStatus(''); panel.content.append(status);
  const append = (...elements: HTMLElement[]) => status.before(...elements);
  const run = async (work: () => unknown | Promise<unknown>) => {
    status.dataset.error = 'false'; status.textContent = '';
    try { await work(); }
    catch (error) { status.textContent = error instanceof Error ? error.message : String(error); status.dataset.error = 'true'; }
  };
  const identities = new WeakMap<HTMLInputElement | HTMLSelectElement, { label: string; id: string }>();
  const field = (input: HTMLInputElement | HTMLSelectElement, label: string, id: string) => {
    identities.set(input, { label, id }); input.dataset.monsterControl = id;
  };
  const select = (label: string, id: string) => {
    const input = document.createElement('select'); field(input, label, id); append(createLabField(label, input)); return input;
  };
  const number = (label: string, id: string, min: number, max: number, step: number) => {
    const input = document.createElement('input'); input.type = 'number'; input.min = String(min); input.max = String(max); input.step = String(step);
    field(input, label, id); append(createLabField(label, input)); return input;
  };
  const toggle = (label: string, id: string) => {
    const control = createLabSwitch(label); field(control.input, label, id); append(control.row); return control.input;
  };
  const button = (label: string, id: string, work: () => unknown | Promise<unknown>) => {
    const input = document.createElement('button'); input.type = 'button'; input.textContent = label; input.dataset.monsterAction = id;
    input.addEventListener('click', () => void run(work)); append(input); return input;
  };
  const color = (label: string, id: string) => {
    const input = document.createElement('input'); input.type = 'color';
    field(input, label, id); append(createLabField(label, input)); return input;
  };
  const setting = (input: HTMLInputElement | HTMLSelectElement, options?: Parameters<typeof controlSetting>[3]) => {
    const identity = identities.get(input);
    if (!identity) throw new Error('只能登记模块显式声明的控件');
    return controlSetting(identity.id, identity.label, input, options);
  };
  const remember = (definitions: readonly SettingDefinition[], apply: () => void) => context.ui.registerSettings(id, definitions, apply);
  const rememberState = <T extends object>(memory: LabSharedData<T>, schema: LabSharedDataDefinition<T>,
    entries: readonly (readonly [HTMLInputElement | HTMLSelectElement, keyof T])[], ready: () => boolean, apply: () => void) => (
    remember(entries.map(([input, key]) => {
      const base = setting(input);
      return { ...base,
        read: () => ready() ? base.read() : (memory.current[key] ?? '') as SettingValue,
        write: value => {
          const select = input.tagName === 'SELECT' ? input as HTMLSelectElement : null;
          const next = select && value === '' && ![...select.options].some(option => option.value === '')
            ? select.options[0]?.value ?? value : value;
          memory.replace({ ...memory.current, [key]: next });
        },
        valid: value => (input.tagName === 'SELECT' && !(input as HTMLSelectElement).options.length
          ? typeof value === 'string' && value.length <= 256 : base.valid(value))
          && schema.type.validate({ ...memory.current, [key]: value }),
      };
    }), apply)
  );
  return { ...panel, status, append, run, select, number, toggle, button, color, setting, remember, rememberState };
}
export function fillMonsterSelect(input: HTMLSelectElement, entries: Array<[string, string]>, selected: string) {
  input.replaceChildren(...entries.map(([key, label]) => { const option = document.createElement('option'); option.value = key; option.textContent = label; return option; }));
  input.value = entries.some(([key]) => key === selected) ? selected : entries[0]?.[0] ?? '';
}
