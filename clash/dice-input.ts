import { DICE_TAGS } from './dice-tag-config.ts';
import type { DiceConfig } from './types.ts';
import './dice-input-effect-input.ts';

function queryInShadow<T extends Element>(root: ShadowRoot, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element as T;
}

class DiceInput extends HTMLElement implements DiceInputElement {
  private selectedTags: string[] = [];

  connectedCallback(): void {
    this.attachShadow({ mode: 'open' });
    this.render();
    this.renderTags();
    this.bindEvents();
  }

  private render(): void {
    const root = this.shadowRoot;
    if (!root) return;

    root.innerHTML = `
      <style>
        .die-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 5px;
          border: 1px solid #ccc;
          flex-wrap: wrap;
        }
        .tags-container {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          justify-content: flex-start;
        }
        .tag-pill {
          background: #e0e0e0;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
          display: flex;
          align-items: center;
        }
        .remove-tag {
          margin-left: 4px;
          cursor: pointer;
          color: red;
        }
        #modal {
          position: absolute;
          z-index: 10;
          background: white;
          border: 1px solid #999;
          padding: 10px;
          display: none;
          text-align: left;
        }
        #effect-list {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 5px;
          justify-items: start;
        }
      </style>

      <div class="die-item">
        <div class="tags-container" id="display"></div>
        <button id="editBtn">设置标签</button>
        <input type="number" class="min" placeholder="最小" style="width:50px">
        <input type="number" class="max" placeholder="最大" style="width:50px">
        <div id="effect-list"></div>
        <button id="addEffectBtn" style="width: auto; white-space: nowrap; min-width: max-content;">+ 添加效果</button>
        <button class="remove">删除行</button>
      </div>

      <div id="modal">
        <div class="grid" id="grid"></div>
        <button id="confirmBtn" style="margin-top:10px">确认</button>
      </div>
    `;
  }

  private bindEvents(): void {
    const root = this.shadowRoot;
    if (!root) return;

    queryInShadow<HTMLButtonElement>(root, '#editBtn').addEventListener('click', () => this.toggleModal(true));
    queryInShadow<HTMLButtonElement>(root, '#confirmBtn').addEventListener('click', () => this.handleConfirm());
    queryInShadow<HTMLButtonElement>(root, '.remove').addEventListener('click', () => this.remove());
    queryInShadow<HTMLButtonElement>(root, '#addEffectBtn').addEventListener('click', () => {
      const effectElement = document.createElement('effect-input');
      queryInShadow<HTMLDivElement>(root, '#effect-list').appendChild(effectElement);
    });
  }

  private toggleModal(show: boolean): void {
    const root = this.shadowRoot;
    if (!root) return;
    const modal = queryInShadow<HTMLDivElement>(root, '#modal');
    modal.style.display = show ? 'block' : 'none';
    if (show) this.renderGrid();
  }

  private renderGrid(): void {
    const root = this.shadowRoot;
    if (!root) return;

    const grid = queryInShadow<HTMLDivElement>(root, '#grid');
    grid.innerHTML = '';
    DICE_TAGS.forEach((tag) => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" value="${tag.value}" ${this.selectedTags.includes(tag.value) ? 'checked' : ''}> ${tag.label}`;
      grid.appendChild(label);
    });
  }

  private renderTags(): void {
    const root = this.shadowRoot;
    if (!root) return;

    const container = queryInShadow<HTMLDivElement>(root, '#display');
    container.innerHTML = '';
    this.selectedTags.forEach((tagValue) => {
      const tagData = DICE_TAGS.find((item) => item.value === tagValue);
      if (!tagData) return;

      const span = document.createElement('span');
      span.className = 'tag-pill';
      span.innerHTML = `${tagData.label} <span class="remove-tag" data-val="${tagValue}">×</span>`;
      const removeButton = span.querySelector('.remove-tag') as HTMLSpanElement | null;
      if (removeButton) {
        removeButton.onclick = () => {
          this.selectedTags = this.selectedTags.filter((item) => item !== tagValue);
          this.renderTags();
        };
      }
      container.appendChild(span);
    });
  }

  private handleConfirm(): void {
    const root = this.shadowRoot;
    if (!root) return;

    const checkboxes = root.querySelectorAll<HTMLInputElement>('#grid input:checked');
    this.selectedTags = Array.from(checkboxes).map((checkbox) => checkbox.value);
    this.renderTags();
    this.toggleModal(false);
  }

  setValues(data: Partial<DiceConfig>): void {
    const root = this.shadowRoot;
    if (!root) return;

    this.selectedTags = Array.isArray(data.tags) ? data.tags : [];
    this.renderTags();

    queryInShadow<HTMLInputElement>(root, '.min').value = String(data.min ?? 0);
    queryInShadow<HTMLInputElement>(root, '.max').value = String(data.max ?? 0);

    const effectList = queryInShadow<HTMLDivElement>(root, '#effect-list');
    effectList.innerHTML = '';
    (data.effects ?? []).forEach((effectData) => {
      const effectElement = document.createElement('effect-input') as EffectInputElement;
      effectList.appendChild(effectElement);
      effectElement.setValues(effectData);
    });
  }

  getData(): DiceConfig {
    const root = this.shadowRoot;
    if (!root) {
      return { tags: [], min: 0, max: 0, effects: [] };
    }

    const effectElements = root.querySelectorAll('effect-input');
    const effects = Array.from(effectElements).map((effectElement) => (effectElement as EffectInputElement).getData());

    return {
      tags: this.selectedTags,
      min: Number.parseInt(queryInShadow<HTMLInputElement>(root, '.min').value, 10) || 0,
      max: Number.parseInt(queryInShadow<HTMLInputElement>(root, '.max').value, 10) || 0,
      effects: effects as DiceConfig['effects'],
    };
  }
}

if (!customElements.get('dice-input')) {
  customElements.define('dice-input', DiceInput);
}
