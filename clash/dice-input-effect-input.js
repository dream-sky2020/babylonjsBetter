// effect-input.js
import { DICE_EFFECTS, STATUS_TYPES } from './dice-effect-config.js';

class EffectInput extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.render();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                .effect-row { 
                    display: flex; 
                    gap: 5px; 
                    margin: 4px 0; 
                    align-items: center; 
                    font-size: 12px; 
                    flex-wrap: wrap; /* 防止缩窄时溢出 */
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
                    ${DICE_EFFECTS.map(e => `<option value="${e.value}" data-type="${e.type}">${e.label}</option>`).join('')}
                </select>

                <select class="status-select hidden">
                    ${STATUS_TYPES.map(s => `<option value="${s.id}">${s.label}</option>`).join('')}
                </select>
                <input type="number" class="power-input hidden" placeholder="强度" style="width:50px">
                <input type="number" class="stack-input hidden" placeholder="层数" style="width:50px">

                <input type="number" class="val-input" placeholder="数值" style="width:50px">

                <button class="del-btn">×</button>
            </div>
        `;

        // 绑定删除事件
        this.shadowRoot.querySelector('.del-btn').onclick = () => this.remove();

        // 绑定动作切换事件
        const typeSelect = this.shadowRoot.querySelector('.type-select');
        typeSelect.addEventListener('change', () => this.updateUI());

        // 初始化UI显示状态
        this.updateUI();
    }

    // 根据选中的动作类型，动态切换后面的输入框
    updateUI() {
        const typeSelect = this.shadowRoot.querySelector('.type-select');
        const selectedOption = typeSelect.options[typeSelect.selectedIndex];
        const effectType = selectedOption.dataset.type;

        const statusSelect = this.shadowRoot.querySelector('.status-select');
        const powerInput = this.shadowRoot.querySelector('.power-input');
        const stackInput = this.shadowRoot.querySelector('.stack-input');
        const valInput = this.shadowRoot.querySelector('.val-input');

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

    // 暴露给外部的回显方法 (如果需要编辑已有数据)
    setValues(data) {
        if (!data) return;
        const typeSelect = this.shadowRoot.querySelector('.type-select');
        typeSelect.value = data.type || DICE_EFFECTS[0].value;
        this.updateUI(); // 触发UI刷新

        const effectType = typeSelect.options[typeSelect.selectedIndex].dataset.type;
        if (effectType === 'status') {
            this.shadowRoot.querySelector('.status-select').value = data.statusId || STATUS_TYPES[0].id;
            this.shadowRoot.querySelector('.power-input').value = data.power || '';
            this.shadowRoot.querySelector('.stack-input').value = data.stack || '';
        } else {
            this.shadowRoot.querySelector('.val-input').value = data.value || '';
        }
    }

    getData() {
        const typeSelect = this.shadowRoot.querySelector('.type-select');
        const selectedOption = typeSelect.options[typeSelect.selectedIndex];
        const effectType = selectedOption.dataset.type;
        const baseType = typeSelect.value;

        if (effectType === 'status') {
            return {
                type: baseType,
                statusId: this.shadowRoot.querySelector('.status-select').value,
                power: parseInt(this.shadowRoot.querySelector('.power-input').value) || 0,
                stack: parseInt(this.shadowRoot.querySelector('.stack-input').value) || 0
            };
        } else {
            return {
                type: baseType,
                value: parseInt(this.shadowRoot.querySelector('.val-input').value) || 0
            };
        }
    }
}
customElements.define('effect-input', EffectInput);