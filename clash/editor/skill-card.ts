import type { SkillData } from '../types.ts';

export class SkillCard extends HTMLElement {
    private _data: Partial<SkillData> = {};

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
    }

    setData(data: Partial<SkillData>) {
        this._data = data;
        this.render();
    }

    private render() {
        const root = this.shadowRoot;
        if (!root) return;

        root.innerHTML = `
      <style>
        :host {
          display: block;
          background: white;
          border-radius: 8px;
          padding: 10px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          cursor: pointer;
          transition: transform 0.2s, border-color 0.2s;
          border: 2px solid transparent;
          user-select: none;
        }
        :host(:hover) {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        :host(.selected) {
          border-color: #007bff;
          background: #e9f5ff;
        }
        .name { font-weight: bold; font-size: 14px; margin-bottom: 5px; color: #333; }
        .info { font-size: 12px; color: #666; }
      </style>
      <div class="name">${this._data.skillName || '新技能'}</div>
      <div class="info">标签: ${(this._data.tags || []).join(', ') || '无'}</div>
      <div class="info">硬币数: ${(this._data.dice || []).length}枚</div>
    `;
    }
}

customElements.define('skill-card', SkillCard);