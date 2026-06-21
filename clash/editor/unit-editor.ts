import type { UnitConfig, SkillData, StatusConfig } from '../types.ts';

function queryInShadow<T extends Element>(root: ShadowRoot, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element as T;
}

class UnitEditor extends HTMLElement implements UnitInputElement {
  private unitId: string = '';
  private skills: SkillData[] = [];
  private activeSkillId: string | undefined;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.render();
    this.bindEvents();
  }

  connectedCallback(): void {
    // 构造函数中已经完成了初始化
  }

  setUnitId(id: string): void {
    this.unitId = id;
    const root = this.shadowRoot;
    if (root) {
      queryInShadow<HTMLHeadingElement>(root, 'h3').textContent = `单位 ${id}`;
    }
  }

  getUnitId(): string {
    return this.unitId;
  }

  private render(): void {
    const root = this.shadowRoot;
    if (!root) return;

    root.innerHTML = `
      <style>
        :host {
          display: block;
          background: white;
          padding: 15px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          margin-bottom: 15px;
          border: 2px solid transparent;
        }
        :host(.selected) {
          border-color: #28a745;
          background: #f8fff9;
        }
        .input-group { margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 14px; }
        input { width: 60px; padding: 4px; border: 1px solid #ccc; border-radius: 4px; }
        .section-title { margin: 12px 0 8px; font-weight: 600; color: #333; border-bottom: 1px solid #eee; padding-bottom: 4px; font-size: 14px; }
        .list-container { display: flex; flex-direction: column; gap: 6px; }
        button { 
          width: 100%; 
          padding: 8px; 
          margin-top: 8px; 
          cursor: pointer; 
          border: none; 
          border-radius: 4px; 
          font-size: 12px;
          transition: background 0.2s;
        }
        .add-btn { background: #f0f0f0; color: #333; border: 1px dashed #ccc; }
        .add-btn:hover { background: #e0e0e0; }
      </style>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 style="margin: 0;">单位</h3>
        <button id="remove-unit" style="width: auto; margin: 0; background: #dc3545; padding: 4px 8px;">删除单位</button>
      </div>
      <div class="input-group">名称: <input type="text" class="unit-name" style="width: 100px;" value="新单位"></div>
      <div class="input-group">血量: <input type="number" class="hp" value="100"></div>
      <div class="input-group">最大血量: <input type="number" class="maxHp" value="100"></div>
      <div class="input-group">护盾: <input type="number" class="shield" value="0"></div>
      <div class="input-group">临时护盾: <input type="number" class="tempShield" value="0"></div>
      <div class="input-group">理智: <input type="number" class="sanity" value="45"></div>
      <div class="input-group">最大理智: <input type="number" class="maxSanity" value="45"></div>
      <div class="input-group">混乱值: <input type="number" class="chaos" value="0"></div>
      <div class="input-group">混乱阈值: <input type="number" class="chaosThreshold" value="100"></div>
      
      <div class="section-title">特殊状态</div>
      <div class="list-container" id="status-list"></div>
      <button class="add-btn" id="add-status">+ 添加特殊状态</button>
    `;
  }

  private bindEvents(): void {
    const root = this.shadowRoot;
    if (!root) return;

    queryInShadow(root, '#add-status').addEventListener('click', () => {
      const status = document.createElement('status-input') as StatusInputElement;
      queryInShadow(root, '#status-list').appendChild(status);
    });

    queryInShadow(root, '#remove-unit').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('remove-unit', { detail: { unitId: this.unitId } }));
    });
  }

  setValues(data: Partial<UnitConfig>): void {
    const root = this.shadowRoot;
    if (!root) return;

    if (data.id) this.unitId = data.id;
    if (data.skills) this.skills = data.skills;
    if (typeof data.activeSkillId !== 'undefined') this.activeSkillId = data.activeSkillId;
    if (data.name) queryInShadow<HTMLInputElement>(root, '.unit-name').value = data.name;
    if (typeof data.hp !== 'undefined') queryInShadow<HTMLInputElement>(root, '.hp').value = String(data.hp);
    if (typeof data.maxHp !== 'undefined') queryInShadow<HTMLInputElement>(root, '.maxHp').value = String(data.maxHp);
    if (typeof data.shield !== 'undefined') queryInShadow<HTMLInputElement>(root, '.shield').value = String(data.shield);
    if (typeof data.tempShield !== 'undefined') queryInShadow<HTMLInputElement>(root, '.tempShield').value = String(data.tempShield);
    if (typeof data.sanity !== 'undefined') queryInShadow<HTMLInputElement>(root, '.sanity').value = String(data.sanity);
    if (typeof data.maxSanity !== 'undefined') queryInShadow<HTMLInputElement>(root, '.maxSanity').value = String(data.maxSanity);
    if (typeof data.chaos !== 'undefined') queryInShadow<HTMLInputElement>(root, '.chaos').value = String(data.chaos);
    if (typeof data.chaosThreshold !== 'undefined') queryInShadow<HTMLInputElement>(root, '.chaosThreshold').value = String(data.chaosThreshold);

    if (data.status) {
      const statusList = queryInShadow(root, '#status-list');
      statusList.innerHTML = '';
      data.status.forEach(s => {
        const el = document.createElement('status-input') as StatusInputElement;
        statusList.appendChild(el);
        customElements.whenDefined('status-input').then(() => el.setValues(s));
      });
    }

    if (data.id) {
      queryInShadow<HTMLHeadingElement>(root, 'h3').textContent = `单位 ${data.id}`;
    }
  }

  getData(): UnitConfig {
    const root = this.shadowRoot;
    if (!root) throw new Error('Shadow root not found');

    const status = Array.from(root.querySelectorAll('status-input')).map(el => (el as StatusInputElement).getData());

    const hp = Number(queryInShadow<HTMLInputElement>(root, '.hp').value);
    const maxHp = Number(queryInShadow<HTMLInputElement>(root, '.maxHp').value);
    const safeMaxHp = Number.isFinite(maxHp) && maxHp > 0 ? maxHp : Math.max(1, hp || 1);
    const safeHp = Math.min(Math.max(0, hp), safeMaxHp);
    const sanity = Number(queryInShadow<HTMLInputElement>(root, '.sanity').value);
    const maxSanity = Number(queryInShadow<HTMLInputElement>(root, '.maxSanity').value);
    const safeMaxSanity = Number.isFinite(maxSanity) && maxSanity >= 0 ? maxSanity : Math.max(0, sanity || 0);
    const safeSanity = Math.min(Math.max(0, sanity), safeMaxSanity);

    return {
      id: this.unitId,
      name: queryInShadow<HTMLInputElement>(root, '.unit-name').value,
      hp: safeHp,
      maxHp: safeMaxHp,
      shield: Number(queryInShadow<HTMLInputElement>(root, '.shield').value),
      tempShield: Number(queryInShadow<HTMLInputElement>(root, '.tempShield').value),
      sanity: safeSanity,
      maxSanity: safeMaxSanity,
      chaos: Number(queryInShadow<HTMLInputElement>(root, '.chaos').value),
      chaosThreshold: Number(queryInShadow<HTMLInputElement>(root, '.chaosThreshold').value),
      status,
      skills: this.skills,
      activeSkillId: this.activeSkillId
    };
  }
}

customElements.define('unit-input', UnitEditor);
