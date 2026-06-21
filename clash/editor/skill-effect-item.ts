import { SKILL_EFFECTS, STATUS_TYPES, TRIGGER_TIMINGS } from '../config.ts';
import type { SkillEffectConfig } from '../types.ts';

function queryInShadow<T extends Element>(root: ShadowRoot, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
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
        .container { display: flex; gap: 5px; align-items: center; margin: 4px 0; font-size: 14px; flex-wrap: wrap; }
        select, input { padding: 4px; border: 1px solid #ccc; border-radius: 4px; }
        button { padding: 4px 8px; cursor: pointer; background: #e74c3c; color: white; border: none; border-radius: 4px; }
        button:hover { background: #c0392b; }
        .hidden { display: none !important; }
      </style>
      <div class="container">
        <select class="timing-select">
          ${TRIGGER_TIMINGS.map((timing) => `<option value="${timing.value}">${timing.label}</option>`).join('')}
        </select>
        <select class="type-select">
          ${SKILL_EFFECTS.map((effect) => `<option value="${effect.value}">${effect.label}</option>`).join('')}
        </select>

        <span class="val-group hidden">数值</span>
        <input type="number" class="val-input val-group hidden" style="width:60px">
        
        <select class="status-select status-group hidden">
          ${STATUS_TYPES.map((status) => `<option value="${status.id}">${status.label}</option>`).join('')}
        </select>
        <span class="status-group hidden">强度</span>
        <input type="number" class="power-input status-group hidden" style="width:50px">
        <span class="status-group hidden">层数</span>
        <input type="number" class="stack-input status-group hidden" style="width:50px">

        <button class="del-btn">删</button>
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
    const valGroups = root.querySelectorAll('.val-group');
    const statusGroups = root.querySelectorAll('.status-group');

    valGroups.forEach(el => el.classList.add('hidden'));
    statusGroups.forEach(el => el.classList.add('hidden'));

    if (type === 'applyStatus') {
      statusGroups.forEach(el => el.classList.remove('hidden'));
    } else {
      valGroups.forEach(el => el.classList.remove('hidden'));
    }
  }

  getData(): SkillEffectConfig {
    const root = this.shadowRoot;
    if (!root) return { timing: 'onHit', type: 'dmg', value: 0 };

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

    if (data.timing) queryInShadow<HTMLSelectElement>(root, '.timing-select').value = data.timing;
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