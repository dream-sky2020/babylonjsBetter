import { DICE_EFFECTS, STATUS_TYPES } from './dice-effect-config.ts';

type DiceEffectInputData =
  | { type: string; value: number }
  | { type: string; statusId: string; power: number; stack: number };

function queryInShadow<T extends Element>(root: ShadowRoot, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element as T;
}

class EffectInput extends HTMLElement implements EffectInputElement {
  connectedCallback(): void {
    this.attachShadow({ mode: 'open' });
    this.render();
  }

  private render(): void {
    const root = this.shadowRoot;
    if (!root) return;

    root.innerHTML = `
      <style>
        .effect-row {
          display: flex;
          gap: 5px;
          margin: 4px 0;
          align-items: center;
          font-size: 12px;
          flex-wrap: wrap;
        }
        select, input {
          padding: 4px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        .hidden {
          display: none !important;
        }
      </style>
      <div class="effect-row">
        <select class="type-select">
          ${DICE_EFFECTS.map((effect) => `<option value="${effect.value}" data-type="${effect.type}">${effect.label}</option>`).join('')}
        </select>

        <select class="status-select hidden">
          ${STATUS_TYPES.map((status) => `<option value="${status.id}">${status.label}</option>`).join('')}
        </select>
        <input type="number" class="power-input hidden" placeholder="强度" style="width:50px">
        <input type="number" class="stack-input hidden" placeholder="层数" style="width:50px">
        <input type="number" class="val-input" placeholder="数值" style="width:50px">
        <button class="del-btn">×</button>
      </div>
    `;

    queryInShadow<HTMLButtonElement>(root, '.del-btn').onclick = () => this.remove();
    queryInShadow<HTMLSelectElement>(root, '.type-select').addEventListener('change', () => this.updateUI());
    this.updateUI();
  }

  private updateUI(): void {
    const root = this.shadowRoot;
    if (!root) return;

    const typeSelect = queryInShadow<HTMLSelectElement>(root, '.type-select');
    const selectedOption = typeSelect.options[typeSelect.selectedIndex];
    const effectType = selectedOption.dataset.type;

    const statusSelect = queryInShadow<HTMLSelectElement>(root, '.status-select');
    const powerInput = queryInShadow<HTMLInputElement>(root, '.power-input');
    const stackInput = queryInShadow<HTMLInputElement>(root, '.stack-input');
    const valInput = queryInShadow<HTMLInputElement>(root, '.val-input');

    if (effectType === 'status') {
      statusSelect.classList.remove('hidden');
      powerInput.classList.remove('hidden');
      stackInput.classList.remove('hidden');
      valInput.classList.add('hidden');
    } else {
      statusSelect.classList.add('hidden');
      powerInput.classList.add('hidden');
      stackInput.classList.add('hidden');
      valInput.classList.remove('hidden');
    }
  }

  setValues(data: unknown): void {
    const root = this.shadowRoot;
    if (!root || !data || typeof data !== 'object') return;
    const typed = data as Record<string, unknown>;

    const typeSelect = queryInShadow<HTMLSelectElement>(root, '.type-select');
    typeSelect.value = typeof typed.type === 'string' ? typed.type : DICE_EFFECTS[0].value;
    this.updateUI();

    const effectType = typeSelect.options[typeSelect.selectedIndex].dataset.type;
    if (effectType === 'status') {
      queryInShadow<HTMLSelectElement>(root, '.status-select').value =
        typeof typed.statusId === 'string' ? typed.statusId : STATUS_TYPES[0].id;
      queryInShadow<HTMLInputElement>(root, '.power-input').value = String(typed.power ?? '');
      queryInShadow<HTMLInputElement>(root, '.stack-input').value = String(typed.stack ?? '');
    } else {
      queryInShadow<HTMLInputElement>(root, '.val-input').value = String(typed.value ?? '');
    }
  }

  getData(): DiceEffectInputData {
    const root = this.shadowRoot;
    if (!root) {
      return { type: 'dmg', value: 0 };
    }

    const typeSelect = queryInShadow<HTMLSelectElement>(root, '.type-select');
    const selectedOption = typeSelect.options[typeSelect.selectedIndex];
    const effectType = selectedOption.dataset.type;
    const baseType = typeSelect.value;

    if (effectType === 'status') {
      return {
        type: baseType,
        statusId: queryInShadow<HTMLSelectElement>(root, '.status-select').value,
        power: Number.parseInt(queryInShadow<HTMLInputElement>(root, '.power-input').value, 10) || 0,
        stack: Number.parseInt(queryInShadow<HTMLInputElement>(root, '.stack-input').value, 10) || 0,
      };
    }

    return {
      type: baseType,
      value: Number.parseInt(queryInShadow<HTMLInputElement>(root, '.val-input').value, 10) || 0,
    };
  }
}

if (!customElements.get('effect-input')) {
  customElements.define('effect-input', EffectInput);
}
