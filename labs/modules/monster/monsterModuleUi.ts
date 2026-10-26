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
  const select = (label: string, id: string) => {
    const input = document.createElement('select'); input.dataset.monsterControl = id; append(createLabField(label, input)); return input;
  };
  const number = (label: string, id: string, min: number, max: number, step: number) => {
    const input = document.createElement('input'); input.type = 'number'; input.min = String(min); input.max = String(max); input.step = String(step);
    input.dataset.monsterControl = id; append(createLabField(label, input)); return input;
  };
  const toggle = (label: string, id: string) => {
    const control = createLabSwitch(label); control.input.dataset.monsterControl = id; append(control.row); return control.input;
  };
  const button = (label: string, id: string, work: () => unknown | Promise<unknown>) => {
    const input = document.createElement('button'); input.type = 'button'; input.textContent = label; input.dataset.monsterAction = id;
    input.addEventListener('click', () => void run(work)); append(input); return input;
  };
  return { ...panel, status, append, run, select, number, toggle, button };
}
export function fillMonsterSelect(input: HTMLSelectElement, entries: Array<[string, string]>, selected: string) {
  input.replaceChildren(...entries.map(([key, label]) => { const option = document.createElement('option'); option.value = key; option.textContent = label; return option; }));
  input.value = entries.some(([key]) => key === selected) ? selected : entries[0]?.[0] ?? '';
}
