import type { SkillData } from '../types.ts';

function queryInShadow<T extends Element>(root: ShadowRoot, selector: string): T {
    const element = root.querySelector(selector);
    if (!element) throw new Error(`Missing element: ${selector}`);
    return element as T;
}

export class SkillEditor extends HTMLElement {
    private skillId: string = '';

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.render();
        this.bindEvents();
    }

    setSkillId(id: string): void {
        this.skillId = id;
        const root = this.shadowRoot;
        if (root) {
            queryInShadow<HTMLHeadingElement>(root, 'h3').textContent = `技能: ${id}`;
        }
    }

    getSkillId(): string {
        return this.skillId;
    }

    private render(): void {
        const root = this.shadowRoot;
        if (!root) return;

        root.innerHTML = `
      <style>
        :host { display: block; background: white; padding: 15px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 15px; }
        .input-group { margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 14px; }
        input { padding: 4px; border: 1px solid #ccc; border-radius: 4px; flex: 1; margin-left: 10px; }
        .section-title { margin: 12px 0 8px; font-weight: 600; color: #333; border-bottom: 1px solid #eee; padding-bottom: 4px; font-size: 14px; }
        .list-container { display: flex; flex-direction: column; gap: 6px; }
        button { width: 100%; padding: 8px; margin-top: 8px; cursor: pointer; border: none; border-radius: 4px; font-size: 12px; transition: background 0.2s; }
        .add-btn { background: #f0f0f0; color: #333; border: 1px dashed #ccc; }
        .add-btn:hover { background: #e0e0e0; }
        .remove-btn { background: #dc3545; color: white; margin-top: 15px; }
      </style>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 style="margin: 0;">技能详情</h3>
        <button id="remove-skill" style="width: auto; margin: 0; background: #dc3545; color: white; padding: 4px 8px;">删除技能</button>
      </div>
      <div class="input-group">名称: <input type="text" class="skill-name" value="新技能"></div>
      <div class="input-group">标签(逗号分隔): <input type="text" class="skill-tags" value="active"></div>
      
      <div class="section-title">硬币面板 (骰子)</div>
      <div class="list-container" id="dice-list"></div>
      <button class="add-btn" id="add-dice">+ 添加硬币</button>

      <div class="section-title">全局技能效果</div>
      <div class="list-container" id="skill-effect-list"></div>
      <button class="add-btn" id="add-skill-effect">+ 添加技能效果</button>
    `;
    }

    private bindEvents(): void {
        const root = this.shadowRoot;
        if (!root) return;

        queryInShadow<HTMLButtonElement>(root, '#add-dice').addEventListener('click', () => {
            const diceList = queryInShadow<HTMLDivElement>(root, '#dice-list');
            const diceEl = document.createElement('dice-input') as any;
            diceList.appendChild(diceEl);
            diceEl.setValues({ min: 1, max: 6, effects: [] });
        });

        queryInShadow<HTMLButtonElement>(root, '#add-skill-effect').addEventListener('click', () => {
            const effectList = queryInShadow<HTMLDivElement>(root, '#skill-effect-list');
            const effectEl = document.createElement('skill-effect-input') as any;
            effectList.appendChild(effectEl);
            effectEl.setValues({ type: 'dmg', value: 0 }); // 初始化默认值
        });

        queryInShadow<HTMLButtonElement>(root, '#remove-skill').addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('remove-skill', { detail: { skillId: this.skillId } }));
            this.remove();
        });
    }

    public setValues(data: Partial<SkillData>): void {
        const root = this.shadowRoot;
        if (!root) return;

        if (data.skillName) queryInShadow<HTMLInputElement>(root, '.skill-name').value = data.skillName;
        if (data.tags) queryInShadow<HTMLInputElement>(root, '.skill-tags').value = data.tags.join(', ');

        const diceList = queryInShadow<HTMLDivElement>(root, '#dice-list');
        diceList.innerHTML = '';
        (data.dice || []).forEach(diceConfig => {
            const diceEl = document.createElement('dice-input') as any;
            diceList.appendChild(diceEl);
            diceEl.setValues(diceConfig);
        });

        const effectList = queryInShadow<HTMLDivElement>(root, '#skill-effect-list');
        effectList.innerHTML = '';
        (data.skillEffects || []).forEach(effectConfig => {
            const effectEl = document.createElement('skill-effect-input') as any;
            effectList.appendChild(effectEl);
            effectEl.setValues(effectConfig);
        });
    }

    public getData(): SkillData {
        const root = this.shadowRoot;
        if (!root) return { skillId: this.skillId, skillName: '', tags: [], dice: [], skillEffects: [] };

        const diceElements = Array.from(root.querySelectorAll('dice-input')) as any[];
        const effectElements = Array.from(root.querySelectorAll('skill-effect-input')) as any[];

        return {
            skillId: this.skillId,
            skillName: queryInShadow<HTMLInputElement>(root, '.skill-name').value,
            tags: queryInShadow<HTMLInputElement>(root, '.skill-tags').value.split(',').map(s => s.trim()).filter(Boolean),
            dice: diceElements.map(el => el.getData()),
            skillEffects: effectElements.map(el => el.getData()),
        };
    }
}

customElements.define('skill-editor', SkillEditor);