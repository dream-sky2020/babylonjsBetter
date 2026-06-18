import { SKILL_EFFECTS, STATUS_TYPES, TRIGGER_TIMINGS } from './skill-effect-config.ts';
import type { SkillEffectConfig } from './types.ts';

function queryInShadow<T extends Element>(root: ShadowRoot, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element as T;
}

class SkillEffectInput extends HTMLElement implements SkillEffectInputElement {
  connectedCallback(): void {
    this.attachShadow({ mode: 'open' });
    this.render();
  }

  private render(): void {
    const root = this.shadowRoot;
    if (!root) return;

    root.innerHTML = `
      <style>
        .effect-row { display: flex; gap: 6px; margin: 5px 0; align-items: center; padding: 5px; border-bottom: 1px solid #eee; }
        select, input { padding: 4px; border: 1px solid #ccc; border-radius: 4px; }
        .hidden { display: none !important; }
      </style>
      <div class="effect-row">
        <select class="timing-select">
          ${TRIGGER_TIMINGS.map((timing) => `<option value="${timing.value}">${timing.label}</option>`).join('')}
        </select>
        <select class="type-select">
          ${SKILL_EFFECTS.map((effect) => `<option value="${effect.value}">${effect.label}</option>`).join('')}
        </select>

        <input type="number" class="val-input" placeholder="数值" style="width:60px">
        <select class="status-select hidden">
          ${STATUS_TYPES.map((status) => `<option value="${status.id}">${status.label}</option>`).join('')}
        </select>
        <input type="number" class="power-input hidden" placeholder="强度" style="width:50px">
        <input type="number" class="stack-input hidden" placeholder="层数" style="width:50px">

        <button class="del-btn">×</button>
      </div>
    `;

    queryInShadow<HTMLSelectElement>(root, '.type-select').addEventListener('change', () => this.updateFields());
    queryInShadow<HTMLButtonElement>(root, '.del-btn').onclick = () => this.remove();
    this.updateFields();
  }

  private updateFields(): void {
    const root = this.shadowRoot;
    if (!root) return;

    const type = queryInShadow<HTMLSelectElement>(root, '.type-select').value;
    const valInput = queryInShadow<HTMLInputElement>(root, '.val-input');
    const statusSelect = queryInShadow<HTMLSelectElement>(root, '.status-select');
    const powerInput = queryInShadow<HTMLInputElement>(root, '.power-input');
    const stackInput = queryInShadow<HTMLInputElement>(root, '.stack-input');

    [valInput, statusSelect, powerInput, stackInput].forEach((element) => element.classList.add('hidden'));

    if (type === 'applyStatus') {
      statusSelect.classList.remove('hidden');
      powerInput.classList.remove('hidden');
      stackInput.classList.remove('hidden');
    } else {
      valInput.classList.remove('hidden');
    }
  }

  getData(): SkillEffectConfig {
    const root = this.shadowRoot;
    if (!root) {
      return { timing: 'onHit', type: 'dmg', value: 0 };
    }

    const type = queryInShadow<HTMLSelectElement>(root, '.type-select').value;
    const base: SkillEffectConfig = {
      timing: queryInShadow<HTMLSelectElement>(root, '.timing-select').value,
      type,
    };

    if (type === 'applyStatus') {
      return {
        ...base,
        statusId: queryInShadow<HTMLSelectElement>(root, '.status-select').value,
        power: Number.parseInt(queryInShadow<HTMLInputElement>(root, '.power-input').value, 10) || 0,
        stack: Number.parseInt(queryInShadow<HTMLInputElement>(root, '.stack-input').value, 10) || 0,
      };
    }

    return {
      ...base,
      value: Number.parseInt(queryInShadow<HTMLInputElement>(root, '.val-input').value, 10) || 0,
    };
  }

  setValues(data: Partial<SkillEffectConfig>): void {
    const root = this.shadowRoot;
    if (!root || !data) return;

    if (data.timing) {
      queryInShadow<HTMLSelectElement>(root, '.timing-select').value = data.timing;
    }
    if (data.type) {
      queryInShadow<HTMLSelectElement>(root, '.type-select').value = data.type;
      this.updateFields();
    }

    if (data.type === 'applyStatus') {
      if (data.statusId) queryInShadow<HTMLSelectElement>(root, '.status-select').value = data.statusId;
      if (typeof data.power !== 'undefined') queryInShadow<HTMLInputElement>(root, '.power-input').value = String(data.power);
      if (typeof data.stack !== 'undefined') queryInShadow<HTMLInputElement>(root, '.stack-input').value = String(data.stack);
    } else if (typeof data.value !== 'undefined') {
      queryInShadow<HTMLInputElement>(root, '.val-input').value = String(data.value);
    }
  }
}

if (!customElements.get('skill-effect-input')) {
  customElements.define('skill-effect-input', SkillEffectInput);
}
