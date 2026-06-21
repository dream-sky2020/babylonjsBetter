import type { UnitConfig } from '../types.ts';

class UnitCard extends HTMLElement {
  private _data: Partial<UnitConfig> = {};

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  setData(data: Partial<UnitConfig>) {
    this._data = data;
    this.render();
  }

  private render() {
    const root = this.shadowRoot;
    if (!root) return;

    const maxHp = this._data.maxHp || this._data.hp || 1;
    const hpPercent = Math.min(100, Math.max(0, ((this._data.hp || 0) / maxHp) * 100));
    const skills = this._data.skills || [];
    const activeSkillId = this._data.activeSkillId || skills[0]?.skillId;
    const activeSkillName = skills.find((skill) => skill.skillId === activeSkillId)?.skillName || '未选择';

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
          border-color: #28a745;
          background: #f0fff4;
        }
        .name { font-weight: bold; font-size: 14px; margin-bottom: 5px; color: #333; }
        .stats { font-size: 12px; color: #666; display: flex; gap: 10px; }
        .hp-bar-bg {
          width: 100%;
          height: 4px;
          background: #eee;
          border-radius: 2px;
          margin-top: 8px;
          overflow: hidden;
        }
        .hp-bar-fill {
          height: 100%;
          background: #28a745;
          width: ${hpPercent}%;
        }
        .shield-info { color: #007bff; font-weight: bold; }
        .skill-meta { margin-top: 6px; font-size: 12px; color: #555; display: flex; flex-direction: column; gap: 2px; }
        .active-skill { color: #6f42c1; font-weight: 600; }
      </style>
      <div class="name">${this._data.name || '未知单位'} (${this._data.id || '?'})</div>
      <div class="stats">
        <span>HP: ${this._data.hp || 0}/${maxHp}</span>
        <span class="shield-info">SHD: ${this._data.shield || 0}</span>
        <span>SAN: ${this._data.sanity || 0}/${this._data.maxSanity ?? this._data.sanity ?? 0}</span>
      </div>
      <div class="skill-meta">
        <span>技能数: ${skills.length}</span>
        <span class="active-skill">当前出战: ${activeSkillName}</span>
      </div>
      <div class="hp-bar-bg">
        <div class="hp-bar-fill"></div>
      </div>
    `;
  }
}

customElements.define('unit-card', UnitCard);
