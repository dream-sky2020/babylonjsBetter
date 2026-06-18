import { SKILL_EFFECTS, TRIGGER_TIMINGS, STATUS_TYPES } from './skill-effect-config.js';

class SkillEffectInput extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.render();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                .effect-row { display: flex; gap: 6px; margin: 5px 0; align-items: center; padding: 5px; border-bottom: 1px solid #eee; }
                select, input { padding: 4px; border: 1px solid #ccc; border-radius: 4px; }
                .hidden { display: none !important; }
            </style>
            <div class="effect-row">
                <select class="timing-select">
                    ${TRIGGER_TIMINGS.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
                </select>
                <select class="type-select">
                    ${SKILL_EFFECTS.map(e => `<option value="${e.value}">${e.label}</option>`).join('')}
                </select>
                
                <input type="number" class="val-input" placeholder="数值" style="width:60px">
                <select class="status-select hidden">
                    ${STATUS_TYPES.map(s => `<option value="${s.id}">${s.label}</option>`).join('')}
                </select>
                <input type="number" class="power-input hidden" placeholder="强度" style="width:50px">
                <input type="number" class="stack-input hidden" placeholder="层数" style="width:50px">

                <button class="del-btn">×</button>
            </div>
        `;

        const typeSelect = this.shadowRoot.querySelector('.type-select');
        typeSelect.addEventListener('change', () => this.updateFields());
        this.shadowRoot.querySelector('.del-btn').onclick = () => this.remove();
        
        this.updateFields();
    }

    updateFields() {
        const type = this.shadowRoot.querySelector('.type-select').value;
        const valInput = this.shadowRoot.querySelector('.val-input');
        const statusSelect = this.shadowRoot.querySelector('.status-select');
        const powerInput = this.shadowRoot.querySelector('.power-input');
        const stackInput = this.shadowRoot.querySelector('.stack-input');

        // 重置显示
        [valInput, statusSelect, powerInput, stackInput].forEach(el => el.classList.add('hidden'));

        if (type === 'applyStatus') {
            statusSelect.classList.remove('hidden');
            powerInput.classList.remove('hidden');
            stackInput.classList.remove('hidden');
        } else {
            valInput.classList.remove('hidden');
        }
    }

    getData() {
        const type = this.shadowRoot.querySelector('.type-select').value;
        const base = {
            timing: this.shadowRoot.querySelector('.timing-select').value,
            type: type
        };

        if (type === 'applyStatus') {
            return { ...base, 
                statusId: this.shadowRoot.querySelector('.status-select').value,
                power: parseInt(this.shadowRoot.querySelector('.power-input').value) || 0,
                stack: parseInt(this.shadowRoot.querySelector('.stack-input').value) || 0
            };
        } else {
            return { ...base, value: parseInt(this.shadowRoot.querySelector('.val-input').value) || 0 };
        }
    }
    // 在 SkillEffectInput 类中添加此方法
    setValues(data) {
        if (!data) return;

        // 1. 设置触发时机
        if (data.timing) {
            this.shadowRoot.querySelector('.timing-select').value = data.timing;
        }

        // 2. 设置效果类型并刷新 UI 字段显示状态
        if (data.type) {
            this.shadowRoot.querySelector('.type-select').value = data.type;
            this.updateFields(); 
        }

        // 3. 根据类型填入具体的数值
        if (data.type === 'applyStatus') {
            if (data.statusId) this.shadowRoot.querySelector('.status-select').value = data.statusId;
            if (data.power !== undefined) this.shadowRoot.querySelector('.power-input').value = data.power;
            if (data.stack !== undefined) this.shadowRoot.querySelector('.stack-input').value = data.stack;
        } else {
            // 处理 'dmg' (追加伤害) 或 'heal' (恢复生命)
            if (data.value !== undefined) this.shadowRoot.querySelector('.val-input').value = data.value;
        }
    }
}
customElements.define('skill-effect-input', SkillEffectInput);